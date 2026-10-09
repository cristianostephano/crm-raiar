import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  anonClient,
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Testes ao vivo do recorte opcional por vendedor (p_vendedor) das 6 leituras
 * do Dashboard (migration 0054, quick 261009-npp): o recorte so ESTREITA sobre a
 * RLS, nulo = todos, e um Vendedor que manda o id de outro continua vendo so os
 * proprios clientes.
 *
 * O projeto Supabase de teste E o de producao, com dados reais de clientes.
 * Por isso este arquivo: usa so fixtures descartaveis (membros e clientes
 * criados e apagados aqui, nunca as contas semente antigas); NUNCA imprime
 * linha lida do banco no terminal; usa so nomes e CNPJs inventados (toda razao
 * social comeca com o prefixo "Teste Filtro Vendedor"); nunca le nem grava a
 * tabela de registro de acesso diario da aderencia; e troca toda etapa/status
 * pelo cliente de servico (autor nulo no historico, entao nada conta na
 * aderencia de ninguem).
 *
 * Duas autenticacoes no arquivo inteiro: Vendedor A e Supervisor. Vendedor B
 * nunca faz login - os clientes dele sao semeados pelo cliente de servico (rate
 * limit conhecido de login por senha).
 *
 * As fixtures sao semeadas UMA vez (beforeAll): as leituras sao agregados, nao
 * listas filtraveis por id. Numeros exatos so onde quem chama enxerga apenas
 * fixtures (Vendedor A, ou Supervisor com recorte A/B). O Supervisor sem
 * recorte enxerga a carteira real: so comparacoes "maior ou igual", com
 * mensagens sem valores.
 *
 * Fica VERMELHO (a coluna de recorte ainda nao existe no banco) ate o dono
 * aplicar a 0054 pelo SQL Editor. Esse vermelho e esperado e NAO foi medido na
 * tarefa de construcao: este arquivo so roda depois da aplicacao (Tarefa 6) -
 * mesmo procedimento das quick tasks anteriores.
 */

const PREFIXO_FIXTURE = "Teste Filtro Vendedor"

const ETAPAS = [
  "aguardando_contato",
  "conversa_comprador",
  "aguardando_data_reuniao",
  "aguardando_feedback",
  "aguardando_aprovacao",
  "em_cadastro_produto",
  "primeira_venda",
] as const

type Linha = Record<string, unknown>
type NomeLeitura =
  | "dashboard_clientes_por_etapa"
  | "dashboard_funil_detalhado"
  | "dashboard_tempo_ate_fechamento"
  | "dashboard_ganhos_perdidos"
  | "dashboard_prospeccao_por_produto"
  | "dashboard_prospeccao_por_categoria"

const LEITURAS: NomeLeitura[] = [
  "dashboard_clientes_por_etapa",
  "dashboard_funil_detalhado",
  "dashboard_tempo_ate_fechamento",
  "dashboard_ganhos_perdidos",
  "dashboard_prospeccao_por_produto",
  "dashboard_prospeccao_por_categoria",
]

const COM_PERIODO: NomeLeitura[] = [
  "dashboard_ganhos_perdidos",
  "dashboard_prospeccao_por_produto",
  "dashboard_prospeccao_por_categoria",
]

const AUSENTE = "ausente" as const
/** "ausente" = formato antigo (sem p_vendedor); nulo = todos; texto = id. */
type VendedorArg = string | null | typeof AUSENTE

type FunilEtapa = { quantidade: number; avancou: number; perdidos: number }

type Resumo = {
  etapas: Record<string, number>
  funil: Record<string, FunilEtapa>
  tempo: string[]
  ganhos: Record<string, number>
  produto: Record<string, number>
  categoria: Record<string, number>
}

const DIA_MS = 24 * 60 * 60_000
const TEMPO_LIMITE = 60_000

let cnpjCounter = 0

function uniqueRazaoSocial(label: string): string {
  return `${PREFIXO_FIXTURE} ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 14 digitos derivados do timestamp + contador - evita colidir com a trava
 * de razao social+CNPJ da migration 0030 entre fixtures do arquivo. */
function uniqueCnpj(): string {
  cnpjCounter += 1
  return `${Date.now()}${cnpjCounter}`.slice(-14).padStart(14, "0")
}

let vendedorA: TestMember | undefined
let vendedorB: TestMember | undefined
let supervisor: TestMember | undefined
let clientA: SupabaseClient
let clientS: SupabaseClient
let janela: { inicio: string; fim: string }
let produtoId: string
let categoriaId: string

/** Todos os ids de cliente criados no arquivo (apagados e conferidos no
 * afterAll). */
const clienteIds: string[] = []

/** Leitura read-only do id do primeiro item ativo de uma lista editavel. */
async function primeiroAtivoId(tabela: string, rotulo: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from(tabela)
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error(`Nenhum item ativo de ${rotulo} encontrado para o teste`)
  }
  return (data as { id: string }).id
}

/** Insere pelo cliente de servico, com a categoria e o produto das fixtures. */
async function seedCliente(
  responsavelId: string,
  label: string,
  campos: Record<string, unknown>
): Promise<string> {
  const admin = serviceClient()
  const razaoSocial = uniqueRazaoSocial(label)
  const { data, error } = await admin
    .from("clientes")
    .insert({
      razao_social: razaoSocial,
      nome_fantasia: `Fantasia ${razaoSocial}`,
      cnpj: uniqueCnpj(),
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "Sao Paulo",
      estado: "SP",
      responsavel: responsavelId,
      categoria_id: categoriaId,
      ...campos,
    })
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear cliente: ${error?.message}`)
  }
  const id = (data as { id: string }).id
  clienteIds.push(id)

  const { error: erroProduto } = await admin
    .from("cliente_produtos")
    .insert({ cliente_id: id, produto_id: produtoId })
  if (erroProduto) {
    throw new Error(`Falha ao ligar produto ao cliente: ${erroProduto.message}`)
  }
  return id
}

async function atualizarCliente(clienteId: string, campos: Record<string, unknown>): Promise<void> {
  const { error } = await serviceClient().from("clientes").update(campos).eq("id", clienteId)
  if (error) {
    throw new Error(`Falha ao atualizar cliente: ${error.message}`)
  }
}

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "filtro-vendedor-a")
  vendedorB = await createTestMember("vendedor", "filtro-vendedor-b")
  supervisor = await createTestMember("supervisor", "filtro-vendedor-s")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  clientS = await signInAs(supervisor.email, supervisor.password)

  const motivoPerdaId = await primeiroAtivoId("motivos_perda", "motivo de perda")
  categoriaId = await primeiroAtivoId("categorias", "categoria")
  produtoId = await primeiroAtivoId("produtos_consumidos", "produto")

  // Vendedor A: A1 em conversa_comprador, A2 ganho.
  const a1 = await seedCliente(vendedorA.id, "a1", { etapa: "aguardando_contato" })
  await atualizarCliente(a1, { etapa: "conversa_comprador" })
  const a2 = await seedCliente(vendedorA.id, "a2", {
    etapa: "primeira_venda",
    status_acompanhamento: "em_andamento",
  })
  await atualizarCliente(a2, { status_acompanhamento: "ganho" })

  // Vendedor B: B1 em aguardando_data_reuniao, B2 perdido.
  const b1 = await seedCliente(vendedorB.id, "b1", { etapa: "aguardando_contato" })
  await atualizarCliente(b1, { etapa: "aguardando_data_reuniao" })
  const b2 = await seedCliente(vendedorB.id, "b2", {
    etapa: "aguardando_contato",
    status_acompanhamento: "em_andamento",
  })
  await atualizarCliente(b2, {
    status_acompanhamento: "perdido",
    motivo_perda_id: motivoPerdaId,
  })

  // Janela de periodo calculada DEPOIS da semeadura.
  const agora = Date.now()
  janela = {
    inicio: new Date(agora - DIA_MS).toISOString(),
    fim: new Date(agora + DIA_MS).toISOString(),
  }
}, 120_000)

afterAll(async () => {
  // Ordem obrigatoria: clientes primeiro (FK sem ON DELETE), membros depois.
  const admin = serviceClient()
  if (clienteIds.length > 0) {
    // O historico e os produtos vao por cascata junto com o cliente.
    await admin.from("clientes").delete().in("id", clienteIds)
  }
  for (const membro of [vendedorA, vendedorB, supervisor]) {
    if (membro) await deleteTestMember(membro.id)
  }

  if (clienteIds.length === 0) return
  const { data: clientesRestantes, error: erroClientes } = await admin
    .from("clientes")
    .select("id")
    .in("id", clienteIds)
  const { data: historicoRestante, error: erroHistorico } = await admin
    .from("historico")
    .select("id")
    .in("cliente_id", clienteIds)
  const { data: produtosRestantes, error: erroProdutos } = await admin
    .from("cliente_produtos")
    .select("cliente_id")
    .in("cliente_id", clienteIds)
  if (erroClientes || erroHistorico || erroProdutos) {
    throw new Error("Falha ao conferir residuo das fixtures do filtro de vendedor")
  }
  const sobrouClientes = (clientesRestantes ?? []).length
  const sobrouHistorico = (historicoRestante ?? []).length
  const sobrouProdutos = (produtosRestantes ?? []).length
  if (sobrouClientes > 0 || sobrouHistorico > 0 || sobrouProdutos > 0) {
    throw new Error(
      `Residuo de fixtures do filtro de vendedor: ${sobrouClientes} cliente(s), ` +
        `${sobrouHistorico} linha(s) de historico e ${sobrouProdutos} ligacao(oes) de produto`
    )
  }
}, 120_000)

/** Monta os argumentos da leitura; "ausente" nao manda p_vendedor. */
function argumentos(nome: NomeLeitura, vendedor: VendedorArg): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  if (COM_PERIODO.includes(nome)) {
    args.p_inicio = janela.inicio
    args.p_fim = janela.fim
  }
  if (vendedor !== AUSENTE) args.p_vendedor = vendedor
  return args
}

/** Chama a leitura; devolve o erro como booleano (nunca a mensagem nem linha). */
async function tentar(
  cliente: SupabaseClient,
  nome: NomeLeitura,
  vendedor: VendedorArg
): Promise<{ erro: boolean; linhas: Linha[] }> {
  const args = argumentos(nome, vendedor)
  const { data, error } =
    Object.keys(args).length > 0 ? await cliente.rpc(nome, args) : await cliente.rpc(nome)
  if (error) return { erro: true, linhas: [] }
  return { erro: false, linhas: (data ?? []) as Linha[] }
}

/** Chama a leitura e lanca erro (sem imprimir linha) se o banco recusar. */
async function chamar(
  cliente: SupabaseClient,
  nome: NomeLeitura,
  vendedor: VendedorArg
): Promise<Linha[]> {
  const resultado = await tentar(cliente, nome, vendedor)
  if (resultado.erro) {
    throw new Error(`A leitura ${nome} falhou (vendedor: ${vendedor === AUSENTE ? "ausente" : vendedor === null ? "nulo" : "informado"})`)
  }
  return resultado.linhas
}

function mapaTotais(linhas: Linha[], chave: string): Record<string, number> {
  const mapa: Record<string, number> = {}
  for (const linha of linhas) mapa[String(linha[chave])] = Number(linha.total)
  return mapa
}

function resumoDoFunil(linhas: Linha[]): Record<string, FunilEtapa> {
  const mapa: Record<string, FunilEtapa> = {}
  for (const linha of linhas) {
    mapa[String(linha.etapa)] = {
      quantidade: Number(linha.quantidade),
      avancou: Number(linha.avancou_count),
      perdidos: Number(linha.perdidos_count),
    }
  }
  return mapa
}

/** As 6 leituras de uma sessao, normalizadas (tempo e gargalo do funil
 * dependem do relogio e ficam de fora). */
async function lerTodas(cliente: SupabaseClient, vendedor: VendedorArg): Promise<Resumo> {
  const [etapas, funil, tempo, ganhos, produto, categoria] = await Promise.all(
    LEITURAS.map((nome) => chamar(cliente, nome, vendedor))
  )
  return {
    etapas: mapaTotais(etapas, "etapa"),
    funil: resumoDoFunil(funil),
    tempo: tempo.map((linha) => String(linha.status)).sort(),
    ganhos: mapaTotais(ganhos, "status"),
    produto: mapaTotais(produto, "produto_id"),
    categoria: mapaTotais(categoria, "categoria_id"),
  }
}

function funilCom(
  quantidade: Record<string, number>,
  avancou: Record<string, number>,
  perdidos: Record<string, number>
): Record<string, FunilEtapa> {
  const mapa: Record<string, FunilEtapa> = {}
  for (const etapa of ETAPAS) {
    mapa[etapa] = {
      quantidade: quantidade[etapa] ?? 0,
      avancou: avancou[etapa] ?? 0,
      perdidos: perdidos[etapa] ?? 0,
    }
  }
  return mapa
}

/** Vendedor A: A1 em conversa_comprador (passou por aguardando_contato), A2
 * ganho (inserido ja em primeira_venda, so com a entrada sintetica em
 * aguardando_contato). */
function esperadoA(): Resumo {
  return {
    etapas: { conversa_comprador: 1, primeira_venda: 1 },
    funil: funilCom(
      { aguardando_contato: 2, conversa_comprador: 1 },
      { aguardando_contato: 1 },
      {}
    ),
    tempo: ["ganho"],
    ganhos: { ganho: 1 },
    produto: { [produtoId]: 2 },
    categoria: { [categoriaId]: 2 },
  }
}

/** Vendedor B: B1 em aguardando_data_reuniao (passou por aguardando_contato),
 * B2 perdido ainda em aguardando_contato. */
function esperadoB(): Resumo {
  return {
    etapas: { aguardando_contato: 1, aguardando_data_reuniao: 1 },
    funil: funilCom(
      { aguardando_contato: 2, aguardando_data_reuniao: 1 },
      { aguardando_contato: 1 },
      { aguardando_contato: 1 }
    ),
    tempo: ["perdido"],
    ganhos: { perdido: 1 },
    produto: { [produtoId]: 2 },
    categoria: { [categoriaId]: 2 },
  }
}

function esperadoVazio(): Resumo {
  return {
    etapas: {},
    funil: funilCom({}, {}, {}),
    tempo: [],
    ganhos: {},
    produto: {},
    categoria: {},
  }
}

function soma(mapa: Record<string, number>): number {
  return Object.values(mapa).reduce((acc, valor) => acc + valor, 0)
}

function somaFunil(funil: Record<string, FunilEtapa>): number {
  return Object.values(funil).reduce((acc, etapa) => acc + etapa.quantidade, 0)
}

describe("filtro-vendedor-rpc: p_vendedor nas 6 leituras do Dashboard (ao vivo)", () => {
  it(
    "vendedor-sem-filtro-igual-ao-proprio",
    async () => {
      const semFiltro = await lerTodas(clientA, null)
      const recorteA = await lerTodas(clientA, vendedorA!.id)
      expect(semFiltro).toEqual(esperadoA())
      expect(recorteA).toEqual(esperadoA())
      expect(recorteA).toEqual(semFiltro)
    },
    TEMPO_LIMITE
  )

  it(
    "vendedor-nao-amplia",
    async () => {
      // Vendedor A manda o id do Vendedor B: a RLS continua a unica fronteira.
      const comIdDeB = await lerTodas(clientA, vendedorB!.id)
      expect(comIdDeB).toEqual(esperadoVazio())
    },
    TEMPO_LIMITE
  )

  it(
    "supervisor-filtra-a",
    async () => {
      const recorteA = await lerTodas(clientS, vendedorA!.id)
      expect(recorteA).toEqual(esperadoA())
    },
    TEMPO_LIMITE
  )

  it(
    "supervisor-filtra-b",
    async () => {
      const recorteB = await lerTodas(clientS, vendedorB!.id)
      expect(recorteB).toEqual(esperadoB())
    },
    TEMPO_LIMITE
  )

  it(
    "supervisor-sem-filtro-inclui-todos",
    async () => {
      // O Supervisor sem recorte enxerga a carteira real: so comparacoes
      // booleanas, com mensagens sem valores.
      const todos = await lerTodas(clientS, null)
      const a = esperadoA()
      const b = esperadoB()

      expect(
        soma(todos.etapas) >= soma(a.etapas) + soma(b.etapas),
        "clientes por etapa sem recorte inclui os dois vendedores"
      ).toBe(true)
      expect(
        (todos.funil.aguardando_contato?.quantidade ?? 0) >= 4,
        "funil sem recorte inclui os 4 clientes na primeira etapa"
      ).toBe(true)
      expect(
        somaFunil(todos.funil) >= somaFunil(a.funil) + somaFunil(b.funil),
        "funil sem recorte inclui os dois vendedores"
      ).toBe(true)
      expect(
        todos.tempo.includes("ganho") && todos.tempo.includes("perdido"),
        "tempo ate fechamento sem recorte inclui ganho e perdido"
      ).toBe(true)
      expect(
        soma(todos.ganhos) >= soma(a.ganhos) + soma(b.ganhos),
        "ganhos e perdidos sem recorte inclui os dois vendedores"
      ).toBe(true)
      expect(
        soma(todos.produto) >= soma(a.produto) + soma(b.produto),
        "prospeccao por produto sem recorte inclui os dois vendedores"
      ).toBe(true)
      expect(
        soma(todos.categoria) >= soma(a.categoria) + soma(b.categoria),
        "prospeccao por categoria sem recorte inclui os dois vendedores"
      ).toBe(true)
    },
    TEMPO_LIMITE
  )

  it(
    "chamada-antiga-continua-valendo",
    async () => {
      // Formato antigo (codigo hoje em producao): sem p_vendedor.
      const antigoA = await lerTodas(clientA, AUSENTE)
      const nuloA = await lerTodas(clientA, null)
      expect(antigoA).toEqual(nuloA)
      expect(antigoA).toEqual(esperadoA())

      // Supervisor: as mesmas 6 chamadas antigas respondem sem erro; o
      // resultado nao e comparado nem impresso (inclui a carteira real).
      for (const nome of LEITURAS) {
        const resultado = await tentar(clientS, nome, AUSENTE)
        expect(resultado.erro, `chamada antiga de ${nome} pelo Supervisor`).toBe(false)
      }
    },
    TEMPO_LIMITE
  )

  it(
    "anonimo-sem-dados",
    async () => {
      const anonimo = anonClient()
      for (const nome of LEITURAS) {
        const resultado = await tentar(anonimo, nome, vendedorA!.id)
        if (resultado.erro) continue // recusar tambem e aceitavel
        if (nome === "dashboard_funil_detalhado") {
          const funil = resumoDoFunil(resultado.linhas)
          expect(somaFunil(funil), "funil anonimo sem clientes").toBe(0)
          for (const etapa of Object.values(funil)) {
            expect(etapa.avancou + etapa.perdidos, "funil anonimo sem avancos nem perdas").toBe(0)
          }
        } else {
          expect(resultado.linhas.length, `${nome} anonimo vazio`).toBe(0)
        }
      }
    },
    TEMPO_LIMITE
  )
})
