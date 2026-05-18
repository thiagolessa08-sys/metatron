"use client"
import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import { ExportButton } from "@/components/relatorios/export-button"
import { Skeleton } from "@/components/ui/skeleton"
import api from "@/lib/api"
import { useFilters } from "@/lib/filters-context"
import { Phone, Target, Users, Gauge, Award, AlertCircle, Package } from "lucide-react"

interface AprItem {
  campanha: string
  total: number
  localizados: number
  em_contato: number
  contatados: number
  discados_total: number
  atendidas_hoje: number
  aproveitamento: number
  agendamentos_publicos: number
  agendamentos_privados: number
}
interface AprResult {
  items: AprItem[]
  totais: AprItem | null
}

export default function AproveitamentoPage() {
  const { campanha } = useFilters()
  const body = { campanha: campanha ?? undefined }

  const { data, isLoading, isError } = useQuery<AprResult>({
    queryKey: ["aproveitamento", body],
    queryFn: async () => (await api.post("/api/relatorios/aproveitamento", body)).data,
  })

  const t = data?.totais
  const items = data?.items ?? []

  // Eficiência e volume — para scatter quadrante
  const volumeMedio =
    items.length > 0
      ? items.reduce((s, i) => s + i.discados_total, 0) / items.length
      : 0
  const efMedia =
    items.length > 0
      ? items.reduce((s, i) => s + i.aproveitamento, 0) / items.length
      : 0

  // Funil principal
  const funnelOption = t
    ? {
        tooltip: { trigger: "item", formatter: "{b}: <b>{c}</b>" },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [
          {
            name: "Funil",
            type: "funnel",
            left: "5%",
            right: "5%",
            top: 20,
            bottom: 40,
            minSize: "20%",
            sort: "descending",
            gap: 2,
            label: {
              show: true,
              position: "inside",
              fontSize: 13,
              fontWeight: 600,
              formatter: (p: { name: string; value: number; percent?: number }) =>
                `${p.name}\n${p.value.toLocaleString("pt-BR")}`,
            },
            labelLine: { show: false },
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            data: [
              { value: t.discados_total, name: "Discados", itemStyle: { color: "#111" } },
              { value: t.localizados, name: "Localizados", itemStyle: { color: "#444" } },
              { value: t.em_contato, name: "Em contato", itemStyle: { color: "#ff7a3d" } },
              { value: t.contatados, name: "Contatados", itemStyle: { color: "#ff5a18" } },
            ],
          },
        ],
      }
    : null

  // Gauge aproveitamento médio
  const gaugeOption = t
    ? {
        series: [
          {
            type: "gauge",
            startAngle: 200,
            endAngle: -20,
            min: 0,
            max: 100,
            progress: { show: true, width: 22 },
            axisLine: {
              lineStyle: {
                width: 22,
                color: [
                  [0.25, "#e23b3b"],
                  [0.5, "#f4a51b"],
                  [1, "#16a34a"],
                ],
              },
            },
            pointer: { length: "60%", width: 6, itemStyle: { color: "#111" } },
            axisTick: { show: false },
            splitLine: { length: 10, lineStyle: { color: "#fff", width: 2 } },
            axisLabel: { color: "#9a9a9a", fontSize: 10, distance: -30 },
            detail: {
              valueAnimation: true,
              fontSize: 32,
              fontWeight: 700,
              color: "#111",
              formatter: "{value}%",
              offsetCenter: [0, "20%"],
            },
            data: [{ value: t.aproveitamento, name: "Aproveitamento" }],
          },
        ],
      }
    : null

  // Scatter quadrante: Volume × Eficiência
  const scatterOption = items.length > 0
    ? {
        tooltip: {
          formatter: (p: { data: { value: [number, number]; name: string } }) =>
            `<b>${p.data.name}</b><br/>Volume: ${p.data.value[0].toLocaleString("pt-BR")}<br/>Aproveitamento: ${p.data.value[1]}%`,
        },
        grid: { left: 50, right: 30, top: 30, bottom: 50 },
        xAxis: {
          type: "value",
          name: "Volume (discados)",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 10 },
          splitLine: { lineStyle: { type: "dashed", color: "#e0e0e0" } },
        },
        yAxis: {
          type: "value",
          name: "Aproveitamento %",
          nameLocation: "middle",
          nameGap: 35,
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 10, formatter: "{value}%" },
          splitLine: { lineStyle: { type: "dashed", color: "#e0e0e0" } },
        },
        series: [
          {
            type: "scatter",
            symbolSize: (val: number[]) => Math.max(10, Math.min(40, Math.sqrt(val[0]) / 3)),
            data: items.map((i) => ({
              name: i.campanha,
              value: [i.discados_total, i.aproveitamento],
              itemStyle: {
                color:
                  i.aproveitamento >= efMedia && i.discados_total >= volumeMedio
                    ? "#16a34a" // champions
                    : i.aproveitamento >= efMedia
                      ? "#ff6a2c" // alta efic, baixo volume
                      : i.discados_total >= volumeMedio
                        ? "#f4a51b" // alto volume, baixa efic (revisar)
                        : "#a8a8a8", // resto
              },
            })),
            markLine: {
              silent: true,
              symbol: "none",
              lineStyle: { type: "dashed", color: "#bbb" },
              data: [
                { xAxis: volumeMedio },
                { yAxis: efMedia },
              ],
            },
          },
        ],
      }
    : null

  // Bar de aproveitamento por campanha
  const barAprOption = items.length > 0
    ? {
        tooltip: { trigger: "axis", formatter: "{b}: <b>{c}%</b>" },
        grid: { left: 50, right: 20, top: 20, bottom: 80 },
        xAxis: {
          type: "category",
          data: items.map((i) => (i.campanha.length > 14 ? i.campanha.slice(0, 13) + "…" : i.campanha)),
          axisLabel: { rotate: 35, fontSize: 10 },
        },
        yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: "{value}%" } },
        series: [
          {
            type: "bar",
            data: items.map((i) => ({
              value: i.aproveitamento,
              itemStyle: {
                color:
                  i.aproveitamento >= 50
                    ? "#16a34a"
                    : i.aproveitamento >= 25
                      ? "#f4a51b"
                      : "#e23b3b",
                borderRadius: [8, 8, 0, 0],
              },
            })),
            barMaxWidth: 24,
          },
        ],
      }
    : null

  const champion = items.reduce<AprItem | null>(
    (best, cur) => (!best || cur.aproveitamento > best.aproveitamento ? cur : best),
    null
  )
  const worst = items.reduce<AprItem | null>(
    (worst, cur) => (!worst || cur.aproveitamento < worst.aproveitamento ? cur : worst),
    null
  )
  const estoque = t ? t.total - t.contatados : 0

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Aproveitamento</h1>
          <p className="mt-1 text-sm text-[var(--muted-finexy)]">
            Funil de conversão e eficiência por campanha
          </p>
        </div>
        <ExportButton
          endpoint="/api/relatorios/aproveitamento"
          body={body}
          filename="aproveitamento"
        />
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-[22px]" />
          <Skeleton className="h-96 w-full rounded-[22px]" />
        </div>
      )}

      {isError && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Erro ao carregar dados.
        </div>
      )}

      {data && !isLoading && items.length === 0 && (
        <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-white p-12 text-center text-[var(--muted-finexy)]">
          Nenhuma campanha encontrada com os filtros atuais.
        </div>
      )}

      {t && items.length > 0 && (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi
              highlight
              label="Aproveitamento médio"
              value={`${t.aproveitamento.toFixed(1)}%`}
              hint="Geral do período"
              icon={<Gauge className="h-4 w-4" />}
            />
            <Kpi
              label="Total discado"
              value={t.discados_total.toLocaleString("pt-BR")}
              hint="Tentativas realizadas"
              icon={<Phone className="h-4 w-4" />}
            />
            <Kpi
              label="Contatados"
              value={t.contatados.toLocaleString("pt-BR")}
              hint={`${t.total > 0 ? ((t.contatados / t.total) * 100).toFixed(1) : 0}% do mailing`}
              icon={<Target className="h-4 w-4" />}
            />
            <Kpi
              label="Estoque a contatar"
              value={estoque.toLocaleString("pt-BR")}
              hint="Restante no mailing"
              icon={<Package className="h-4 w-4" />}
            />
          </section>

          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi
              label="Localizados"
              value={t.localizados.toLocaleString("pt-BR")}
              hint={`${t.total > 0 ? ((t.localizados / t.total) * 100).toFixed(1) : 0}% do mailing`}
              icon={<Users className="h-4 w-4" />}
            />
            <Kpi
              label="Em contato"
              value={t.em_contato.toLocaleString("pt-BR")}
              hint="Em tratamento"
              icon={<Phone className="h-4 w-4" />}
            />
            <Kpi
              label="Campanha + eficiente"
              value={champion?.campanha ?? "—"}
              hint={champion ? `${champion.aproveitamento.toFixed(1)}%` : "—"}
              icon={<Award className="h-4 w-4" />}
              valueSize="sm"
              accent="green"
            />
            <Kpi
              label="Campanha - eficiente"
              value={worst?.campanha ?? "—"}
              hint={worst ? `${worst.aproveitamento.toFixed(1)}%` : "—"}
              icon={<AlertCircle className="h-4 w-4" />}
              valueSize="sm"
              accent="red"
            />
          </section>

          {/* Funil + Gauge */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div
              className="lg:col-span-2 rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">
                Funil de aproveitamento
              </h2>
              <p className="mb-3 text-xs text-[var(--muted-finexy)]">
                Discado → Localizado → Em contato → Contatado
              </p>
              {funnelOption && <ReactECharts option={funnelOption} style={{ height: 340 }} />}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">
                Aproveitamento médio
              </h2>
              <p className="mb-3 text-xs text-[var(--muted-finexy)]">
                Vermelho &lt;25% · Amarelo 25-50% · Verde ≥50%
              </p>
              {gaugeOption && <ReactECharts option={gaugeOption} style={{ height: 290 }} />}
            </div>
          </section>

          {/* Scatter quadrante + Bar */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">
                Matriz de eficiência
              </h2>
              <p className="mb-3 text-xs text-[var(--muted-finexy)]">
                <span className="text-green-600 font-semibold">Verde</span>: champion ·{" "}
                <span className="text-[var(--orange)] font-semibold">Laranja</span>: alta efic ·{" "}
                <span className="text-yellow-600 font-semibold">Amarelo</span>: alto volume
              </p>
              {scatterOption && <ReactECharts option={scatterOption} style={{ height: 320 }} />}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">
                Aproveitamento por campanha
              </h2>
              <p className="mb-3 text-xs text-[var(--muted-finexy)]">
                Cor por faixa de eficiência
              </p>
              {barAprOption && <ReactECharts option={barAprOption} style={{ height: 320 }} />}
            </div>
          </section>

          {/* Tabela */}
          <section
            className="rounded-[22px] bg-white p-5"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em]">
              Detalhamento por campanha
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line-2)] bg-[#fafafa]">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      Campanha
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      Total
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      Localizados
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      Contatados
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      Discados
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      Aproveit.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--line-2)] last:border-b-0">
                      <td className="px-3 py-2.5 font-medium">{row.campanha}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.total.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.localizados.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.contatados.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.discados_total.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className="inline-flex w-16 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background:
                              row.aproveitamento >= 50
                                ? "#dcfce7"
                                : row.aproveitamento >= 25
                                  ? "#fef3c7"
                                  : "#fee2e2",
                            color:
                              row.aproveitamento >= 50
                                ? "#16a34a"
                                : row.aproveitamento >= 25
                                  ? "#a16207"
                                  : "#dc2626",
                          }}
                        >
                          {row.aproveitamento.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#fafafa] font-bold">
                    <td className="px-3 py-2.5">TOTAL</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.total.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.localizados.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.contatados.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.discados_total.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.aproveitamento.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon,
  highlight = false,
  accent,
  valueSize = "default",
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
  accent?: "green" | "red"
  valueSize?: "default" | "sm"
}) {
  const accentColor = accent === "green" ? "#16a34a" : accent === "red" ? "#e23b3b" : undefined
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
          style={accent && !highlight ? { color: accentColor } : undefined}
        >
          {icon}
        </span>
      </div>
      <p
        className={`relative mt-2 truncate font-bold tracking-[-0.01em] ${
          valueSize === "sm" ? "text-[15px]" : "text-[22px]"
        }`}
        style={accent && !highlight ? { color: accentColor } : undefined}
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
