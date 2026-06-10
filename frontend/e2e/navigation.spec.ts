import { test, expect } from "@playwright/test"

// Usa token de login salvo pelo global-setup
test.use({ storageState: "e2e/.auth.json" })

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

test.describe("Navegação (gestor autenticado)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/`)
    // Two <aside> elements exist (desktop + mobile); target the desktop one (shrink-0)
    await expect(page.locator("aside.shrink-0")).toBeVisible({ timeout: 15_000 })
  })

  test("sidebar exibe links corretos", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Cockpit Temporal" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Qualificações" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Agentes" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Análise de Ligação" })).toBeVisible()
  })

  test("navega para /agentes", async ({ page }) => {
    await page.getByRole("link", { name: "Agentes" }).click()
    await expect(page).toHaveURL(`${BASE}/agentes`)
    await expect(page.getByText("Análise de Agentes")).toBeVisible()
  })

  test("navega para /relatorios/qualificacoes", async ({ page }) => {
    await page.getByRole("link", { name: "Qualificações" }).click()
    await expect(page).toHaveURL(`${BASE}/relatorios/qualificacoes`)
    await expect(page.getByText("Qualificações").first()).toBeVisible()
  })

  test("navega para /relatorios/analise-ligacao", async ({ page }) => {
    await page.getByRole("link", { name: "Análise de Ligação" }).click()
    await expect(page).toHaveURL(`${BASE}/relatorios/analise-ligacao`)
    await expect(page.getByRole("heading", { name: "Análise de Ligação" })).toBeVisible()
  })

  test("página 404 para rota inexistente", async ({ page }) => {
    await page.goto(`${BASE}/rota-que-nao-existe`)
    await expect(page.getByText("404")).toBeVisible()
    await expect(page.getByText("Página não encontrada")).toBeVisible()
  })
})
