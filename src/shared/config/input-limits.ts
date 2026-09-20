export const inputLimits = {
  fileBytes: 2 * 1024 * 1024,
  canonicalSourceBytes: 2 * 1024 * 1024,
  rows: 5_000,
  columns: 30,
  textCharacters: 30_000,
  zipInflatedBytes: 16 * 1024 * 1024,
  zipEntries: 256,
  physicalCells: 150_030,
  xlsxSparseRows: 10_001,
  xlsxSparseColumns: 60,
  workerTimeoutMs: 15_000,
  previewRows: 12,
} as const;
