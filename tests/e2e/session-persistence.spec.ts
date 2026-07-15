import { expect, test } from "@playwright/test"

/**
 * Seeded Supervisor test account (see tests/auth/rls-roles.test.ts's
 * SEED_ACCOUNTS — duplicated here rather than imported, since this file
 * runs under Playwright's test runner, not Vitest, and importing a
 * Vitest-authored test module would register its describe/it blocks in the
 * wrong runner).
 */
const SUPERVISOR_EMAIL = "cristiano.stephano@raiarorganicos.com.br"
const SUPERVISOR_PASSWORD = "TestSupervisor!2026"

test.describe("Session persistence (AUTH-04)", () => {
  test("unauthenticated visit redirects to /login; login persists across reload", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel("E-mail").fill(SUPERVISOR_EMAIL)
    await page.getByLabel("Senha").fill(SUPERVISOR_PASSWORD)
    await page.getByRole("button", { name: "Entrar" }).click()

    const roleBadge = page.getByRole("banner").getByText("Supervisor", {
      exact: true,
    })

    await expect(page).toHaveURL("/")
    await expect(roleBadge).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL("/")
    await expect(roleBadge).toBeVisible()
  })
})
