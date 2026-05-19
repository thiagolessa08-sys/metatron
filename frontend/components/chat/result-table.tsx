"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"

interface ResultTableProps {
  columns: string[]
  rows: unknown[][]
}

const DEFAULT_LIMIT = 20

function isNumericValue(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false
  if (typeof v === "number") return Number.isFinite(v)
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."))
    return Number.isFinite(n) && v.trim() !== ""
  }
  return false
}

function formatNumber(v: unknown): string {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."))
  if (!Number.isFinite(n)) return String(v)
  const hasDecimals = !Number.isInteger(n)
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  })
}

export function ResultTable({ columns, rows }: ResultTableProps) {
  const [expanded, setExpanded] = useState(false)

  const numericCols = useMemo(() => {
    return columns.map((_, ci) => {
      if (rows.length === 0) return false
      let numeric = 0
      let nonNull = 0
      for (const row of rows) {
        const v = row[ci]
        if (v === null || v === undefined || v === "") continue
        nonNull++
        if (isNumericValue(v)) numeric++
      }
      return nonNull > 0 && numeric / nonNull >= 0.8
    })
  }, [columns, rows])

  if (!columns.length) return null

  const totalRows = rows.length
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_LIMIT)
  const hasMore = totalRows > DEFAULT_LIMIT

  return (
    <div
      className="mt-3 overflow-hidden rounded-[14px] border border-[var(--line-2)] bg-white"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--orange)" }}>
              {columns.map((col, ci) => (
                <th
                  key={col}
                  className={`whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white ${
                    numericCols[ci] ? "text-right" : "text-left"
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`whitespace-nowrap px-4 py-2.5 ${
                      numericCols[j]
                        ? "text-right tabular-nums text-[var(--ink)]"
                        : "text-left text-[var(--ink)]"
                    }`}
                  >
                    {cell === null || cell === undefined || cell === "" ? (
                      <span className="text-[var(--muted-finexy)]/60">—</span>
                    ) : numericCols[j] ? (
                      formatNumber(cell)
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

      <div className="flex items-center justify-between border-t border-[var(--line-2)] bg-[#fafafa] px-4 py-2.5 text-xs text-[var(--muted-finexy)]">
        <span>
          {hasMore && !expanded ? (
            <>
              Mostrando <b className="text-[var(--ink)]">{visibleRows.length}</b> de{" "}
              <b className="text-[var(--ink)]">{totalRows.toLocaleString("pt-BR")}</b> linhas
            </>
          ) : (
            <>
              <b className="text-[var(--ink)]">{totalRows.toLocaleString("pt-BR")}</b>{" "}
              {totalRows === 1 ? "linha" : "linhas"}
            </>
          )}
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-[var(--orange)] transition-colors hover:bg-[var(--orange-soft)]"
          >
            {expanded ? "Mostrar menos" : "Ver todas"}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
    </div>
  )
}
