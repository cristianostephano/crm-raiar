"use server"

import { revalidatePath } from "next/cache"

import { diaLocalSaoPaulo } from "@/lib/aderencia/registroDiario"
import type { Agenda2Item } from "@/lib/agenda2/itens"
import { gerarDatasSemanais } from "@/lib/agenda2/repeticao"
import { getAgenda2, getAgenda2Periodo } from "@/lib/supabase/queries/agenda2"
import { createClient } from "@/lib/supabase/server"
import { validarIntervaloHistorico } from "@/lib/validations/agenda"
import {
  agenda2ItemIdSchema,
  agenda2ItemSchema,
  criarAgenda2CriarSchema,
  type Agenda2CriarItemInput,
  type Agenda2ItemInput,
} from "@/lib/validations/agenda2"

/**
 * Sete Server Actions da Agenda 2 (Fase 31, AGD2-01/03/04/05/07, D-05, D-06,
 * D-16; Pattern 2/4 da pesquisa, 31-RESEARCH.md; Fase 32 acrescenta a
 * leitura do calendário, AGD2-08). Toda escrita é um insert/update/delete
 * DIRETO em `agenda2_itens` — sem RPC, sem privilégio elevado. Quem decide
 * se 0 ou 1 linha é afetada é a RLS assimétrica da migration 0048 (plano
 * 31-01): Supervisor e vendedor alheio ao item sempre afetam zero linhas
 * (D-16), nunca uma linha de outro dono. Criar grava de 1 a 12 linhas num
 * único insert tudo-ou-nada (D-20), com a RLS avaliada linha a linha e sem
 * identificador de série (D-22).
 *
 * Nenhuma checagem de papel aqui — a RLS é a fronteira (CLAUDE.md). O dono
 * do item é SEMPRE `user.id` da sessão do servidor, nunca um valor vindo da
 * tela (nota a do ROADMAP, T-31-18): o insert monta cada linha só com os três
 * campos validados do schema + `vendedor_id`. A mensagem crua do banco nunca
 * chega à tela (T-31-21) — sempre uma das mensagens fixas abaixo. Uma ação
 * que afeta zero linhas é tratada como erro (`nao_encontrado`), nunca como
 * sucesso falso.
 */

const MSG_SESSAO_EXPIRADA = "Sessão expirada."
const MSG_CARREGAR_FALHOU =
  "Não foi possível carregar sua Agenda. Tente novamente."
const MSG_SALVAR_FALHOU = "Não foi possível salvar. Tente novamente."
const MSG_CARREGAR_CALENDARIO_FALHOU =
  "Não foi possível carregar o calendário deste período."

export type Agenda2ErrorCode =
  | "unauthenticated"
  | "validacao"
  | "nao_encontrado"
  | "salvar_falhou"
  | "fetch_falhou"

export type GetAgenda2Result =
  | { data: Agenda2Item[]; error?: undefined }
  | { data?: undefined; error: { code: Agenda2ErrorCode; message: string } }

export type Agenda2MutationResult =
  | { data: true; error?: undefined }
  | { data?: undefined; error: { code: Agenda2ErrorCode; message: string } }

/** Embrulho fino: `getAgenda2()` depende de `cookies()` via
 * lib/supabase/server.ts, então só pode ser chamada a partir de uma Server
 * Action/Component. */
export async function getAgenda2Action(): Promise<GetAgenda2Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }
  }

  try {
    return { data: await getAgenda2() }
  } catch {
    return { error: { code: "fetch_falhou", message: MSG_CARREGAR_FALHOU } }
  }
}

/**
 * AGD2-08/D-28: leitura do calendário — pendentes e concluídos do período
 * visível. Molde de `getAgendaConcluidosAction` (app/actions/agenda.ts),
 * mas com uma fonte só. Ação de servidor é endpoint público e o intervalo
 * calculado no navegador não é fronteira: `validarIntervaloHistorico`
 * (formato, início ≤ fim, ≤ 45 dias; a grade de mês tem no máximo 42) roda
 * ANTES de qualquer ida ao banco. É guarda de RECURSO, não de permissão —
 * quem escopa o resultado é só a RLS da 0048 (vendedor vê os seus,
 * Supervisor o time); o filtro por vendedor do Supervisor é só um
 * estreitamento na tela (D-30). Sem revalidatePath: leitura pura, chamada
 * pelo navegador conforme a pessoa navega. Mensagem sempre fixa.
 */
export async function getAgenda2PeriodoAction(
  inicio: string,
  fim: string
): Promise<GetAgenda2Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }
  }

  const validacao = validarIntervaloHistorico(inicio, fim)
  if (!validacao.valido) {
    return {
      error: { code: "validacao", message: MSG_CARREGAR_CALENDARIO_FALHOU },
    }
  }

  try {
    return { data: await getAgenda2Periodo(validacao.inicio, validacao.fim) }
  } catch {
    return {
      error: { code: "fetch_falhou", message: MSG_CARREGAR_CALENDARIO_FALHOU },
    }
  }
}

/**
 * Cria um item (AGD2-01) com repetição semanal opcional (AGD2-02, Fase 32).
 * Grava de 1 a 12 linhas num ÚNICO insert tudo-ou-nada (D-20, D-31): o
 * PostgREST transforma `.insert(array)` em um só INSERT, então uma falha no
 * meio (RLS, constraint, rede) não deixa metade das semanas gravada. Nunca
 * há laço nem várias chamadas, e sempre é array, inclusive para 1 linha.
 *
 * Re-valida com `criarAgenda2CriarSchema(hoje)` no servidor — ação de
 * servidor é endpoint público, nunca confia só na validação do navegador
 * (CLAUDE.md). O "hoje" da regra D-23 é o dia de São Paulo calculado AQUI
 * (a Vercel roda em UTC; às 22:30 de Brasília o UTC já virou o dia). Cada
 * linha é montada SÓ com os três campos do parse mais `vendedor_id: user.id`
 * — qualquer campo extra enviado pela tela (ex.: `vendedorId`, `concluido`)
 * é descartado (T-31-18), e nenhum identificador de série existe (D-22).
 * Quem autoriza é só a RLS da 0048, avaliada linha a linha: uma única linha
 * recusada derruba o lote inteiro.
 */
export async function criarAgenda2Item(
  values: Agenda2CriarItemInput
): Promise<Agenda2MutationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }
  }

  const hoje = diaLocalSaoPaulo(new Date())
  const parsed = criarAgenda2CriarSchema(hoje).safeParse(values)
  if (!parsed.success) {
    return { error: { code: "validacao", message: MSG_SALVAR_FALHOU } }
  }

  const datas = gerarDatasSemanais(
    parsed.data.data,
    parsed.data.repetirSemanas ?? 0
  )
  const linhas = datas.map((data) => ({
    nome_cliente: parsed.data.nomeCliente,
    bairro: parsed.data.bairro,
    data,
    vendedor_id: user.id,
  }))

  // Sem .select(): menos tráfego de volta e nada a ler do lote gravado.
  const { error } = await supabase.from("agenda2_itens").insert(linhas)

  if (error) {
    return { error: { code: "salvar_falhou", message: MSG_SALVAR_FALHOU } }
  }

  revalidatePath("/agenda-2")
  return { data: true }
}

/**
 * Edita um item (AGD2-03). NUNCA inclui `concluido` no update (D-06): editar
 * um item concluído não pode desmarcá-lo por acidente. Zero linhas afetadas
 * (RLS barrou ou item não existe) vira `nao_encontrado`, nunca sucesso
 * falso.
 */
export async function atualizarAgenda2Item(
  itemId: string,
  values: Agenda2ItemInput
): Promise<Agenda2MutationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }
  }

  const idParsed = agenda2ItemIdSchema.safeParse(itemId)
  const valuesParsed = agenda2ItemSchema.safeParse(values)
  if (!idParsed.success || !valuesParsed.success) {
    return { error: { code: "validacao", message: MSG_SALVAR_FALHOU } }
  }

  const { data, error } = await supabase
    .from("agenda2_itens")
    .update({
      nome_cliente: valuesParsed.data.nomeCliente,
      bairro: valuesParsed.data.bairro,
      data: valuesParsed.data.data,
    })
    .eq("id", idParsed.data)
    .select("id")

  if (error) {
    return { error: { code: "salvar_falhou", message: MSG_SALVAR_FALHOU } }
  }
  if (!data || data.length === 0) {
    return { error: { code: "nao_encontrado", message: MSG_SALVAR_FALHOU } }
  }

  revalidatePath("/agenda-2")
  return { data: true }
}

/**
 * Apaga um item (AGD2-04). Mesma forma de guarda de zero-linhas que
 * `atualizarAgenda2Item`.
 */
export async function apagarAgenda2Item(
  itemId: string
): Promise<Agenda2MutationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }
  }

  const idParsed = agenda2ItemIdSchema.safeParse(itemId)
  if (!idParsed.success) {
    return { error: { code: "validacao", message: MSG_SALVAR_FALHOU } }
  }

  const { data, error } = await supabase
    .from("agenda2_itens")
    .delete()
    .eq("id", idParsed.data)
    .select("id")

  if (error) {
    return { error: { code: "salvar_falhou", message: MSG_SALVAR_FALHOU } }
  }
  if (!data || data.length === 0) {
    return { error: { code: "nao_encontrado", message: MSG_SALVAR_FALHOU } }
  }

  revalidatePath("/agenda-2")
  return { data: true }
}

/** Helper interno (não exportado) de `concluirAgenda2Item`/
 * `desmarcarAgenda2Item` — mesma guarda de sessão/validação/zero-linhas. */
async function definirConcluido(
  itemId: string,
  valor: boolean
): Promise<Agenda2MutationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }
  }

  const idParsed = agenda2ItemIdSchema.safeParse(itemId)
  if (!idParsed.success) {
    return { error: { code: "validacao", message: MSG_SALVAR_FALHOU } }
  }

  const { data, error } = await supabase
    .from("agenda2_itens")
    .update({ concluido: valor })
    .eq("id", idParsed.data)
    .select("id")

  if (error) {
    return { error: { code: "salvar_falhou", message: MSG_SALVAR_FALHOU } }
  }
  if (!data || data.length === 0) {
    return { error: { code: "nao_encontrado", message: MSG_SALVAR_FALHOU } }
  }

  revalidatePath("/agenda-2")
  return { data: true }
}

/** AGD2-05: marca o item como concluído. */
export async function concluirAgenda2Item(
  itemId: string
): Promise<Agenda2MutationResult> {
  return definirConcluido(itemId, true)
}

/** D-05: desmarca um item concluído por engano. */
export async function desmarcarAgenda2Item(
  itemId: string
): Promise<Agenda2MutationResult> {
  return definirConcluido(itemId, false)
}
