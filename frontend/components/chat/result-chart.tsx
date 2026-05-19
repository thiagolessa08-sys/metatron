"use client"

import ReactECharts from "echarts-for-react"

interface ChartHint {
  type?: "bar" | "line" | "pie" | "none"
  x_column?: string
  y_column?: string
}

interface ResultChartProps {
  columns: string[]
  rows: unknown[][]
  hint: ChartHint
}

export function ResultChart({ columns, rows, hint }: ResultChartProps) {
  const chartType = hint.type ?? "bar"
  if (!rows.length || chartType === "none") return null

  const xIdx = hint.x_column ? columns.indexOf(hint.x_column) : 0
  const yIdx = hint.y_column ? columns.indexOf(hint.y_column) : 1

  if (xIdx < 0 || yIdx < 0) return null

  const labels = rows.map((r) => String(r[xIdx] ?? ""))
  const values = rows.map((r) => Number(r[yIdx]) || 0)

  let option: Record<string, unknown>

  if (chartType === "pie") {
    option = {
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      series: [
        {
          type: "pie",
          radius: "60%",
          data: labels.map((name, i) => ({ name, value: values[i] })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.5)" } },
        },
      ],
    }
  } else {
    option = {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: labels, axisLabel: { rotate: labels.length > 8 ? 30 : 0 } },
      yAxis: { type: "value" },
      series: [{ type: chartType === "line" ? "line" : "bar", data: values, smooth: chartType === "line" }],
      grid: { left: "3%", right: "4%", bottom: "8%", containLabel: true },
    }
  }

  return (
    <div
      className="mt-3 overflow-hidden rounded-[14px] border border-[var(--line-2)] bg-white p-3"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <ReactECharts option={option} style={{ height: 280 }} theme="default" />
    </div>
  )
}
