import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Import owns parsing/lifecycle invariants even with one dashboard consumer.
    // Keep this feature boundary; only the usage-count heuristic is disabled.
    files: ["./src/features/import-data", "./src/features/import-data/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // Contract, server calculation, and renderer use this entity through its
    // public API; the current plugin does not count these internal consumers.
    files: ["./src/entities/report", "./src/entities/report/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // The analysis feature owns both server orchestration and the report UI;
    // the widget only composes its public client entry point.
    files: ["./src/features/analyze-data", "./src/features/analyze-data/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // Query Report owns grounded chat UI, transport, and server orchestration.
    // Keep this cohesive feature boundary despite its single widget composer.
    files: ["./src/features/query-report", "./src/features/query-report/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // Workspace Unlock owns the shared analysis/chat access-code lifecycle;
    // it is intentionally composed once by the dashboard shell.
    files: [
      "./src/features/unlock-workspace",
      "./src/features/unlock-workspace/**",
    ],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // Onboarding owns the versioned UI preference and tour lifecycle; it is
    // intentionally mounted once by the dashboard shell.
    files: ["./src/features/onboarding", "./src/features/onboarding/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
]);
