import { CHAT_ANSWER_MAX_LENGTH, type ChatResult } from "@/entities/chat";
import type { FinalReport } from "@/entities/report";

const summaryIntent =
  /\b(?:main|key)\s+(?:conclusions?|takeaways?|insights?)\b|(?:главн\p{L}*|основн\p{L}*|ключев\p{L}*)\s+(?:вывод\p{L}*|наблюден\p{L}*|инсайт\p{L}*|итог\p{L}*)|подвед\p{L}*\s+итог\p{L}*/iu;

function evidenceReference(report: FinalReport, evidenceId: string) {
  const index = report.evidence.findIndex((item) => item.id === evidenceId);
  const evidence = report.evidence[index];
  if (index < 0 || !evidence) return undefined;
  return {
    id: `evidence-${index}`,
    ...(evidence.excerpt ? { excerpt: evidence.excerpt } : {}),
  };
}

export function checkedReportSummary(
  question: string,
  report: FinalReport,
): ChatResult | undefined {
  if (!summaryIntent.test(question)) return undefined;

  const selectedHero: FinalReport["hero"] = [];
  let answerLength = 0;
  for (const item of report.hero) {
    const nextLength =
      answerLength + (selectedHero.length > 0 ? 1 : 0) + item.text.length;
    if (nextLength > CHAT_ANSWER_MAX_LENGTH) break;
    selectedHero.push(item);
    answerLength = nextLength;
  }

  const references = [
    ...new Set(
      selectedHero.flatMap((item) => [
        ...item.evidenceIds,
        ...item.factIds.flatMap(
          (factId) =>
            report.metrics.find((fact) => fact.id === factId)?.evidenceIds ??
            [],
        ),
      ]),
    ),
  ]
    .flatMap((id) => {
      const reference = evidenceReference(report, id);
      return reference ? [reference] : [];
    })
    .slice(0, 7);

  if (references.length === 0) return undefined;
  return {
    outcome: "answered",
    answer: selectedHero.map((item) => item.text).join(" "),
    references,
  };
}
