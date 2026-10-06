import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0051 (quick task 261006-ncy): protegem a
 * forma do arquivo SEM precisar de banco (ambiente node, so fs/path). A 0051
 * acrescenta a agenda2_itens duas colunas de texto livre OPCIONAIS
 * (o_que_fazer e o_que_foi_feito), com limite de 500 caracteres depois de
 * aparar espacos. Nenhuma policy, funcao ou gatilho novo: as policies da 0048
 * sao por linha e ja cobrem as colunas novas. O dono decidiu NAO recusar
 * sequencias de digitos nesses dois campos (2026-10-06). O arquivo de volta
 * (supabase/rollbacks) remove as colunas e fica fora do caminho do CLI.
 *
 * A aplicacao real da migration e do dono, pelo SQL Editor.
 */

const RAIZ = process.cwd()
const MIGRATIONS_DIR = path.join(RAIZ, "supabase", "migrations")
const ROLLBACKS_DIR = path.join(RAIZ, "supabase", "rollbacks")
const NOME_0051 = "0051_agenda2_observacoes.sql"
const ARQ_0051 = path.join(MIGRATIONS_DIR, NOME_0051)
const NOME_VOLTA = "0051_volta_agenda2_observacoes.sql"
const ARQ_VOLTA = path.join(ROLLBACKS_DIR, NOME_VOLTA)

/** Clausula de elevacao de privilegio montada por concatenacao, para nunca
 * aparecer inteira neste arquivo de teste. */
const CLAUSULA_ELEVACAO = ["security", "definer"].join(" ")

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

describe("migracao-agenda2-observacoes: 0051 e arquivo de volta (estrutural, sem banco)", () => {
  it("arquivo-unico", () => {
    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
    expect(arquivos.filter((nome) => nome.startsWith("0051"))).toEqual([NOME_0051])
    expect(arquivos).not.toContain(NOME_VOLTA)

    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
    expect(fs.readdirSync(ROLLBACKS_DIR)).toContain(NOME_VOLTA)
  })

  it("duas-colunas-opcionais", () => {
    const sql = normaliza(semComentarios(lerCru(ARQ_0051))).toLowerCase()

    expect(sql).toContain(
      "alter table agenda2_itens add column if not exists o_que_fazer text;"
    )
    expect(sql).toContain(
      "alter table agenda2_itens add column if not exists o_que_foi_feito text;"
    )
    expect(contaOcorrencias(sql, "add column")).toBe(2)
    expect(sql).not.toContain("not null")
    expect(sql).not.toContain("default")
  })

  it("limite-500", () => {
    const sql = normaliza(semComentarios(lerCru(ARQ_0051))).toLowerCase()

    expect(sql).toContain(
      "alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_fazer_tamanho;"
    )
    expect(sql).toContain(
      "alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_foi_feito_tamanho;"
    )
    expect(sql).toContain(
      "alter table agenda2_itens add constraint chk_agenda2_o_que_fazer_tamanho check (char_length(btrim(o_que_fazer)) <= 500);"
    )
    expect(sql).toContain(
      "alter table agenda2_itens add constraint chk_agenda2_o_que_foi_feito_tamanho check (char_length(btrim(o_que_foi_feito)) <= 500);"
    )
    expect(contaOcorrencias(sql, "add constraint")).toBe(2)
  })

  it("sem-trava-de-numeros", () => {
    const sql = semComentarios(lerCru(ARQ_0051)).toLowerCase()

    expect(sql).not.toContain("[0-9]")
    expect(sql).not.toContain("regexp")
  })

  it("so-colunas-sem-regra-nova", () => {
    const sql = normaliza(semComentarios(lerCru(ARQ_0051))).toLowerCase()

    expect(sql).not.toContain(CLAUSULA_ELEVACAO)
    for (const proibido of [
      "policy",
      "function",
      "trigger",
      "grant ",
      "revoke ",
      "drop table",
      "drop column",
      "truncate",
      "delete from",
      "update ",
      "insert into",
      "rename",
      "disable row level security",
      "$$",
    ]) {
      expect(sql, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }

    expect(sql).toContain("comment on column agenda2_itens.o_que_fazer is")
    expect(sql).toContain("comment on column agenda2_itens.o_que_foi_feito is")
  })

  it("comentarios-seguros", () => {
    const cru = lerCru(ARQ_0051)
    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)

    const minusculo = cru.toLowerCase()
    expect(minusculo).not.toContain(CLAUSULA_ELEVACAO)
    expect(minusculo).not.toContain("function")
    expect(minusculo).not.toContain("$$")
  })

  it("arquivo-de-volta", () => {
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
    const cru = lerCru(ARQ_VOLTA)

    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(cru).toContain("NAO APLICAR")
    expect(cru).toContain("APAGA todos os textos")

    const sql = normaliza(semComentarios(cru)).toLowerCase()
    expect(sql).toBe(
      [
        "alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_fazer_tamanho;",
        "alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_foi_feito_tamanho;",
        "alter table agenda2_itens drop column if exists o_que_fazer;",
        "alter table agenda2_itens drop column if exists o_que_foi_feito;",
      ].join(" ")
    )
    expect(sql).not.toContain("add column")
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)
  })
})
