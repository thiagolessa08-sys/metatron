# Visualizações — Caminho B (Design)

**Data:** 2026-05-17
**Status:** Aprovado — pronto para writing-plans

## Objetivo

Enriquecer as visualizações do Metatron usando dados subutilizados (`duracao`, `hora`, `desligou`, `Operadora`, `Valor`) através de redesenhos das páginas existentes + 2 novas páginas (`/cockpit`, `/financeiro`).

## Princípios de design

- **Reutilizar componentes Finexy** já criados — cards 22px, paleta laranja/bege
- **ECharts** para todos os gráficos (já em uso) — heatmap, funnel, gauge nativos
- **`usePageFilters` slot** — cada página pode adicionar filtros extras no topo
- **Backend lean** — preferir queries em `TT_ACIONAMENTOS_METATRON` (única segura pra COUNT/SUM); cruzamentos pesados feitos no Python

## Escopo (6 itens)

### Item 1: Cockpit Temporal (NOVA `/cockpit`)
**Insight central:** quando ligar dá mais resultado.

- **Heatmap principal:** eixo X = hora do dia (8h–20h), eixo Y = dia da semana (segunda–domingo); célula = volume de ligações no período filtrado.
- **Comparativo:** linha "hoje" sobreposta a "média dos últimos 7 dias" — mesma faixa horária.
- **Picos automáticos:** card "Melhor horário: 14h–15h às terças" (calculado em Python).
- **Estado vazio:** mensagem amigável quando período sem dados.

**Backend novo:** `POST /api/cockpit/heatmap` body `{data_inicio, data_fim}` → `{ heatmap: [[diaSemana, hora, valor]], comparativo: {hoje: [...], media7d: [...]}, picos: [{dia_semana, hora, valor}] }`.

### Item 2: Aproveitamento como funil (redesign `/relatorios/aproveitamento`)
**Insight:** mostrar visualmente a perda em cada etapa.

- **Funil principal (ECharts type=funnel):** Discados → Localizados → Em contato → Contatados.
- **Gauge ECharts:** aproveitamento médio com benchmark (50% verde, 25-50% âmbar, <25% vermelho).
- **Tabela** atual mantida mas com **sparklines** por campanha (volume diário das últimas 2 semanas — opcional, depende de query).

**Backend:** endpoint atual `/api/relatorios/aproveitamento` mantém retorno; frontend transforma `items` em pontos do funil.

### Item 3: Qualificações enriquecidas (redesign `/relatorios/qualificacoes`)
**Insight:** quem qualifica o quê + evolução temporal.

- **Donut Top 10** (já existe) — mantém.
- **NOVO — Tendência diária:** line chart das 5 qualificações principais ao longo do período.
- **NOVO — Heatmap operador×qualificação:** top 10 operadores × top 10 qualificações; célula = volume.

**Backend:** novo endpoint `POST /api/relatorios/qualificacoes/tendencia` → `{ datas: [...], series: [{ nome, valores }] }`. Novo endpoint `POST /api/relatorios/qualificacoes/heatmap` → `{ operadores: [], qualificacoes: [], matriz: [[op_idx, q_idx, valor]] }`.

### Item 4: Chamadas em dashboard (redesign `/relatorios/chamadas`)
**Insight:** tabela é detalhe, dashboard é overview.

- **Tab "Visão"** (default):
  - Histograma de duração (faixas: 0-30s, 30-60s, 1-2min, 2-5min, 5+min)
  - Distribuição por hora do dia (bar)
  - Donut por Operadora
- **Tab "Lista":** tabela atual.

**Backend:** novo endpoint `POST /api/relatorios/chamadas/resumo` → `{ por_duracao: [{faixa, total}], por_hora: [{hora, total}], por_operadora: [{nome, total}] }`. Tabela continua usando `/api/agentes/chamadas`.

### Item 5: Dashboard executivo (redesign `/`)
**Insight:** primeira tela = panorama estratégico do dia.

- 4 KPIs do dia (mantém).
- **NOVO — Linha 2 esquerda (2/3):** bar+line "Ligações por dia" (14 dias) com linha de média.
- **NOVO — Linha 2 direita (1/3):** donut "Qualificações hoje" (top 6).
- **Linha 3 esquerda:** Agentes ativos (mantém).
- **NOVO — Linha 3 direita:** Top 5 campanhas hoje (bar horizontal).

**Backend:** novo endpoint `GET /api/dashboard/executive` → `{ ligacoes_14d: [{data, total}], qualificacoes_hoje: [...], top_campanhas: [...] }`. Consolida 3 queries no backend para evitar 3 round-trips.

### Item 6: Financeiro (NOVA `/financeiro`)
**Insight:** custo nunca foi exposto.

- KPIs: Custo total, Custo médio/ligação, Operadora mais cara, Conversões × custo.
- Donut Custo por Operadora.
- Bar horizontal Top 10 números mais caros.
- Tabela Custo por hora.

**Backend:** novo endpoint `POST /api/financeiro/resumo` → lê `TT_RELATORIO_METATRON` sem agregar (proibido em varchar) e agrega no Python.

## Ordem aprovada

1. Cockpit Temporal
2. Aproveitamento funil
3. Qualificações enriquecidas
4. Chamadas dashboard
5. Dashboard executivo
6. Financeiro

Cada item é entrega isolada — feito, comitado, deployado. Próximo só começa após validar o anterior.

## Riscos

| Risco | Mitigação |
|---|---|
| Heatmap com poucos dados visualmente confuso | Mostrar estado vazio quando < 50 ligações no período |
| Sparklines exigem múltiplas queries | Adiar sparklines; usar tabela simples se complexidade explodir |
| Endpoint `/financeiro` lento (carrega muito de TT_RELATORIO) | Paginar ou limitar período máximo a 30 dias |
| ECharts funnel customização | Já tem typing; testar antes de polir |

## Auto-revisão

- [x] Cada item tem insight claro e visualizações específicas
- [x] Endpoints backend documentados
- [x] Ordem racional (impacto crescente; financeiro último pois depende de TT_RELATORIO populado)
- [x] Sem placeholders
