# Cockpit Temporal — Plano de Implementação (Item 1 do Caminho B)

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans
> para implementar tarefa por tarefa. Passos usam checkbox `- [ ]`.

**Objetivo:** Página `/cockpit` com heatmap temporal (dia-da-semana × hora), comparativo hoje vs média 7d, e picos automáticos. Insight central: quando ligar produz mais.

**Arquitetura:** Endpoint backend novo `/api/cockpit/heatmap` agrega `TT_ACIONAMENTOS_METATRON` por dia da semana e hora. Frontend renderiza com ECharts heatmap + line comparativo + cards de picos. Filtros: período global (já existe).

**Tech Stack:** FastAPI + Pydantic (backend), Next.js + ECharts + filters-context (frontend).

---

## Tarefa 1: Backend — schema Pydantic

**Arquivos:**
- Criar: `backend/app/schemas/cockpit.py`

- [ ] **Passo 1:** Criar `backend/app/schemas/cockpit.py`:
  ```python
  from pydantic import BaseModel, Field

  class CockpitQuery(BaseModel):
      data_inicio: str = Field(..., description="yyyy-MM-dd")
      data_fim: str = Field(..., description="yyyy-MM-dd")

  class HeatmapCell(BaseModel):
      dia_semana: int  # 0=segunda, 6=domingo
      hora: int        # 0-23
      valor: int

  class PicoItem(BaseModel):
      dia_semana: int
      hora: int
      valor: int
      label: str  # ex: "Terça às 14h"

  class ComparativoSerie(BaseModel):
      hora: int
      valor: int

  class CockpitResult(BaseModel):
      heatmap: list[HeatmapCell]
      comparativo_hoje: list[ComparativoSerie]
      comparativo_media7d: list[ComparativoSerie]
      picos: list[PicoItem]
      total_periodo: int
  ```
- [ ] **Passo 2:** Commitar — `feat(cockpit): schema Pydantic`

---

## Tarefa 2: Backend — serviço de query

**Arquivos:**
- Criar: `backend/app/services/cockpit_service.py`

- [ ] **Passo 1:** Criar `backend/app/services/cockpit_service.py`:
  ```python
  from datetime import datetime, timedelta
  from app.services.sybase_agent import SybaseAgentClient
  from app.schemas.cockpit import CockpitResult, HeatmapCell, ComparativoSerie, PicoItem

  DIAS_PT = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

  async def cockpit_heatmap(data_inicio: str, data_fim: str, operador_filter: str | None = None) -> CockpitResult:
      agent = SybaseAgentClient()
      hoje = datetime.now().strftime("%Y-%m-%d")
      d7_atras = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

      where_op = ""
      if operador_filter:
          safe = operador_filter.replace("'", "''")
          where_op = f" AND operador = '{safe}'"

      # 1. Heatmap período inteiro: data + hora → COUNT
      sql_heatmap = (
          f"SELECT data, hora, COUNT(*) AS total "
          f"FROM metatron.TT_ACIONAMENTOS_METATRON "
          f"WHERE data BETWEEN '{data_inicio}' AND '{data_fim}'{where_op} "
          f"GROUP BY data, hora"
      )
      heatmap_raw = await agent.query(sql_heatmap, limit=10000)

      # 2. Comparativo hoje (já incluso no heatmap se hoje estiver no período)
      sql_hoje = (
          f"SELECT hora, COUNT(*) AS total "
          f"FROM metatron.TT_ACIONAMENTOS_METATRON "
          f"WHERE data = '{hoje}'{where_op} "
          f"GROUP BY hora"
      )
      hoje_raw = await agent.query(sql_hoje, limit=24)

      # 3. Média 7 dias (excluindo hoje): COUNT por hora / 7
      sql_media = (
          f"SELECT hora, COUNT(*) AS total "
          f"FROM metatron.TT_ACIONAMENTOS_METATRON "
          f"WHERE data BETWEEN '{d7_atras}' AND '{hoje}'{where_op} "
          f"GROUP BY hora"
      )
      media_raw = await agent.query(sql_media, limit=24)

      # Processa heatmap: cada linha vem (data, hora, total)
      heatmap_cells: list[HeatmapCell] = []
      picos_dict: dict[tuple[int, int], int] = {}
      total_periodo = 0
      for row in heatmap_raw.get("rows", []):
          data_str, hora_str, total = row[0], row[1], int(row[2])
          try:
              dt = datetime.strptime(data_str, "%Y-%m-%d")
              dia_semana = dt.weekday()  # 0=segunda, 6=domingo
              hora_int = int(hora_str.split(":")[0]) if ":" in str(hora_str) else int(hora_str)
              heatmap_cells.append(HeatmapCell(dia_semana=dia_semana, hora=hora_int, valor=total))
              picos_dict[(dia_semana, hora_int)] = picos_dict.get((dia_semana, hora_int), 0) + total
              total_periodo += total
          except (ValueError, IndexError):
              continue

      # Top 3 picos
      picos_sorted = sorted(picos_dict.items(), key=lambda x: x[1], reverse=True)[:3]
      picos = [
          PicoItem(
              dia_semana=ds,
              hora=h,
              valor=v,
              label=f"{DIAS_PT[ds]} às {h:02d}h",
          )
          for (ds, h), v in picos_sorted
      ]

      # Comparativo hoje (24 horas, preenchendo zeros)
      hoje_dict = {int(str(r[0]).split(":")[0]): int(r[1]) for r in hoje_raw.get("rows", []) if r[0] is not None}
      comp_hoje = [ComparativoSerie(hora=h, valor=hoje_dict.get(h, 0)) for h in range(24)]

      # Comparativo média 7d (dividir total por 7)
      media_dict = {int(str(r[0]).split(":")[0]): int(r[1]) for r in media_raw.get("rows", []) if r[0] is not None}
      comp_media = [ComparativoSerie(hora=h, valor=round(media_dict.get(h, 0) / 7)) for h in range(24)]

      return CockpitResult(
          heatmap=heatmap_cells,
          comparativo_hoje=comp_hoje,
          comparativo_media7d=comp_media,
          picos=picos,
          total_periodo=total_periodo,
      )
  ```
- [ ] **Passo 2:** Commitar — `feat(cockpit): serviço backend`

---

## Tarefa 3: Backend — rota FastAPI

**Arquivos:**
- Criar: `backend/app/routes/cockpit.py`
- Modificar: `backend/app/main.py` (registrar router)

- [ ] **Passo 1:** Criar `backend/app/routes/cockpit.py`:
  ```python
  from fastapi import APIRouter, Depends
  from app.schemas.cockpit import CockpitQuery, CockpitResult
  from app.services.cockpit_service import cockpit_heatmap
  from app.auth import get_current_user
  from app.models import User

  router = APIRouter(prefix="/api/cockpit", tags=["cockpit"])

  @router.post("/heatmap", response_model=CockpitResult)
  async def heatmap(body: CockpitQuery, user: User = Depends(get_current_user)) -> CockpitResult:
      operador_filter = None
      if user.role == "consultor" and user.agente_id_sybase:
          operador_filter = user.agente_id_sybase
      return await cockpit_heatmap(body.data_inicio, body.data_fim, operador_filter)
  ```
- [ ] **Passo 2:** Ler `backend/app/main.py` para identificar onde routers são registrados (procurar `app.include_router`).
- [ ] **Passo 3:** Adicionar `from app.routes import cockpit` e `app.include_router(cockpit.router)`.
- [ ] **Passo 4:** Verificar rota: rodar backend localmente e `curl -X POST http://localhost:8000/api/cockpit/heatmap` com token válido.
- [ ] **Passo 5:** Commitar — `feat(cockpit): rota /api/cockpit/heatmap`

---

## Tarefa 4: Frontend — adicionar item de navegação

**Arquivos:**
- Modificar: `frontend/components/layout/sidebar.tsx`

- [ ] **Passo 1:** Adicionar ícone import: `import { CalendarClock } from "lucide-react"`.
- [ ] **Passo 2:** Adicionar item na lista `NAV_ITEMS` (entre Operação e Qualificações):
  ```ts
  { href: "/cockpit", label: "Cockpit Temporal", icon: CalendarClock, roles: ["gestor", "admin"] },
  ```
- [ ] **Passo 3:** Commitar com a feature completa no final.

---

## Tarefa 5: Frontend — página `/cockpit`

**Arquivos:**
- Criar: `frontend/app/(dashboard)/cockpit/page.tsx`

- [ ] **Passo 1:** Criar página com:
  ```tsx
  "use client"

  import { useQuery } from "@tanstack/react-query"
  import ReactECharts from "echarts-for-react"
  import { Clock, TrendingUp } from "lucide-react"
  import api from "@/lib/api"
  import { useFilters } from "@/lib/filters-context"
  import { Skeleton } from "@/components/ui/skeleton"

  interface HeatmapCell { dia_semana: number; hora: number; valor: number }
  interface PicoItem { dia_semana: number; hora: number; valor: number; label: string }
  interface ComparativoSerie { hora: number; valor: number }
  interface CockpitResult {
    heatmap: HeatmapCell[]
    comparativo_hoje: ComparativoSerie[]
    comparativo_media7d: ComparativoSerie[]
    picos: PicoItem[]
    total_periodo: number
  }

  const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
  const HORAS_LABEL = Array.from({ length: 24 }, (_, h) => `${h.toString().padStart(2, "0")}h`)

  export default function CockpitPage() {
    const { period } = useFilters()
    const body = { data_inicio: period.dataInicio, data_fim: period.dataFim }

    const { data, isLoading, isError } = useQuery<CockpitResult>({
      queryKey: ["cockpit", body],
      queryFn: async () => (await api.post("/api/cockpit/heatmap", body)).data,
    })

    const heatmapOption = data && {
      tooltip: {
        position: "top",
        formatter: (p: { value: [number, number, number] }) => {
          const [h, ds, v] = p.value
          return `${DIAS_LABEL[ds]} às ${HORAS_LABEL[h]}: <b>${v} ligações</b>`
        },
      },
      grid: { left: 60, right: 20, top: 30, bottom: 50 },
      xAxis: { type: "category", data: HORAS_LABEL, splitArea: { show: true } },
      yAxis: { type: "category", data: DIAS_LABEL, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: Math.max(...data.heatmap.map((c) => c.valor), 1),
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 5,
        inRange: { color: ["#fff5ec", "#ffd9c2", "#ff7a3d", "#ff5a18"] },
      },
      series: [
        {
          type: "heatmap",
          data: data.heatmap.map((c) => [c.hora, c.dia_semana, c.valor]),
          label: { show: false },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" } },
        },
      ],
    }

    const comparativoOption = data && {
      tooltip: { trigger: "axis" },
      legend: { data: ["Hoje", "Média 7 dias"], top: 0, right: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: "category", data: HORAS_LABEL, boundaryGap: false },
      yAxis: { type: "value" },
      series: [
        {
          name: "Hoje",
          type: "line",
          smooth: true,
          data: data.comparativo_hoje.map((p) => p.valor),
          itemStyle: { color: "#ff6a2c" },
          lineStyle: { width: 3 },
          areaStyle: { color: "rgba(255,106,44,0.12)" },
        },
        {
          name: "Média 7 dias",
          type: "line",
          smooth: true,
          data: data.comparativo_media7d.map((p) => p.valor),
          itemStyle: { color: "#111" },
          lineStyle: { width: 2, type: "dashed" },
        },
      ],
    }

    return (
      <div className="flex flex-col gap-5 pb-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Cockpit Temporal</h1>
          <p className="mt-1 text-sm text-[var(--muted-finexy)]">
            Identifique os melhores horários e padrões de operação
          </p>
        </div>

        {isError && (
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
            Erro ao carregar dados.
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}

        {data && !isLoading && (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                <p className="text-[13px] font-medium text-[var(--muted-finexy)]">Total no período</p>
                <p className="mt-2 text-[30px] font-bold tracking-[-0.02em]">
                  {data.total_periodo.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-[11.5px] text-[var(--muted-finexy)]">Ligações registradas</p>
              </div>
              {data.picos.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  className={`rounded-[22px] p-5 ${i === 0 ? "text-white" : "bg-white"}`}
                  style={
                    i === 0
                      ? { background: "linear-gradient(180deg, #ff7a3d 0%, #ff5a18 100%)" }
                      : { boxShadow: "var(--shadow-card)" }
                  }
                >
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <Clock className={i === 0 ? "h-4 w-4 text-[#ffe7d8]" : "h-4 w-4 text-[var(--muted-finexy)]"} />
                    <span className={i === 0 ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"}>
                      {i === 0 ? "Melhor horário" : `Pico #${i + 1}`}
                    </span>
                  </div>
                  <p className="mt-3 text-[18px] font-bold tracking-[-0.01em]">{p.label}</p>
                  <p className={`mt-1 text-[11.5px] ${i === 0 ? "text-[#ffd9c2]" : "text-[var(--muted-finexy)]"}`}>
                    {p.valor.toLocaleString("pt-BR")} ligações
                  </p>
                </div>
              ))}
            </section>

            <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="mb-3">
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">
                  Mapa de calor — dia da semana × hora
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Cores mais escuras indicam maior volume de ligações no período
                </p>
              </div>
              {heatmapOption && <ReactECharts option={heatmapOption} style={{ height: 360 }} />}
            </section>

            <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[var(--orange)]" />
                <div>
                  <h2 className="text-[18px] font-bold tracking-[-0.01em]">Hoje vs Média 7 dias</h2>
                  <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                    Compare o ritmo de hoje com o histórico recente
                  </p>
                </div>
              </div>
              {comparativoOption && <ReactECharts option={comparativoOption} style={{ height: 280 }} />}
            </section>
          </>
        )}
      </div>
    )
  }
  ```
- [ ] **Passo 2:** Rodar `npm run dev` e abrir `/cockpit` logado como gestor — verificar:
  - 4 cards no topo (Total + 3 picos)
  - Heatmap renderiza com paleta laranja
  - Linha hoje vs média 7d
  - Filtro de período no header funciona (mudar período recarrega)
- [ ] **Passo 3:** Testar período vazio (data futura ou sem dados) — não pode quebrar.
- [ ] **Passo 4:** Commitar — `feat(cockpit): página /cockpit completa`

---

## Tarefa 6: Verificação final

- [ ] **Passo 1:** `npm run build` no frontend — sem erros TypeScript.
- [ ] **Passo 2:** Testar como gestor: navegar para `/cockpit`, mudar período, validar visualizações.
- [ ] **Passo 3:** Testar como consultor: deve receber filtro automático em `operador_filter` ou ver mensagem de acesso negado (roles=gestor/admin no sidebar).
- [ ] **Passo 4:** Commit final e push para Railway.

---

## Notas

- Endpoint usa apenas `TT_ACIONAMENTOS_METATRON` — única tabela com aggregação segura.
- Heatmap usa weekday() do Python — segunda=0, domingo=6.
- Coluna `hora` do banco é VARCHAR no formato `HH:MM:SS` — parse extrai hora inteira.
- Comparativo "média 7 dias" divide total por 7 — aproximação simples; suficiente como insight.
- Se `data` for VARCHAR (não DATE), o parse com `strptime("%Y-%m-%d")` é seguro pois o schema dita esse formato.
