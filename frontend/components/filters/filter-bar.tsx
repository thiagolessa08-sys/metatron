"use client"
import { useFilters, PERIOD_PRESETS, Filters } from "@/lib/hooks/use-filters"
import { useFilterOptions } from "@/lib/hooks/use-filter-options"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

interface FilterBarProps {
  fields?: ("periodo" | "campanha" | "operador" | "qualificacao")[]
}

export function FilterBar({ fields = ["periodo", "campanha", "operador", "qualificacao"] }: FilterBarProps) {
  const [filters, setFilters] = useFilters()
  const { data: options, isLoading } = useFilterOptions()

  const show = (f: string) => fields.includes(f as keyof typeof fields)

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap gap-3 items-end">

        {show("periodo") && (
          <div className="space-y-1 min-w-[120px]">
            <Label className="text-xs text-muted-foreground">Data início</Label>
            <Input
              type="date"
              value={filters.data_inicio}
              onChange={(e) => setFilters({ data_inicio: e.target.value })}
              className="h-9 w-36"
            />
          </div>
        )}

        {show("periodo") && (
          <div className="space-y-1 min-w-[120px]">
            <Label className="text-xs text-muted-foreground">Data fim</Label>
            <Input
              type="date"
              value={filters.data_fim}
              onChange={(e) => setFilters({ data_fim: e.target.value })}
              className="h-9 w-36"
            />
          </div>
        )}

        {show("periodo") && (
          <div className="flex gap-1 flex-wrap">
            {PERIOD_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setFilters(p.getValue())}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {(show("campanha") || show("operador") || show("qualificacao")) && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-3 items-end">
            {show("campanha") && (
              <div className="space-y-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Campanha</Label>
                <Select
                  value={filters.campanha ?? "all"}
                  onValueChange={(v) => setFilters({ campanha: v === "all" ? undefined : v })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {options?.campanhas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {show("operador") && (
              <div className="space-y-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Operador</Label>
                <Select
                  value={filters.operador ?? "all"}
                  onValueChange={(v) => setFilters({ operador: v === "all" ? undefined : v })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {options?.operadores.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {show("qualificacao") && (
              <div className="space-y-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Qualificação</Label>
                <Select
                  value={filters.qualificacao ?? "all"}
                  onValueChange={(v) => setFilters({ qualificacao: v === "all" ? undefined : v })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {options?.qualificacoes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
