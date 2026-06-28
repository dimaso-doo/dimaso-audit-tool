import dns from "node:dns/promises";
import net from "node:net";

const DEFAULT_TIMEOUT_MS = Number(process.env.AUDIT_REQUEST_TIMEOUT_MS ?? 10000);
const DEFAULT_MAX_REDIRECTS = Number(process.env.AUDIT_MAX_REDIRECTS ?? 5);

export class UrlSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlSafetyError";
  }
}

export function normalizeInputUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) {
    throw new UrlSafetyError("URL is required.");
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new UrlSafetyError("Enter a valid public URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UrlSafetyError("Only http and https URLs are allowed.");
  }

  url.hash = "";
  if (!url.pathname) {
    url.pathname = "/";
  }

  return url;
}

export function isPrivateIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;

  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 88) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  const lower = address.toLowerCase();
  if (lower === "::1" || lower === "::" || lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIp(mapped[1]) : false;
}

export async function assertPublicUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UrlSafetyError("Only http and https URLs are allowed.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UrlSafetyError("Localhost URLs are blocked.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UrlSafetyError("Private or internal IP ranges are blocked.");
    }
    return;
  }

  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: false });
  } catch {
    throw new UrlSafetyError("Could not resolve the target hostname.");
  }

  if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
    throw new UrlSafetyError("Private or internal hostnames are blocked.");
  }
}

export interface SafeFetchResult {
  response: Response;
  finalUrl: string;
}

export async function safeFetch(
  inputUrl: URL,
  init: RequestInit = {},
  maxRedirects = DEFAULT_MAX_REDIRECTS
): Promise<SafeFetchResult> {
  let current = new URL(inputUrl.toString());

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    await assertPublicUrl(current);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(current, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "DimasoAuditTool/0.1 (+https://dimaso.example)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(init.headers ?? {})
        }
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return { response, finalUrl: current.toString() };
        }
        current = new URL(location, current);
        continue;
      }

      return { response, finalUrl: current.toString() };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new UrlSafetyError("Request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new UrlSafetyError("Too many redirects.");
}
