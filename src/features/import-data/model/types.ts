import type { Dataset, TextSource } from "@/entities/dataset";

export type ImportSource = Dataset | TextSource;
export type ImportWarning = { code: string; message: string };
export type ParsedTable = {
  headers: string[];
  rows: unknown[][];
  sourceRowOffset?: number;
  sourceRowNumbers?: number[];
};
export type ImportResult = {
  source: ImportSource;
  warnings: ImportWarning[];
  sheetNames?: string[];
};

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sheetNames?: string[],
  ) {
    super(message);
    this.name = "ImportError";
  }
}
