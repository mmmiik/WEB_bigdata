// MapLibre 6 busca su worker junto a su propio archivo, que deja de existir al
// empaquetarlo con Next. Lo copiamos a public/ y el mapa lo carga desde ahí.
import { copyFileSync, mkdirSync } from "node:fs"

mkdirSync("public", { recursive: true })
copyFileSync(
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  "public/maplibre-gl-worker.mjs"
)
