/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = process.env.PORT ?? "3000";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
