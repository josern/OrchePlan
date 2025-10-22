"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

// Simple client-only wrapper that forwards props to next-themes ThemeProvider.
// Keep this file marked as a client component so the app layout (a server
// component) can import it safely as a client reference.
export default function ThemeProviderClient(props: ThemeProviderProps) {
  return <NextThemesProvider {...props} />
}
