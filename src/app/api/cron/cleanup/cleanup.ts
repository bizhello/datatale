export async function cleanupExpiredData(
  cleanupRuns: () => Promise<number>,
  cleanupAnalyses: () => Promise<number>,
) {
  const [runs, analyses] = await Promise.all([
    cleanupRuns(),
    cleanupAnalyses(),
  ]);
  return runs + analyses;
}
