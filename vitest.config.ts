import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const alias = {
  "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
  "@client": fileURLToPath(new URL("./src/client", import.meta.url)),
  "@worker": fileURLToPath(new URL("./src/worker", import.meta.url)),
  "@content": fileURLToPath(new URL("./content", import.meta.url)),
};

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    fileURLToPath(new URL("./migrations", import.meta.url)),
  );
  return {
    resolve: { alias },
    test: {
      projects: [
        {
          resolve: { alias },
          test: {
            name: "node",
            environment: "node",
            include: ["src/shared/**/*.test.ts", "src/client/**/*.test.ts", "scripts/**/*.test.ts"],
          },
        },
        {
          resolve: { alias },
          plugins: [
            cloudflareTest({
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: { bindings: { TEST_MIGRATIONS: migrations, ADMIN_DEV_BYPASS: "0" } },
            }),
          ],
          test: {
            name: "worker",
            include: ["src/worker/**/*.test.ts"],
            setupFiles: ["./src/worker/test-setup.ts"],
          },
        },
      ],
    },
  };
});
