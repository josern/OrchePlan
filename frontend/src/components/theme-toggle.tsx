'use client'

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-[180px] h-10 rounded-md border border-input bg-background" />
    )
  }

  return (
    <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="light">
                <div className="flex items-center">
                    <Sun className="mr-2 h-4 w-4" />
                    <span>Light</span>
                </div>
            </SelectItem>
            <SelectItem value="dark">
                <div className="flex items-center">
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Dark</span>
                </div>
            </SelectItem>
            <SelectItem value="system">
                <div className="flex items-center">
                    <Laptop className="mr-2 h-4 w-4" />
                    <span>System</span>
                </div>
            </SelectItem>
        </SelectContent>
    </Select>
  )
}
