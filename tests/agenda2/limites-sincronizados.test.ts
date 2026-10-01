import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  AGENDA2_BAIRRO_MAX,
  AGENDA2_DIGITOS_SEGUIDOS_MAX,
  AGENDA2_NOME_MAX,
  contemSequenciaLongaDeDigitos,
} from "@/lib/validations/agenda2"

/**
 * Teste de sincronia (Fase 31 Plano 4, Tarefa 1) entre a migration 0048
 * (`supabase/migrations/0048_agenda2_itens.sql`, Plano 31-01) e o schema de
 * aplicação (`lib/validations/agenda2.ts`, Plano 31-02) — garante que mudar
 * um lado sem mudar o outro quebra o build, em vez de divergir em silêncio.
 * Lê a migration com fs (sem banco), mesmo molde de
 * tests/agenda2/migracao-agenda2.test.ts.
 */

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "0048_agenda2_itens.sql"
)

function migrationLower(): string {
  return fs.readFileSync(MIGRATION_PATH, "utf8").toLowerCase()
}

describe("limites sincronizados entre a migration 0048 e lib/validations/agenda2.ts", () => {
  it("nome-sincronizado: a constraint de nome_cliente usa 'between 1 and ' + AGENDA2_NOME_MAX", () => {
    const sql = migrationLower()
    expect(sql).toContain(
      `chk_agenda2_nome_cliente_tamanho check (char_length(btrim(nome_cliente)) between 1 and ${AGENDA2_NOME_MAX})`
    )
  })

  it("bairro-sincronizado: a constraint de bairro usa 'between 1 and ' + AGENDA2_BAIRRO_MAX", () => {
    const sql = migrationLower()
    expect(sql).toContain(
      `chk_agenda2_bairro_tamanho check (char_length(btrim(bairro)) between 1 and ${AGENDA2_BAIRRO_MAX})`
    )
  })

  it("digitos-sincronizados: as duas constraints sem_documento usam [0-9]{N,} com N = AGENDA2_DIGITOS_SEGUIDOS_MAX + 1", () => {
    const sql = migrationLower()
    const sequencia = `[0-9]{${AGENDA2_DIGITOS_SEGUIDOS_MAX + 1},}`

    expect(sql).toContain("chk_agenda2_nome_cliente_sem_documento")
    expect(sql).toContain("chk_agenda2_bairro_sem_documento")
    // A regra aparece uma vez por constraint (duas no total no arquivo).
    const ocorrencias = sql.split(sequencia).length - 1
    expect(ocorrencias).toBe(2)

    // Lado da aplicação: aceita exatamente o limite, recusa um dígito a mais.
    const limiteExato = "1".repeat(AGENDA2_DIGITOS_SEGUIDOS_MAX)
    const umAMais = "1".repeat(AGENDA2_DIGITOS_SEGUIDOS_MAX + 1)
    expect(contemSequenciaLongaDeDigitos(limiteExato)).toBe(false)
    expect(contemSequenciaLongaDeDigitos(umAMais)).toBe(true)
  })
})
