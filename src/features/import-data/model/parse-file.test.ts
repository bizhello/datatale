import { afterEach, describe, expect, it, vi } from "vitest";

type Listener = ((event: MessageEvent) => void) | null;
class ControlledWorker {
  static instances: ControlledWorker[] = [];
  onmessage: Listener = null;
  onerror: ((event: Event) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();
  constructor() {
    ControlledWorker.instances.push(this);
  }
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
  fail() {
    this.onerror?.(new Event("error"));
  }
}

async function controller() {
  vi.resetModules();
  ControlledWorker.instances = [];
  vi.stubGlobal("Worker", ControlledWorker);
  return import("./parse-file");
}
const file = new File(["A\n1"], "report.csv", { type: "text/csv" });
const success = {
  kind: "success" as const,
  result: {
    source: {
      version: 1,
      id: "text",
      source: { kind: "text" as const },
      rawText: "x",
      paragraphs: [{ index: 1, text: "x" }],
    },
    warnings: [],
  },
};

describe("parseFileInWorker lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("ignores stale IDs and settles the matching response", async () => {
    const { parseFileInWorker } = await controller();
    const job = parseFileInWorker(file);
    const worker = ControlledWorker.instances[0]!;
    worker.emit({ id: 999, ...success });
    expect(worker.terminate).not.toHaveBeenCalled();
    const id = worker.postMessage.mock.calls[0]?.[0].id as number;
    worker.emit({ id, ...success });
    await expect(job.promise).resolves.toEqual(success.result);
  });
  it("cancels a pending worker with AbortError and clears its timeout", async () => {
    vi.useFakeTimers();
    const { parseFileInWorker } = await controller();
    const job = parseFileInWorker(file);
    const worker = ControlledWorker.instances[0]!;
    job.cancel();
    await expect(job.promise).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(15_001);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("times out after fifteen seconds and terminates", async () => {
    vi.useFakeTimers();
    const { parseFileInWorker } = await controller();
    const job = parseFileInWorker(file);
    const worker = ControlledWorker.instances[0]!;
    const pending = expect(job.promise).rejects.toThrow(/15 секунд/);
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("keeps a workbook worker alive after a recoverable error and selects a sheet", async () => {
    const { parseFileInWorker } = await controller();
    const job = parseFileInWorker(file);
    const worker = ControlledWorker.instances[0]!;
    const firstId = worker.postMessage.mock.calls[0]?.[0].id as number;
    worker.emit({
      id: firstId,
      kind: "error",
      error: {
        message: "Пустой лист",
        code: "empty-data",
        sheetNames: ["Продажи"],
      },
    });
    await expect(job.promise).rejects.toMatchObject({
      code: "empty-data",
      sheetNames: ["Продажи"],
    });
    const selected = job.selectSheet("Продажи");
    expect(worker.terminate).not.toHaveBeenCalled();
    const secondId = worker.postMessage.mock.calls[1]?.[0].id as number;
    worker.emit({ id: secondId, ...success });
    await expect(selected).resolves.toEqual(success.result);
  });
  it("maps worker.onerror to an actionable rejection", async () => {
    const { parseFileInWorker } = await controller();
    const job = parseFileInWorker(file);
    const worker = ControlledWorker.instances[0]!;
    worker.fail();
    await expect(job.promise).rejects.toThrow(/завершился с ошибкой/);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
