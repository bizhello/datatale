import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ["**/.gitkeep"] },
  {
    // DT-01a introduces the contract before DT-03/DT-04 provide its consumers.
    // Remove this usage-only exception once both feature slices import Dataset.
    files: ["./src/entities/dataset", "./src/entities/dataset/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // DT-01b introduces the contract before DT-04/DT-07 provide its consumers.
    // Remove this usage-only exception once both planned consumers import the report public API.
    files: ["./src/entities/report", "./src/entities/report/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
]);
