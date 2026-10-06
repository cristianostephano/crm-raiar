import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0048 (Fase 31, Tarefa 1) — protegem a
 * forma do arquivo (colunas mínimas LGPD, RLS assimétrica D-16, sem
 * elevação de privilégio, inventário inalterado — nota g do ROADMAP), sem
 * precisar de banco (ambiente node, só fs/path). Lê o arquivo com fs,
 * remove as linhas INTEIRAS de comentário SQL ("-- ...", conforme a regra
 * mecânica do plano: todo comentário vive em linha própria, nunca no fim
 * de uma linha de código) e compara em minúsculas.
 *
 * Fica VERDE sem precisar do banco de produção — a aplicação real da
 * migration acontece no plano 31-03, depois da aprovação do dono.
 *
 * Quick 261006-ncy (2026-10-06): a migration 0051 acrescenta, por decisão do
 * dono, duas colunas de texto opcionais; arquivo-unico passa a aceitar
 * exatamente 0048 e 0051 como os únicos arquivos que citam a tabela, e
 * colunas-minimas confere 8 colunas da 0048 + 2 da 0051 = 10.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations")
const MIGRATION_FILE = "0048_agenda2_itens.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const MIGRATION_0051_FILE = "0051_agenda2_observacoes.sql"
const MIGRATION_0051_PATH = path.join(MIGRATIONS_DIR, MIGRATION_0051_FILE)

/** As 10 colunas da tabela: 8 da 0048 + 2 da 0051 (quick 261006-ncy). */
const COLUNAS_TOTAIS = [
  "id",
  "vendedor_id",
  "nome_cliente",
  "bairro",
  "data",
  "concluido",
  "criado_em",
  "atualizado_em",
  "o_que_fazer",
  "o_que_foi_feito",
] as const

/** Inventário (bloco <interfaces> do 31-01-PLAN.md) das funções cuja ÚLTIMA
 * definição, hoje, tem cláusula de elevação de privilégio — em ordem
 * alfabética. 11 no total: as 6 exceções documentadas em STATE.md + os 5
 * gatilhos de sistema/auditoria. Esta fase termina com o MESMO conjunto. */
const INVENTARIO_ELEVACAO_ESPERADO = [
  "cidades_com_clientes_por_estado",
  "clientes_after_update_historico",
  "clientes_before_update",
  "clientes_bloqueia_duplicata_razao_social_cnpj",
  "desativar_membro_equipe",
  "handle_new_user",
  "is_supervisor",
  "reativar_membro_equipe",
  "registrar_acesso_diario",
  "tarefas_before_update_historico",
  "visitas_after_update_historico",
] as const

/** Monta o literal da cláusula de elevação de privilégio por concatenação
 * de duas partes — propositalmente, para que a string nunca apareça
 * inteira neste arquivo de teste. */
const CLAUSULA_ELEVACAO = ["security", "definer"].join(" ")

function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((nome) => nome.endsWith(".sql"))
    .sort()
}

/** Remove linhas inteiras de comentário SQL ("-- ..."). */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n")
}

function readMigrationRaw(filePath: string): string {
  return fs.readFileSync(filePath, "utf8")
}

function readMigrationLower(filePath: string): string {
  return stripSqlComments(readMigrationRaw(filePath)).toLowerCase()
}

function migration0048Lower(): string {
  return readMigrationLower(MIGRATION_PATH)
}

/**
 * Extrai o bloco de colunas do `create table` de agenda2_itens: tudo entre
 * o parêntese de abertura logo após `agenda2_itens (` e o `);` que fecha a
 * declaração da tabela (último parêntese da seção, antes do ponto e
 * vírgula final do statement).
 */
function colunasAgenda2Block(sqlLower: string): string {
  const match = sqlLower.match(
    /create table if not exists agenda2_itens\s*\(([\s\S]*?)\n\);/
  )
  if (!match) {
    throw new Error("Bloco `create table ... agenda2_itens (...)` não encontrado.")
  }
  return match[1]
}

/**
 * Extrai todas as policies do arquivo (nome + corpo completo, da palavra
 * `create policy` até o `;` que fecha o statement).
 */
function extractPolicies(
  sqlLower: string
): Array<{ nome: string; comando: string; corpo: string }> {
  const regex =
    /create policy\s+"([^"]+)"\s*\n?on agenda2_itens for (select|insert|update|delete) to authenticated([\s\S]*?);/g
  const resultados: Array<{ nome: string; comando: string; corpo: string }> = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(sqlLower)) !== null) {
    resultados.push({ nome: m[1], comando: m[2], corpo: m[3] })
  }
  return resultados
}

/**
 * Varre TODAS as migrations em ordem de nome e, para cada função definida
 * (`create or replace function <nome>` ou `create function <nome>`),
 * guarda se a ÚLTIMA definição encontrada (a de arquivo de maior nome)
 * contém a cláusula de elevação de privilégio antes do fechamento `$$;`
 * do corpo da função.
 */
function inventarioElevacaoAtual(): string[] {
  const arquivos = listMigrationFiles()
  const ultimaElevacao = new Map<string, boolean>()

  const funcaoRegex =
    /create (?:or replace )?function\s+([a-z0-9_]+)\s*\([^)]*\)([\s\S]*?)\$\$;/g

  for (const arquivo of arquivos) {
    const sqlLower = readMigrationLower(path.join(MIGRATIONS_DIR, arquivo))
    let m: RegExpExecArray | null
    const regex = new RegExp(funcaoRegex)
    while ((m = regex.exec(sqlLower)) !== null) {
      const nomeFuncao = m[1]
      const corpo = m[2]
      ultimaElevacao.set(nomeFuncao, corpo.includes(CLAUSULA_ELEVACAO))
    }
  }

  return [...ultimaElevacao.entries()]
    .filter(([, temElevacao]) => temElevacao)
    .map(([nome]) => nome)
    .sort()
}

describe("migracao-agenda2: 0048_agenda2_itens.sql (estrutural, sem banco)", () => {
  it("arquivo-unico", () => {
    const arquivos = listMigrationFiles()
    const comPrefixo0048 = arquivos.filter((nome) => nome.startsWith("0048"))
    expect(comPrefixo0048).toEqual([MIGRATION_FILE])

    // Quick 261006-ncy: a 0051 cita a tabela de proposito (acrescenta colunas).
    const citamATabela = arquivos.filter((arquivo) =>
      readMigrationRaw(path.join(MIGRATIONS_DIR, arquivo))
        .toLowerCase()
        .includes("agenda2_itens")
    )
    expect(citamATabela).toEqual([MIGRATION_FILE, MIGRATION_0051_FILE])
  })

  it("colunas-minimas", () => {
    const sqlLower = migration0048Lower()
    const bloco = colunasAgenda2Block(sqlLower)

    const colunasEsperadas = [
      "id",
      "vendedor_id",
      "nome_cliente",
      "bairro",
      "data",
      "concluido",
      "criado_em",
      "atualizado_em",
    ]
    for (const coluna of colunasEsperadas) {
      expect(bloco).toMatch(new RegExp(`\\b${coluna}\\b`))
    }

    const palavrasProibidas = [
      "telefone",
      "celular",
      "email",
      "endereco",
      "rua",
      "cep",
      "observacao",
      "latitude",
      "longitude",
    ]
    for (const palavra of palavrasProibidas) {
      expect(bloco).not.toContain(palavra)
    }

    // Quick 261006-ncy: a 0051 acrescenta exatamente 2 colunas (total 10).
    // A 0051 comenta em bloco barra-asterisco, entao tira esses blocos antes.
    const sql0051 = readMigrationLower(MIGRATION_0051_PATH).replace(/\/\*[\s\S]*?\*\//g, "")
    const novas = [...sql0051.matchAll(/add column if not exists\s+([a-z0-9_]+)/g)].map(
      (m) => m[1]
    )
    expect(novas).toEqual(["o_que_fazer", "o_que_foi_feito"])
    expect(COLUNAS_TOTAIS).toHaveLength(10)
    expect([...colunasEsperadas, ...novas]).toEqual([...COLUNAS_TOTAIS])
    for (const nova of novas) {
      for (const palavra of palavrasProibidas) {
        expect(nova).not.toContain(palavra)
      }
    }
  })

  it("dono-com-cascata", () => {
    const sqlLower = migration0048Lower()
    expect(sqlLower).toContain(
      "vendedor_id uuid not null references profiles(id) on delete cascade"
    )
  })

  it("rls-ligada", () => {
    const sqlLower = migration0048Lower()
    expect(sqlLower).toContain("alter table agenda2_itens enable row level security")
  })

  it("quatro-policies", () => {
    const sqlLower = migration0048Lower()

    const createCount = (sqlLower.match(/create policy/g) ?? []).length
    const dropCount = (sqlLower.match(/drop policy if exists/g) ?? []).length
    expect(createCount).toBe(4)
    expect(dropCount).toBe(4)

    const policies = extractPolicies(sqlLower)
    expect(policies).toHaveLength(4)

    const porComando = new Map(policies.map((p) => [p.comando, p]))
    expect(porComando.has("select")).toBe(true)
    expect(porComando.has("insert")).toBe(true)
    expect(porComando.has("update")).toBe(true)
    expect(porComando.has("delete")).toBe(true)
  })

  it("select-dono-ou-supervisor", () => {
    const sqlLower = migration0048Lower()
    const policies = extractPolicies(sqlLower)
    const select = policies.find((p) => p.comando === "select")
    expect(select).toBeDefined()
    expect(select!.corpo).toContain("vendedor_id = (select auth.uid())")
    expect(select!.corpo).toContain("is_supervisor()")
  })

  it("escrita-so-vendedor-ativo", () => {
    const sqlLower = migration0048Lower()
    const policies = extractPolicies(sqlLower)

    for (const comando of ["insert", "update", "delete"] as const) {
      const policy = policies.find((p) => p.comando === comando)
      expect(policy, `policy de ${comando} não encontrada`).toBeDefined()
      expect(policy!.corpo).toContain("vendedor_id = (select auth.uid())")
      expect(policy!.corpo).toContain("p.role = 'vendedor'")
      expect(policy!.corpo).toContain("p.ativo = true")
      expect(policy!.corpo).not.toContain("is_supervisor()")
    }

    const update = policies.find((p) => p.comando === "update")!
    expect(update.corpo).toContain("using")
    expect(update.corpo).toContain("with check")
  })

  it("limites-de-tamanho", () => {
    const sqlLower = migration0048Lower()
    expect(sqlLower).toContain("char_length(btrim(nome_cliente)) between 1 and 120")
    expect(sqlLower).toContain("char_length(btrim(bairro)) between 1 and 60")
  })

  it("sem-sequencia-de-documento", () => {
    const sqlLower = migration0048Lower()
    expect(sqlLower).toContain("chk_agenda2_nome_cliente_sem_documento")
    expect(sqlLower).toContain("chk_agenda2_bairro_sem_documento")
    expect(sqlLower).toContain("[0-9]{8,}")
  })

  it("carimbos-do-servidor", () => {
    const sqlLower = migration0048Lower()
    expect(sqlLower).toContain("create or replace function agenda2_itens_carimbos()")
    expect(sqlLower).toContain("returns trigger")
    expect(sqlLower).toContain("language plpgsql")
    expect(sqlLower).toContain("new.criado_em := now()")
    expect(sqlLower).toContain("new.criado_em := old.criado_em")
    expect(sqlLower).toContain("before insert or update on agenda2_itens")
  })

  it("sem-elevacao", () => {
    const sqlLower = migration0048Lower()
    expect(sqlLower).not.toContain(CLAUSULA_ELEVACAO)
    expect(sqlLower).not.toContain("grant ")
    expect(sqlLower).not.toContain("drop table")
    expect(sqlLower).not.toContain("truncate")
    expect(sqlLower).not.toContain(".rpc")

    const funcoesCriadas = (
      sqlLower.match(/create (?:or replace )?function\s+([a-z0-9_]+)/g) ?? []
    ).map((trecho) => trecho.replace(/create (?:or replace )?function\s+/, ""))
    expect(funcoesCriadas).toEqual(["agenda2_itens_carimbos"])
  })

  it("sem-descarte-automatico", () => {
    const sqlLower = migration0048Lower()
    expect(sqlLower).not.toContain("delete from agenda2_itens")
  })

  it("inventario-elevacao-inalterado", () => {
    const inventario = inventarioElevacaoAtual()
    expect(inventario).toEqual([...INVENTARIO_ELEVACAO_ESPERADO])
  })
})
