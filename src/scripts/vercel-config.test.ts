import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

type VercelConfig = {
  buildCommand?: string;
  ignoreCommand?: string;
};

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("Vercel deployment configuration", () => {
  it("migrates before building production from main", async () => {
    const [manifest, vercel] = await Promise.all([
      readJson<PackageManifest>("package.json"),
      readJson<VercelConfig>("vercel.json"),
    ]);

    expect(vercel.buildCommand).toBe("bun run build:vercel");
    expect(manifest.scripts?.["build:vercel"]).toBe(
      "bun run db:migrate && bun run build",
    );
    expect(vercel.ignoreCommand).toBe(
      'if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi',
    );
  });
});
