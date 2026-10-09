import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Testes estruturais da migration 0053 REESCRITA (quick 261008-rxw, revisao do
 * dono de 2026-10-08) - protegem a forma do arquivo SEM precisar de banco
 * (ambiente node, so fs/path) (per D-06, D-13, D-14, D-15, D-16, D-18).
 *
 * A 0053 agora faz quatro coisas: (1) coluna nova clientes.ganho_em (a "data
 * real do ganho"); (2) gatilho BEFORE UPDATE sem elevacao que preenche a coluna
 * quando o status passa a ganho e ela esta vazia; (3) preenchimento unico dos
 * ganhos de hoje pelo historico; (4) a leitura clientes_ganhos(p_inicio, p_fim)
 * sobre a coluna real, com 6 colunas minimas (LGPD).
 *
 * Raciocinio "mesmas regras de acesso da 0034" (substitui a prova antiga por
 * trocas, que deixou de valer quando a data virou uma coluna real): as duas
 * leituras sao language sql, stable, sem clausula de elevacao, sem search_path
 * proprio, sem checagem de papel e sem grant/revoke - entao rodam com os
 * direitos de quem chama e cada SELECT interno passa pela RLS normal. As
 * tabelas lidas pela 0053 ({clientes, profiles}) estao contidas nas lidas pela
 * 0034, com a MESMA juncao de profiles e a MESMA expressao de responsavel_nome:
 * nao existe tabela nova cuja RLS precisasse ser revista. O gatilho tambem roda
 * com os direitos de quem faz o UPDATE e so atribui NEW.ganho_em da propria
 * linha. O preenchimento unico roda uma vez, no SQL Editor, restrito a status
 * ganho e ganho_em vazio.
 *
 * O arquivo de volta (supabase/rollbacks) remove a leitura, o gatilho, a regra
 * do gatilho e a coluna (APAGA as datas) e fica fora do caminho do CLI. A
 * aplicacao real da migration e do dono, pelo SQL Editor.
 *
 * Definicao de "corpo" neste arquivo: do primeiro "as $$" depois da frase de
 * criacao ate o primeiro "$$;" depois dele, INCLUSIVE os dois marcadores. A
 * assinatura (nome e colunas de retorno) e provada a parte pela
 * ASSINATURA_ESPERADA.
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
const FRASE_CRIACAO_GATILHO = [
  "create or replace",
  " function clientes_preenche_ganho_em(",
].join("")

/** Codigo da 0053 depois do bloco de comentario, ao pe da letra do "Contrato
 * SQL" do plano (sem nenhum comentario no meio). */
const CODIGO_ESPERADO = `alter table clientes add column if not exists ganho_em date;

create or replace function clientes_preenche_ganho_em()
returns trigger
language plpgsql
as $$
begin
  new.ganho_em := (now() at time zone 'America/Sao_Paulo')::date;
  return new;
end;
$$;

drop trigger if exists trg_clientes_preenche_ganho_em on clientes;

create trigger trg_clientes_preenche_ganho_em
  before update on clientes
  for each row
  when (
    new.status_acompanhamento = 'ganho'
    and old.status_acompanhamento is distinct from new.status_acompanhamento
    and new.ganho_em is null
  )
  execute function clientes_preenche_ganho_em();

update clientes c
set ganho_em = (h.ultimo_ganho at time zone 'America/Sao_Paulo')::date
from (
  select h2.cliente_id, max(h2.criado_em) as ultimo_ganho
  from historico h2
  where h2.tipo = 'status_acompanhamento'
    and h2.descricao ilike '%"ganho"%'
  group by h2.cliente_id
) h
where h.cliente_id = c.id
  and c.status_acompanhamento = 'ganho'
  and c.ganho_em is null;

${REMOCAO_FUNCAO} if exists clientes_ganhos(timestamptz, timestamptz);

create or replace function clientes_ganhos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  ganho_em date,
  responsavel uuid,
  responsavel_nome text
)
language sql
stable
as $$
  select
    c.id as cliente_id,
    c.razao_social,
    c.nome_fantasia,
    c.ganho_em,
    c.responsavel,
    nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome
  from clientes c
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'ganho'
    and (p_inicio is null or c.ganho_em >= (p_inicio at time zone 'America/Sao_Paulo')::date)
    and (p_fim is null or c.ganho_em < (p_fim at time zone 'America/Sao_Paulo')::date)
  order by 4 desc nulls last, 1 asc;
$$;
`

const ASSINATURA_ESPERADA =
  "create or replace function clientes_ganhos( p_inicio timestamptz default null, p_fim timestamptz default null ) returns table ( cliente_id uuid, razao_social text, nome_fantasia text, ganho_em date, responsavel uuid, responsavel_nome text ) language sql stable as $$"

const COLUNA_ESPERADA = "alter table clientes add column if not exists ganho_em date;"

const CORPO_GATILHO_ESPERADO =
  "as $$ begin new.ganho_em := (now() at time zone 'america/sao_paulo')::date; return new; end; $$;"

const CREATE_TRIGGER_ESPERADO =
  "create trigger trg_clientes_preenche_ganho_em before update on clientes for each row when ( new.status_acompanhamento = 'ganho' and old.status_acompanhamento is distinct from new.status_acompanhamento and new.ganho_em is null ) execute function clientes_preenche_ganho_em();"

const BACKFILL_ESPERADO =
  "update clientes c set ganho_em = (h.ultimo_ganho at time zone 'america/sao_paulo')::date from ( select h2.cliente_id, max(h2.criado_em) as ultimo_ganho from historico h2 where h2.tipo = 'status_acompanhamento' and h2.descricao ilike '%\"ganho\"%' group by h2.cliente_id ) h where h.cliente_id = c.id and c.status_acompanhamento = 'ganho' and c.ganho_em is null;"

const EXPRESSAO_RESPONSAVEL_NOME =
  "nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome"
const JUNCAO_PROFILES = "left join profiles p on p.id = c.responsavel"

/** As 4 instrucoes do arquivo de volta, na ordem. */
const VOLTA_ESPERADA = [
  `${REMOCAO_FUNCAO} if exists clientes_ganhos(timestamptz, timestamptz);`,
  "drop trigger if exists trg_clientes_preenche_ganho_em on clientes;",
  `${REMOCAO_FUNCAO} if exists clientes_preenche_ganho_em();`,
  "alter table clientes drop column if exists ganho_em;",
].join(" ")

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
 * INCLUSIVE os dois marcadores. */
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

/** Recorta da frase inicial ate o primeiro ";" depois dela, inclusive. */
function instrucaoDesde(sqlNormalizado: string, inicio: string): string {
  const ini = sqlNormalizado.indexOf(inicio)
  if (ini < 0) throw new Error(`Instrucao nao encontrada: ${inicio}`)
  const fim = sqlNormalizado.indexOf(";", ini)
  if (fim < 0) throw new Error(`Instrucao sem ponto e virgula: ${inicio}`)
  return sqlNormalizado.slice(ini, fim + 1)
}

/** Tabelas lidas (depois de from/join) em um corpo SQL normalizado e minusculo.
 * Ignora chamadas como "from coalesce(" e subconsultas "join lateral (". */
function tabelasLidas(corpo: string): string[] {
  const achadas = new Set<string>()
  const regex = /\b(?:from|join)\s+([a-z_][a-z0-9_]*)\b(?!\s*\()/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(corpo)) !== null) {
    achadas.add(m[1])
  }
  return [...achadas].sort()
}

const CODIGO_ESPERADO_NORMALIZADO = normaliza(CODIGO_ESPERADO).toLowerCase()
const CORPO_ESPERADO = normaliza(
  corpoComMarcadores(blocoDaFuncao(CODIGO_ESPERADO, FRASE_CRIACAO_GANHOS))
).toLowerCase()

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

  it("sql-exato", () => {
    const sql = normaliza(semComentarios(lerCru(ARQ_0053))).toLowerCase()
    expect(sql).toBe(CODIGO_ESPERADO_NORMALIZADO)
  })

  it("coluna-ganho-em", () => {
    const sql = semComentarios(lerCru(ARQ_0053)).toLowerCase()
    const normalizado = normaliza(sql)
    expect(contaOcorrencias(normalizado, COLUNA_ESPERADA)).toBe(1)
    expect(contaOcorrencias(normalizado, "alter table")).toBe(1)

    const linhaDaColuna = sql.split("\n").find((linha) => linha.includes("add column"))
    expect(linhaDaColuna).toBeDefined()
    expect(linhaDaColuna).not.toContain("not null")
    expect(linhaDaColuna).not.toContain("default")
  })

  it("gatilho-sem-elevacao", () => {
    const sql = semComentarios(lerCru(ARQ_0053)).toLowerCase()
    const bloco = normaliza(blocoDaFuncao(sql, FRASE_CRIACAO_GATILHO))

    expect(bloco).toContain("returns trigger")
    expect(bloco).toContain("language plpgsql")
    expect(bloco).not.toContain(CLAUSULA_ELEVACAO)
    expect(bloco).not.toContain("search_path")
    expect(normaliza(corpoComMarcadores(bloco))).toBe(CORPO_GATILHO_ESPERADO)

    const normalizado = normaliza(sql)
    expect(contaOcorrencias(normalizado, "create trigger")).toBe(1)
    const criacaoDoGatilho = instrucaoDesde(normalizado, "create trigger trg_clientes_preenche_ganho_em")
    expect(criacaoDoGatilho).toContain("before update on clientes")
    expect(criacaoDoGatilho).toContain("for each row")
    expect(criacaoDoGatilho).toBe(CREATE_TRIGGER_ESPERADO)
  })

  it("backfill-so-ganho-sem-data", () => {
    const normalizado = normaliza(semComentarios(lerCru(ARQ_0053))).toLowerCase()
    expect(contaOcorrencias(normalizado, "update clientes c")).toBe(1)

    const backfill = instrucaoDesde(normalizado, "update clientes c")
    expect(backfill).toBe(BACKFILL_ESPERADO)
    // So atribui ganho_em.
    expect(contaOcorrencias(backfill, " set ")).toBe(1)
    expect(backfill).toContain("set ganho_em = ")
    // Filtra ganho e ganho_em vazio.
    expect(backfill).toContain("and c.status_acompanhamento = 'ganho'")
    expect(backfill).toContain("and c.ganho_em is null")
    // Fonte: maximo de criado_em das trocas para ganho, em data de Sao Paulo.
    expect(backfill).toContain("max(h2.criado_em) as ultimo_ganho")
    expect(backfill).toContain("h2.tipo = 'status_acompanhamento'")
    expect(backfill).toContain(`h2.descricao ilike '%"ganho"%'`)
    expect(backfill).toContain("(h.ultimo_ganho at time zone 'america/sao_paulo')::date")
  })

  it("leitura-assinatura", () => {
    const sql0053 = lf(lerCru(ARQ_0053))
    expect(contaOcorrencias(sql0053, FRASE_CRIACAO_GANHOS)).toBe(1)

    const ass = normaliza(assinatura(blocoDaFuncao(sql0053, FRASE_CRIACAO_GANHOS))).toLowerCase()
    expect(ass).toBe(ASSINATURA_ESPERADA)
  })

  it("leitura-corpo", () => {
    const bloco = blocoDaFuncao(lerCru(ARQ_0053), FRASE_CRIACAO_GANHOS)
    const corpoCru = lf(corpoComMarcadores(bloco))
    const corpo = normaliza(corpoCru).toLowerCase()

    expect(corpo).toBe(CORPO_ESPERADO)
    expect(corpo).toContain("order by 4 desc nulls last, 1 asc;")
    expect(contaOcorrencias(corpo, "at time zone 'america/sao_paulo'")).toBe(2)
    for (const proibido of ["historico", "criado_em", "atualizado_em"]) {
      expect(corpo, `corpo da leitura nao pode citar ${proibido}`).not.toContain(proibido)
    }
    // Nenhum meio de contato com a pessoa do cliente (LGPD).
    for (const palavra of ["telefone", "email", "contato", "celular", "cnpj", "cep", "observacao", "motivo"]) {
      expect(corpo, `dado de contato/extra proibido: ${palavra}`).not.toMatch(
        new RegExp(`\\b${palavra}\\b`)
      )
    }
    // O corpo nao leva comentario nenhum.
    expect(corpoCru).not.toContain("--")
    expect(corpoCru).not.toContain("/*")
  })

  it("mesmas-regras-de-acesso-da-0034", () => {
    const bloco0034 = normaliza(
      semComentarios(blocoDaFuncao(lerCru(ARQ_0034), FRASE_CRIACAO_PERDIDOS))
    ).toLowerCase()
    const bloco0053 = normaliza(
      semComentarios(blocoDaFuncao(lerCru(ARQ_0053), FRASE_CRIACAO_GANHOS))
    ).toLowerCase()

    for (const [nome, bloco] of [
      ["0034", bloco0034],
      ["0053", bloco0053],
    ] as const) {
      expect(bloco, `${nome}: language sql`).toContain("language sql")
      expect(bloco, `${nome}: stable`).toContain("stable")
      expect(bloco, `${nome}: sem elevacao`).not.toContain(CLAUSULA_ELEVACAO)
      for (const proibido of ["search_path", "is_supervisor", "auth.uid", "grant ", "revoke "]) {
        expect(bloco, `${nome}: nao pode conter "${proibido}"`).not.toContain(proibido)
      }
    }

    const tabelas0034 = tabelasLidas(corpoComMarcadores(bloco0034))
    const tabelas0053 = tabelasLidas(corpoComMarcadores(bloco0053))
    expect(tabelas0053).toEqual(["clientes", "profiles"])
    for (const tabela of tabelas0053) {
      expect(tabelas0034, `tabela ${tabela} lida pela 0053 e nao pela 0034`).toContain(tabela)
    }

    // Mesma juncao de profiles e mesma expressao de responsavel_nome.
    expect(bloco0034).toContain(JUNCAO_PROFILES)
    expect(bloco0053).toContain(JUNCAO_PROFILES)
    expect(bloco0034).toContain(EXPRESSAO_RESPONSAVEL_NOME)
    expect(bloco0053).toContain(EXPRESSAO_RESPONSAVEL_NOME)
  })

  it("sem-elevacao-escrita-restrita", () => {
    const sqlLower = semComentarios(lerCru(ARQ_0053)).toLowerCase()
    const normalizado = normaliza(sqlLower)

    expect(sqlLower).not.toContain(CLAUSULA_ELEVACAO)
    for (const proibido of [
      "grant ",
      "revoke ",
      "policy",
      "insert into",
      "delete from",
      "truncate",
      "create table",
    ]) {
      expect(sqlLower, `nao pode conter "${proibido}"`).not.toContain(proibido)
    }

    const funcoesCriadas = (
      sqlLower.match(/create (?:or replace )?function\s+([a-z0-9_]+)/g) ?? []
    )
      .map((trecho) => trecho.replace(/create (?:or replace )?function\s+/, ""))
      .sort()
    expect(funcoesCriadas).toEqual(["clientes_ganhos", "clientes_preenche_ganho_em"])

    // Os unicos "drop" sao o do gatilho e o da leitura rascunho do contrato.
    expect(contaOcorrencias(normalizado, "drop ")).toBe(2)
    expect(normalizado).toContain("drop trigger if exists trg_clientes_preenche_ganho_em on clientes;")
    expect(normalizado).toContain(
      `${REMOCAO_FUNCAO} if exists clientes_ganhos(timestamptz, timestamptz);`
    )
  })

  it("comentarios-seguros", () => {
    const cru = lerCru(ARQ_0053)
    expect(ehAsciiPuro(cru)).toBe(true)
    expect(lf(cru).trimStart().startsWith("/*")).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(contaOcorrencias(cru, "$$")).toBe(4)
    expect(contaOcorrencias(cru.toLowerCase(), "function")).toBe(4)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)
    expect(cru.toLowerCase()).not.toContain(TABELA_AGENDA2)
    expect(cru).toContain("261008-rxw")
    expect(cru).toContain("supabase/rollbacks/0053_volta_clientes_ganhos.sql")
  })

  it("volta-desfaz-tudo", () => {
    expect(fs.existsSync(ARQ_VOLTA)).toBe(true)
    const cru = lerCru(ARQ_VOLTA)

    expect(ehAsciiPuro(cru)).toBe(true)
    expect(linhaComecaComDoisHifens(cru)).toBe(false)
    expect(cru).toContain("NAO APLICAR")
    expect(cru).toContain("APAGA")
    expect(contaOcorrencias(cru.toLowerCase(), "function")).toBe(2)
    expect(cru.toLowerCase()).not.toContain(CLAUSULA_ELEVACAO)

    expect(normaliza(semComentarios(cru)).toLowerCase()).toBe(VOLTA_ESPERADA)
  })
})
