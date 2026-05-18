from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import health as health_router
from app.routes import auth as auth_router
from app.routes import filters as filters_router
from app.routes import relatorios as relatorios_router
from app.routes import agentes as agentes_router
from app.routes import operacao as operacao_router
from app.routes import chat as chat_router

app = FastAPI(
    title="Dashboard Joytec API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router.router, tags=["health"])
app.include_router(auth_router.router, tags=["auth"])
app.include_router(filters_router.router, tags=["filters"])
app.include_router(relatorios_router.router, tags=["relatorios"])
app.include_router(agentes_router.router, tags=["agentes"])
app.include_router(operacao_router.router, tags=["operacao"])
app.include_router(chat_router.router, tags=["chat"])
