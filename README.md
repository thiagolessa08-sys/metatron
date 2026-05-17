# Dashboard Analítico — Discadora Joytec

Dashboard web para análise operacional do sistema de discadora Joytec, conectado ao Sybase IQ via Java Agent HTTP.

## Arquitetura

```
frontend/   → Next.js 14 + Tailwind + shadcn/ui + ECharts
backend/    → Python FastAPI + httpx (proxy para o Java Agent)
docs/       → Design, plano de implementação e manual
```

## Pré-requisitos

- Node.js 20+
- Python 3.11+
- Java Agent rodando e acessível (URL configurada em `.env`)

## Desenvolvimento local

```bash
# 1. Copiar variáveis de ambiente
cp .env.example backend/.env
cp .env.example frontend/.env.local   # só NEXT_PUBLIC_API_URL

# 2. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# 3. Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:3000

## Deploy (Railway)

- Serviço `api` → pasta `backend/`, Dockerfile incluído
- Serviço `web` → pasta `frontend/`, Dockerfile incluído
- Plugin PostgreSQL → `DATABASE_URL` injetada automaticamente

Ver `docs/operacao.md` para atualizar `AGENT_URL` quando o tunnel mudar.

## Documentação

- [Design](docs/superpowers/specs/2026-05-17-joytec-dashboard-design.md)
- [Plano de Implementação](docs/superpowers/plans/2026-05-17-joytec-dashboard.md)
