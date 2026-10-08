import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0052 (quick 261008-mrf) - protegem a forma
 * do arquivo SEM precisar de banco (ambiente node, so fs/path): a funcao
 * dashboard_aderencia_uso() passa a contar, enquanto a medicao tem menos de
 * 28 dias, so os dias uteis desde o inicio da medicao, com a MESMA assinatura
 * da 0040, sem comando de escrita e sem elevacao de privilegio. O corpo da
 * 0052 e exatamente o corpo da 0040 (sem comentarios) com 3 trocas - essa
 * igualdade e a prova ESTRUTURAL (D-02) de que, com a janela de 28 dias
 * cheia, o resultado e identico ao da 0040. O arquivo de volta
 * (supabase/rollbacks) reproduz a 0040 e fica fora do caminho do CLI.
 *
 * A aplicacao real da migration e do dono, pelo SQL Editor.
 */

const RAIZ = process.cwd()
const MIGRATIONS_DIR = path.join(RAIZ, "supabase", "migrations")
const ARQ_0040 = path.join(MIGRATIONS_DIR, "0040_dashboard_aderencia_uso.sql")
const NOME_0052 = "0052_aderencia_uso_parcial.sql"
const ARQ_0052 = path.join(MIGRATIONS_DIR, NOME_0052)
const NOME_VOLTA = "0052_volta_aderencia_uso.sql"
const ARQ_VOLTA = path.join(RAIZ, "supabase", "rollbacks", NOME_VOLTA)

/** Clausula de elevacao de privilegio montada por concatenacao, para nunca
 * aparecer inteira neste arquivo de teste. */
const CLAUSULA_ELEVACAO = ["security", "definer"].join(" ")
/** Frase de remocao de funcao, montada por concatenacao pelo mesmo motivo. */
const REMOCAO_FUNCAO = ["drop", " function"].join("")
/** Nome da tabela da Agenda 2, montado por concatenacao pelo mesmo motivo. */
const TABELA_AGENDA2 = ["agenda2", "itens"].join("_")

const FRASE_CRIACAO = "create or replace function dashboard_aderencia_uso()"

// As 3 trocas (texto normalizado: todo espaco em branco vira um espaco).
const T1_ANTIGO =
  "from parametros pm, generate_series(0, 27) as g(n) where extract(isodow from (pm.inicio_janela + g.n)) < 6 )"
const T1_NOVO =
  "from parametros pm, medicao md, generate_series(0, 27) as g(n) where extract(isodow from (pm.inicio_janela + g.n)) < 6 and (pm.inicio_janela + g.n) >= md.inicio_medicao )"
const T2_ANTIGO = "count(ev.dia)::integer as dias_usados from dias_ativos da"
const T2_NOVO =
  "count(ev.dia)::integer as dias_usados, min(da.dia) as primeiro_dia from dias_ativos da"
const T3_ANTIGO =
  "case when md.inicio_medicao > pm.inicio_janela then md.inicio_medicao when coalesce(ag.dias_uteis, 0) = 0 then greatest(v.admissao, v.reativado) else null end as coletando_desde"
const T3_NOVO =
  "case when coalesce(ag.dias_uteis, 0) = 0 and md.inicio_medicao > pm.inicio_janela then md.inicio_medicao when coalesce(ag.dias_uteis, 0) = 0 then greatest(v.admissao, v.reativado) when md.inicio_medicao > pm.inicio_janela then ag.primeiro_dia else null end as coletando_desde"

function lerCru(arquivo: string): string {
  return fs.readFileSync(arquivo, "utf8")
}

/** CRLF -> LF. */
function lf(texto: string): string {
  return texto.replace(/\r\n/g, "\n")
}

/** Recorta da primeira frase de criacao de dashboard_aderencia_uso ate o
 * primeiro "$$;" depois dela, inclusive. */
function blocoDaFuncao(sqlCru: string): string {
  const sql = lf(sqlCru)
  const inicio = sql.indexOf(FRASE_CRIACAO)
  if (inicio < 0) throw new Error("Frase de criacao de dashboard_aderencia_uso nao encontrada.")
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

/** Bloco da funcao, sem comentarios, normalizado - corpo comparavel. */
function blocoLimpoNormalizado(sqlCru: string): string {
  return normaliza(semComentarios(blocoDaFuncao(sqlCru)))
}

describe("aderencia-parcial-migracao: 0052 e arquivo de volta (estrutural, sem banco)", () => {
  it("arquivo-unico", () => {
    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
    expect(arquivos.filter((nome) => nome.startsWith("0052"))).toEqual([NOME_0052])
    expect(arquivos).not.toContain(NOME_VOLTA)
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
  })

  it("mesma-assinatura", () => {
    const sql0052 = lf(lerCru(ARQ_0052))
    const sql0040 = lf(lerCru(ARQ_0040))

    expect(contaOcorrencias(sql0052, FRASE_CRIACAO)).toBe(1)
    expect(sql0052.toLowerCase()).not.toContain(REMOCAO_FUNCAO)

    const ass0052 = normaliza(assinatura(blocoDaFuncao(sql0052)))
    const ass0040 = normaliza(assinatura(blocoDaFuncao(sql0040)))
    expect(ass0052).toBe(ass0040)
  })

  it("corpo-0040-com-tres-trocas", () => {
    const corpo0040 = normaliza(semComentarios(corpo(blocoDaFuncao(lerCru(ARQ_0040)))))
    const corpo0052 = normaliza(semComentarios(corpo(blocoDaFuncao(lerCru(ARQ_0052)))))

    for (const antigo of [T1_ANTIGO, T2_ANTIGO, T3_ANTIGO]) {
      expect(contaOcorrencias(corpo0040, antigo), `trecho antigo ausente ou repetido: ${antigo}`).toBe(1)
    }

    const trocado = corpo0040
      .replace(T1_ANTIGO, T1_NOVO)
      .replace(T2_ANTIGO, T2_NOVO)
      .replace(T3_ANTIGO, T3_NOVO)
    expect(corpo0052).toBe(trocado)

    // O corpo da 0052 nao leva comentario nenhum.
    const corpoCru0052 = lf(corpo(blocoDaFuncao(lerCru(ARQ_0052))))
    expect(corpoCru0052).not.toContain("--")
    expect(corpoCru0052).not.toContain("/*")
  })

  it("mesma-autorizacao-sem-elevacao", () => {
    const sqlLower = semComentarios(lerCru(ARQ_0052)).toLowerCase()
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
      "create table",
      "policy",
    ]) {
      expect(sqlLower, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }

    expect(contaOcorrencias(sqlLower, "(select is_supervisor())")).toBe(1)
    expect(sqlLower).toContain("language sql")

    const funcoesCriadas = (
      sqlLower.match(/create (?:or replace )?function\s+([a-z0-9_]+)/g) ?? []
    ).map((trecho) => trecho.replace(/create (?:or replace )?function\s+/, ""))
    expect(funcoesCriadas).toEqual(["dashboard_aderencia_uso"])
  })

  it("comentarios-seguros", () => {
    const cru = lerCru(ARQ_0052)
    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(contaOcorrencias(cru, "$$")).toBe(2)
    expect(contaOcorrencias(cru.toLowerCase(), "function")).toBe(1)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)
    expect(cru.toLowerCase()).not.toContain(TABELA_AGENDA2)
    expect(cru).toContain("261008-mrf")
    expect(cru).toContain("supabase/rollbacks/0052_volta_aderencia_uso.sql")
  })

  it("volta-restaura-0040", () => {
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
    const cru = lerCru(ARQ_VOLTA)

    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(cru).toContain("NAO APLICAR")
    expect(contaOcorrencias(cru, "$$")).toBe(2)
    expect(contaOcorrencias(cru.toLowerCase(), "function")).toBe(1)
    expect(cru.toLowerCase()).not.toContain(REMOCAO_FUNCAO)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)

    expect(blocoLimpoNormalizado(cru)).toBe(blocoLimpoNormalizado(lerCru(ARQ_0040)))
  })
})
