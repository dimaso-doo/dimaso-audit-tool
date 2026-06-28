import { describe, expect, it } from "vitest";
import { isPrivateIp, normalizeInputUrl } from "@/lib/audit/urlSafety";

describe("URL safety", () => {
  it("normalizes URLs without protocols to https", () => {
    expect(normalizeInputUrl("example.com").toString()).toBe("https://example.com/");
  });

  it("blocks unsupported protocols", () => {
    expect(() => normalizeInputUrl("file:///etc/passwd")).toThrow(/Only http and https/);
    expect(() => normalizeInputUrl("ftp://example.com")).toThrow(/Only http and https/);
  });

  it("detects private and internal IP ranges", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("172.16.1.1")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
  });
});
