import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Pruebas contra servicios reales (requieren red). No forman parte de `npm test`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: { include: ["tests/integracion/**/*.test.ts"] },
})
