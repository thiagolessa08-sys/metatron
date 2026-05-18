"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatMessage, type Message } from "@/components/chat/chat-message"
import api from "@/lib/api"

const SUGGESTIONS = [
  "Quantas ligações por operador hoje?",
  "Qual campanha tem maior aproveitamento?",
  "Quais as qualificações mais comuns esta semana?",
  "Qual operador teve mais conversões no mês?",
  "Quantas ligações foram feitas por hora ontem?",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const send = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return

      const userMsg: Message = { role: "user", content: question.trim() }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setLoading(true)

      // Histórico para contexto (exclui a mensagem que acabamos de adicionar)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.role === "user" ? m.content : m.analysis || m.content,
      }))

      try {
        const { data } = await api.post("/api/chat/ask", {
          question: question.trim(),
          history,
        })

        const assistantMsg: Message = {
          role: "assistant",
          content: data.error
            ? "Não consegui responder sua pergunta."
            : data.analysis || `Consulta retornou ${data.row_count} linha(s).`,
          sql: data.sql,
          columns: data.columns,
          rows: data.rows,
          row_count: data.row_count,
          analysis: data.analysis,
          chart_hint: data.chart_hint,
          error: data.error,
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err: unknown) {
        const detail =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : undefined
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Ocorreu um erro ao processar sua pergunta.",
            error: detail ?? "Erro de comunicação com o servidor.",
          },
        ])
      } finally {
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    },
    [messages, loading]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[22px] bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[var(--orange)]" />
          <div>
            <h1 className="text-base font-semibold leading-tight">Chat Analítico</h1>
            <p className="text-xs text-muted-foreground">Faça perguntas sobre os dados em português natural</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            className="text-muted-foreground gap-1.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Mensagens */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Olá! Sou seu analista de dados.</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Faça perguntas sobre ligações, operadores, campanhas e qualificações.
                Vou traduzir para SQL e trazer os resultados com análise.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
        )}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <div className="rounded-xl bg-muted/60 border border-border/40 px-4 py-2.5 text-sm text-muted-foreground">
              Analisando e consultando dados…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--line)] px-4 md:px-8 py-4">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Quantas ligações por operador hoje?"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 min-h-[42px] max-h-32"
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = "auto"
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`
            }}
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-10 w-10 rounded-xl shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  )
}
