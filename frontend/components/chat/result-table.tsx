"use client"

interface ResultTableProps {
  columns: string[]
  rows: unknown[][]
}

export function ResultTable({ columns, rows }: ResultTableProps) {
  if (!columns.length) return null

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-muted/50">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-foreground/80 whitespace-nowrap">
                  {cell === null || cell === undefined ? (
                    <span className="text-muted-foreground/50">—</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border/30 bg-muted/20">
        {rows.length} {rows.length === 1 ? "linha" : "linhas"}
      </div>
    </div>
  )
}
