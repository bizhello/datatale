export function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function isAbort(reason: unknown) {
  return reason instanceof DOMException && reason.name === "AbortError";
}
