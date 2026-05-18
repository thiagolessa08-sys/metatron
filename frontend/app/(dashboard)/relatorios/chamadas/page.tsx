"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import { ExportButton } from "@/components/relatorios/export-button"
import { Skeleton } from "@/components/ui/skeleton"
import api from "@/lib/api"
import { useFilters } from "@/lib/filters-context"
import {
  Phone,
  DollarSign,
  Clock,
  Building2,
  TrendingUp,
  LayoutDashboard,
  List,
} from "lucide-react"

interface ChamadaItem {
  data_hora: string
  numero: string
  operadora: string
  resultado: string
  duracao: string
  dur_min: string
  valor: string
}
interface ChamadasResult {
  items: ChamadaItem[]
  total: number
  truncated: boolean
}
interface FaixaDuracao {
  faixa: string
  total: number
}
interface HoraBucket {
  hora: number
  total: number
}
interface OperadoraBucket {
  nome: string
  total: number
}
interface ChamadasResumo {
  total: number
  duracao_total_s: number
  duracao_media_s: number
  custo_total: number
  custo_medio: number
  operadora_dominante: string | null
  pct_longas: number
  por_duracao: FaixaDuracao[]
  por_hora: HoraBucket[]
  por_operadora: OperadoraBucket[]
}

const PALETA = ["#ff6a2c", "#111111", "#f4a51b", "#16a34a", "#8a8a8a", "#3a8df0", "#e23b3b", "#ff9966"]

function fmtSeg(s: number): string {
  if (!s) return "—"
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`
  return `${sec}s`
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(v)
}

function resultadoCor(resultado: string): { bg: string; text: string } {
  const r = resultado.toLowerCase()
  if (r.includes("atend") || r.includes("contato")) return { bg: "#dcfce7", text: "#16a34a" }
  if (r.includes("ocup") || r.includes("não atend") || r.includes("nao atend"))
    return { bg: "#fee2e2", text: "#dc2626" }
  return { bg: "#f3f4f6", text: "#6b7280" }
}

export default function ChamadasPage() {
  const { period, operador } = useFilters()
  const [tab, setTab] = useState<"visao" | "lista">("visao")

  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
    operadora: undefined,
    resultado: undefined,
    operador: operador ?? undefined,
  }

  const { data: resumo, isLoading: resumoLoading } = useQuery<ChamadasResumo>({
    queryKey: ["chamadas-resumo", body],
    queryFn: async () => (await api.post("/api/agentes/chamadas/resumo", body)).data,
    enabled: tab === "visao",
  })

  const { data: lista, isLoading: listaLoading } = useQuery<ChamadasResult>({
    queryKey: ["chamadas", body],
    queryFn: async () => (await api.post("/api/agentes/chamadas", body)).data,
    enabled: tab === "lista",
  })

  // === ECharts ===
  const histOption = resumo
    ? {
        tooltip: { trigger: "item", formatter: "{b}: <b>{c}</b>" },
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: "category",
          data: resumo.por_duracao.map((f) => f.faixa),
          axisLabel: { fontSize: 11 },
        },
        yAxis: { type: "value", axisLabel: { fontSize: 10 } },
        series: [
          {
            type: "bar",
            data: resumo.por_duracao.map((f, i) => ({
              value: f.total,
              itemStyle: { color: PALETA[i % PALETA.length], borderRadius: [8, 8, 0, 0] },
            })),
            barMaxWidth: 40,
            label: {
              show: true,
              position: "top",
              fontSize: 10,
              formatter: (p: { value: number }) => p.value.toLocaleString("pt-BR"),
            },
          },
        ],
      }
    : null

  const horaOption = resumo
    ? {
        tooltip: { trigger: "axis", formatter: (p: { name: string; value: number }[]) =>
          `<b>${p[0].name}h</b>: ${p[0].value.toLocaleString("pt-BR")} chamadas` },
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: "category",
          data: resumo.por_hora.map((h) => h.hora.toString().padStart(2, "0")),
          axisLabel: { fontSize: 10 },
        },
        yAxis: { type: "value", axisLabel: { fontSize: 10 } },
        series: [
          {
            type: "bar",
            data: resumo.por_hora.map((h) => h.total),
            itemStyle: { color: "#ff6a2c", borderRadius: [6, 6, 0, 0] },
            barMaxWidth: 16,
          },
        ],
      }
    : null

  const operadoraOption = resumo
    ? {
        tooltip: { trigger: "item", formatter: "{b}: <b>{c}</b> ({d}%)" },
        legend: {
          orient: "vertical",
          right: 0,
          top: "center",
          type: "scroll",
          textStyle: { fontSize: 11 },
        },
        series: [
          {
            type: "pie",
            radius: ["48%", "72%"],
            center: ["35%", "50%"],
            data: resumo.por_operadora.map((o, i) => ({
              name: o.nome,
              value: o.total,
              itemStyle: { color: PALETA[i % PALETA.length] },
            })),
            label: { show: false },
            labelLine: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Chamadas</h1>
          <p className="mt-1 text-sm text-[var(--muted-finexy)]">
            Volume, duração, custo e operadoras
          </p>
        </div>
        <ExportButton endpoint="/api/agentes/chamadas" body={body} filename="chamadas" />
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 self-start rounded-full bg-white p-1" style={{ boxShadow: "var(--shadow-card)" }}>
        <TabButton active={tab === "visao"} onClick={() => setTab("visao")}>
          <LayoutDashboard className="h-3.5 w-3.5" />
          Visão
        </TabButton>
        <TabButton active={tab === "lista"} onClick={() => setTab("lista")}>
          <List className="h-3.5 w-3.5" />
          Lista
        </TabButton>
      </div>

      {/* ===== TAB VISÃO ===== */}
      {tab === "visao" && (
        <>
          {resumoLoading && (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-[22px]" />
              <Skeleton className="h-96 w-full rounded-[22px]" />
            </div>
          )}

          {resumo && !resumoLoading && resumo.total === 0 && (
            <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-white p-12 text-center text-[var(--muted-finexy)]">
              Nenhuma chamada encontrada com os filtros atuais.
            </div>
          )}

          {resumo && !resumoLoading && resumo.total > 0 && (
            <>
              {/* KPIs */}
              <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Kpi
                  highlight
                  label="Total"
                  value={resumo.total.toLocaleString("pt-BR")}
                  hint="Chamadas"
                  icon={<Phone className="h-4 w-4" />}
                />
                <Kpi
                  label="Custo total"
                  value={fmtBRL(resumo.custo_total)}
                  hint="No período"
                  icon={<DollarSign className="h-4 w-4" />}
                  valueSize="sm"
                />
                <Kpi
                  label="Custo médio"
                  value={fmtBRL(resumo.custo_medio)}
                  hint="Por chamada"
                  icon={<DollarSign className="h-4 w-4" />}
                  valueSize="sm"
                />
                <Kpi
                  label="Duração média"
                  value={fmtSeg(resumo.duracao_media_s)}
                  hint={`Total: ${fmtSeg(resumo.duracao_total_s)}`}
                  icon={<Clock className="h-4 w-4" />}
                  valueSize="sm"
                />
                <Kpi
                  label="Operadora top"
                  value={resumo.operadora_dominante ?? "—"}
                  hint="Dominante no período"
                  icon={<Building2 className="h-4 w-4" />}
                  valueSize="sm"
                />
                <Kpi
                  label="Chamadas longas"
                  value={`${resumo.pct_longas}%`}
                  hint="Acima de 2 min"
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              </section>

              {/* Histograma + Hora */}
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div
                  className="rounded-[22px] bg-white p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">
                    Duração das chamadas
                  </h2>
                  <p className="mb-3 text-xs text-[var(--muted-finexy)]">
                    Distribuição por faixas de tempo
                  </p>
                  {histOption && <ReactECharts option={histOption} style={{ height: 260 }} />}
                </div>
                <div
                  className="rounded-[22px] bg-white p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">
                    Volume por hora
                  </h2>
                  <p className="mb-3 text-xs text-[var(--muted-finexy)]">
                    Padrão horário das chamadas
                  </p>
                  {horaOption && <ReactECharts option={horaOption} style={{ height: 260 }} />}
                </div>
              </section>

              {/* Operadora */}
              <section
                className="rounded-[22px] bg-white p-5"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">Mix por operadora</h2>
                <p className="mb-3 text-xs text-[var(--muted-finexy)]">
                  Distribuição de chamadas entre operadoras (top 10)
                </p>
                {operadoraOption && resumo.por_operadora.length > 0 ? (
                  <ReactECharts option={operadoraOption} style={{ height: 320 }} />
                ) : (
                  <div className="grid h-[200px] place-items-center text-xs text-[var(--muted-finexy)]">
                    Sem dados de operadora
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {/* ===== TAB LISTA ===== */}
      {tab === "lista" && (
        <>
          {listaLoading && <Skeleton className="h-96 w-full rounded-[22px]" />}
          {lista && !listaLoading && (
            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-[var(--muted-finexy)]">
                  Mostrando <b>{lista.items.length}</b> de{" "}
                  <b>{lista.total.toLocaleString("pt-BR")}</b> registros
                  {lista.truncated && " (truncado a 1.000)"}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line-2)] bg-[#fafafa]">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Data/Hora
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Número
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Operadora
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Resultado
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Duração
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.items.map((row, i) => {
                      const cor = resultadoCor(row.resultado)
                      return (
                        <tr key={i} className="border-b border-[var(--line-2)] last:border-b-0">
                          <td className="px-3 py-2 text-[12.5px]">{row.data_hora}</td>
                          <td className="px-3 py-2 font-mono text-[12.5px]">{row.numero}</td>
                          <td className="px-3 py-2 text-[12.5px]">{row.operadora}</td>
                          <td className="px-3 py-2">
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{ background: cor.bg, color: cor.text }}
                            >
                              {row.resultado}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.dur_min || row.duracao}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.valor}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? "bg-[#111] text-white"
          : "text-[var(--muted-finexy)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon,
  highlight = false,
  valueSize = "default",
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
  valueSize?: "default" | "sm"
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] p-4 ${
        highlight ? "text-white" : "bg-white text-[var(--ink)]"
      }`}
      style={{
        background: highlight ? "linear-gradient(180deg, #ff7a3d 0%, #ff5a18 100%)" : undefined,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {highlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
          }}
        />
      )}
      <div className="relative flex items-center justify-between text-[12px] font-medium">
        <span className={highlight ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"}>{label}</span>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full ${
            highlight ? "bg-white/20" : "bg-[#f3f3f3] text-[#bdbdbd]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`relative mt-2 truncate font-bold tracking-[-0.01em] ${
          valueSize === "sm" ? "text-[15px]" : "text-[22px]"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`relative mt-0.5 text-[11px] ${
            highlight ? "text-[#ffd9c2]" : "text-[var(--muted-finexy)]"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
