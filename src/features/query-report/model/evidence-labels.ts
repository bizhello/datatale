export function evidenceLabels(count: number) {
  return Array.from({ length: count }, (_, index) => `Источник ${index + 1}`);
}
