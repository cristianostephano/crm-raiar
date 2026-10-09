import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0054 (quick 261009-npp) - protegem a forma do
 * arquivo SEM precisar de banco (ambiente node, so fs/path): 6 leituras do
 * Dashboard ganham o parametro opcional p_vendedor (uuid, padrao nulo), que so
 * ESTREITA o resultado sobre a RLS. O SQL esperado e montado aqui a partir das
 * fontes (0003 e 0037, as ultimas definicoes de cada leitura) + a tabela de
 * trocas abaixo: e a prova ESTRUTURAL de que o resto de cada corpo nao mudou e
 * de que, com p_vendedor nulo, o resultado e o de hoje. O arquivo de volta
 * (supabase/rollbacks) recria exatamente as versoes anteriores e fica fora do
 * caminho do CLI.
 *
 * A aplicacao real da migration e do dono, pelo SQL Editor.
 */

const RAIZ = process.cwd()
const MIGRATIONS_DIR = path.join(RAIZ, "supabase", "migrations")
const NOME_0054 = "0054_dashboard_filtro_vendedor.sql"
const ARQ_0054 = path.join(MIGRATIONS_DIR, NOME_0054)
const NOME_VOLTA = "0054_volta_dashboard_filtro_vendedor.sql"
const ARQ_VOLTA = path.join(RAIZ, "supabase", "rollbacks", NOME_VOLTA)

const FONTE_0003 = "0003_dashboard_aggregates.sql"
const FONTE_0037 = "0037_dashboard_ganho_sobrevive_encerramento.sql"

/** Clausula de elevacao de privilegio montada por concatenacao, para nunca
 * aparecer inteira neste arquivo de teste. */
const CLAUSULA_ELEVACAO = ["security", "definer"].join(" ")
/** Frase de remocao de leitura, montada por concatenacao pelo mesmo motivo. */
const REMOCAO = ["drop", "function", "if", "exists"].join(" ")
/** Nome da tabela da Agenda 2, montado por concatenacao pelo mesmo motivo. */
const TABELA_AGENDA2 = ["agenda2", "itens"].join("_")
/** Palavras inglesas que os cabecalhos nao podem usar (as contagens do
 * arquivo cru dependem disso). */
const PALAVRA_FUNCAO = ["func", "tion"].join("")
const PALAVRA_INICIO = ["be", "gin"].join("")
const PALAVRA_FIM = ["com", "mit"].join("")

type Troca = { antigo: string; novo: string }

type Leitura = {
  nome: string
  fonte: string
  /** Remocao da assinatura antiga (0054). */
  remocaoNova: string
  /** Remocao da assinatura nova (arquivo de volta). */
  remocaoVolta: string
  trocaAssinatura: Troca
  trocasCorpo: Troca[]
  /** Quantas vezes "p_vendedor is null or" aparece no bloco da 0054. */
  recortes: number
}

const ASSINATURA_PERIODO: Troca = {
  antigo: "p_fim timestamptz )",
  novo: "p_fim timestamptz, p_vendedor uuid default null )",
}

const TROCA_FECHAMENTO: Troca = {
  antigo: "c.status_acompanhamento = 'encerrado')) group by u.status_evento;",
  novo: "c.status_acompanhamento = 'encerrado')) and (p_vendedor is null or c.responsavel = p_vendedor) group by u.status_evento;",
}

const LEITURAS: Leitura[] = [
  {
    nome: "dashboard_clientes_por_etapa",
    fonte: FONTE_0003,
    remocaoNova: `${REMOCAO} dashboard_clientes_por_etapa();`,
    remocaoVolta: `${REMOCAO} dashboard_clientes_por_etapa(uuid);`,
    trocaAssinatura: {
      antigo: "create or replace function dashboard_clientes_por_etapa()",
      novo: "create or replace function dashboard_clientes_por_etapa(p_vendedor uuid default null)",
    },
    trocasCorpo: [
      {
        antigo: "from clientes group by etapa;",
        novo: "from clientes where (p_vendedor is null or responsavel = p_vendedor) group by etapa;",
      },
    ],
    recortes: 1,
  },
  {
    nome: "dashboard_funil_detalhado",
    fonte: FONTE_0037,
    remocaoNova: `${REMOCAO} dashboard_funil_detalhado();`,
    remocaoVolta: `${REMOCAO} dashboard_funil_detalhado(uuid);`,
    trocaAssinatura: {
      antigo: "create or replace function dashboard_funil_detalhado()",
      novo: "create or replace function dashboard_funil_detalhado(p_vendedor uuid default null)",
    },
    trocasCorpo: [
      {
        antigo: "c.criado_em as entrada from clientes c union all",
        novo: "c.criado_em as entrada from clientes c where (p_vendedor is null or c.responsavel = p_vendedor) union all",
      },
      {
        antigo: "from historico h where h.tipo = 'etapa' ),",
        novo: "from historico h where h.tipo = 'etapa' and (p_vendedor is null or h.cliente_id in (select c2.id from clientes c2 where c2.responsavel = p_vendedor)) ),",
      },
    ],
    recortes: 2,
  },
  {
    nome: "dashboard_tempo_ate_fechamento",
    fonte: FONTE_0037,
    remocaoNova: `${REMOCAO} dashboard_tempo_ate_fechamento();`,
    remocaoVolta: `${REMOCAO} dashboard_tempo_ate_fechamento(uuid);`,
    trocaAssinatura: {
      antigo: "create or replace function dashboard_tempo_ate_fechamento()",
      novo: "create or replace function dashboard_tempo_ate_fechamento(p_vendedor uuid default null)",
    },
    trocasCorpo: [TROCA_FECHAMENTO],
    recortes: 1,
  },
  {
    nome: "dashboard_ganhos_perdidos",
    fonte: FONTE_0037,
    remocaoNova: `${REMOCAO} dashboard_ganhos_perdidos(timestamptz, timestamptz);`,
    remocaoVolta: `${REMOCAO} dashboard_ganhos_perdidos(timestamptz, timestamptz, uuid);`,
    trocaAssinatura: ASSINATURA_PERIODO,
    trocasCorpo: [TROCA_FECHAMENTO],
    recortes: 1,
  },
  {
    nome: "dashboard_prospeccao_por_produto",
    fonte: FONTE_0003,
    remocaoNova: `${REMOCAO} dashboard_prospeccao_por_produto(timestamptz, timestamptz);`,
    remocaoVolta: `${REMOCAO} dashboard_prospeccao_por_produto(timestamptz, timestamptz, uuid);`,
    trocaAssinatura: ASSINATURA_PERIODO,
    trocasCorpo: [
      {
        antigo: "and c.criado_em < p_fim group by pc.id, pc.nome;",
        novo: "and c.criado_em < p_fim and (p_vendedor is null or c.responsavel = p_vendedor) group by pc.id, pc.nome;",
      },
    ],
    recortes: 1,
  },
  {
    nome: "dashboard_prospeccao_por_categoria",
    fonte: FONTE_0003,
    remocaoNova: `${REMOCAO} dashboard_prospeccao_por_categoria(timestamptz, timestamptz);`,
    remocaoVolta: `${REMOCAO} dashboard_prospeccao_por_categoria(timestamptz, timestamptz, uuid);`,
    trocaAssinatura: ASSINATURA_PERIODO,
    trocasCorpo: [
      {
        antigo: "and c.criado_em < p_fim group by cat.id, cat.nome;",
        novo: "and c.criado_em < p_fim and (p_vendedor is null or c.responsavel = p_vendedor) group by cat.id, cat.nome;",
      },
    ],
    recortes: 1,
  },
]

const FUNCOES_FORA_DO_ESCOPO = [
  "dashboard_desempenho_vendedor",
  "dashboard_comparativo_vendedor",
  "dashboard_aderencia_uso",
]

function lerCru(arquivo: string): string {
  return fs.readFileSync(arquivo, "utf8")
}

/** CRLF -> LF. */
function lf(texto: string): string {
  return texto.replace(/\r\n/g, "\n")
}

/**
 * Remove blocos barra-asterisco e, em cada linha, tudo a partir do primeiro par
 * de hifens (comentario de linha, inclusive no fim de uma linha de codigo).
 * Seguro porque nenhum literal de texto dos corpos de origem contem dois
 * hifens.
 */
function semComentarios(sql: string): string {
  return lf(sql)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((linha) => {
      const idx = linha.indexOf("--")
      return idx >= 0 ? linha.slice(0, idx) : linha
    })
    .join("\n")
}

/** Todo espaco em branco vira um espaco; trim. */
function normaliza(texto: string): string {
  return texto.replace(/\s+/g, " ").trim()
}

function ehAsciiPuro(texto: string): boolean {
  return !/[^\x00-\x7F]/.test(texto)
}

function contaOcorrencias(texto: string, trecho: string): number {
  return texto.split(trecho).length - 1
}

function temParDeHifens(texto: string): boolean {
  return texto.includes("--")
}

/** Recorta de "create or replace function <nome>(" ate o primeiro "$$;" depois
 * dela, inclusive. Recebe o SQL JA sem comentarios. */
function blocoDaFuncao(sqlSemComentarios: string, nome: string): string {
  const frase = `create or replace function ${nome}(`
  const inicio = sqlSemComentarios.indexOf(frase)
  if (inicio < 0) throw new Error(`Frase de criacao de ${nome} nao encontrada.`)
  const fim = sqlSemComentarios.indexOf("$$;", inicio)
  if (fim < 0) throw new Error(`Fechamento $$; do bloco de ${nome} nao encontrado.`)
  return sqlSemComentarios.slice(inicio, fim + "$$;".length)
}

/** Bloco da leitura, sem comentarios, normalizado. */
function blocoLimpoNormalizado(sqlCru: string, nome: string): string {
  return normaliza(blocoDaFuncao(semComentarios(sqlCru), nome))
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

/** Troca exatamente uma ocorrencia, depois de conferir que o trecho antigo
 * aparece exatamente 1 vez. */
function trocaUnica(texto: string, troca: Troca, contexto: string): string {
  expect(
    contaOcorrencias(texto, troca.antigo),
    `trecho antigo ausente ou repetido em ${contexto}: ${troca.antigo}`
  ).toBe(1)
  return texto.replace(troca.antigo, () => troca.novo)
}

function sqlDaFonte(nomeArquivo: string): string {
  return lerCru(path.join(MIGRATIONS_DIR, nomeArquivo))
}

/** Bloco esperado de uma leitura na 0054 (fonte + trocas). */
function blocoEsperado0054(leitura: Leitura): string {
  let bloco = blocoLimpoNormalizado(sqlDaFonte(leitura.fonte), leitura.nome)
  bloco = trocaUnica(bloco, leitura.trocaAssinatura, `assinatura de ${leitura.nome}`)
  for (const troca of leitura.trocasCorpo) {
    bloco = trocaUnica(bloco, troca, `corpo de ${leitura.nome}`)
  }
  return bloco
}

/** Bloco esperado de uma leitura no arquivo de volta (fonte, sem troca). */
function blocoEsperadoVolta(leitura: Leitura): string {
  return blocoLimpoNormalizado(sqlDaFonte(leitura.fonte), leitura.nome)
}

/** Percorre o texto e remove cada trecho "(p_vendedor is null or ...)" com os
 * parenteses balanceados. */
function semRecortes(texto: string): string {
  const abertura = "(p_vendedor is null or"
  let resto = texto
  for (;;) {
    const inicio = resto.indexOf(abertura)
    if (inicio < 0) return resto
    let profundidade = 0
    let fim = -1
    for (let i = inicio; i < resto.length; i += 1) {
      if (resto[i] === "(") profundidade += 1
      if (resto[i] === ")") {
        profundidade -= 1
        if (profundidade === 0) {
          fim = i
          break
        }
      }
    }
    if (fim < 0) throw new Error("Parenteses do recorte nao balanceados.")
    resto = resto.slice(0, inicio) + " " + resto.slice(fim + 1)
  }
}

describe("filtro-vendedor-migracao: 0054 e arquivo de volta (estrutural, sem banco)", () => {
  it("arquivo-unico", () => {
    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
    expect(arquivos.filter((nome) => nome.startsWith("0054"))).toEqual([NOME_0054])
    expect(arquivos).not.toContain(NOME_VOLTA)
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
  })

  it("fontes-sao-as-ultimas-definicoes", () => {
    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql") && nome !== NOME_0054)
      .sort()

    for (const leitura of LEITURAS) {
      const frase = `create or replace function ${leitura.nome}(`
      const comCriacao = arquivos.filter((nome) =>
        semComentarios(sqlDaFonte(nome)).toLowerCase().includes(frase)
      )
      expect(comCriacao.length, `nenhuma criacao de ${leitura.nome}`).toBeGreaterThan(0)
      expect(comCriacao[comCriacao.length - 1], `fonte de ${leitura.nome}`).toBe(leitura.fonte)
    }

    const sql0054 = semComentarios(lerCru(ARQ_0054)).toLowerCase()
    for (const nome of FUNCOES_FORA_DO_ESCOPO) {
      expect(sql0054, `${nome} nao pode ser tocada`).not.toContain(nome)
    }
  })

  it("migracao-exata", () => {
    const esperado =
      "begin; " +
      LEITURAS.map((l) => `${l.remocaoNova} ${blocoEsperado0054(l)}`).join(" ") +
      " commit;"
    const atual = normaliza(semComentarios(lerCru(ARQ_0054)))
    expect(atual).toBe(esperado)
  })

  it("filtro-so-estreita", () => {
    const sql = semComentarios(lerCru(ARQ_0054))
    for (const leitura of LEITURAS) {
      const bloco = normaliza(blocoDaFuncao(sql, leitura.nome))
      const ass = assinatura(bloco)
      const corpoSql = corpo(bloco)

      expect(
        contaOcorrencias(bloco, "p_vendedor is null or"),
        `recortes em ${leitura.nome}`
      ).toBe(leitura.recortes)
      // Toda ocorrencia de p_vendedor no corpo esta dentro de um recorte.
      expect(semRecortes(corpoSql), `p_vendedor solto em ${leitura.nome}`).not.toContain("p_vendedor")
      expect(bloco, `${leitura.nome} sem checagem de papel`).not.toContain("is_supervisor")
      expect(bloco, `${leitura.nome} sem auth.uid`).not.toContain("auth.uid")
      expect(ass, `${leitura.nome} language sql`).toContain("language sql")
      expect(ass, `${leitura.nome} stable`).toContain("stable")
      expect(ass, `${leitura.nome} parametro opcional`).toContain("p_vendedor uuid default null")
    }
  })

  it("sem-elevacao-escrita-restrita", () => {
    const sql = normaliza(semComentarios(lerCru(ARQ_0054))).toLowerCase()

    expect(sql).not.toContain(CLAUSULA_ELEVACAO)
    for (const proibido of [
      "grant",
      "revoke",
      "policy",
      "insert into",
      "delete from",
      "truncate",
      "alter table",
      "create table",
      "update ",
      "notify",
    ]) {
      expect(sql, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }

    expect(contaOcorrencias(sql, "drop ")).toBe(6)
    expect(contaOcorrencias(sql, REMOCAO)).toBe(6)
    expect(contaOcorrencias(sql, "begin;")).toBe(1)
    expect(sql.startsWith("begin;")).toBe(true)
    expect(contaOcorrencias(sql, "commit;")).toBe(1)
    expect(sql.endsWith("commit;")).toBe(true)
    expect(contaOcorrencias(sql, "p_vendedor is null or")).toBe(7)

    const criadas = [...sql.matchAll(/create or replace function (\w+)\(/g)].map((m) => m[1])
    expect(criadas).toEqual(LEITURAS.map((l) => l.nome))
  })

  it("comentarios-seguros", () => {
    const cru = lf(lerCru(ARQ_0054))
    const minusculo = cru.toLowerCase()

    expect(ehAsciiPuro(cru)).toBe(true)
    const primeiraLinha = cru.split("\n").find((linha) => linha.trim() !== "")
    expect(primeiraLinha?.trim().startsWith("/*")).toBe(true)
    expect(temParDeHifens(cru)).toBe(false)
    expect(contaOcorrencias(cru, "$$")).toBe(12)
    expect(contaOcorrencias(minusculo, PALAVRA_FUNCAO)).toBe(12)
    expect(contaOcorrencias(minusculo, PALAVRA_INICIO)).toBe(1)
    expect(contaOcorrencias(minusculo, PALAVRA_FIM)).toBe(1)
    expect(minusculo).not.toContain(CLAUSULA_ELEVACAO)
    expect(minusculo).not.toContain(TABELA_AGENDA2)
    expect(cru).toContain("261009-npp")
    expect(cru).toContain("supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql")
  })

  it("volta-restaura-anteriores", () => {
    const cru = lf(lerCru(ARQ_VOLTA))
    const minusculo = cru.toLowerCase()

    expect(ehAsciiPuro(cru)).toBe(true)
    expect(temParDeHifens(cru)).toBe(false)
    expect(cru).toContain("NAO APLICAR")
    expect(contaOcorrencias(cru, "$$")).toBe(12)
    expect(contaOcorrencias(minusculo, PALAVRA_FUNCAO)).toBe(12)
    expect(contaOcorrencias(minusculo, PALAVRA_INICIO)).toBe(1)
    expect(contaOcorrencias(minusculo, PALAVRA_FIM)).toBe(1)
    expect(minusculo).not.toContain(CLAUSULA_ELEVACAO)

    const esperado =
      "begin; " +
      LEITURAS.map((l) => `${l.remocaoVolta} ${blocoEsperadoVolta(l)}`).join(" ") +
      " commit;"
    expect(normaliza(semComentarios(cru))).toBe(esperado)
  })
})
