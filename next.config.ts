import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Importa solo los iconos usados, no el paquete entero (~3000 módulos).
  experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
}

export default nextConfig
