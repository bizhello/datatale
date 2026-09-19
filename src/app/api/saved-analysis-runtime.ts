import "server-only";

import { chatResultSchema } from "@/entities/chat";
import { datasetSchema, textSourceSchema } from "@/entities/dataset";
import { finalReportSchema } from "@/entities/report";
import { SqlSavedAnalysisRepository } from "@/entities/saved-analysis/server";

export const savedAnalysisRepository = new SqlSavedAnalysisRepository({
  source: {
    parse(input) {
      const dataset = datasetSchema.safeParse(input);
      if (dataset.success) return dataset.data;
      return textSourceSchema.parse(input);
    },
  },
  report: finalReportSchema,
  messageResult: chatResultSchema,
});
