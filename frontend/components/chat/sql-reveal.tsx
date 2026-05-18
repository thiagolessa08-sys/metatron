"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Code2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SqlRevealProps {
  sql: string
}

export function SqlReveal({ sql }: SqlRevealProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2 rounded-md border border-border/50 bg-muted/30 text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Code2 className="h-3 w-3" />
        <span>SQL gerado</span>
        {open ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>
      {open && (
        <pre className={cn("px-3 pb-3 overflow-x-auto text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all")}>
          {sql}
        </pre>
      )}
    </div>
  )
}
