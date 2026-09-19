import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ["**/.gitkeep"] },
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
]);
