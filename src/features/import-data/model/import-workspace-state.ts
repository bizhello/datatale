import type { parseFileInWorker } from "./parse-file";
import type { ImportResult } from "./types";

export type ParserController = ReturnType<typeof parseFileInWorker>;

export type ReadyState = {
  status: "ready";
  text: string;
  file?: File;
  result: ImportResult;
  selectedSheet?: string | undefined;
  isDemo?: boolean;
};

export type ImportState =
  | { status: "empty"; text: string }
  | {
      status: "loading";
      text: string;
      file: File;
      requestId: number;
      selectingSheet?: string | undefined;
    }
  | ReadyState
  | {
      status: "error";
      text: string;
      file?: File;
      message: string;
      sheetNames?: string[] | undefined;
    };

export type ImportAction =
  | { type: "text"; text: string }
  | {
      type: "start";
      file: File;
      requestId: number;
      selectingSheet?: string | undefined;
    }
  | { type: "ready"; requestId?: number; state: ReadyState }
  | {
      type: "error";
      requestId: number;
      message: string;
      sheetNames?: string[] | undefined;
    }
  | { type: "file-error"; file: File; message: string }
  | { type: "local-error"; message: string }
  | { type: "cancel" }
  | { type: "empty" };
