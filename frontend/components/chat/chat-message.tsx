"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { SqlReveal } from "./sql-reveal"
import { ResultTable } from "./result-table"
import { ResultChart } from "./result-chart"
import { AlertCircle, BarChart3, Bot, Code2, Table as TableIcon, User } from "lucide-react"

export interface Message {
  role: "user" | "assistant"
  content: string
  sql?: string
  columns?: string[]
  rows?: unknown[][]
  row_count?: number
  analysis?: string
  chart_hint?: { type?: "bar" | "line" | "pie" | "none"; x_column?: string; y_column?: string } | null
  error?: string | null
}

interface ChatMessageProps {
  message: Message
}

type View = "chart" | "table" | "sql"

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const hasData = !!message.columns?.length && !!message.rows?.length
  const hasChart = hasData
  const [view, setView] = useState<View>(hasData ? "chart" : "table")

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("max-w-[85%] space-y-2", isUser && "items-end flex flex-col")}>
        <div
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-foreground border border-border/40"
          )}
        >
          {message.content}
        </div>

        {message.error && (
          <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{message.error}</span>
          </div>
        )}

        {!isUser && hasData && (
          <div className="w-full space-y-2">
            {message.analysis && (
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                {message.analysis}
              </p>
            )}

            <div className="flex items-center gap-2">
              {hasChart && (
                <ViewToggle
                  active={view === "chart"}
                  onClick={() => setView("chart")}
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  label="Gráfico"
                />
              )}
              <ViewToggle
                active={view === "table"}
                onClick={() => setView("table")}
                icon={<TableIcon className="h-3.5 w-3.5" />}
                label="Tabela"
              />
              {message.sql && (
                <ViewToggle
                  active={view === "sql"}
                  onClick={() => setView("sql")}
                  icon={<Code2 className="h-3.5 w-3.5" />}
                  label="SQL"
                />
              )}
            </div>

            {view === "chart" && hasChart && (
              <ResultChart
                columns={message.columns!}
                rows={message.rows ?? []}
                hint={message.chart_hint ?? { type: "bar" }}
              />
            )}
            {view === "table" && (
              <ResultTable columns={message.columns!} rows={message.rows ?? []} />
            )}
            {view === "sql" && message.sql && <SqlReveal sql={message.sql} />}
          </div>
        )}

        {!isUser && !hasData && message.sql && <SqlReveal sql={message.sql} />}
      </div>
    </div>
  )
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "text-white"
          : "border border-[var(--line-2)] bg-white text-[var(--ink)] hover:bg-[#f5f5f5]"
      )}
      style={active ? { background: "var(--orange)" } : undefined}
    >
      {icon}
      {label}
    </button>
  )
}
