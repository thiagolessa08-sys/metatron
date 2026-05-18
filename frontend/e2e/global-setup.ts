import { chromium } from "@playwright/test"

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const EMAIL = process.env.TEST_GESTOR_EMAIL ?? "gestor@joytec.com"
const PASSWORD = process.env.TEST_GESTOR_PASSWORD ?? "gestor123"

async function globalSetup() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
  const page = await browser.newPage()
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState("networkidle")
  await page.locator("input[type='email']").fill(EMAIL)
  await page.locator("input[type='password']").fill(PASSWORD)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL(`${BASE}/`, { timeout: 40_000 })
  await page.context().storageState({ path: "e2e/.auth.json" })
  await browser.close()
}

export default globalSetup
