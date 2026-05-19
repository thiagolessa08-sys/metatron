"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

interface SqlRevealProps {
  sql: string
}

export function SqlReveal({ sql }: SqlRevealProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="mt-3 overflow-hidden rounded-[14px] border border-[var(--line-2)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between bg-[#1e1e2e] px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#cdd6f4]/70">
          SQL gerado
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#cdd6f4] transition-colors hover:bg-white/20"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copiar
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#1e1e2e] px-4 pb-4 pt-1 font-mono text-[12.5px] leading-relaxed text-[#cdd6f4] whitespace-pre-wrap">
        {sql}
      </pre>
    </div>
  )
}
