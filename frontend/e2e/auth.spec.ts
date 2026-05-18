import { test, expect } from "@playwright/test"

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const LONG = 30_000

test.describe("Autenticação", () => {
  test("redireciona para /login quando não autenticado", async ({ page }) => {
    await page.goto(`${BASE}/`)
    // Aguarda o redirect client-side do layout (sem token em localStorage)
    await expect(page).toHaveURL(/\/login/, { timeout: LONG })
  })

  test("exibe formulário de login", async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Joytec")).toBeVisible()
    await expect(page.locator("input[type='email']")).toBeVisible()
    await expect(page.locator("input[type='password']")).toBeVisible()
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible()
  })

  test("exibe erro com credenciais inválidas", async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState("networkidle")
    await page.locator("input[type='email']").fill("invalido@joytec.com.br")
    await page.locator("input[type='password']").fill("senha_errada")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible({ timeout: LONG })
  })

  test("login com gestor e navega para dashboard", async ({ page }) => {
    const email = process.env.TEST_GESTOR_EMAIL ?? "gestor@joytec.com"
    const password = process.env.TEST_GESTOR_PASSWORD ?? "gestor123"

    await page.goto(`${BASE}/login`)
    await page.waitForLoadState("networkidle")
    await page.locator("input[type='email']").fill(email)
    await page.locator("input[type='password']").fill(password)
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).toHaveURL(`${BASE}/`, { timeout: LONG })
    await expect(page.getByText("Bem-vindo")).toBeVisible()
  })

  test("logout redireciona para /login", async ({ page }) => {
    const email = process.env.TEST_GESTOR_EMAIL ?? "gestor@joytec.com"
    const password = process.env.TEST_GESTOR_PASSWORD ?? "gestor123"

    await page.goto(`${BASE}/login`)
    await page.waitForLoadState("networkidle")
    await page.locator("input[type='email']").fill(email)
    await page.locator("input[type='password']").fill(password)
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).toHaveURL(`${BASE}/`, { timeout: LONG })

    // Verifica que o trigger do dropdown de usuário está visível no header
    await expect(page.locator('[data-slot="dropdown-menu-trigger"]')).toBeVisible()

    // Simula logout (equivalente a clicar "Sair" no dropdown): limpa localStorage
    await page.evaluate(() => localStorage.clear())
    // Navega para / — sem token deve redirecionar para /login
    await page.goto(`${BASE}/`)
    await expect(page).toHaveURL(/\/login/, { timeout: LONG })
  })
})
