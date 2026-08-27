import { expect, test } from "@playwright/test"

/**
 * Proves the server-side redirect half of IMP-10 (T-06-01): a Vendedor
 * navigating directly to /clientes/importar by URL is redirected to "/",
 * same guard shape as app/(app)/configuracoes/page.tsx. Credentials
 * duplicated here (not imported from tests/auth/rls-roles.test.ts) since
 * this file runs under Playwright's runner, not Vitest — same convention
 * as tests/e2e/session-persistence.spec.ts.
 */
const VENDEDOR_A_EMAIL = "vendedor.a+test@raiar.local"
const VENDEDOR_A_PASSWORD = "TestVendedorA!2026"

const SUPERVISOR_EMAIL = "cristiano.stephano@raiarorganicos.com.br"
const SUPERVISOR_PASSWORD = "TestSupervisor!2026"

// signInWithPassword against the live Supabase project + Next dev's
// first-compile of "/" can take well beyond Playwright's 5s default
// assertion timeout — generous but bounded, matches the real cold-start cost
// observed against this project (see 06-03-SUMMARY.md).
const LOGIN_TIMEOUT = 20_000

test.describe("Importar clientes route guard (IMP-10)", () => {
  test("Vendedor navigating to /clientes/importar is redirected to /", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(VENDEDOR_A_EMAIL)
    await page.getByLabel("Senha").fill(VENDEDOR_A_PASSWORD)
    await page.getByRole("button", { name: "Entrar" }).click()

    await expect(page).toHaveURL("/", { timeout: LOGIN_TIMEOUT })

    await page.goto("/clientes/importar")

    await expect(page).toHaveURL("/")
  })

  test("Supervisor navigating to /clientes/importar sees the import wizard", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(SUPERVISOR_EMAIL)
    await page.getByLabel("Senha").fill(SUPERVISOR_PASSWORD)
    await page.getByRole("button", { name: "Entrar" }).click()

    await expect(page).toHaveURL("/", { timeout: LOGIN_TIMEOUT })

    await page.goto("/clientes/importar")

    await expect(page).toHaveURL("/clientes/importar")
    await expect(
      page.getByRole("heading", { name: "Importar Clientes em Prospecção" })
    ).toBeVisible()
  })
})
