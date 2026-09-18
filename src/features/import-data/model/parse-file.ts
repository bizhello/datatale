import { inputLimits } from "@/shared/config";
import type { ImportResult } from "./types";

type WorkerResponse =
  | { id: number; kind: "success"; result: ImportResult }
  | { id: number; kind: "error"; error: { message: string; code: string } };

export function parseFileInWorker(file: File, initialSheet?: string) {
  const worker = new Worker(new URL("./worker.ts", import.meta.url));
  let activeId = 0;
  let active = false;
  let timer: number | undefined;
  let rejectActive: ((reason: Error) => void) | undefined;
  const clear = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    active = false;
  };
  const request = (selectedSheet?: string) =>
    new Promise<ImportResult>((resolve, reject) => {
      if (active) {
        reject(new Error("Обработка уже выполняется."));
        return;
      }
      active = true;
      rejectActive = reject;
      activeId += 1;
      const id = activeId;
      timer = window.setTimeout(() => {
        worker.terminate();
        clear();
        reject(
          new Error(
            "Обработка файла заняла больше 15 секунд. Попробуйте файл меньшего размера.",
          ),
        );
      }, inputLimits.workerTimeoutMs);
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.id !== id || !active) return;
        clear();
        data.kind === "success"
          ? resolve(data.result)
          : reject(new Error(data.error.message));
      };
      worker.onerror = () => {
        if (active) {
          clear();
          worker.terminate();
          reject(new Error("Рабочий процесс обработки завершился с ошибкой."));
        }
      };
      worker.postMessage({ id, file, selectedSheet });
    });
  const promise = request(initialSheet);
  return {
    promise,
    selectSheet: (name: string) =>
      name ? request(name) : Promise.reject(new Error("Выберите лист.")),
    cancel: () => {
      if (active)
        rejectActive?.(new DOMException("Импорт отменён.", "AbortError"));
      clear();
      worker.terminate();
    },
  };
}
