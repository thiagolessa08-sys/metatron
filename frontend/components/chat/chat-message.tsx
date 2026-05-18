"use client"

import { cn } from "@/lib/utils"
import { SqlReveal } from "./sql-reveal"
import { ResultTable } from "./result-table"
import { ResultChart } from "./result-chart"
import { AlertCircle, Bot, User } from "lucide-react"

export interface Message {
  role: "user" | "assistant"
  content: string
  sql?: string
  columns?: string[]
  rows?: unknown[][]
  row_count?: number
  analysis?: string
  chart_hint?: { type: "bar" | "line" | "pie" | "none"; x_column?: string; y_column?: string } | null
  error?: string | null
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Balão */}
      <div className={cn("max-w-[85%] space-y-1", isUser && "items-end flex flex-col")}>
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

        {/* Erro */}
        {message.error && (
          <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{message.error}</span>
          </div>
        )}

        {/* Análise + resultados (apenas mensagens do assistente com dados) */}
        {!isUser && message.columns && message.columns.length > 0 && (
          <div className="w-full space-y-1">
            {message.analysis && (
              <p className="text-xs text-muted-foreground leading-relaxed px-1">{message.analysis}</p>
            )}
            {message.chart_hint && message.chart_hint.type !== "none" && (
              <ResultChart
                columns={message.columns}
                rows={message.rows ?? []}
                hint={message.chart_hint}
              />
            )}
            <ResultTable columns={message.columns} rows={message.rows ?? []} />
            {message.sql && <SqlReveal sql={message.sql} />}
          </div>
        )}

        {/* SQL sem dados (erro de execução mas SQL existe) */}
        {!isUser && !message.columns?.length && message.sql && (
          <SqlReveal sql={message.sql} />
        )}
      </div>
    </div>
  )
}
