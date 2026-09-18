import { inputLimits } from "@/shared/config/input-limits";
import type { ImportResult } from "./types";

type WorkerResponse =
  | { id: number; kind: "success"; result: ImportResult }
  | { id: number; kind: "error"; error: { message: string; code: string } };

export function parseFileInWorker(file: File, selectedSheet?: string) {
  const worker = new Worker(new URL("./worker.ts", import.meta.url));
  const id = Date.now();
  const promise = new Promise<ImportResult>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          "Обработка файла заняла больше 15 секунд. Попробуйте файл меньшего размера.",
        ),
      );
    }, inputLimits.workerTimeoutMs);
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.id === id) {
        clearTimeout(timeout);
        worker.terminate();
        data.kind === "success"
          ? resolve(data.result)
          : reject(new Error(data.error.message));
      }
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error("Рабочий процесс обработки завершился с ошибкой."));
    };
    worker.postMessage({ id, file, selectedSheet });
  });
  return { promise, cancel: () => worker.terminate() };
}
