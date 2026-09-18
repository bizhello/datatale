import type { ImportResult } from "./types";

export type WorkerRequest = { id: number; file: File; selectedSheet?: string };
export type WorkerResponse =
  | { id: number; kind: "success"; result: ImportResult }
  | {
      id: number;
      kind: "error";
      error: { message: string; code: string; sheetNames?: string[] };
    };
