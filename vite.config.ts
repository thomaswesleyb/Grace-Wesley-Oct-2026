import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const alias = {
  "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
  "@client": fileURLToPath(new URL("./src/client", import.meta.url)),
  "@worker": fileURLToPath(new URL("./src/worker", import.meta.url)),
  "@content": fileURLToPath(new URL("./content", import.meta.url)),
};

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: { alias },
});
