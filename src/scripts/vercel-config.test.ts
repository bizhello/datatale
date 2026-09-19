import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runVercelBuild } from "../../scripts/vercel-build";

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
      "bun scripts/vercel-build.ts",
    );
    expect(vercel.ignoreCommand).toBe(
      'if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi',
    );
  });

  it("migrates before a production build from main", async () => {
    const calls: string[] = [];

    await runVercelBuild(
      { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" },
      async (script) => {
        calls.push(script);
      },
    );

    expect(calls).toEqual(["db:migrate", "build"]);
  });

  it("stops the production build when migration fails", async () => {
    const calls: string[] = [];

    await expect(
      runVercelBuild(
        { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" },
        async (script) => {
          calls.push(script);
          if (script === "db:migrate") {
            throw new Error("migration failed");
          }
        },
      ),
    ).rejects.toThrow("migration failed");

    expect(calls).toEqual(["db:migrate"]);
  });

  it.each([
    ["preview", "main"],
    ["production", "feat/example"],
    [undefined, "main"],
    ["production", undefined],
  ])(
    "does not migrate when VERCEL_ENV=%s and VERCEL_GIT_COMMIT_REF=%s",
    async (vercelEnvironment, gitReference) => {
      const calls: string[] = [];

      await runVercelBuild(
        {
          VERCEL_ENV: vercelEnvironment,
          VERCEL_GIT_COMMIT_REF: gitReference,
        },
        async (script) => {
          calls.push(script);
        },
      );

      expect(calls).toEqual(["build"]);
    },
  );
});
