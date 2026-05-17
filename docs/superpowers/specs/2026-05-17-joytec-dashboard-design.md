# Dashboard Analítico Discadora Joytec — Documento de Design

**Data:** 2026-05-17
**Autor:** Thiago + Claude (via superpowers)
**Status:** Aprovado, pendente revisão final

---

## 1. Objetivo

Construir um **dashboard analítico web** para a operação da Discadora Joytec (call center), conectado ao banco Sybase IQ (`IQHML`, schema `pref_aruja_sp`) através de um Java Agent HTTP intermediário. O dashboard atende duas visões — **Gestor** e **Consultor** — com relatórios históricos, análise de produtividade por agente, monitoramento em tempo real e métricas de listas.

Base de requisitos: `Relatórios Front.pptx` (Solicitação de Melhorias - 18/09/2025).

---

## 2. Stack Técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui | UI moderna, componentes prontos, deploy fácil no Railway |
| **Gráficos** | Apache ECharts (`echarts-for-react`) | Cobre todos os tipos do PPTX (distribuição, comparação, tempo real, tabelas-pivot) |
| **Backend** | Python 3.11+ + FastAPI + `httpx` (cliente do agent) + `pydantic` | Proxy autenticado entre frontend e Java Agent; melhor para queries analíticas |
| **Auth dashboard** | JWT (access + refresh) + bcrypt | Stateless, escala bem no Railway |
| **Banco do dashboard** | SQLite local (dev) → PostgreSQL Railway (prod) | Armazena usuários, sessões, configurações, cache de queries |
| **Tempo real** | SSE (Server-Sent Events) com polling adaptativo no backend | Push unidirecional simples; backend faz polling 5s/30s no agent |
| **Deploy** | Railway (2 serviços: `web` Next.js + `api` FastAPI) | Conforme requisito |
| **Banco de dados-fonte** | Sybase IQ via Java Agent HTTP | Sem driver Sybase no backend — apenas HTTP/JSON |

---

## 3. Arquitetura

```
┌─────────────┐     HTTPS      ┌──────────────┐    HTTPS    ┌──────────────────┐    JDBC    ┌────────────┐
│  Navegador  │ ◀──SSE/REST──▶ │   Next.js    │ ◀─REST────▶ │   FastAPI        │ ◀────────▶ │ Java Agent │
│ (Dashboard) │                │  (frontend)  │             │   (backend)      │            │ + Cloudflare│
└─────────────┘                │  Railway     │             │   Railway        │            │   Tunnel    │
                               └──────────────┘             └────┬─────────────┘            └─────┬──────┘
                                                                 │                                │
                                                                 ▼                                ▼
                                                         ┌──────────────┐                  ┌──────────────┐
                                                         │ PostgreSQL   │                  │  Sybase IQ   │
                                                         │ (usuários,   │                  │   IQHML      │
                                                         │  configs,    │                  │ pref_aruja_sp│
                                                         │  cache)      │                  │              │
                                                         └──────────────┘                  └──────────────┘
```

### Fluxo de uma request analítica:
1. Frontend envia `GET /api/relatorios/qualificacoes?periodo=...&campanha=...` com JWT
2. Backend valida JWT, monta SQL parametrizado (`SELECT ... FROM pref_aruja_sp.tabela WHERE ...`)
3. Backend chama `POST {AGENT_URL}/query` com `X-API-Key` e o SQL
4. Agent executa no Sybase IQ e retorna `{columns, rows, count, truncated}`
5. Backend transforma `rows` em objetos tipados (Pydantic), aplica cache se aplicável
6. Frontend renderiza tabela/gráfico com ECharts

### Fluxo de tempo real (Sprint 3):
1. Frontend abre conexão SSE: `GET /api/realtime/operacao`
2. Backend mantém loop interno: a cada 5s consulta agent para status atual dos agentes
3. Backend envia evento SSE com snapshot atualizado
4. Frontend reduz para 30s quando `document.hidden === true`

---

## 4. Conexão com Sybase IQ via Agent

### Variáveis de ambiente (backend)
```env
AGENT_URL=https://featured-logistics-advertisement-beats.trycloudflare.com
AGENT_API_KEY=chave123abc456def789
AGENT_TIMEOUT_SECONDS=30
AGENT_DEFAULT_LIMIT=500
AGENT_MAX_LIMIT=5000
SYBASE_SCHEMA=pref_aruja_sp
```

### Cliente HTTP (`backend/app/services/sybase_agent.py`)
- Wrapper único centraliza autenticação, retries (1x em 5xx), timeout, logging
- Expõe: `health()`, `list_tables()`, `get_schema(table)`, `query(sql, limit)`
- **Nunca** propaga `AGENT_API_KEY` ao frontend
- Bloqueia DDL/DML defensivamente no backend além do bloqueio do agent
- Loga todas as queries no `query_log` (Postgres) com hash, duração, count, user_id

### Paginação
Como o limit do agent é 500 (padrão) e 5000 (máx), queries grandes usam:
```sql
SELECT ... FROM pref_aruja_sp.tabela
WHERE ...
ORDER BY chave_estavel
START AT N ROW LIMIT 500   -- sintaxe Sybase IQ
```

### Descoberta de schema (Sprint 0)
Mapear nomes reais das tabelas/colunas que precisaremos. Heurística inicial (a confirmar via `/tables` e `/schema/{tabela}`):
- `agentes` ou `consultores` (cadastro)
- `ligacoes` ou `chamadas` (fato de ligação)
- `qualificacoes` (tipos: CPC, Conversão, Outros, Desconhece)
- `pausas` ou `eventos_agente` (tempos)
- `logins` ou `sessoes` (histórico de login)
- `listas` e `contatos_lista` (campanhas)
- `campanhas`

---

## 5. Perfis de Usuário

| Perfil | Acessa |
|---|---|
| **Gestor** | Tudo: relatórios históricos, tempo real, agentes (todos), listas, histórico de login |
| **Consultor** | Apenas seus próprios dados: tempo de pausa próprio, suas chamadas, suas qualificações |
| **Admin** (futuro) | Gestor + gestão de usuários do dashboard |

### Estratégia de identidade
- **Sprint 0:** tabela `usuarios` local (PostgreSQL) com `email`, `password_hash`, `role`, `agente_id_sybase` (FK lógico para o agente no Sybase)
- **Futuro:** quando o schema do Sybase estiver mapeado, avaliar reaproveitar tabela de agentes da Joytec para login (se houver hash de senha lá)

### Autorização
- JWT carrega `user_id`, `role`, `agente_id_sybase`
- Middleware FastAPI: decorator `@require_role("gestor")` em endpoints sensíveis
- Endpoints de consultor filtram automaticamente por `agente_id_sybase` do JWT

---

## 6. Módulos / Telas

Mapeamento direto dos slides do PPTX:

### 📊 Tempo Real (Gestor) — Sprint 3
- **Operação Agora:** cards por agente com status (Ocioso/Falando/Pausa/Logado)
- **Indicadores agregados:** total logados, em chamada, em pausa, tempo médio
- **Tempo de Ociosidade Real:** medição precisa por agente (não confunde "ocioso" com "logado")

### 📈 Relatórios Históricos — Sprint 1
- **Filtros universais:** Período (date range), Campanha, Equipe, Agente, Status, Qualificações, Duração Máx, Duração Mín
- **Relatório de Qualificações:** tabela + gráfico de barras + pizza (CPC, Conversão+CPC, Outros, Desconhece)
- **Relatório de Aproveitamento:** Ligações (período), Qualificações Totais, Qualificações (período)
- **Export CSV/Excel:** com filtros aplicados

### 👥 Agentes — Sprint 2
- **Gráfico Tempo Total:** distribuição empilhada (Ocioso/Falando/TPA/Pausa) por agente, com filtro de período
- **Tabela Tempo Total:** Agente, Ligações, Ocioso, Falando, TPA, MTPA, Manual, Intervalos, Logado, Trabalhando
- **Tabela Tempo Médio:** mesmas colunas em médias
- **Comparação entre agentes:** seleção múltipla com gráfico comparativo

### 🔐 Histórico de Login — Sprint 2
- Entradas/saídas por agente
- Período (data/hora cada sessão)
- Status (ativo/inativo)
- Duração de sessão

### 📋 Listas — Sprint 4
- Métricas de aproveitamento por lista
- Total de contatos, alcançados, qualificados, conversão

---

## 7. Decisões Técnicas Chave

| Decisão | Razão |
|---|---|
| **Apenas SELECT no backend** | Agent só permite SELECT; backend valida antes de enviar como defesa em profundidade |
| **SQL montado server-side** | Frontend nunca envia SQL; reduz superfície de injection (queries são parametrizadas no backend) |
| **Cache curto (60s)** para relatórios pesados | Reduz carga no agent; invalida ao mudar filtros |
| **SSE em vez de WebSocket** | Unidirecional bastante; reconnect automático nativo do browser |
| **TypeScript estrito** | Contratos de API tipados (zod ou orval gerando types da OpenAPI do FastAPI) |
| **Monorepo simples** | `frontend/` + `backend/` em pastas; Railway aceita 2 serviços de um mesmo repo |
| **PostgreSQL no Railway** | Para usuários/cache/logs; SQLite só em dev |
| **i18n: pt-BR único** | Sem necessidade de outros idiomas — economiza complexidade |
| **Tema: claro + escuro** | shadcn/ui já entrega ambos |

---

## 8. Não-Objetivos (Out of Scope)

- ❌ Editar/inserir dados no Sybase IQ (agent bloqueia, e tampouco é solicitado)
- ❌ App mobile nativo (a UI será responsiva, mas web-first)
- ❌ Integração com PABX/telefonia diretamente (a discadora Joytec já faz isso)
- ❌ Sistema completo de gerenciamento de usuários no Sprint 1 (apenas seed manual; CRUD de usuários fica para fase futura)
- ❌ Alertas/notificações push (Sprint 3 mostra indicadores em tempo real, mas sem disparo de SMS/email)
- ❌ Internacionalização

---

## 9. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| URL do agent muda (Cloudflare Tunnel temporário) | `AGENT_URL` como env var no Railway; restart leve do serviço API |
| Queries pesadas estouram timeout (30s) | Paginação obrigatória, cache 60s, índices conhecidos no Sybase IQ |
| Schema real diferente do hipotetizado | Sprint 0 inclui descoberta via `/tables` antes de qualquer SQL real |
| Agent fica offline | Endpoint `/api/health` no backend testa agent; UI mostra banner "indisponível" |
| Segredo `AGENT_API_KEY` vazar | Apenas backend conhece; Railway env vars; nunca exposta no frontend |
| JWT roubado | Refresh tokens curtos (15min access / 7d refresh); logout invalida server-side |

---

## 10. Roadmap (resumo)

| Sprint | Duração | Foco | Entrega |
|---|---|---|---|
| **0** | 1 sem | Fundação | Login + dashboard vazio + health-check end-to-end |
| **1** | 2 sem | Relatórios Core | Filtros + Qualificações + Aproveitamento + Export |
| **2** | 2 sem | Agentes | Gráficos/tabelas Tempo Total + Médio + Histórico Login |
| **3** | 2 sem | Tempo Real | Painel Operação Agora via SSE |
| **4** | 1-2 sem | Listas + Polimento | Métricas de Listas + QA + Docs |

**Total:** ~8-9 semanas.

Detalhamento de tarefas em `docs/superpowers/plans/2026-05-17-joytec-dashboard.md`.
