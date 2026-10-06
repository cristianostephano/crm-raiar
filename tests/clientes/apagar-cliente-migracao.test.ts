import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0050 (quick task 261006-gvo): protegem a
 * forma do arquivo SEM precisar de banco (ambiente node, so fs/path). A
 * policy de DELETE de clientes passa a deixar o Vendedor ATIVO apagar so os
 * proprios clientes "em andamento", e o Supervisor apagar qualquer um. So
 * RLS: nenhuma funcao nova, nenhuma clausula de elevacao de privilegio. O
 * arquivo de volta (supabase/rollbacks) recoloca a policy original da 0002
 * e fica fora do caminho do CLI do Supabase.
 *
 * A aplicacao real da migration e do dono, pelo SQL Editor.
 */

const RAIZ = process.cwd()
const MIGRATIONS_DIR = path.join(RAIZ, "supabase", "migrations")
const ROLLBACKS_DIR = path.join(RAIZ, "supabase", "rollbacks")
const ARQ_0002 = path.join(MIGRATIONS_DIR, "0002_clientes_and_funil.sql")
const NOME_0050 = "0050_vendedor_apaga_cliente_em_prospeccao.sql"
const ARQ_0050 = path.join(MIGRATIONS_DIR, NOME_0050)
const NOME_VOLTA = "0050_volta_policy_delete_clientes.sql"
const ARQ_VOLTA = path.join(ROLLBACKS_DIR, NOME_VOLTA)

const POLICY_NOVA =
  "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos"
const POLICY_ORIGINAL = "somente supervisor apaga clientes"

/** Clausula de elevacao de privilegio montada por concatenacao, para nunca
 * aparecer inteira neste arquivo de teste. */
const CLAUSULA_ELEVACAO = ["security", "definer"].join(" ")
/** Nome da tabela da Agenda 2, montado por concatenacao pelo mesmo motivo. */
const TABELA_AGENDA2 = ["agenda2", "itens"].join("_")

function lerCru(arquivo: string): string {
  return fs.readFileSync(arquivo, "utf8")
}

/** CRLF -> LF. */
function lf(texto: string): string {
  return texto.replace(/\r\n/g, "\n")
}

/** Remove blocos barra-asterisco e linhas cujo trim comeca com dois hifens. */
function semComentarios(sql: string): string {
  return lf(sql)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n")
}

function ehAsciiPuro(texto: string): boolean {
  return !/[^\x00-\x7F]/.test(texto)
}

function linhaComecaComDoisHifens(texto: string): boolean {
  return lf(texto)
    .split("\n")
    .some((linha) => linha.trim().startsWith("--"))
}

function contaOcorrencias(texto: string, trecho: string): number {
  return texto.split(trecho).length - 1
}

/** Todo espaco em branco vira um espaco; trim. */
function normaliza(texto: string): string {
  return texto.replace(/\s+/g, " ").trim()
}

/** Recorta de `create policy "<nome>"` ate o primeiro ";" depois dele, inclusive. */
function blocoPolicy(sqlCru: string, nome: string): string {
  const sql = lf(sqlCru)
  const inicio = sql.indexOf(`create policy "${nome}"`)
  if (inicio < 0) throw new Error(`Policy "${nome}" nao encontrada.`)
  const fim = sql.indexOf(";", inicio)
  if (fim < 0) throw new Error(`Ponto e virgula final da policy "${nome}" nao encontrado.`)
  return sql.slice(inicio, fim + 1)
}

describe("apagar-cliente-migracao: 0050 e arquivo de volta (estrutural, sem banco)", () => {
  it("arquivo-unico", () => {
    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
    expect(arquivos.filter((nome) => nome.startsWith("0050"))).toEqual([NOME_0050])
    expect(arquivos).not.toContain(NOME_VOLTA)

    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
  })

  it("so-a-policy-de-delete", () => {
    const sql = normaliza(semComentarios(lerCru(ARQ_0050))).toLowerCase()

    expect(sql).toContain(`drop policy if exists "${POLICY_ORIGINAL}" on clientes;`)
    expect(sql).toContain(`drop policy if exists "${POLICY_NOVA}" on clientes;`)
    expect(contaOcorrencias(sql, "create policy")).toBe(1)
    expect(sql).toContain("on clientes for delete")
    expect(sql).toContain("to authenticated")
    for (const proibido of ["for select", "for insert", "for update", "with check"]) {
      expect(sql, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }
  })

  it("regra-do-dono", () => {
    const bloco = normaliza(blocoPolicy(lerCru(ARQ_0050), POLICY_NOVA))

    expect(bloco).toContain("responsavel = (select auth.uid())")
    expect(bloco).toContain("status_acompanhamento = 'em_andamento'")
    expect(bloco).toContain("p.id = (select auth.uid())")
    expect(bloco).toContain("p.role = 'vendedor'")
    expect(bloco).toContain("p.ativo = true")
    expect(bloco).toContain("(select is_supervisor()) or (")

    expect(bloco).not.toContain("'ganho'")
    expect(bloco).not.toContain("'perdido'")
    expect(bloco).not.toContain("'encerrado'")
  })

  it("sem-elevacao-sem-funcao", () => {
    const sqlLower = semComentarios(lerCru(ARQ_0050)).toLowerCase()

    expect(sqlLower).not.toContain(CLAUSULA_ELEVACAO)
    for (const proibido of [
      "function",
      "grant ",
      "revoke ",
      "alter table",
      "insert into",
      "update ",
      "delete from",
      "truncate",
      "drop table",
      "disable row level security",
      "$$",
    ]) {
      expect(sqlLower, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }
  })

  it("comentarios-seguros", () => {
    const cru = lerCru(ARQ_0050)
    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)

    const minusculo = cru.toLowerCase()
    expect(minusculo).not.toContain(CLAUSULA_ELEVACAO)
    expect(minusculo).not.toContain(TABELA_AGENDA2)
    expect(minusculo).not.toContain("function")
  })

  it("rollback-original", () => {
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
    const cru = lerCru(ARQ_VOLTA)

    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(cru).toContain("NAO APLICAR")

    const sql = semComentarios(cru).toLowerCase()
    expect(sql).toContain(`drop policy if exists "${POLICY_NOVA}" on clientes;`)
    expect(sql).toContain(`drop policy if exists "${POLICY_ORIGINAL}" on clientes;`)
    expect(contaOcorrencias(sql, "create policy")).toBe(1)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)

    expect(blocoPolicy(cru, POLICY_ORIGINAL)).toBe(blocoPolicy(lerCru(ARQ_0002), POLICY_ORIGINAL))
  })
})
