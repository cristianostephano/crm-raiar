import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0049 (Fase 33, AGD-16) - protegem a forma
 * do arquivo SEM precisar de banco (ambiente node, so fs/path): a funcao
 * agenda_do_vendedor() passa a devolver SO a metade de prospeccao, com a
 * MESMA assinatura da 0036, sem comando de escrita e sem elevacao de
 * privilegio; o arquivo de volta (supabase/rollbacks) reproduz o bloco da
 * 0036 byte a byte e fica fora do caminho do CLI do Supabase.
 *
 * A aplicacao real da migration e do dono, no plano 33-04.
 */

const RAIZ = process.cwd()
const MIGRATIONS_DIR = path.join(RAIZ, "supabase", "migrations")
const ARQ_0036 = path.join(MIGRATIONS_DIR, "0036_encerrar_cliente_ativo.sql")
const NOME_0049 = "0049_agenda_atual_so_prospeccao.sql"
const ARQ_0049 = path.join(MIGRATIONS_DIR, NOME_0049)
const NOME_VOLTA = "0049_volta_agenda_do_vendedor.sql"
const ARQ_VOLTA = path.join(RAIZ, "supabase", "rollbacks", NOME_VOLTA)

/** Clausula de elevacao de privilegio montada por concatenacao, para nunca
 * aparecer inteira neste arquivo de teste. */
const CLAUSULA_ELEVACAO = ["security", "definer"].join(" ")
/** Nome da tabela da Agenda 2, montado por concatenacao pelo mesmo motivo. */
const TABELA_AGENDA2 = ["agenda2", "itens"].join("_")

const FRASE_CRIACAO = "create or replace function agenda_do_vendedor()"

function lerCru(arquivo: string): string {
  return fs.readFileSync(arquivo, "utf8")
}

/** CRLF -> LF. */
function lf(texto: string): string {
  return texto.replace(/\r\n/g, "\n")
}

/** Recorta da primeira frase de criacao de agenda_do_vendedor ate o primeiro
 * "$$;" depois dela, inclusive. */
function blocoDaFuncao(sqlCru: string): string {
  const sql = lf(sqlCru)
  const inicio = sql.indexOf(FRASE_CRIACAO)
  if (inicio < 0) throw new Error("Frase de criacao de agenda_do_vendedor nao encontrada.")
  const fim = sql.indexOf("$$;", inicio)
  if (fim < 0) throw new Error("Fechamento $$; do bloco nao encontrado.")
  return sql.slice(inicio, fim + "$$;".length)
}

/** Todo espaco em branco vira um espaco; trim. */
function normaliza(texto: string): string {
  return texto.replace(/\s+/g, " ").trim()
}

/** Do inicio do bloco ate "as $$", inclusive. */
function assinatura(bloco: string): string {
  const marca = "as $$"
  const idx = bloco.indexOf(marca)
  if (idx < 0) throw new Error("Marca 'as $$' nao encontrada no bloco.")
  return bloco.slice(0, idx + marca.length)
}

/** Entre "as $$" e o ultimo "$$;" do bloco. */
function corpo(bloco: string): string {
  const marca = "as $$"
  const ini = bloco.indexOf(marca)
  const fim = bloco.lastIndexOf("$$;")
  if (ini < 0 || fim < 0) throw new Error("Corpo do bloco nao encontrado.")
  return bloco.slice(ini + marca.length, fim)
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
  // eslint-disable-next-line no-control-regex
  return !/[^\x00-\x7F]/.test(texto)
}

function contaOcorrencias(texto: string, trecho: string): number {
  return texto.split(trecho).length - 1
}

function linhaComecaComDoisHifens(texto: string): boolean {
  return lf(texto)
    .split("\n")
    .some((linha) => linha.trim().startsWith("--"))
}

describe("agenda-sem-visitas-migracao: 0049 e arquivo de volta (estrutural, sem banco)", () => {
  it("arquivo-unico", () => {
    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
    expect(arquivos.filter((nome) => nome.startsWith("0049"))).toEqual([NOME_0049])
    expect(arquivos).not.toContain(NOME_VOLTA)
  })

  it("mesma-assinatura", () => {
    const sql0049 = lf(lerCru(ARQ_0049))
    const sql0036 = lf(lerCru(ARQ_0036))

    expect(contaOcorrencias(sql0049, FRASE_CRIACAO)).toBe(1)
    expect(sql0049.toLowerCase()).not.toContain("drop function")

    const ass0049 = normaliza(assinatura(blocoDaFuncao(sql0049)))
    const ass0036 = normaliza(assinatura(blocoDaFuncao(sql0036)))
    expect(ass0049).toBe(ass0036)
  })

  it("so-prospeccao", () => {
    const corpo0049 = corpo(blocoDaFuncao(lerCru(ARQ_0049))).toLowerCase()
    expect(corpo0049).not.toContain("union")
    expect(corpo0049).not.toContain("from visitas")
    expect(corpo0049).not.toContain("proxima_data_visita(")
    expect(corpo0049).not.toContain("'visita'::text")
  })

  it("prospeccao-identica", () => {
    const corpo0049 = normaliza(corpo(blocoDaFuncao(lerCru(ARQ_0049))))
    const corpo0036 = corpo(blocoDaFuncao(lerCru(ARQ_0036)))
    const marcaUnion = "union all"
    const idxUnion = corpo0036.indexOf(marcaUnion)
    expect(idxUnion).toBeGreaterThan(0)
    const metadeProspeccao = corpo0036.slice(0, idxUnion)
    expect(corpo0049).toBe(normaliza(metadeProspeccao + " order by 8, 4;"))
  })

  it("sem-escrita-sem-elevacao", () => {
    const sqlLower = semComentarios(lerCru(ARQ_0049)).toLowerCase()
    expect(sqlLower).not.toContain(CLAUSULA_ELEVACAO)
    for (const proibido of [
      "grant ",
      "revoke ",
      "insert into",
      "update ",
      "delete from",
      "truncate",
      "alter table",
      "drop ",
    ]) {
      expect(sqlLower, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }

    const funcoesCriadas = (
      sqlLower.match(/create (?:or replace )?function\s+([a-z0-9_]+)/g) ?? []
    ).map((trecho) => trecho.replace(/create (?:or replace )?function\s+/, ""))
    expect(funcoesCriadas).toEqual(["agenda_do_vendedor"])

    expect(sqlLower).not.toContain("mover_card_funil")
    expect(sqlLower).not.toContain("concluir_visita")
  })

  it("comentarios-seguros", () => {
    const cru = lerCru(ARQ_0049)
    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(cru.toLowerCase()).not.toContain(TABELA_AGENDA2)
    expect(contaOcorrencias(cru, "$$")).toBe(2)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)
  })

  it("rollback-fora-do-cli", () => {
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
    const cru = lerCru(ARQ_VOLTA)

    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(cru).toContain("NAO APLICAR")
    expect(contaOcorrencias(cru, "$$")).toBe(2)
    expect(cru.toLowerCase()).not.toContain("drop function")
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)

    expect(blocoDaFuncao(cru)).toBe(blocoDaFuncao(lerCru(ARQ_0036)))
  })
})
