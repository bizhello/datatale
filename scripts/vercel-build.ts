import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type BuildEnvironment = {
  VERCEL_ENV: string | undefined;
  VERCEL_GIT_COMMIT_REF: string | undefined;
};

export type RunPackageScript = (script: string) => Promise<void>;

async function runPackageScript(script: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["run", script], {
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          signal
            ? `bun run ${script} exited on signal ${signal}`
            : `bun run ${script} exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}

export async function runVercelBuild(
  environment: BuildEnvironment = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  },
  run: RunPackageScript = runPackageScript,
): Promise<void> {
  const isProductionMain =
    environment.VERCEL_ENV === "production" &&
    environment.VERCEL_GIT_COMMIT_REF === "main";

  if (isProductionMain) {
    await run("db:migrate");
  }

  await run("build");
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runVercelBuild().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Vercel build failed",
    );
    process.exitCode = 1;
  });
}
