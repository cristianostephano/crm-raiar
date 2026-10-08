import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0053 (quick 261008-rxw) - protegem a forma
 * do arquivo SEM precisar de banco (ambiente node, so fs/path) (per D-06).
 *
 * A leitura nova clientes_ganhos(p_inicio, p_fim) e irma da leitura
 * clientes_perdidos (0034): o corpo da 0053 e exatamente o corpo da 0034 com
 * 8 trocas listadas abaixo (R1..R8). Essa igualdade e a prova ESTRUTURAL de
 * que a autorizacao NAO mudou (per P-01): mesma juncao com profiles, mesma
 * juncao lateral com historico, nenhuma checagem de papel e nenhuma elevacao
 * de privilegio - a RLS continua sendo a unica fronteira. A data de reserva
 * (cliente ganho sem registro de troca de status, por exemplo importado pela
 * planilha de Clientes Ativos) e a data de CADASTRO, nunca a da ultima
 * edicao (per P-02) - protegida pelas trocas R2/R6/R7 e pela contagem das 3
 * ocorrencias da expressao de data.
 *
 * O arquivo de volta (supabase/rollbacks) remove so a leitura nova e fica
 * fora do caminho do CLI. A aplicacao real da migration e do dono, pelo SQL
 * Editor.
 *
 * Definicao de "corpo" neste arquivo: do primeiro "as $$" depois da frase de
 * criacao ate o primeiro "$$;" depois dele, INCLUSIVE os dois marcadores. A
 * assinatura (nome e colunas de retorno) NAO entra na comparacao com a 0034,
 * porque la ainda diz clientes_perdidos / motivo_perda_nome / perdido_em; ela
 * e provada a parte pela ASSINATURA_ESPERADA.
 */

const RAIZ = process.cwd()
const MIGRATIONS_DIR = path.join(RAIZ, "supabase", "migrations")
const ARQ_0034 = path.join(MIGRATIONS_DIR, "0034_clientes_perdidos.sql")
const NOME_0053 = "0053_clientes_ganhos.sql"
const ARQ_0053 = path.join(MIGRATIONS_DIR, NOME_0053)
const NOME_VOLTA = "0053_volta_clientes_ganhos.sql"
const ARQ_VOLTA = path.join(RAIZ, "supabase", "rollbacks", NOME_VOLTA)

/** Clausula de elevacao de privilegio montada por concatenacao, para nunca
 * aparecer inteira neste arquivo de teste. */
const CLAUSULA_ELEVACAO = ["security", "definer"].join(" ")
/** Frase de remocao de funcao, montada por concatenacao pelo mesmo motivo. */
const REMOCAO_FUNCAO = ["drop", " function"].join("")
/** Nome da tabela da Agenda 2, montado por concatenacao pelo mesmo motivo. */
const TABELA_AGENDA2 = ["agenda2", "itens"].join("_")

const FRASE_CRIACAO_PERDIDOS = ["create or replace", " function clientes_perdidos("].join("")
const FRASE_CRIACAO_GANHOS = ["create or replace", " function clientes_ganhos("].join("")

const ASSINATURA_ESPERADA =
  "create or replace function clientes_ganhos( p_inicio timestamptz default null, p_fim timestamptz default null ) returns table ( cliente_id uuid, razao_social text, nome_fantasia text, ganho_em timestamptz, responsavel uuid, responsavel_nome text ) language sql stable as $$"

const COLUNAS_ESPERADAS = [
  "cliente_id",
  "razao_social",
  "nome_fantasia",
  "ganho_em",
  "responsavel",
  "responsavel_nome",
]

// As 8 trocas (texto normalizado: todo espaco em branco vira um espaco).
const TROCAS: ReadonlyArray<{ id: string; antigo: string; novo: string }> = [
  { id: "R1", antigo: "mp.nome as motivo_perda_nome,", novo: "" },
  {
    id: "R2",
    antigo: "coalesce(h.criado_em, c.atualizado_em) as perdido_em",
    novo: "coalesce(h.criado_em, c.criado_em) as ganho_em",
  },
  { id: "R3", antigo: `'%"perdido"%'`, novo: `'%"ganho"%'` },
  { id: "R4", antigo: "left join motivos_perda mp on mp.id = c.motivo_perda_id", novo: "" },
  {
    id: "R5",
    antigo: "where c.status_acompanhamento = 'perdido'",
    novo: "where c.status_acompanhamento = 'ganho'",
  },
  {
    id: "R6",
    antigo: "coalesce(h.criado_em, c.atualizado_em) >= p_inicio",
    novo: "coalesce(h.criado_em, c.criado_em) >= p_inicio",
  },
  {
    id: "R7",
    antigo: "coalesce(h.criado_em, c.atualizado_em) < p_fim",
    novo: "coalesce(h.criado_em, c.criado_em) < p_fim",
  },
  { id: "R8", antigo: "order by 5 desc, 1 asc;", novo: "order by 4 desc, 1 asc;" },
]

function lerCru(arquivo: string): string {
  return fs.readFileSync(arquivo, "utf8")
}

/** CRLF -> LF. */
function lf(texto: string): string {
  return texto.replace(/\r\n/g, "\n")
}

/** Recorta da frase de criacao ate o primeiro "$$;" depois dela, inclusive. */
function blocoDaFuncao(sqlCru: string, frase: string): string {
  const sql = lf(sqlCru)
  const inicio = sql.indexOf(frase)
  if (inicio < 0) throw new Error(`Frase de criacao nao encontrada: ${frase}`)
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

/** Corpo deste arquivo: do primeiro "as $$" ate o primeiro "$$;" depois dele,
 * INCLUSIVE os dois marcadores (diferenca deliberada em relacao ao molde). */
function corpoComMarcadores(bloco: string): string {
  const marca = "as $$"
  const ini = bloco.indexOf(marca)
  if (ini < 0) throw new Error("Marca 'as $$' nao encontrada no bloco.")
  const fim = bloco.indexOf("$$;", ini + marca.length)
  if (fim < 0) throw new Error("Fechamento $$; do corpo nao encontrado.")
  return bloco.slice(ini, fim + "$$;".length)
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

describe("ganhos-migracao: 0053 e arquivo de volta (estrutural, sem banco)", () => {
  it("arquivo-unico", () => {
    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
    expect(arquivos.filter((nome) => nome.startsWith("0053"))).toEqual([NOME_0053])
    expect(arquivos).not.toContain(NOME_VOLTA)
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
  })

  it("assinatura", () => {
    const sql0053 = lf(lerCru(ARQ_0053))
    expect(contaOcorrencias(sql0053, FRASE_CRIACAO_GANHOS)).toBe(1)
    expect(sql0053.toLowerCase()).not.toContain(REMOCAO_FUNCAO)

    const ass = normaliza(assinatura(blocoDaFuncao(sql0053, FRASE_CRIACAO_GANHOS))).toLowerCase()
    expect(ass).toBe(ASSINATURA_ESPERADA)
  })

  it("corpo-0034-com-trocas", () => {
    const corpo0034 = normaliza(
      semComentarios(corpoComMarcadores(blocoDaFuncao(lerCru(ARQ_0034), FRASE_CRIACAO_PERDIDOS)))
    )
    const corpo0053 = normaliza(
      semComentarios(corpoComMarcadores(blocoDaFuncao(lerCru(ARQ_0053), FRASE_CRIACAO_GANHOS)))
    )

    for (const troca of TROCAS) {
      expect(
        contaOcorrencias(corpo0034, troca.antigo),
        `${troca.id}: trecho antigo ausente ou repetido: ${troca.antigo}`
      ).toBe(1)
    }

    let trocado = corpo0034
    for (const troca of TROCAS) {
      trocado = trocado.split(troca.antigo).join(troca.novo)
    }
    expect(corpo0053).toBe(normaliza(trocado))

    // O corpo da 0053 nao leva comentario nenhum.
    const corpoCru0053 = lf(corpoComMarcadores(blocoDaFuncao(lerCru(ARQ_0053), FRASE_CRIACAO_GANHOS)))
    expect(corpoCru0053).not.toContain("--")
    expect(corpoCru0053).not.toContain("/*")
  })

  it("colunas-minimas-lgpd", () => {
    const sqlLower = semComentarios(lerCru(ARQ_0053)).toLowerCase()
    const bloco = normaliza(blocoDaFuncao(sqlLower, FRASE_CRIACAO_GANHOS))

    const inicio = bloco.indexOf("returns table (")
    const fim = bloco.indexOf(") language sql")
    expect(inicio).toBeGreaterThan(-1)
    expect(fim).toBeGreaterThan(inicio)
    const colunas = bloco
      .slice(inicio + "returns table (".length, fim)
      .split(",")
      .map((parte) => parte.trim().split(" ")[0])
    expect(colunas).toEqual(COLUNAS_ESPERADAS)

    for (const palavra of [
      "telefone",
      "email",
      "contato",
      "celular",
      "cnpj",
      "cep",
      "rua",
      "numero",
      "observacao",
      "motivo",
    ]) {
      expect(sqlLower, `dado de contato/extra proibido: ${palavra}`).not.toMatch(
        new RegExp(`\\b${palavra}\\b`)
      )
    }
  })

  it("sem-elevacao-sem-escrita", () => {
    const sqlLower = semComentarios(lerCru(ARQ_0053)).toLowerCase()
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
      "is_supervisor",
      "auth.uid",
      "atualizado_em",
      "etapa_alterada_em",
    ]) {
      expect(sqlLower, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }

    expect(sqlLower).toContain("language sql")
    expect(sqlLower).toContain("stable")

    const funcoesCriadas = (
      sqlLower.match(/create (?:or replace )?function\s+([a-z0-9_]+)/g) ?? []
    ).map((trecho) => trecho.replace(/create (?:or replace )?function\s+/, ""))
    expect(funcoesCriadas).toEqual(["clientes_ganhos"])

    // Data de reserva = data de cadastro (P-02): as 3 ocorrencias.
    expect(contaOcorrencias(sqlLower, "coalesce(h.criado_em, c.criado_em)")).toBe(3)
  })

  it("comentarios-seguros", () => {
    const cru = lerCru(ARQ_0053)
    expect(ehAsciiPuro(cru)).toBe(true)
    expect(lf(cru).trimStart().startsWith("/*")).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(contaOcorrencias(cru, "$$")).toBe(2)
    expect(contaOcorrencias(cru.toLowerCase(), "function")).toBe(1)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)
    expect(cru.toLowerCase()).not.toContain(TABELA_AGENDA2)
    expect(cru).toContain("261008-rxw")
    expect(cru).toContain("supabase/rollbacks/0053_volta_clientes_ganhos.sql")
  })

  it("volta-remove-so-a-leitura", () => {
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
    const cru = lerCru(ARQ_VOLTA)

    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(cru).toContain("NAO APLICAR")
    expect(contaOcorrencias(cru.toLowerCase(), "function")).toBe(1)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)

    expect(normaliza(semComentarios(cru)).toLowerCase()).toBe(
      "drop function if exists clientes_ganhos(timestamptz, timestamptz);"
    )
  })
})
