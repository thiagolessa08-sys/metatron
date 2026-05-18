# Redesign de Layout — Finexy → Metatron

**Data:** 2026-05-17
**Autor:** Thiago Lessa + Claude
**Status:** Aprovado — pronto para writing-plans

---

## Objetivo

Reimplementar a casca visual do dashboard Metatron seguindo fielmente o design do arquivo `Finexy Dashboard.html`. As páginas internas (Acionamentos, Métricas, Relatórios, Agentes, Chat) mantêm conteúdo e lógica — apenas o **shell visual** (sidebar, header, layout, paleta, tipografia, cards) é refeito.

**Escopo desta entrega:**
- Sidebar icon-only (64px) com pill container central
- Topbar com profile pill e icon buttons no estilo Finexy
- Paleta cores quente (bege + laranja) e fonte Plus Jakarta Sans
- Background warm (`#f1efea`) e cards arredondados (22px)
- Apenas tema claro (dark mode adiado)

**Fora de escopo:**
- Redesign do conteúdo de cada página
- Implementação do dark mode (decisão adiada)
- Recriar widgets específicos do Finexy (wallets, credit cards, balance) — esses são de domínio financeiro, não call center

---

## Abordagem aprovada

**Abordagem B — Rewrite dos componentes de layout.** Reescrever `sidebar.tsx`, `header.tsx`, `(dashboard)/layout.tsx` do zero. Atualizar `globals.css` com tokens Finexy. Páginas internas inalteradas.

---

## Design tokens

### Paleta (light theme, em CSS variables)

```css
--bg: #f1efea;          /* fundo principal — bege quente */
--panel: #ffffff;       /* cards, sidebar pill, topbar pill */
--ink: #0f0f0f;         /* texto primário */
--ink-2: #1a1a1a;       /* texto secundário forte */
--muted: #8a8a8a;       /* texto auxiliar */
--muted-2: #a8a8a8;     /* texto fraco */
--line: #ececec;        /* bordas */
--line-2: #f1f1f1;      /* bordas suaves */
--chip: #f5f5f5;        /* chips, search inputs */
--orange: #ff6a2c;      /* accent primário */
--orange-2: #ff7a3d;    /* gradient secundário */
--orange-soft: #ffe9dc; /* fundo soft do laranja */
--green: #16a34a;       /* status positivo */
--green-soft: #e8f7ee;  /* pill positiva */
--red: #e23b3b;         /* erro/negativo */
--amber: #f4a51b;       /* alerta */
```

Estas variáveis serão expostas no `:root` e mapeadas para o `@theme inline` do Tailwind v4 — Tailwind continua acessível via classes como `bg-background`, `text-foreground`, mas os valores apontam para a paleta Finexy.

### Mapeamento Tailwind v4 (`@theme inline`)

```css
@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--ink);
  --color-card: var(--panel);
  --color-card-foreground: var(--ink);
  --color-muted: var(--chip);
  --color-muted-foreground: var(--muted);
  --color-primary: var(--orange);
  --color-primary-foreground: #ffffff;
  --color-accent: var(--orange-soft);
  --color-accent-foreground: var(--orange);
  --color-border: var(--line);
  --color-input: var(--chip);
  --color-ring: var(--orange);

  --radius: 22px;
  --radius-sm: 12px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 22px;
  --radius-2xl: 28px;
  --radius-full: 999px;
}
```

### Tipografia

- **Família principal:** `Plus Jakarta Sans` (Google Fonts, weights 400/500/600/700/800)
- **Fallback:** `system-ui, sans-serif`
- **Carregamento:** via `next/font/google` no `app/layout.tsx` (substitui Geist Sans atual)
- **Tamanhos-base:**
  - h1: 34px / 700 / -0.02em
  - h2 (card title): 18px / 700
  - h3 (small card title): 14px / 600
  - body: 13–14px / 400
  - caption: 11.5–12.5px / 500

### Sombras e bordas

```css
--shadow-card: 0 1px 0 rgba(0,0,0,.02);
--shadow-logo: 0 6px 14px rgba(255,106,44,.35);
--shadow-soft: 0 2px 0 rgba(0,0,0,.02);
```

Bordas dos cards usam `border-radius: 22px`. Pills (topbar, profile, tabs) usam `999px`. Botões internos usam `14px`.

---

## Componentes

### 1. Layout shell — `app/(dashboard)/layout.tsx`

**Estrutura:**

```
<div class="stage">
  <Sidebar />          // 64px, vertical
  <main class="main">
    <Header />         // topbar com tabs + profile
    <Greeting />       // h1 "Bom dia, {nome}" + descrição
    <div>{children}</div>
  </main>
</div>
```

**Stage:**
- `min-h-screen flex gap-[18px] p-[18px_22px_22px_22px]`
- `background: var(--bg)` aplicado no `body` (em `globals.css`)

**Main:**
- `flex-1 min-w-0 flex flex-col gap-4`

**Greeting (novo componente):**
- Mostra "Bom dia/Boa tarde/Boa noite, {primeiro nome do usuário}"
- Subtítulo: "Acompanhe suas operações em tempo real."
- Sempre presente acima do conteúdo da rota
- Em rotas específicas (configurações, perfil) pode ser ocultado via prop ou contexto

### 2. Sidebar — `components/layout/sidebar.tsx` (rewrite total)

**Estrutura visual:**

```
┌─────┐
│ ▲   │  ← logo (44x44, laranja, sombra)
│     │
│ ┌─┐ │  ← pill container white, radius 36px
│ │■│ │  ← ícone ativo (bg #111, color #fff)
│ │·│ │  ← ícones inativos (color #b6b6b6, hover bg #f6f6f6)
│ │·│ │
│ │·│ │
│ │·│ │
│ │·│ │
│ └─┘ │
│     │
│ ?   │  ← help (foot)
│ ⏻   │  ← logout (foot)
└─────┘
```

**Specs:**
- Container: `width: 64px; flex: 0 0 64px; display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 8px 0 14px`
- Logo: 44×44, `border-radius: 14px`, `background: var(--orange)`, ícone SVG dentro
  - Substituir o triângulo do Finexy pelo símbolo Metatron (vou usar um ícone abstrato de antena/comunicação — sugiro `Radio` do lucide-react ou um SVG custom estilizado)
- Pill nav: `background: #fff; border-radius: 36px; padding: 10px 6px; display: flex; flex-direction: column; gap: 4px`
- Ícone do nav: 38×38, `border-radius: 12px`, `display: grid; place-items: center`
  - Estado normal: `color: #b6b6b6`
  - Hover: `background: #f6f6f6; color: #555`
  - Ativo: `background: #111; color: #fff`
- Separador: `width: 24px; height: 1px; background: #eee; margin: 4px 0`
- Foot: `margin-top: auto; display: flex; flex-direction: column; gap: 10px`

**Comportamento:**
- Cada ícone tem `title` (HTML tooltip nativo) e `aria-label` com o nome da rota
- Active state: detectado via `usePathname()` — match exato ou prefixo
- Click no ícone navega via `Link` do Next
- Logout: chama `signOut()` do AuthContext
- Help: link para `/perfil` (ou rota de ajuda futura)

**Itens de navegação (mantém os atuais, sem labels visíveis):**

| Ícone (lucide) | Rota | Tooltip |
|---|---|---|
| `LayoutGrid` | `/` | Visão Geral |
| `Phone` | `/acionamentos` | Acionamentos |
| `BarChart3` | `/metricas` | Métricas |
| `FileText` | `/chamadas` | Chamadas |
| `Users` | `/agentes` | Agentes |
| `MessageSquare` | `/chat` | Chat Analítico |

Filtro por role permanece igual ao atual.

**Mobile:**
- Em telas <768px, sidebar fica como bottom-tab bar (5 ícones principais) OU drawer.
- Decisão: **drawer** — abre por botão hamburger no header. Manter consistência com o atual mas atualizando o visual do drawer para o estilo Finexy.

### 3. Header / Topbar — `components/layout/header.tsx` (rewrite total)

**Estrutura visual:**

```
[Metatron]        [Tab1 Tab2 Tab3...]        [🔍] [🔔•] [ℹ] [👤 Nome ▾]
```

**Specs:**
- Container: `display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 2px 4px`
- **Brand (esquerda):** texto "Metatron", `font-size: 20px; font-weight: 800; letter-spacing: -0.01em`
- **Tabs (centro):**
  - Container: `background: #fff; border-radius: 999px; padding: 6px; display: flex; gap: 2px`
  - Tab: `padding: 9px 18px; border-radius: 999px; font-size: 13.5px; color: #5b5b5b; font-weight: 500`
  - Ativa: `background: #111; color: #fff`
  - **Conteúdo das tabs:** as tabs no Finexy são navegação de página interna (Overview, Activity, etc.). No Metatron vamos usar as **tabs como atalhos para subseções da rota atual**, OU **escondê-las quando a rota não tem subnavegação** (dashboard, chat, etc.).
  - **Decisão simplificada:** ocultar as tabs por padrão. Só renderiza se a página passar uma prop `tabs` via context/slot. Mantém o visual do header limpo em rotas sem subnav.
- **Right side (top-right):**
  - Icon buttons (40×40, `border-radius: 50%; background: #fff; box-shadow: 0 1px 0 rgba(0,0,0,.02)`):
    - 🔍 Search (abre modal de busca global — futuro, por ora navega para `/chat`)
    - 🔔 Notificações (dot laranja se houver — placeholder inativo agora)
    - 🎨 Theme toggle (mantém o componente existente, mas reestiliza)
  - **Profile pill:**
    - `background: #fff; border-radius: 999px; padding: 5px 14px 5px 6px; display: flex; align-items: center; gap: 10px`
    - Avatar circular 36×36 (placeholder colorido com inicial do nome)
    - Nome (b 13.5px / 700) + email truncado (small 11px, #9a9a9a)
    - Chevron ▾ no fim
    - Click abre o `DropdownMenu` existente (Perfil, Sair) — mantém a estrutura atual, reestiliza só o trigger

**Mobile:**
- Em telas <768px:
  - Brand vira apenas logo (sem texto)
  - Tabs viram menu dropdown ou somem
  - Profile pill mostra só avatar (sem nome/email)
  - Botão hamburger aparece para abrir sidebar drawer

### 4. globals.css — atualizações

- Importar Google Fonts via `<link>` em `app/layout.tsx` (`next/font/google`)
- Substituir todo o bloco `:root` e `.dark` por novas variáveis (acima)
- Adicionar utility classes para o stage layout (ou usar puramente Tailwind)
- Remover overrides do dark mode por ora (deixar `.dark` apontando para os mesmos valores claros, não quebra o `next-themes` mas o toggle não tem efeito visual)

### 5. Páginas internas

**Não mexer.** Apenas garantir que os containers/cards usem variáveis Tailwind (`bg-card`, `text-foreground`) que agora apontam para a paleta nova. Se alguma página tem cor hardcoded (`bg-white`, `text-black`, `bg-gray-...`) que destoa, ajustar pontualmente — mas isso é fora do escopo desta entrega.

---

## Verificação de fidelidade

Após implementação, comparar lado a lado:
- Sidebar: largura 64px, pill, ícones com estados corretos
- Topbar: profile pill com avatar circular, icon buttons brancos com shadow
- Background: bege quente uniforme
- Cards: radius 22px, sombra suave
- Tipografia: Plus Jakarta Sans renderizando
- Greeting h1: tamanho e tracking corretos

Critério de sucesso: side-by-side com o HTML do Finexy mostra equivalência visual no shell, com apenas branding (textos "Metatron" vs "Finexy") e conteúdo das páginas internas diferentes.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Componentes shadcn (Dialog, Dropdown, Toast) com estilos antigos destoando | Manter shadcn — só ajustar `--radius`, `--color-primary`, `--color-background`. Os componentes herdam tokens. |
| Páginas internas com `bg-white`/`text-black` hardcoded ficando "ilhas" no fundo bege | Auditoria rápida após o shell pronto — substituir para `bg-card`/`text-foreground` quando aparecer. |
| Theme toggle quebrado (dark sem efeito visual) | Aceitar — `.dark` aponta para mesmos valores. Toggle continua existindo mas inerte. Plano: remover toggle ou implementar dark depois. |
| Sidebar icon-only confunde usuário sem labels | `title` HTML em cada ícone + ícones distintos suficientemente. Aceitar como trade-off do design escolhido. |
| Tabs do topbar sem uso real no Metatron | Ocultar por padrão. Renderizar só quando página passar prop. Não quebra layout. |

---

## Arquivos afetados

**Reescrita total:**
- `frontend/components/layout/sidebar.tsx`
- `frontend/components/layout/header.tsx`
- `frontend/app/(dashboard)/layout.tsx`
- `frontend/app/globals.css`

**Alteração pontual:**
- `frontend/app/layout.tsx` — trocar `Geist` por `Plus Jakarta Sans` via `next/font/google`
- `frontend/components/layout/theme-toggle.tsx` — reestilizar visual (manter funcional)

**Novos arquivos:**
- `frontend/components/layout/greeting.tsx` — saudação dinâmica
- `frontend/components/layout/profile-pill.tsx` — trigger custom do dropdown de usuário

**Inalterados:**
- Todas as páginas em `app/(dashboard)/*/page.tsx`
- Lógica de auth, react-query, services

---

## Decisões adiadas (não bloqueiam esta entrega)

1. **Dark mode** — implementar paleta escura equivalente
2. **Mobile bottom-tab** — vs drawer atual
3. **Notificações reais** — backend + dot indicator
4. **Search global** — modal com command palette
5. **Auditoria de cores hardcoded** nas páginas internas

---

## Auto-revisão

- [x] Sem placeholders/TBD
- [x] Sem contradições entre seções
- [x] Escopo claramente delimitado (shell, não páginas)
- [x] Cada componente tem specs visuais concretas (cores, tamanhos, raios)
- [x] Riscos identificados com mitigação
- [x] Critério de sucesso objetivo (comparação visual com HTML)
- [x] Lista exaustiva de arquivos afetados
