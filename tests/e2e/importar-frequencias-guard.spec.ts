import { expect, test } from "@playwright/test"

/**
 * Espelho de tests/e2e/importar-guard.spec.ts (T-17-36): prova o duplo
 * redirecionamento server-side de /clientes/importar-frequencias contra o
 * banco real — um Vendedor navegando direto pela URL é redirecionado para
 * "/", e um Supervisor vê o assistente. Credenciais duplicadas aqui (não
 * importadas de tests/auth/rls-roles.test.ts) porque este arquivo roda sob
 * o runner do Playwright, não do Vitest — mesma convenção de
 * importar-guard.spec.ts.
 */
const VENDEDOR_A_EMAIL = "vendedor.a+test@raiar.local"
const VENDEDOR_A_PASSWORD = "TestVendedorA!2026"

const SUPERVISOR_EMAIL = "cristiano.stephano@raiarorganicos.com.br"
const SUPERVISOR_PASSWORD = "TestSupervisor!2026"

// signInWithPassword contra o projeto Supabase ao vivo + a primeira
// compilação do Next dev de "/" pode passar bastante do timeout padrão de
// asserção de 5s do Playwright — mesmo ajuste generoso e limitado já usado
// em importar-guard.spec.ts (06-03-SUMMARY.md).
const LOGIN_TIMEOUT = 20_000

test.describe("Importar frequências route guard (IMP-01, T-17-36)", () => {
  test("vendedor navigating to /clientes/importar-frequencias is redirected to /", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(VENDEDOR_A_EMAIL)
    await page.getByLabel("Senha").fill(VENDEDOR_A_PASSWORD)
    await page.getByRole("button", { name: "Entrar" }).click()

    await expect(page).toHaveURL("/", { timeout: LOGIN_TIMEOUT })

    await page.goto("/clientes/importar-frequencias")

    await expect(page).toHaveURL("/")
  })

  test("supervisor navigating to /clientes/importar-frequencias sees the import wizard", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(SUPERVISOR_EMAIL)
    await page.getByLabel("Senha").fill(SUPERVISOR_PASSWORD)
    await page.getByRole("button", { name: "Entrar" }).click()

    await expect(page).toHaveURL("/", { timeout: LOGIN_TIMEOUT })

    await page.goto("/clientes/importar-frequencias")

    await expect(page).toHaveURL("/clientes/importar-frequencias")
    await expect(
      page.getByRole("heading", { name: "Importar frequências de visita" })
    ).toBeVisible()
  })
})
