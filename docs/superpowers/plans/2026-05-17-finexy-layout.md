# Redesign Finexy — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans
> para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox
> (`- [ ]`) para rastreamento.

**Objetivo:** Reimplementar o shell visual do dashboard Metatron seguindo o design Finexy (sidebar 64px icon-only, topbar com profile pill, fundo bege quente, fonte Plus Jakarta Sans, cards com radius 22px, accent laranja).

**Arquitetura:** Rewrite total dos componentes `sidebar.tsx`, `header.tsx`, `(dashboard)/layout.tsx` e `globals.css`. Novos componentes `greeting.tsx` e `profile-pill.tsx`. Páginas internas inalteradas — apenas o shell muda.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4 (`@theme inline`), `next/font/google`, lucide-react, shadcn/ui (DropdownMenu mantido), next-themes (mantido inerte).

---

## Tarefa 1: Atualizar paleta e tokens em `globals.css`

**Arquivos:**
- Modificar: `frontend/app/globals.css`

- [ ] **Passo 1:** Substituir o bloco `:root` por:
  ```css
  :root {
    --bg: #f1efea;
    --panel: #ffffff;
    --ink: #0f0f0f;
    --ink-2: #1a1a1a;
    --muted: #8a8a8a;
    --muted-2: #a8a8a8;
    --line: #ececec;
    --line-2: #f1f1f1;
    --chip: #f5f5f5;
    --orange: #ff6a2c;
    --orange-2: #ff7a3d;
    --orange-soft: #ffe9dc;
    --green: #16a34a;
    --green-soft: #e8f7ee;
    --red: #e23b3b;
    --amber: #f4a51b;
    --shadow-card: 0 1px 0 rgba(0,0,0,.02);
    --shadow-logo: 0 6px 14px rgba(255,106,44,.35);
  }
  ```
- [ ] **Passo 2:** Substituir o bloco `.dark` (deixar idêntico ao `:root` por ora — dark mode adiado).
- [ ] **Passo 3:** Substituir o bloco `@theme inline` para mapear Tailwind v4:
  ```css
  @theme inline {
    --color-background: var(--bg);
    --color-foreground: var(--ink);
    --color-card: var(--panel);
    --color-card-foreground: var(--ink);
    --color-popover: var(--panel);
    --color-popover-foreground: var(--ink);
    --color-muted: var(--chip);
    --color-muted-foreground: var(--muted);
    --color-primary: var(--orange);
    --color-primary-foreground: #ffffff;
    --color-secondary: var(--chip);
    --color-secondary-foreground: var(--ink);
    --color-accent: var(--orange-soft);
    --color-accent-foreground: var(--orange);
    --color-destructive: var(--red);
    --color-destructive-foreground: #ffffff;
    --color-border: var(--line);
    --color-input: var(--chip);
    --color-ring: var(--orange);
    --radius: 22px;
    --radius-sm: 12px;
    --radius-md: 14px;
    --radius-lg: 18px;
    --radius-xl: 22px;
    --radius-2xl: 28px;
  }
  ```
- [ ] **Passo 4:** Adicionar regra global no `body`:
  ```css
  body {
    background: var(--bg);
    color: var(--ink);
    font-feature-settings: "ss01", "cv11";
    -webkit-font-smoothing: antialiased;
  }
  ```
- [ ] **Passo 5:** Commitar — `feat(layout): aplicar paleta Finexy em globals.css`

---

## Tarefa 2: Trocar fonte para Plus Jakarta Sans

**Arquivos:**
- Modificar: `frontend/app/layout.tsx`

- [ ] **Passo 1:** Ler `frontend/app/layout.tsx` para entender estrutura atual.
- [ ] **Passo 2:** Remover imports/uso de `Geist` e `Geist_Mono` do `next/font/google`.
- [ ] **Passo 3:** Adicionar import:
  ```typescript
  import { Plus_Jakarta_Sans } from "next/font/google"

  const jakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    variable: "--font-jakarta",
    display: "swap",
  })
  ```
- [ ] **Passo 4:** Aplicar a classe no `<body>`:
  ```tsx
  <body className={`${jakarta.variable} font-sans antialiased`}>
  ```
- [ ] **Passo 5:** Em `globals.css`, dentro do `@theme inline`, adicionar:
  ```css
  --font-sans: var(--font-jakarta), system-ui, sans-serif;
  ```
- [ ] **Passo 6:** Rodar `npm run dev` e verificar visualmente que a fonte mudou no navegador.
- [ ] **Passo 7:** Commitar — `feat(layout): trocar fonte para Plus Jakarta Sans`

---

## Tarefa 3: Reescrever `sidebar.tsx` (icon-only 64px)

**Arquivos:**
- Substituir totalmente: `frontend/components/layout/sidebar.tsx`

- [ ] **Passo 1:** Ler o atual `frontend/components/layout/sidebar.tsx` para extrair: lista de rotas, filtro por role, lógica de active state.
- [ ] **Passo 2:** Criar novo conteúdo do arquivo:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  Phone,
  BarChart3,
  FileText,
  Users,
  MessageSquare,
  LifeBuoy,
  LogOut,
  Radio,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

type Role = "gestor" | "consultor" | "admin"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutGrid
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Visão Geral", icon: LayoutGrid, roles: ["gestor", "consultor", "admin"] },
  { href: "/acionamentos", label: "Acionamentos", icon: Phone, roles: ["gestor", "admin"] },
  { href: "/metricas", label: "Métricas", icon: BarChart3, roles: ["gestor", "admin"] },
  { href: "/chamadas", label: "Chamadas", icon: FileText, roles: ["gestor", "consultor", "admin"] },
  { href: "/agentes", label: "Agentes", icon: Users, roles: ["gestor", "admin"] },
  { href: "/chat", label: "Chat Analítico", icon: MessageSquare, roles: ["gestor", "consultor", "admin"] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const visible = NAV_ITEMS.filter((item) =>
    user?.role ? item.roles.includes(user.role as Role) : false
  )

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <aside className="hidden md:flex w-16 shrink-0 flex-col items-center gap-[18px] py-2 pb-[14px]">
      <Link
        href="/"
        className="grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--orange)] text-white"
        style={{ boxShadow: "var(--shadow-logo)" }}
        title="Metatron"
        aria-label="Metatron — início"
      >
        <Radio className="h-[22px] w-[22px]" strokeWidth={2.4} />
      </Link>

      <nav
        className="mt-1.5 flex flex-col items-center gap-1 rounded-[36px] bg-white px-1.5 py-2.5"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label="Navegação principal"
      >
        {visible.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "grid h-[38px] w-[38px] place-items-center rounded-xl transition-colors",
                active
                  ? "bg-[#111] text-white"
                  : "text-[#b6b6b6] hover:bg-[#f6f6f6] hover:text-[#555]"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2.5">
        <Link
          href="/perfil"
          title="Perfil / Ajuda"
          aria-label="Perfil"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl text-[#b6b6b6] hover:bg-white hover:text-[#555]"
        >
          <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </Link>
        <button
          type="button"
          onClick={signOut}
          title="Sair"
          aria-label="Sair"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl text-[#b6b6b6] hover:bg-white hover:text-[#555]"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Passo 3:** Verificar visualmente: sidebar 64px, ícone laranja no topo, pill branca central com ícones, ativos pretos, hover cinza claro. Conferir filtro por role.
- [ ] **Passo 4:** Conferir rotas existentes (`/`, `/acionamentos`, `/metricas`, `/chamadas`, `/agentes`, `/chat`). Se alguma não existir, ajustar lista.
- [ ] **Passo 5:** Commitar — `feat(layout): sidebar icon-only no estilo Finexy`

---

## Tarefa 4: Criar `profile-pill.tsx`

**Arquivos:**
- Criar: `frontend/components/layout/profile-pill.tsx`

- [ ] **Passo 1:** Criar o arquivo com:

```tsx
"use client"

import { ChevronDown, LogOut, User as UserIcon } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth-context"

function getInitial(text: string | undefined | null): string {
  if (!text) return "U"
  const trimmed = text.trim()
  return trimmed.charAt(0).toUpperCase() || "U"
}

function truncateEmail(email: string | undefined | null, max = 18): string {
  if (!email) return ""
  if (email.length <= max) return email
  return email.slice(0, max - 1) + "…"
}

export function ProfilePill() {
  const { user, signOut } = useAuth()

  const initial = getInitial(user?.email)
  const displayName = user?.email?.split("@")[0] ?? "Usuário"
  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ""

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex cursor-pointer items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-3.5"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label="Menu do usuário"
      >
        <span
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--orange-soft)] text-sm font-bold text-[var(--orange)]"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="flex flex-col items-start leading-[1.15]">
          <span className="text-[13.5px] font-bold text-[var(--ink)]">{displayName}</span>
          <span className="text-[11px] text-[#9a9a9a]">{truncateEmail(user?.email)}</span>
        </span>
        <ChevronDown className="ml-0.5 h-3.5 w-3.5 text-[#bdbdbd]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{displayName}</span>
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            {role && <span className="mt-1 text-xs text-[var(--orange)]">{role}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Passo 2:** Commitar — `feat(layout): adicionar ProfilePill no estilo Finexy`

---

## Tarefa 5: Reescrever `header.tsx`

**Arquivos:**
- Substituir totalmente: `frontend/components/layout/header.tsx`

- [ ] **Passo 1:** Ler o atual `frontend/components/layout/header.tsx` para identificar props existentes (ex: `onMenuClick` para mobile).
- [ ] **Passo 2:** Criar novo conteúdo:

```tsx
"use client"

import { Bell, Info, Menu, Search } from "lucide-react"
import { ProfilePill } from "./profile-pill"
import { ThemeToggle } from "./theme-toggle"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <div className="flex items-center justify-between gap-[18px] px-1 py-0.5">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onMenuClick}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#444] md:hidden"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Abrir menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="text-[20px] font-extrabold tracking-[-0.01em] text-[var(--ink)]">
          Metatron
        </div>
      </div>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          className="hidden h-10 w-10 place-items-center rounded-full bg-white text-[#444] sm:grid"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Buscar"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-[#444]"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Notificações"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <span
            className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full bg-[var(--orange)]"
            style={{ border: "2px solid #fff" }}
          />
        </button>
        <button
          type="button"
          className="hidden h-10 w-10 place-items-center rounded-full bg-white text-[#444] sm:grid"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Informações"
        >
          <Info className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <ThemeToggle />
        <ProfilePill />
      </div>
    </div>
  )
}
```

- [ ] **Passo 3:** Commitar — `feat(layout): novo header no estilo Finexy`

---

## Tarefa 6: Reestilizar `theme-toggle.tsx` (manter funcional)

**Arquivos:**
- Modificar: `frontend/components/layout/theme-toggle.tsx`

- [ ] **Passo 1:** Ler o atual para preservar lógica de `next-themes`.
- [ ] **Passo 2:** Reescrever mantendo lógica, ajustando wrapper visual:

```tsx
"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div
        className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#444]"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-hidden="true"
      />
    )
  }

  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#444] transition-colors hover:bg-[#f6f6f6]"
      style={{ boxShadow: "var(--shadow-card)" }}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {isDark ? (
        <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      ) : (
        <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
      )}
    </button>
  )
}
```

- [ ] **Passo 3:** Commitar — `feat(layout): reestilizar ThemeToggle no padrão Finexy`

---

## Tarefa 7: Criar `greeting.tsx`

**Arquivos:**
- Criar: `frontend/components/layout/greeting.tsx`

- [ ] **Passo 1:** Criar o arquivo:

```tsx
"use client"

import { useAuth } from "@/lib/auth-context"

function getPeriodGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

export function Greeting() {
  const { user } = useAuth()
  const firstName = user?.email?.split("@")[0]?.split(".")[0] ?? ""
  const capitalized = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : ""

  return (
    <div className="px-1">
      <h1 className="m-0 mb-1 text-[34px] font-bold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
        {getPeriodGreeting()}{capitalized && `, ${capitalized}`}
      </h1>
      <p className="m-0 text-sm text-[#7c7c7c]">
        Acompanhe suas operações, métricas e ligações em tempo real.
      </p>
    </div>
  )
}
```

- [ ] **Passo 2:** Commitar — `feat(layout): adicionar componente Greeting`

---

## Tarefa 8: Reescrever `(dashboard)/layout.tsx`

**Arquivos:**
- Substituir totalmente: `frontend/app/(dashboard)/layout.tsx`

- [ ] **Passo 1:** Ler o atual para extrair lógica de autenticação e mobile sidebar (state, overlay).
- [ ] **Passo 2:** Criar novo conteúdo:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Greeting } from "@/components/layout/greeting"
import { useAuth } from "@/lib/auth-context"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)]">
        <div className="text-sm text-[var(--muted)]">Carregando…</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen gap-[18px] bg-[var(--bg)] px-[22px] py-[18px]">
      <Sidebar />

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col items-center gap-[18px] bg-[var(--bg)] py-2 pb-[14px] md:hidden">
            <Sidebar />
          </aside>
        </>
      )}

      <main className="flex min-w-0 flex-1 flex-col gap-4">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <Greeting />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Passo 3:** Confirmar que o hook `useAuth` expõe `isLoading` (se não, ajustar para o nome usado: `loading`, `pending`, etc.).
- [ ] **Passo 4:** Commitar — `feat(layout): novo dashboard layout no estilo Finexy`

---

## Tarefa 9: Auditoria visual — rodar e verificar

**Arquivos:**
- Sem modificações de código (apenas verificação)

- [ ] **Passo 1:** `npm run dev` em `frontend/` e abrir `http://localhost:3000`.
- [ ] **Passo 2:** Login e navegar por todas as rotas: `/`, `/acionamentos`, `/metricas`, `/chamadas`, `/agentes`, `/chat`.
- [ ] **Passo 3:** Para cada rota, verificar:
  - Background bege (`#f1efea`) em toda a viewport
  - Sidebar 64px com ícones funcionando, ativo destacado em preto
  - Topbar com profile pill, icon buttons, theme toggle
  - Greeting renderizando com nome do usuário
  - Cards das páginas internas com radius arredondado
  - Sem "ilhas brancas" destoando do fundo bege
- [ ] **Passo 4:** Listar quaisquer ajustes pontuais necessários nas páginas internas (cores hardcoded, contrastes ruins).
- [ ] **Passo 5:** Se aparecer auditoria de cores, aplicar fix em lote OU criar tarefa de follow-up.

---

## Tarefa 10: Cards das páginas — ajustes pontuais

**Arquivos:**
- A definir pela auditoria da Tarefa 9 (provavelmente arquivos em `frontend/components/dashboard/*` ou `frontend/components/ui/card.tsx`)

- [ ] **Passo 1:** Identificar componentes Card que usam `bg-white` hardcoded em vez de `bg-card`.
- [ ] **Passo 2:** Substituir por `bg-card` para herdar a paleta.
- [ ] **Passo 3:** Confirmar que `Card` do shadcn (`components/ui/card.tsx`) usa `border-radius: var(--radius)` (que agora é 22px).
- [ ] **Passo 4:** Se algum Card visual tem radius menor desejado, ajustar explicitamente com `rounded-2xl` (que mapeia para 28px) ou `rounded-xl` (22px).
- [ ] **Passo 5:** Re-verificar visualmente as páginas listadas na Tarefa 9.
- [ ] **Passo 6:** Commitar — `style(layout): ajustar cards das páginas internas para paleta Finexy`

---

## Tarefa 11: Verificação final (skill: verification-before-completion)

**Arquivos:**
- Sem modificações

- [ ] **Passo 1:** Rodar `npm run lint` em `frontend/` — corrigir warnings introduzidos pelo redesign.
- [ ] **Passo 2:** Rodar `npm run build` em `frontend/` — verificar que não há erros de TypeScript.
- [ ] **Passo 3:** Side-by-side: abrir `Finexy Dashboard.html` no navegador e comparar com `http://localhost:3000` — sidebar, topbar, fundo, tipografia devem casar.
- [ ] **Passo 4:** Verificar Playwright tests (`npm run test:e2e` ou similar) — alguns seletores podem ter quebrado pela mudança de classes; ajustar testes se necessário.
- [ ] **Passo 5:** Commitar quaisquer ajustes finais — `chore(layout): ajustes finais Finexy redesign`

---

## Notas de implementação

- **Tailwind v4 + cores customizadas:** ao usar `bg-[var(--orange)]` em tempo de JIT, Tailwind precisa que o valor esteja entre colchetes (não interpolado). Confirmar que o build aceita `bg-[#ff6a2c]` se a sintaxe `bg-[var(...)]` der problema.
- **Mobile sidebar:** mantido drawer simples. Versão mobile completa (bottom tab) é tarefa futura.
- **Dark mode:** os tokens `.dark` apontam para os mesmos valores claros. Toggle continua funcional no `next-themes` mas não muda nada visualmente. Aceito como adiado.
- **`useAuth` API:** o plano assume `{ user, isLoading, signOut }`. Se for `{ user, loading, logout }` ou outro nome, ajustar consistentemente em sidebar, header, profile-pill, layout.
- **`/perfil` route:** se essa rota não existir, criar placeholder ou trocar o link do help/profile para `/`.
