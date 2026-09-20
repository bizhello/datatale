import type { FinalReport } from "@/entities/report";

export class FinalReportValidationError extends Error {}

/** Verifies links at the boundary where checked facts become displayable report data. */
export function validateFinalReportReferences(
  report: FinalReport,
): FinalReport {
  const evidenceIds = new Set(report.evidence.map((item) => item.id));
  const factIds = new Set(report.metrics.map((item) => item.id));
  const observationIds = new Set(
    (report.observations ?? []).map((item) => item.id),
  );
  const requireEvidence = (ids: string[], owner: string) => {
    if (ids.some((id) => !evidenceIds.has(id)))
      throw new FinalReportValidationError(
        `${owner} references unknown evidence.`,
      );
  };
  for (const fact of report.metrics)
    requireEvidence(fact.evidenceIds, `Fact ${fact.id}`);
  for (const chart of report.charts)
    requireEvidence(chart.evidenceIds, `Chart ${chart.id}`);
  for (const chart of report.charts)
    if (chart.observationIds?.some((id) => !observationIds.has(id)))
      throw new FinalReportValidationError(
        `Chart ${chart.id} references an unknown observation.`,
      );
  for (const item of [...report.hero, ...report.recommendations]) {
    requireEvidence(item.evidenceIds, "Narrative");
    if (item.factIds.some((id) => !factIds.has(id)))
      throw new FinalReportValidationError(
        "Narrative references an unknown checked fact.",
      );
    if (item.kind === "hypothesis" && item.factIds.length === 0)
      throw new FinalReportValidationError(
        "Hypotheses require checked supporting facts.",
      );
  }
  return report;
}
