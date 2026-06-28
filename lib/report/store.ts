type StoredReport = {
  bytes: Uint8Array;
  filename: string;
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000;
const globalStore = globalThis as typeof globalThis & {
  __dimasoReportStore?: Map<string, StoredReport>;
};

const store = globalStore.__dimasoReportStore ?? new Map<string, StoredReport>();
globalStore.__dimasoReportStore = store;

function cleanup() {
  const now = Date.now();
  for (const [id, report] of store.entries()) {
    if (report.expiresAt < now) {
      store.delete(id);
    }
  }
}

export function saveReport(bytes: Uint8Array, filename: string) {
  cleanup();
  const id = crypto.randomUUID();
  store.set(id, { bytes, filename, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getReport(id: string) {
  cleanup();
  return store.get(id);
}
