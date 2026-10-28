"use client"

import { MoonIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function BotonTema() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Cambiar entre modo claro y oscuro (tecla D)"
      title="Modo claro / oscuro (D)"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Los dos iconos se pintan y el CSS elige: no depende del tema en el servidor. */}
      <MoonIcon weight="fill" className="dark:hidden" />
      <SunIcon weight="fill" className="hidden dark:block" />
    </Button>
  )
}
