# Dashboard Discadora Joytec — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA — Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Dashboard web analítico para Discadora Joytec conectado ao Sybase IQ via Java Agent HTTP, com 5 sprints incrementais.

**Arquitetura:** Next.js (frontend) + FastAPI (backend) + PostgreSQL (usuários) + Java Agent HTTP (proxy para Sybase IQ). Deploy no Railway. SSE para tempo real.

**Tech Stack:** Next.js 14 / TypeScript / Tailwind / shadcn/ui / ECharts / Python 3.11 / FastAPI / httpx / SQLAlchemy / Pydantic / pytest / Vitest / Playwright.

**Doc de Design:** `docs/superpowers/specs/2026-05-17-joytec-dashboard-design.md`

---

## SPRINT 0 — Fundação (1 semana)

> Objetivo: ambiente local + Railway funcional + health-check end-to-end + login básico + schema descoberto.

### Tarefa 0.1: Inicializar monorepo

**Arquivos:**
- Criar: `README.md`
- Criar: `.gitignore`
- Criar: `.editorconfig`
- Criar: `frontend/` (Next.js)
- Criar: `backend/` (FastAPI)

- [ ] **Passo 1:** `git init` na raiz do projeto
- [ ] **Passo 2:** Criar `README.md` com nome do projeto, descrição curta, como rodar (dev/prod) e link para o doc de design
- [ ] **Passo 3:** Criar `.gitignore` cobrindo Node (`node_modules`, `.next`, `out`), Python (`__pycache__`, `.venv`, `*.pyc`, `.pytest_cache`), env (`.env`, `.env.local`, `.env.*.local`), editores (`.vscode`, `.idea`, `.DS_Store`)
- [ ] **Passo 4:** Criar `.env.example` na raiz com todas as variáveis (sem valores reais)
- [ ] **Passo 5:** Commitar: `chore: scaffold monorepo`

### Tarefa 0.2: Scaffold Frontend Next.js

**Arquivos:**
- Criar: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.mjs`, `frontend/tailwind.config.ts`, `frontend/postcss.config.mjs`
- Criar: `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/globals.css`

- [ ] **Passo 1:** Rodar `npx create-next-app@latest frontend --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*"`
- [ ] **Passo 2:** Instalar shadcn/ui: `cd frontend && npx shadcn@latest init` (escolher tema neutro)
- [ ] **Passo 3:** Adicionar componentes base: `npx shadcn@latest add button input card table dialog toast sonner select date-picker tabs separator badge avatar dropdown-menu form`
- [ ] **Passo 4:** Instalar ECharts: `npm install echarts echarts-for-react`
- [ ] **Passo 5:** Instalar dependências de dados: `npm install @tanstack/react-query axios zod react-hook-form @hookform/resolvers date-fns`
- [ ] **Passo 6:** Rodar `npm run dev` e verificar que abre em `http://localhost:3000`
- [ ] **Passo 7:** Commitar: `feat(frontend): scaffold Next.js + Tailwind + shadcn + ECharts`

### Tarefa 0.3: Scaffold Backend FastAPI

**Arquivos:**
- Criar: `backend/pyproject.toml` ou `backend/requirements.txt`
- Criar: `backend/app/__init__.py`, `backend/app/main.py`
- Criar: `backend/app/config.py`, `backend/app/database.py`
- Criar: `backend/app/services/sybase_agent.py`
- Criar: `backend/app/routes/__init__.py`, `backend/app/routes/health.py`
- Criar: `backend/tests/__init__.py`, `backend/tests/test_health.py`
- Criar: `backend/.env.example`

- [ ] **Passo 1:** Criar `backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
httpx==0.27.2
pydantic==2.9.0
pydantic-settings==2.5.0
sqlalchemy==2.0.35
psycopg[binary]==3.2.0
alembic==1.13.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.17
pytest==8.3.0
pytest-asyncio==0.24.0
respx==0.21.0
```
- [ ] **Passo 2:** Criar venv: `python -m venv backend/.venv` e ativar; `pip install -r backend/requirements.txt`
- [ ] **Passo 3:** Criar `backend/app/config.py` com `Settings(BaseSettings)` lendo: `AGENT_URL`, `AGENT_API_KEY`, `AGENT_TIMEOUT_SECONDS=30`, `AGENT_DEFAULT_LIMIT=500`, `SYBASE_SCHEMA=pref_aruja_sp`, `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `JWT_ACCESS_MINUTES=15`, `JWT_REFRESH_DAYS=7`
- [ ] **Passo 4:** Criar `backend/.env.example` com todas as chaves
- [ ] **Passo 5:** Criar `backend/app/main.py` com app FastAPI mínima, CORS liberado para `http://localhost:3000`, e include do router de health
- [ ] **Passo 6:** Criar `backend/app/routes/health.py` com `GET /health` retornando `{"status":"ok","service":"api"}`
- [ ] **Passo 7:** Escrever teste falhando em `backend/tests/test_health.py`:
```python
from fastapi.testclient import TestClient
from app.main import app

def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "api"}
```
- [ ] **Passo 8:** Rodar `pytest backend/tests -v` e ver passar
- [ ] **Passo 9:** Rodar `uvicorn app.main:app --reload` (dentro de `backend/`) e abrir `http://localhost:8000/health`
- [ ] **Passo 10:** Commitar: `feat(backend): scaffold FastAPI with health endpoint`

### Tarefa 0.4: Cliente do Java Agent (Sybase Proxy)

**Arquivos:**
- Modificar: `backend/app/services/sybase_agent.py`
- Criar: `backend/tests/test_sybase_agent.py`

- [ ] **Passo 1:** Escrever teste falhando para `health()` usando `respx` mockando `GET {AGENT_URL}/health` retornando `200 {"status":"ok"}`. Assert que `await agent.health()` retorna `True`
- [ ] **Passo 2:** Escrever teste para `list_tables()` mockando `GET /tables` com lista; assert que retorna lista de strings
- [ ] **Passo 3:** Escrever teste para `get_schema(table)` mockando `GET /schema/usuarios`; assert que retorna lista de `{name, type, nullable}`
- [ ] **Passo 4:** Escrever teste para `query(sql, limit)` mockando `POST /query` com `{columns,rows,count,truncated}`; assert que retorna estrutura tipada e que header `X-API-Key` foi enviado
- [ ] **Passo 5:** Escrever teste para `query()` rejeitando SQL com `INSERT/UPDATE/DELETE/DROP/ALTER` antes de chamar o agent (defesa em profundidade)
- [ ] **Passo 6:** Escrever teste para timeout configurado e retry em 5xx (1 retentativa)
- [ ] **Passo 7:** Rodar `pytest` e ver todos os 6 testes falharem
- [ ] **Passo 8:** Implementar classe `SybaseAgentClient` em `backend/app/services/sybase_agent.py` usando `httpx.AsyncClient` com `base_url=settings.AGENT_URL`, header `X-API-Key`, timeout e retry
- [ ] **Passo 9:** Rodar testes e ver passar
- [ ] **Passo 10:** Adicionar `GET /health/full` em `backend/app/routes/health.py` que chama `agent.health()` e retorna status do agent
- [ ] **Passo 11:** Rodar manualmente contra o agent real: `curl http://localhost:8000/health/full` deve retornar agent online
- [ ] **Passo 12:** Commitar: `feat(backend): sybase agent client with health/tables/schema/query`

### Tarefa 0.5: Descoberta do Schema Real

**Arquivos:**
- Criar: `backend/scripts/discover_schema.py`
- Criar: `docs/superpowers/specs/2026-05-17-sybase-schema-map.md`

- [ ] **Passo 1:** Criar script `backend/scripts/discover_schema.py` que:
  1. Chama agent.query com `SELECT table_name FROM sys.systable WHERE user_name(creator) = 'pref_aruja_sp' AND table_type IN ('BASE','VIEW') ORDER BY table_name`
  2. Para cada tabela, chama `/schema/{tabela}` e imprime nome+tipo de coluna
  3. Salva o output em `docs/superpowers/specs/2026-05-17-sybase-schema-map.md`
- [ ] **Passo 2:** Rodar o script com env vars setadas: `python backend/scripts/discover_schema.py`
- [ ] **Passo 3:** Revisar o arquivo gerado e identificar manualmente quais tabelas correspondem a:
  - Agentes/Consultores
  - Ligações/Chamadas
  - Qualificações
  - Pausas/Eventos de agente
  - Logins/Sessões
  - Listas e contatos
  - Campanhas
- [ ] **Passo 4:** Atualizar `2026-05-17-sybase-schema-map.md` com a seção **"Mapeamento Lógico"** ligando entidade → tabela real
- [ ] **Passo 5:** Commitar: `docs: discover and map Sybase IQ schema`

### Tarefa 0.6: Banco do Dashboard (PostgreSQL/SQLite)

**Arquivos:**
- Criar: `backend/app/models/__init__.py`, `backend/app/models/user.py`, `backend/app/models/query_log.py`
- Criar: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/`
- Criar: `backend/tests/test_user_model.py`

- [ ] **Passo 1:** Configurar SQLAlchemy em `backend/app/database.py` com engine lendo `DATABASE_URL` (fallback `sqlite:///./dev.db`)
- [ ] **Passo 2:** Criar modelo `User` em `backend/app/models/user.py` com colunas: `id` (uuid), `email` (unique), `password_hash`, `role` (enum: `gestor`/`consultor`/`admin`), `agente_id_sybase` (nullable str), `active` (bool), `created_at`, `updated_at`
- [ ] **Passo 3:** Criar modelo `QueryLog` com: `id`, `user_id`, `sql_hash`, `sql_text`, `duration_ms`, `row_count`, `truncated`, `created_at`
- [ ] **Passo 4:** Inicializar Alembic: `cd backend && alembic init alembic`; configurar `alembic/env.py` para usar `settings.DATABASE_URL` e `Base.metadata` dos models
- [ ] **Passo 5:** Gerar migration: `alembic revision --autogenerate -m "initial users and query_log"`
- [ ] **Passo 6:** Aplicar: `alembic upgrade head`
- [ ] **Passo 7:** Escrever teste em `backend/tests/test_user_model.py`: cria User, salva, lê de volta, valida campos
- [ ] **Passo 8:** Rodar `pytest` — testes passam
- [ ] **Passo 9:** Commitar: `feat(backend): user and query_log models with alembic`

### Tarefa 0.7: Autenticação (Login JWT)

**Arquivos:**
- Criar: `backend/app/auth/__init__.py`, `backend/app/auth/jwt.py`, `backend/app/auth/passwords.py`, `backend/app/auth/dependencies.py`
- Criar: `backend/app/routes/auth.py`
- Criar: `backend/tests/test_auth.py`
- Criar: `backend/scripts/seed_users.py`

- [ ] **Passo 1:** Escrever testes falhando em `backend/tests/test_auth.py`:
  - `POST /api/auth/login` com credenciais válidas retorna `{access_token, refresh_token, user: {id, email, role}}`
  - Credenciais inválidas → 401
  - `POST /api/auth/refresh` com refresh válido → novo access
  - `GET /api/me` sem token → 401; com token válido → user info
- [ ] **Passo 2:** Implementar `backend/app/auth/passwords.py` com bcrypt (`hash_password`, `verify_password`)
- [ ] **Passo 3:** Implementar `backend/app/auth/jwt.py` com `create_access_token`, `create_refresh_token`, `decode_token`
- [ ] **Passo 4:** Implementar `backend/app/auth/dependencies.py` com `get_current_user` (FastAPI Depends que extrai e valida JWT do header `Authorization: Bearer`)
- [ ] **Passo 5:** Implementar `backend/app/routes/auth.py` com `/login`, `/refresh`, `/me`
- [ ] **Passo 6:** Registrar router em `main.py` com prefixo `/api/auth` (e `/api` para `/me`)
- [ ] **Passo 7:** Rodar testes e verificar todos passam
- [ ] **Passo 8:** Criar `backend/scripts/seed_users.py` que cria um usuário gestor e um consultor com senhas conhecidas (apenas para dev)
- [ ] **Passo 9:** Rodar `python backend/scripts/seed_users.py`
- [ ] **Passo 10:** Commitar: `feat(backend): JWT auth with login/refresh/me`

### Tarefa 0.8: Frontend — Login + Layout Base

**Arquivos:**
- Criar: `frontend/lib/api.ts`, `frontend/lib/auth-context.tsx`, `frontend/lib/query-client.tsx`
- Criar: `frontend/app/login/page.tsx`
- Criar: `frontend/app/(dashboard)/layout.tsx`, `frontend/app/(dashboard)/page.tsx`
- Criar: `frontend/components/sidebar.tsx`, `frontend/components/header.tsx`, `frontend/components/theme-toggle.tsx`
- Criar: `frontend/middleware.ts`
- Criar: `frontend/.env.local.example`

- [ ] **Passo 1:** Criar `frontend/.env.local.example` com `NEXT_PUBLIC_API_URL=http://localhost:8000`
- [ ] **Passo 2:** Implementar `frontend/lib/api.ts` — cliente axios com baseURL, interceptor que adiciona `Authorization: Bearer <token>` (token vem de cookie httpOnly setado pela API)
- [ ] **Passo 3:** Implementar `frontend/lib/auth-context.tsx` com Provider de estado (user, login, logout)
- [ ] **Passo 4:** Criar `frontend/app/login/page.tsx` com form (email/senha) usando shadcn Form + react-hook-form + zod
- [ ] **Passo 5:** Criar `frontend/middleware.ts` redirecionando para `/login` se não autenticado em rotas protegidas
- [ ] **Passo 6:** Criar `frontend/app/(dashboard)/layout.tsx` com sidebar (links: Dashboard, Relatórios, Agentes, Histórico Login, Listas — só os visíveis baseados em role) + header (avatar + logout + tema)
- [ ] **Passo 7:** Criar `frontend/app/(dashboard)/page.tsx` com cards de placeholder mostrando "Bem-vindo, {nome}" + status de saúde do backend (chama `/health/full`)
- [ ] **Passo 8:** Implementar tema dark/light com `next-themes` e shadcn
- [ ] **Passo 9:** Testar manualmente: login com seed user → entra no dashboard, vê health do agent, faz logout
- [ ] **Passo 10:** Commitar: `feat(frontend): login + dashboard layout with auth flow`

### Tarefa 0.9: Deploy inicial no Railway

**Arquivos:**
- Criar: `frontend/Dockerfile` (ou `railway.json`)
- Criar: `backend/Dockerfile`
- Criar: `railway.toml` (config root)
- Criar: `docs/deploy.md`

- [ ] **Passo 1:** Criar `backend/Dockerfile` baseado em `python:3.11-slim`, instalando requirements.txt, copiando código e rodando `uvicorn`
- [ ] **Passo 2:** Criar `frontend/Dockerfile` multi-stage com `node:20-alpine`, build do Next.js (standalone mode) e runtime mínimo
- [ ] **Passo 3:** Atualizar `frontend/next.config.mjs` para `output: 'standalone'`
- [ ] **Passo 4:** Criar projeto Railway pelo dashboard: 2 serviços (`api` e `web`) + PostgreSQL plugin
- [ ] **Passo 5:** Configurar env vars no Railway:
  - `api`: `AGENT_URL`, `AGENT_API_KEY`, `DATABASE_URL` (do plugin), `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `SYBASE_SCHEMA=pref_aruja_sp`
  - `web`: `NEXT_PUBLIC_API_URL` (URL pública do serviço `api`)
- [ ] **Passo 6:** Conectar repo Git ao Railway; configurar build path por serviço (`/backend`, `/frontend`)
- [ ] **Passo 7:** Fazer deploy; ajustar até `/health/full` responder na URL pública
- [ ] **Passo 8:** Rodar migration no Railway (`alembic upgrade head`) via `Railway CLI` ou job de start
- [ ] **Passo 9:** Rodar seed inicial de usuários
- [ ] **Passo 10:** Login produção funciona; documentar URL pública e credenciais iniciais em `docs/deploy.md`
- [ ] **Passo 11:** Commitar: `chore: railway deployment setup`

### Verificação Sprint 0

- [ ] Login local funcional (gestor e consultor)
- [ ] Health-check end-to-end: navegador → frontend → backend → agent → "ok"
- [ ] Schema do Sybase IQ descoberto e documentado
- [ ] PostgreSQL com migrations aplicadas
- [ ] Deploy Railway funcionando
- [ ] Tests passando: `pytest backend/tests` e `npm test` (se houver) verdes
- [ ] **Antes de Sprint 1:** Confirmar com Thiago o mapeamento de tabelas/colunas

---

## SPRINT 1 — Relatórios Históricos Core (2 semanas)

> Objetivo: 2 relatórios completos (Qualificações + Aproveitamento) com sistema de filtros e export.

### Tarefa 1.1: Sistema de Filtros — Backend

**Arquivos:**
- Criar: `backend/app/schemas/filters.py`
- Criar: `backend/app/services/filter_options.py`
- Criar: `backend/app/routes/filters.py`
- Criar: `backend/tests/test_filters.py`

- [ ] **Passo 1:** Criar Pydantic schema `FilterOptions` com: `campanhas: list[Item]`, `equipes: list[Item]`, `agentes: list[Item]`, `status: list[Item]`, `qualificacoes: list[Item]` onde `Item = {id, label}`
- [ ] **Passo 2:** Escrever teste falhando para `GET /api/filters/options` retornar todas as listas
- [ ] **Passo 3:** Implementar `services/filter_options.py` com queries (usando os nomes reais descobertos no Sprint 0) e cache em memória (TTL 5min)
- [ ] **Passo 4:** Implementar route `GET /api/filters/options` com auth
- [ ] **Passo 5:** Rodar testes → passar
- [ ] **Passo 6:** Commitar: `feat(backend): filter options endpoint`

### Tarefa 1.2: Sistema de Filtros — Frontend

**Arquivos:**
- Criar: `frontend/components/filters/filter-bar.tsx`
- Criar: `frontend/components/filters/period-picker.tsx`
- Criar: `frontend/components/filters/multi-select.tsx`
- Criar: `frontend/lib/hooks/use-filters.ts`
- Criar: `frontend/lib/hooks/use-filter-options.ts`

- [ ] **Passo 1:** Criar hook `useFilterOptions` (React Query) que chama `/api/filters/options`
- [ ] **Passo 2:** Criar componente `<PeriodPicker>` com presets (Hoje, Ontem, 7d, 30d, Mês atual, Mês passado, Customizado) usando shadcn Calendar
- [ ] **Passo 3:** Criar componente `<MultiSelect>` reutilizável usando shadcn Command + Popover
- [ ] **Passo 4:** Criar componente `<FilterBar>` integrando Period + MultiSelects para Campanha, Equipe, Agente, Status, Qualificações + inputs numéricos para Duração Mín/Máx
- [ ] **Passo 5:** Criar hook `useFilters` que sincroniza filtros com URL (search params) para shareable links
- [ ] **Passo 6:** Testar manualmente: mudar filtros, ver URL atualizar, refresh manter estado
- [ ] **Passo 7:** Commitar: `feat(frontend): universal filter bar with URL sync`

### Tarefa 1.3: Relatório de Qualificações — Backend

**Arquivos:**
- Criar: `backend/app/schemas/qualificacoes.py`
- Criar: `backend/app/services/relatorio_qualificacoes.py`
- Criar: `backend/app/routes/relatorios.py`
- Criar: `backend/tests/test_relatorio_qualificacoes.py`

- [ ] **Passo 1:** Definir Pydantic schemas: `QualificacoesQuery` (filtros) e `QualificacoesResult` (linhas + totais)
- [ ] **Passo 2:** Escrever teste falhando: `POST /api/relatorios/qualificacoes` com filtros retorna agregação por tipo (CPC, Conversão+CPC, Outros, Desconhece)
- [ ] **Passo 3:** Escrever SQL parametrizado (usando mapeamento real do schema) agrupando por qualificação e período; aplicar todos os filtros
- [ ] **Passo 4:** Implementar `services/relatorio_qualificacoes.py` montando SQL via template seguro (parâmetros via `?` ou interpolação validada)
- [ ] **Passo 5:** Implementar route com cache de 60s (chave = hash dos filtros)
- [ ] **Passo 6:** Testes passam
- [ ] **Passo 7:** Commitar: `feat(backend): relatorio qualificacoes endpoint`

### Tarefa 1.4: Relatório de Qualificações — Frontend

**Arquivos:**
- Criar: `frontend/app/(dashboard)/relatorios/qualificacoes/page.tsx`
- Criar: `frontend/components/relatorios/qualificacoes-table.tsx`
- Criar: `frontend/components/relatorios/qualificacoes-chart.tsx`
- Criar: `frontend/lib/hooks/use-relatorio-qualificacoes.ts`

- [ ] **Passo 1:** Criar página com `<FilterBar>` no topo
- [ ] **Passo 2:** Criar hook `useRelatorioQualificacoes(filters)` chamando `/api/relatorios/qualificacoes`
- [ ] **Passo 3:** Criar `<QualificacoesTable>` com colunas: Qualificação, Quantidade, % do Total
- [ ] **Passo 4:** Criar `<QualificacoesChart>` com 2 gráficos ECharts (barras horizontais + pizza)
- [ ] **Passo 5:** Layout: filtros → cards de totais → chart → tabela
- [ ] **Passo 6:** Loading skeleton (shadcn Skeleton) durante fetch
- [ ] **Passo 7:** Empty state ("Nenhum dado para os filtros selecionados")
- [ ] **Passo 8:** Testar com dados reais
- [ ] **Passo 9:** Commitar: `feat(frontend): relatorio qualificacoes page`

### Tarefa 1.5: Relatório de Aproveitamento — Backend + Frontend

**Arquivos:**
- Criar: `backend/app/services/relatorio_aproveitamento.py`
- Criar: `backend/app/schemas/aproveitamento.py`
- Modificar: `backend/app/routes/relatorios.py`
- Criar: `backend/tests/test_relatorio_aproveitamento.py`
- Criar: `frontend/app/(dashboard)/relatorios/aproveitamento/page.tsx`
- Criar: `frontend/components/relatorios/aproveitamento-cards.tsx`
- Criar: `frontend/components/relatorios/aproveitamento-chart.tsx`

- [ ] **Passo 1:** Schema Pydantic: `AproveitamentoResult` com `ligacoes_periodo`, `qualificacoes_totais`, `qualificacoes_periodo`, série temporal `points: [{date, value}]`
- [ ] **Passo 2:** Teste falhando para `POST /api/relatorios/aproveitamento`
- [ ] **Passo 3:** Implementar service com SQL agregado por dia/semana/mês (granularidade definida pelo período)
- [ ] **Passo 4:** Implementar route, testes passam
- [ ] **Passo 5:** Criar página frontend com cards (3 KPIs grandes) + gráfico de linha temporal
- [ ] **Passo 6:** Commitar: `feat: relatorio aproveitamento end-to-end`

### Tarefa 1.6: Exportação CSV/Excel

**Arquivos:**
- Criar: `backend/app/services/export.py`
- Modificar: `backend/app/routes/relatorios.py` (adicionar `?format=csv|xlsx`)
- Criar: `backend/tests/test_export.py`
- Criar: `frontend/components/relatorios/export-button.tsx`

- [ ] **Passo 1:** Adicionar `openpyxl` ao `requirements.txt`; `pip install`
- [ ] **Passo 2:** Teste falhando: requisição com `Accept: text/csv` ou query `?format=csv` retorna CSV; `?format=xlsx` retorna binário Excel
- [ ] **Passo 3:** Implementar `services/export.py` com `to_csv(rows, headers)` e `to_xlsx(rows, headers, sheet_name)`
- [ ] **Passo 4:** Adaptar routes para retornar `StreamingResponse` quando `format` presente
- [ ] **Passo 5:** Criar `<ExportButton>` no frontend (Dropdown CSV/Excel) que dispara download
- [ ] **Passo 6:** Testar end-to-end
- [ ] **Passo 7:** Commitar: `feat: csv/xlsx export for reports`

### Verificação Sprint 1

- [ ] 2 relatórios funcionais com filtros completos
- [ ] Export CSV e Excel funcionando
- [ ] Cache de queries reduz repetidos hits no agent
- [ ] Filtros sincronizam com URL
- [ ] Loading e empty states cobertos
- [ ] Deploy Railway atualizado

---

## SPRINT 2 — Análise de Agentes (2 semanas)

> Objetivo: gráfico distribuição de tempo + tabelas Total/Médio + Histórico de Login.

### Tarefa 2.1: Backend — Tempos por Agente

**Arquivos:**
- Criar: `backend/app/schemas/agentes.py`
- Criar: `backend/app/services/agentes_tempos.py`
- Criar: `backend/app/routes/agentes.py`
- Criar: `backend/tests/test_agentes_tempos.py`

- [ ] **Passo 1:** Schema `AgenteTempos` com: `agente_id`, `agente_nome`, `ligacoes`, `tempo_ocioso_s`, `tempo_falando_s`, `tempo_tpa_s`, `tempo_mtpa_s`, `tempo_manual_s`, `tempo_intervalos_s`, `tempo_logado_s`, `tempo_trabalhando_s`
- [ ] **Passo 2:** Schemas `AgentesTotalQuery/Result` e `AgentesMedioQuery/Result`
- [ ] **Passo 3:** Testes falhando: `POST /api/agentes/tempo-total` e `POST /api/agentes/tempo-medio`
- [ ] **Passo 4:** Implementar SQLs com `SUM` (total) e `AVG`/divisão por dias (médio); aplicar filtros + agrupar por agente
- [ ] **Passo 5:** Endpoint `POST /api/agentes/distribuicao` para o gráfico (Ocioso/Falando/TPA/Pausa por agente)
- [ ] **Passo 6:** Testes passam
- [ ] **Passo 7:** Commitar: `feat(backend): agentes tempo total/medio/distribuicao`

### Tarefa 2.2: Frontend — Tabelas de Agentes

**Arquivos:**
- Criar: `frontend/app/(dashboard)/agentes/page.tsx`
- Criar: `frontend/components/agentes/agentes-table.tsx`
- Criar: `frontend/components/agentes/distribuicao-chart.tsx`

- [ ] **Passo 1:** Página `/agentes` com Tabs (shadcn): "Tempo Total", "Tempo Médio", "Distribuição (Gráfico)"
- [ ] **Passo 2:** Componente `<AgentesTable>` reutilizável recebendo dados e tipo (total/médio), com sort por coluna, busca por nome, formatação de tempo (`hh:mm:ss`)
- [ ] **Passo 3:** Componente `<DistribuicaoChart>` com ECharts (barras empilhadas horizontais, uma por agente)
- [ ] **Passo 4:** Permitir seleção múltipla de agentes para comparação no gráfico
- [ ] **Passo 5:** Reutilizar `<FilterBar>` (apenas Período, Equipe, Agente)
- [ ] **Passo 6:** Export Excel
- [ ] **Passo 7:** Commitar: `feat(frontend): agentes analysis page`

### Tarefa 2.3: Histórico de Login

**Arquivos:**
- Criar: `backend/app/services/historico_login.py`
- Criar: `backend/app/schemas/historico_login.py`
- Criar: `backend/tests/test_historico_login.py`
- Modificar: `backend/app/routes/agentes.py` (adicionar `/historico-login`)
- Criar: `frontend/app/(dashboard)/historico-login/page.tsx`
- Criar: `frontend/components/historico-login/sessoes-table.tsx`

- [ ] **Passo 1:** Schema `SessaoLogin` com `agente`, `entrada`, `saida` (nullable se ativa), `duracao_s`, `status` (ativa/encerrada)
- [ ] **Passo 2:** Teste falhando + SQL com `JOIN` agentes + tabela de sessões/logins
- [ ] **Passo 3:** Implementar route com paginação real (offset/limit) e ordenação
- [ ] **Passo 4:** Frontend: tabela paginada + filtro por agente/período + indicador visual de sessão ativa (badge verde)
- [ ] **Passo 5:** Commitar: `feat: historico de login end-to-end`

### Verificação Sprint 2

- [ ] Gráfico de distribuição comparativo entre agentes
- [ ] 2 tabelas (total + médio) com todas as colunas do PPTX
- [ ] Histórico de Login funcional
- [ ] Export disponível em todas as views
- [ ] Performance: queries < 2s no Sybase IQ (otimizar com índices se necessário)
- [ ] Deploy Railway atualizado

---

## SPRINT 3 — Tempo Real (Visão Gestor) (2 semanas)

> Objetivo: painel ao vivo da operação via SSE com polling adaptativo.

### Tarefa 3.1: Endpoint SSE de Tempo Real — Backend

**Arquivos:**
- Criar: `backend/app/services/realtime_polling.py`
- Criar: `backend/app/routes/realtime.py`
- Criar: `backend/tests/test_realtime.py`

- [ ] **Passo 1:** Schema `OperacaoSnapshot` com: `timestamp`, `total_logados`, `total_em_chamada`, `total_em_pausa`, `tempo_medio_ocioso_s`, `agentes: list[AgenteAoVivo{id, nome, status, tempo_no_status_s}]`
- [ ] **Passo 2:** Teste falhando: `GET /api/realtime/operacao` retorna stream SSE com `data: {snapshot}\n\n` a cada N segundos
- [ ] **Passo 3:** Implementar `services/realtime_polling.py` com função async que consulta agent (tempo médio de ociosidade real, status atual de cada agente)
- [ ] **Passo 4:** Implementar route SSE com `StreamingResponse` e `text/event-stream`; intervalo configurável via query `?interval=5`
- [ ] **Passo 5:** Garantir cleanup ao desconectar cliente
- [ ] **Passo 6:** Restringir endpoint a `role=gestor` via dependency
- [ ] **Passo 7:** Testes passam
- [ ] **Passo 8:** Commitar: `feat(backend): SSE realtime operacao endpoint`

### Tarefa 3.2: Frontend — Painel Operação Agora

**Arquivos:**
- Criar: `frontend/app/(dashboard)/operacao/page.tsx`
- Criar: `frontend/components/operacao/sse-snapshot-provider.tsx`
- Criar: `frontend/components/operacao/kpi-cards.tsx`
- Criar: `frontend/components/operacao/agentes-grid.tsx`
- Criar: `frontend/lib/hooks/use-sse.ts`

- [ ] **Passo 1:** Hook `useSSE(url, options)` com `EventSource`, reconnect automático, e detecção de `document.visibilityState` para ajustar intervalo (5s/30s)
- [ ] **Passo 2:** `<SSESnapshotProvider>` recebe URL e expõe snapshot via Context
- [ ] **Passo 3:** `<KpiCards>` mostra 4 KPIs grandes: Logados, Em Chamada, Em Pausa, Tempo Médio Ocioso
- [ ] **Passo 4:** `<AgentesGrid>` grade de cards (1 por agente) com cor por status (verde=falando, amarelo=ocioso, vermelho=pausa, cinza=offline) + cronômetro de "tempo no status"
- [ ] **Passo 5:** Animação suave em transições de status
- [ ] **Passo 6:** Indicador "Tempo de Ociosidade Real" destacado (conforme PPTX)
- [ ] **Passo 7:** Banner de aviso se SSE desconectado
- [ ] **Passo 8:** Testar manualmente com agent real
- [ ] **Passo 9:** Commitar: `feat(frontend): painel operacao ao vivo com SSE`

### Verificação Sprint 3

- [ ] SSE estável (reconnect funciona ao perder rede)
- [ ] Intervalo adaptativo verificado (DevTools Network mostra mudança)
- [ ] Indicadores corretos (validados contra dados do Sybase IQ)
- [ ] Apenas gestor consegue acessar
- [ ] Deploy Railway com SSE funcionando (verificar timeout Railway, pode precisar de keepalive)

---

## SPRINT 4 — Listas + Polimento (1-2 semanas)

> Objetivo: Relatório de Métricas das Listas + QA + docs finais.

### Tarefa 4.1: Relatório de Métricas das Listas

**Arquivos:**
- Criar: `backend/app/services/relatorio_listas.py`
- Criar: `backend/app/schemas/listas.py`
- Criar: `backend/tests/test_relatorio_listas.py`
- Modificar: `backend/app/routes/relatorios.py`
- Criar: `frontend/app/(dashboard)/relatorios/listas/page.tsx`
- Criar: `frontend/components/relatorios/listas-table.tsx`

- [ ] **Passo 1:** Schema `MetricasLista` com: `lista_id`, `nome`, `total_contatos`, `alcancados`, `qualificados`, `conversoes`, `taxa_alcance`, `taxa_conversao`
- [ ] **Passo 2:** Teste falhando + SQL com `JOIN` listas + ligações
- [ ] **Passo 3:** Implementar service e route
- [ ] **Passo 4:** Frontend: tabela com sort + gráfico de barras (taxa de conversão por lista) + drill-down ao clicar
- [ ] **Passo 5:** Commitar: `feat: relatorio metricas de listas`

### Tarefa 4.2: Polimento de UI/UX

- [ ] **Passo 1:** Auditar responsividade em mobile/tablet (cada página)
- [ ] **Passo 2:** Padronizar empty states com ilustração + CTA
- [ ] **Passo 3:** Adicionar tooltips em todas as colunas/KPIs com explicação
- [ ] **Passo 4:** Atalhos de teclado: `/` foca busca, `g r` vai para Relatórios, etc.
- [ ] **Passo 5:** Toasts de feedback em ações longas (export iniciado, etc.)
- [ ] **Passo 6:** Loading states consistentes (Skeleton + Spinner onde apropriado)
- [ ] **Passo 7:** Página 404 customizada
- [ ] **Passo 8:** Commitar: `polish: UI/UX consistency pass`

### Tarefa 4.3: Otimização de Performance

- [ ] **Passo 1:** Profilar queries lentas via `query_log` no Postgres
- [ ] **Passo 2:** Para queries > 2s: solicitar à equipe DBA criação de índices no Sybase IQ
- [ ] **Passo 3:** Ajustar cache TTL por relatório (maior em históricos antigos, menor em recentes)
- [ ] **Passo 4:** Bundle frontend: rodar `npm run build` e analisar com `@next/bundle-analyzer`; code-split rotas pesadas
- [ ] **Passo 5:** Lighthouse score > 90 em Performance, Accessibility, Best Practices
- [ ] **Passo 6:** Commitar: `perf: query optimization and bundle splitting`

### Tarefa 4.4: Testes E2E (Playwright)

**Arquivos:**
- Criar: `frontend/e2e/`
- Criar: `frontend/playwright.config.ts`

- [ ] **Passo 1:** `npm install -D @playwright/test && npx playwright install`
- [ ] **Passo 2:** Teste E2E: login → ver dashboard → abrir relatório de qualificações → aplicar filtro → exportar CSV
- [ ] **Passo 3:** Teste E2E: login como consultor → tentar acessar `/operacao` → ser bloqueado
- [ ] **Passo 4:** Adicionar CI step (GitHub Actions) rodando `pytest` + `playwright test`
- [ ] **Passo 5:** Commitar: `test: e2e playwright + CI`

### Tarefa 4.5: Documentação Final

- [ ] **Passo 1:** Atualizar `README.md` com: visão geral, prereqs, dev setup, deploy, troubleshooting
- [ ] **Passo 2:** Criar `docs/manual-usuario.md` com screenshots de cada tela e como usar filtros
- [ ] **Passo 3:** Criar `docs/api.md` apontando para `/docs` (FastAPI Swagger) + exemplos de uso da API
- [ ] **Passo 4:** Criar `docs/operacao.md`: como atualizar `AGENT_URL`, como adicionar usuário, como ler logs no Railway
- [ ] **Passo 5:** Commitar: `docs: complete project documentation`

### Verificação Sprint 4 (Aceite Final)

- [ ] Todos os 5 sprints com `[x]` checados
- [ ] Cobertura de testes ≥ 70% no backend
- [ ] Lighthouse ≥ 90 em todas as métricas principais
- [ ] Deploy Railway estável por 1 semana sem incidentes
- [ ] Manual de usuário entregue
- [ ] Sessão de demo com stakeholders Joytec realizada

---

## Apêndice — Comandos Úteis

```bash
# Backend
cd backend
.venv\Scripts\activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
pytest -v

# Frontend
cd frontend
npm install
npm run dev
npm run build
npm test
npx playwright test

# Descoberta de schema
python backend/scripts/discover_schema.py

# Seed users
python backend/scripts/seed_users.py
```

## Apêndice — Variáveis de Ambiente Necessárias

### `backend/.env`
```
AGENT_URL=https://featured-logistics-advertisement-beats.trycloudflare.com
AGENT_API_KEY=chave123abc456def789
AGENT_TIMEOUT_SECONDS=30
AGENT_DEFAULT_LIMIT=500
SYBASE_SCHEMA=pref_aruja_sp
DATABASE_URL=postgresql://user:pass@host:5432/dashboard
JWT_SECRET=<gerar com `openssl rand -hex 32`>
JWT_ALGORITHM=HS256
JWT_ACCESS_MINUTES=15
JWT_REFRESH_DAYS=7
CORS_ORIGINS=http://localhost:3000,https://<seu-frontend>.up.railway.app
```

### `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
