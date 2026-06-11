"use client"
import { useRef, useState, type DragEvent } from "react"
import api from "@/lib/api"
import {
  UploadCloud,
  FileAudio,
  Loader2,
  CheckCircle2,
  XCircle,
  Smile,
  Meh,
  Frown,
  Gauge,
  Tag,
  RotateCcw,
  ChevronDown,
} from "lucide-react"

interface ChecklistItem {
  item: string
  atendido: boolean
  observacao: string | null
}
interface Qualidade {
  nota: number
  resumo_avaliacao: string
  checklist: ChecklistItem[]
}
interface AnaliseResult {
  transcricao: string
  duracao_estimada_s: number
  resumo: string
  sentimento: "positivo" | "neutro" | "negativo"
  sentimento_justificativa: string
  qualidade: Qualidade
  classificacao: string
  classificacao_justificativa: string
  modelo_transcricao: string
  modelo_analise: string
}

const EXTENSOES = ".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.ogg"

// URL pública do backend. O upload de áudio vai DIRETO ao backend (sem o
// proxy /api do Next, que trunca uploads grandes). NEXT_PUBLIC_API_URL não é
// embutida no build do Docker, então usamos a URL fixa como fallback.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://metatron-production.up.railway.app"

/**
 * Extrai uma mensagem de erro sempre como string. O `detail` do FastAPI pode
 * ser string, um objeto, ou uma lista de objetos de validação ({type,loc,msg}).
 * Renderizar qualquer um desses que não seja string quebra o React (erro #31).
 */
function extrairMensagemErro(e: unknown): string {
  const resp = (e as { response?: { data?: { detail?: unknown }; status?: number } })?.response
  const detail = resp?.data?.detail
  if (typeof detail === "string" && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null))
      .filter(Boolean)
    if (msgs.length) return msgs.join("; ")
  }
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail)
    } catch {
      /* */
    }
  }
  if (resp?.status === 422) {
    return "O arquivo não pôde ser processado (formato inválido ou upload incompleto). Tente um arquivo menor ou outro formato."
  }
  if (resp?.status === 413) {
    return "Áudio muito grande. Reduza o tamanho do arquivo."
  }
  if (e instanceof Error && e.message) return e.message
  return "Falha ao analisar a ligação."
}

function fmtDuracao(s: number): string {
  if (!s) return "—"
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `~${m}min ${sec}s` : `~${sec}s`
}

function sentimentoCfg(s: string) {
  switch (s) {
    case "positivo":
      return { label: "Positivo", bg: "#dcfce7", text: "#16a34a", Icon: Smile }
    case "negativo":
      return { label: "Negativo", bg: "#fee2e2", text: "#dc2626", Icon: Frown }
    default:
      return { label: "Neutro", bg: "#f3f4f6", text: "#6b7280", Icon: Meh }
  }
}

function classificacaoCfg(c: string): { bg: string; text: string } {
  const k = c.toLowerCase()
  if (k.includes("fechad")) return { bg: "#dcfce7", text: "#15803d" }
  if (k.includes("negocia")) return { bg: "#dbeafe", text: "#1d4ed8" }
  if (k.includes("agend")) return { bg: "#ede9fe", text: "#6d28d9" }
  if (k.includes("sem interesse") || k.includes("não localiz") || k.includes("sem contato"))
    return { bg: "#fee2e2", text: "#b91c1c" }
  return { bg: "#f3f4f6", text: "#6b7280" }
}

function notaCor(nota: number): string {
  if (nota >= 8) return "#16a34a"
  if (nota >= 5) return "#d97706"
  return "#dc2626"
}

export default function AnaliseLigacaoPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<AnaliseResult | null>(null)
  const [transcricaoAberta, setTranscricaoAberta] = useState(false)

  function escolherArquivo(f: File | null) {
    if (!f) return
    setArquivo(f)
    setErro(null)
    setResultado(null)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    escolherArquivo(e.dataTransfer.files?.[0] ?? null)
  }

  async function analisar() {
    if (!arquivo) return
    setProcessando(true)
    setErro(null)
    setResultado(null)
    try {
      const form = new FormData()
      form.append("file", arquivo)
      // Upload direto ao backend (sem o proxy /api do Next), que trunca/limita
      // uploads grandes. NÃO definir Content-Type: o browser põe o boundary do
      // multipart automaticamente.
      const { data } = await api.post<AnaliseResult>(
        `${BACKEND_URL}/api/analise-ligacao`,
        form,
        { timeout: 300000 },
      )
      setResultado(data)
    } catch (e) {
      setErro(extrairMensagemErro(e))
    } finally {
      setProcessando(false)
    }
  }

  function recomeçar() {
    setArquivo(null)
    setResultado(null)
    setErro(null)
    setTranscricaoAberta(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Análise de Ligação</h1>
        <p className="mt-1 text-sm text-[var(--muted-finexy)]">
          Faça upload do áudio de uma ligação e deixe a IA transcrever e avaliar
        </p>
      </div>

      {/* ===== Upload ===== */}
      {!resultado && (
        <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !processando && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !processando) inputRef.current?.click()
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!processando) setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => !processando && onDrop(e)}
            className={`flex flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed px-6 py-12 text-center transition-colors ${
              processando
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:border-[var(--orange)]"
            } ${dragOver ? "border-[var(--orange)] bg-[#fff7ec]" : "border-[var(--line)]"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={EXTENSOES}
              className="hidden"
              onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
            />
            {arquivo ? (
              <>
                <FileAudio className="h-10 w-10 text-[var(--orange)]" />
                <p className="text-[15px] font-semibold">{arquivo.name}</p>
                <p className="text-xs text-[var(--muted-finexy)]">
                  {(arquivo.size / 1024 / 1024).toFixed(1)} MB · clique para trocar
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-[var(--muted-finexy)]" />
                <p className="text-[15px] font-semibold">
                  Arraste o áudio aqui ou clique para selecionar
                </p>
                <p className="text-xs text-[var(--muted-finexy)]">
                  MP3, WAV, M4A, OGG, WEBM · até 25 MB
                </p>
              </>
            )}
          </div>

          {erro && (
            <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            {arquivo && !processando && (
              <button
                type="button"
                onClick={recomeçar}
                className="rounded-full px-4 py-2 text-[13px] font-semibold text-[var(--muted-finexy)] transition-colors hover:text-[var(--ink)]"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={analisar}
              disabled={!arquivo || processando}
              className="inline-flex items-center gap-2 rounded-full bg-[#111] px-5 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {processando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando…
                </>
              ) : (
                "Analisar ligação"
              )}
            </button>
          </div>

          {processando && (
            <p className="mt-3 text-center text-xs text-[var(--muted-finexy)]">
              Transcrevendo o áudio e avaliando o atendimento. Pode levar até 1 minuto.
            </p>
          )}
        </section>
      )}

      {/* ===== Resultado ===== */}
      {resultado && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted-finexy)]">
              {arquivo?.name} · {fmtDuracao(resultado.duracao_estimada_s)}
            </p>
            <button
              type="button"
              onClick={recomeçar}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold transition-colors hover:text-[var(--orange)]"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Analisar outra
            </button>
          </div>

          {/* Cards de topo */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Classificação */}
            <div className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--muted-finexy)]">
                <Tag className="h-4 w-4" />
                Resultado da ligação
              </div>
              <span
                className="mt-3 inline-flex rounded-full px-3 py-1 text-[15px] font-bold"
                style={{
                  background: classificacaoCfg(resultado.classificacao).bg,
                  color: classificacaoCfg(resultado.classificacao).text,
                }}
              >
                {resultado.classificacao}
              </span>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-finexy)]">
                {resultado.classificacao_justificativa}
              </p>
            </div>

            {/* Sentimento */}
            {(() => {
              const cfg = sentimentoCfg(resultado.sentimento)
              return (
                <div className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--muted-finexy)]">
                    <cfg.Icon className="h-4 w-4" />
                    Sentimento do cliente
                  </div>
                  <span
                    className="mt-3 inline-flex rounded-full px-3 py-1 text-[15px] font-bold"
                    style={{ background: cfg.bg, color: cfg.text }}
                  >
                    {cfg.label}
                  </span>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-finexy)]">
                    {resultado.sentimento_justificativa}
                  </p>
                </div>
              )
            })()}

            {/* Nota de qualidade */}
            <div className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--muted-finexy)]">
                <Gauge className="h-4 w-4" />
                Qualidade do atendimento
              </div>
              <p className="mt-3 text-[34px] font-bold leading-none tracking-[-0.02em]">
                <span style={{ color: notaCor(resultado.qualidade.nota) }}>
                  {resultado.qualidade.nota.toFixed(1)}
                </span>
                <span className="text-[16px] text-[var(--muted-finexy)]"> / 10</span>
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-finexy)]">
                {resultado.qualidade.resumo_avaliacao}
              </p>
            </div>
          </section>

          {/* Resumo */}
          <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <h2 className="mb-2 text-[18px] font-bold tracking-[-0.01em]">Resumo da ligação</h2>
            <p className="text-[14px] leading-relaxed text-[var(--ink)]">{resultado.resumo}</p>
          </section>

          {/* Checklist de qualidade */}
          <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em]">
              Checklist do atendimento
            </h2>
            <ul className="flex flex-col gap-2.5">
              {resultado.qualidade.checklist.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  {c.atendido ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="text-[14px] font-medium">{c.item}</p>
                    {c.observacao && (
                      <p className="text-[12px] text-[var(--muted-finexy)]">{c.observacao}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Transcrição (expansível) */}
          <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <button
              type="button"
              onClick={() => setTranscricaoAberta((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <h2 className="text-[18px] font-bold tracking-[-0.01em]">Transcrição completa</h2>
              <ChevronDown
                className={`h-5 w-5 text-[var(--muted-finexy)] transition-transform ${
                  transcricaoAberta ? "rotate-180" : ""
                }`}
              />
            </button>
            {transcricaoAberta && (
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">
                {resultado.transcricao}
              </p>
            )}
          </section>

          <p className="text-center text-[11px] text-[#bdbdbd]">
            Transcrição: {resultado.modelo_transcricao} · Análise: {resultado.modelo_analise}
          </p>
        </>
      )}
    </div>
  )
}
