"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Play, AlertCircle, ChevronDown, Copy, Check, Clock, Rows } from "lucide-react"

const LIMITS = [100, 500, 1000, 5000]

const EXAMPLES = [
  {
    label: "Ligações por operador (hoje)",
    sql: "SELECT operador, COUNT(*) AS total\nFROM metatron.TT_ACIONAMENTOS_METATRON\nWHERE data_correta >= '2026-04-01'\nGROUP BY operador\nORDER BY total DESC",
  },
  {
    label: "Volume diário do mês",
    sql: "SELECT data_correta, COUNT(*) AS total\nFROM metatron.TT_ACIONAMENTOS_METATRON\nWHERE data_correta BETWEEN '2026-03-01' AND '2026-04-01'\nGROUP BY data_correta\nORDER BY data_correta",
  },
  {
    label: "Top qualificações",
    sql: "SELECT descricao, COUNT(*) AS total\nFROM metatron.TT_ACIONAMENTOS_METATRON\nWHERE data_correta BETWEEN '2026-01-01' AND '2026-04-01'\nGROUP BY descricao\nORDER BY total DESC",
  },
  {
    label: "Campanhas ativas",
    sql: "SELECT campanha, total, discados_total, atendidas_hoje, aproveitamento\nFROM metatron.TT_METRICAS_METATRON\nWHERE ativo = '1'\nORDER BY campanha",
  },
]

interface ExecResult {
  columns: string[]
  rows: unknown[][]
  row_count: number
  truncated: boolean
  error?: string | null
  elapsed_ms?: number
}

export default function SqlPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [sql, setSql] = useState(EXAMPLES[0].sql)
  const [limit, setLimit] = useState(500)
  const [result, setResult] = useState<ExecResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const examplesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user && user.role === "consultor") {
      router.replace("/")
    }
  }, [user, router])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (examplesRef.current && !examplesRef.current.contains(e.target as Node)) {
        setShowExamples(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const execute = useCallback(async () => {
    if (!sql.trim() || loading) return
    setLoading(true)
    const t0 = Date.now()
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch("/api/sql/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sql: sql.trim(), limit }),
      })
      const data = await res.json()
      setResult({ ...data, elapsed_ms: Date.now() - t0 })
    } catch (e) {
      setResult({
        columns: [],
        rows: [],
        row_count: 0,
        truncated: false,
        error: String(e),
        elapsed_ms: Date.now() - t0,
      })
    } finally {
      setLoading(false)
    }
  }, [sql, limit, loading])

  // Ctrl+Enter ou Cmd+Enter executa
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        execute()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [execute])

  async function copyResult() {
    if (!result?.rows.length) return
    const header = result.columns.join("\t")
    const rows = result.rows.map((r) => r.join("\t")).join("\n")
    await navigator.clipboard.writeText(`${header}\n${rows}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">SQL Explorer</h1>
        <p className="mt-1 text-sm text-[var(--muted-finexy)]">
          Execute consultas diretamente no Sybase IQ
        </p>
      </div>

      {/* Editor */}
      <div className="rounded-[22px] bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line-2)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {/* Exemplos */}
            <div className="relative" ref={examplesRef}>
              <button
                type="button"
                onClick={() => setShowExamples((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--line-2)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[#f5f5f5]"
              >
                Exemplos
                <ChevronDown className={`h-3 w-3 transition-transform ${showExamples ? "rotate-180" : ""}`} />
              </button>
              {showExamples && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 min-w-[240px] rounded-[14px] bg-white py-1.5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => {
                        setSql(ex.sql)
                        setShowExamples(false)
                        setResult(null)
                        textareaRef.current?.focus()
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[#f5f5f5]"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Limit */}
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line-2)] px-3 py-1.5">
              <Rows className="h-3 w-3 text-[var(--muted-finexy)]" />
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-transparent text-xs font-medium text-[var(--ink)] outline-none"
              >
                {LIMITS.map((l) => (
                  <option key={l} value={l}>
                    {l.toLocaleString("pt-BR")} linhas
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Executar */}
          <button
            type="button"
            onClick={execute}
            disabled={loading || !sql.trim()}
            className="flex items-center gap-2 rounded-[10px] px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--orange)" }}
          >
            <Play className="h-3 w-3 fill-white" />
            {loading ? "Executando…" : "Executar"}
            <span className="ml-0.5 rounded bg-white/20 px-1 py-px font-mono text-[10px]">
              ⌘↵
            </span>
          </button>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            rows={10}
            placeholder="SELECT ..."
            className="w-full resize-none rounded-b-[22px] bg-[#1e1e2e] p-5 font-mono text-sm leading-relaxed text-[#cdd6f4] outline-none placeholder:text-[#585b70]"
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="rounded-[22px] bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Header resultado */}
          <div className="flex items-center justify-between border-b border-[var(--line-2)] px-5 py-3">
            <div className="flex items-center gap-3">
              {result.error ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Erro
                </span>
              ) : (
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {result.row_count.toLocaleString("pt-BR")} linha{result.row_count !== 1 ? "s" : ""}
                  {result.truncated && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      truncado
                    </span>
                  )}
                </span>
              )}
              {result.elapsed_ms !== undefined && (
                <span className="flex items-center gap-1 text-xs text-[var(--muted-finexy)]">
                  <Clock className="h-3 w-3" />
                  {result.elapsed_ms}ms
                </span>
              )}
            </div>
            {!result.error && result.rows.length > 0 && (
              <button
                type="button"
                onClick={copyResult}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted-finexy)] transition-colors hover:bg-[#f5f5f5] hover:text-[var(--ink)]"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado!" : "Copiar TSV"}
              </button>
            )}
          </div>

          {/* Erro */}
          {result.error && (
            <div className="p-5">
              <pre className="rounded-xl bg-red-50 p-4 font-mono text-xs text-red-700 whitespace-pre-wrap">
                {result.error}
              </pre>
            </div>
          )}

          {/* Tabela */}
          {!result.error && result.rows.length === 0 && (
            <div className="p-10 text-center text-sm text-[var(--muted-finexy)]">
              Nenhuma linha retornada.
            </div>
          )}

          {!result.error && result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--line-2)] bg-[#fafafa]">
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-b border-[var(--line-2)] last:border-b-0 hover:bg-[#fafafa]"
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="max-w-[300px] truncate px-4 py-2.5 text-sm tabular-nums text-[var(--ink)]"
                          title={cell == null ? "NULL" : String(cell)}
                        >
                          {cell == null ? (
                            <span className="text-[var(--muted-finexy)] italic">NULL</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
