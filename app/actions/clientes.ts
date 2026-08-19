"use server"

import { revalidatePath } from "next/cache"

import { cidadeValida } from "@/lib/clientes/cidadeValida"
import {
  frequenciaPedidoCanonica,
  frequenciaPedidoValida,
} from "@/lib/clientes/frequenciaPedido"
import {
  createClienteSchema,
  updateClienteSchema,
  type CreateClienteInput,
  type UpdateClienteInput,
} from "@/lib/validations/cliente"
import { createClient } from "@/lib/supabase/server"
import {
  getClienteById,
  getFrequenciasPedidoAtivas,
  type ClienteDetalhe,
  type LookupOption,
} from "@/lib/supabase/queries/clientes"
import { isFrequenciaVisita, type FrequenciaVisita } from "@/lib/funil/frequencia"

export type CreateClienteErrorCode =
  | "validation"
  | "unauthenticated"
  | "duplicate_razao_social"
  | "generic"

export type CreateClienteResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: CreateClienteErrorCode } }

/**
 * Creates a cliente (CLI-01/CLI-02/CLI-03). Re-validates with
 * createClienteSchema on the server — never trusts the client-side
 * validation (T-02-07). Every new cliente originates in the funil's first
 * stage ("aguardando_contato") via the `clientes.etapa` DB default, so no
 * separate "assign initial stage" step is needed here (FUN-01).
 */
export async function createCliente(
  values: CreateClienteInput
): Promise<CreateClienteResult> {
  const parsed = createClienteSchema.safeParse(values)
  if (!parsed.success) {
    return { error: { code: "validation" } }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  // Defense in depth (T-02-07/T-02-08): a Vendedor's client-sent responsavel
  // is always overridden with their own uid, even though the clientes INSERT
  // RLS policy from 02-01 ("usuarios cadastram clientes para si (ou
  // supervisor para qualquer um)") already enforces the same rule at the
  // database level. Only a Supervisor may assign a different responsavel.
  const responsavel = isSupervisor ? parsed.data.responsavel : user.id

  // V5/T-09-09: the Combobox already constrains the Cidade choice client-side,
  // but a Server Action must never trust that alone (CLAUDE.md) — re-check
  // server-side that the submitted Cidade genuinely belongs to the submitted
  // Estado (Zod's z.enum(UFS) already re-validated Estado above; Cidade
  // validity is DB-dependent, so it can't be expressed in Zod).
  const { data: cidadesDoEstado } = await supabase.rpc("cidades_por_estado", {
    p_uf: parsed.data.estado,
  })

  if (
    !cidadeValida(
      parsed.data.cidade,
      parsed.data.estado,
      (cidadesDoEstado ?? []).map((row: { nome: string }) => ({
        nome: row.nome,
        uf: parsed.data.estado,
      }))
    )
  ) {
    return { error: { code: "validation" } }
  }

  const { data: inserted, error } = await supabase
    .from("clientes")
    .insert({
      razao_social: parsed.data.razaoSocial,
      cep: parsed.data.cep,
      rua: parsed.data.rua,
      numero: parsed.data.numero,
      complemento: parsed.data.complemento || null,
      cidade: parsed.data.cidade,
      estado: parsed.data.estado,
      responsavel,
      categoria_id: parsed.data.categoriaId || null,
      contato: parsed.data.contato || null,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
      numero_de_lojas: parsed.data.numeroDeLojas ?? null,
    })
    .select("id")
    .single()

  if (error) {
    // D-06: razao_social is unique across the whole base. Postgres reports a
    // unique-violation as 23505 — map it to a structured, non-revealing error
    // code (the copy shown to the user never reveals which vendedor owns the
    // existing razão social).
    if (error.code === "23505") {
      return { error: { code: "duplicate_razao_social" } }
    }
    return { error: { code: "generic" } }
  }

  revalidatePath("/clientes")
  return { data: { id: inserted!.id } }
}

export type GetClienteDetalheErrorCode = "unauthenticated" | "not_found"

export type GetClienteDetalheResult =
  | { data: ClienteDetalhe; error?: undefined }
  | { data?: undefined; error: { code: GetClienteDetalheErrorCode } }

/**
 * Thin Server Action wrapper around lib/supabase/queries/clientes.ts's
 * getClienteById() (T-02-21) — KanbanBoard is a Client Component, and
 * getClienteById() reads via lib/supabase/server.ts's createClient(), which
 * needs next/headers' cookies() (a live Next.js request scope). A Client
 * Component can only reach that through a Server Action, not by importing
 * the query function directly.
 */
export async function getClienteDetalhe(
  id: string
): Promise<GetClienteDetalheResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const cliente = await getClienteById(id)
  if (!cliente) {
    return { error: { code: "not_found" } }
  }

  return { data: cliente }
}

export type UpdateClienteErrorCode =
  | "validation"
  | "unauthenticated"
  | "not_found"
  | "duplicate_razao_social"
  | "generic"

export type UpdateClienteResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: UpdateClienteErrorCode } }

/**
 * Edits an existing cliente (CLI-02/CLI-05/CLI-06). Re-validates with
 * updateClienteSchema server-side — never trusts the client-side validation
 * (mirrors createCliente's T-02-07 discipline).
 */
export async function updateCliente(
  values: UpdateClienteInput
): Promise<UpdateClienteResult> {
  const parsed = updateClienteSchema.safeParse(values)
  if (!parsed.success) {
    return { error: { code: "validation" } }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  // Defense in depth (T-02-19): a Vendedor's client-sent responsavel change
  // is always stripped/overridden with their own uid, even though the
  // clientes UPDATE ... WITH CHECK RLS policy from 02-01 already rejects a
  // Vendedor reassigning responsavel at the database level. Only a
  // Supervisor may assign a different responsavel.
  const responsavel = isSupervisor ? parsed.data.responsavel : user.id

  // Quick task 260819-m8q (D-06/T-M8Q-07): a checagem cruzada cidade×estado
  // (V5/T-09-09) só roda quando os DOIS vêm preenchidos. Com qualquer um em
  // branco não há nada para cruzar — cidadeValida() devolveria falso para
  // texto vazio e recusaria o salvamento com o mesmo código de validação,
  // exatamente o bloqueio que D-06 manda tirar da ficha. Consistência
  // deliberada com o lado da importação (quick task Task 1/3): os campos
  // são independentes entre si, cidade preenchida com estado em branco não
  // é tratado como erro aqui, e pular a checagem evita um pedido inútil ao
  // servidor para uma UF vazia.
  const cidadeInformada = parsed.data.cidade.trim() !== ""
  const estadoInformado = parsed.data.estado.trim() !== ""

  if (cidadeInformada && estadoInformado) {
    // V5/T-09-09: never trust that the client-side Combobox already
    // constrained Cidade to the chosen Estado.
    const { data: cidadesDoEstado } = await supabase.rpc(
      "cidades_por_estado",
      { p_uf: parsed.data.estado }
    )

    if (
      !cidadeValida(
        parsed.data.cidade,
        parsed.data.estado,
        (cidadesDoEstado ?? []).map((row: { nome: string }) => ({
          nome: row.nome,
          uf: parsed.data.estado,
        }))
      )
    ) {
      return { error: { code: "validation" } }
    }
  }

  // ATV-02: re-validar frequência de pedidos contra o catálogo COMPLETO do
  // vocabulário (ativos + inativos) — nunca getFrequenciasPedidoAtivas()
  // (plano 16-02), cujo próprio comentário avisa que ela é só para o campo
  // de escolha, não para esta re-validação: um cliente que já guardou um
  // valor desde então desativado precisa continuar conseguindo salvar a
  // ficha inteira (T-16-20). Seleção estreita de só a coluna nome, sem
  // filtro de ativo.
  const { data: vocabularioFrequenciaPedidos } = await supabase
    .from("frequencias_pedido")
    .select("nome")

  if (
    !frequenciaPedidoValida(
      parsed.data.frequenciaPedidos,
      vocabularioFrequenciaPedidos ?? []
    )
  ) {
    return { error: { code: "validation" } }
  }

  // O valor gravado é sempre o nome canônico do vocabulário, nunca o texto
  // cru vindo do navegador (T-16-19).
  const frequenciaPedidosCanonica = frequenciaPedidoCanonica(
    parsed.data.frequenciaPedidos,
    vocabularioFrequenciaPedidos ?? []
  )

  const { data: updated, error } = await supabase
    .from("clientes")
    .update({
      razao_social: parsed.data.razaoSocial,
      // Quick task 260819-m8q (D-04/D-06/T-M8Q-06): grava NULO, nunca
      // texto vazio, quando o campo vem em branco — texto vazio em
      // `estado` viola chk_estado_valido (migration 0007) e derrubaria o
      // salvamento com um erro genérico, sem nenhuma pista do motivo para
      // quem está usando. Mesma forma já usada por complemento abaixo.
      cep: parsed.data.cep || null,
      rua: parsed.data.rua || null,
      numero: parsed.data.numero || null,
      complemento: parsed.data.complemento || null,
      cidade: parsed.data.cidade || null,
      estado: parsed.data.estado || null,
      responsavel,
      categoria_id: parsed.data.categoriaId || null,
      contato: parsed.data.contato || null,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
      numero_de_lojas: parsed.data.numeroDeLojas ?? null,
      // FUN-07: saved together with the rest of "Salvar alterações" — no
      // separate salvarObservacao action.
      observacao: parsed.data.observacao || null,
      // T-16-18: gravação CONDICIONAL à presença — os três campos do
      // cliente ativo só são renderizados quando o cliente está ganho
      // (16-UI-SPEC.md), então um envio vindo da ficha de um cliente
      // não-ganho não os traz. Se essas colunas entrassem incondicionalmente
      // no objeto de atualização, o primeiro salvamento de QUALQUER cliente
      // não-ganho apagaria em silêncio os dados de qualquer cliente ganho
      // que já os tivesse preenchido. Um campo PRESENTE e vazio continua
      // significando "limpar" (vira nulo), como os demais campos opcionais
      // acima — só a AUSÊNCIA do campo no envio já validado impede a
      // coluna de sequer aparecer aqui.
      ...(parsed.data.nomeFantasia !== undefined
        ? { nome_fantasia: parsed.data.nomeFantasia || null }
        : {}),
      ...(parsed.data.cnpj !== undefined
        ? { cnpj: parsed.data.cnpj || null }
        : {}),
      ...(parsed.data.frequenciaPedidos !== undefined
        ? { frequencia_pedidos: frequenciaPedidosCanonica }
        : {}),
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle()

  if (error) {
    // D-06: same 23505 -> duplicate_razao_social mapping as createCliente.
    if (error.code === "23505") {
      return { error: { code: "duplicate_razao_social" } }
    }
    return { error: { code: "generic" } }
  }

  if (!updated) {
    // 0 rows: either the id doesn't exist, or RLS's USING clause filtered it
    // out (a Vendedor editing a non-owned cliente) — never distinguish
    // which, same non-revealing posture as duplicate_razao_social.
    return { error: { code: "not_found" } }
  }

  // Multi-value produtos consumidos (CLI-02): replace the whole
  // cliente_produtos set for this cliente rather than diffing adds/removes —
  // simple and safe at MVP scale (a handful of produtos per cliente). Each
  // statement is still gated by cliente_produtos' own parent-EXISTS RLS
  // policy (Pitfall 3 — a joined table's RLS is independent of clientes').
  const produtoIds = parsed.data.produtoIds ?? []

  const { error: deleteProdutosError } = await supabase
    .from("cliente_produtos")
    .delete()
    .eq("cliente_id", parsed.data.id)

  if (deleteProdutosError) {
    return { error: { code: "generic" } }
  }

  if (produtoIds.length > 0) {
    const { error: insertProdutosError } = await supabase
      .from("cliente_produtos")
      .insert(
        produtoIds.map((produtoId) => ({
          cliente_id: parsed.data.id,
          produto_id: produtoId,
        }))
      )

    if (insertProdutosError) {
      return { error: { code: "generic" } }
    }
  }

  revalidatePath("/clientes")
  return { data: { id: updated.id } }
}

export type DeleteClienteErrorCode = "unauthenticated" | "forbidden" | "generic"

export type DeleteClienteResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: DeleteClienteErrorCode } }

/**
 * Deletes a cliente (CLI-05/CLI-06). Supervisor-only: a non-Supervisor
 * caller is rejected here, before the DELETE is even attempted, but this
 * app-layer check is UX only — clientes' DELETE RLS policy from 02-01
 * (`using (is_supervisor())`) is the real boundary (T-02-18); a Vendedor
 * calling this Server Action directly (bypassing the hidden UI button)
 * would still be a no-op even if this check were somehow skipped.
 */
export async function deleteCliente(id: string): Promise<DeleteClienteResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  if (!isSupervisor) {
    return { error: { code: "forbidden" } }
  }

  const { data: deleted, error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: { code: "generic" } }
  }

  if (!deleted) {
    return { error: { code: "generic" } }
  }

  revalidatePath("/clientes")
  return { data: { id: deleted.id } }
}

export type AtualizarFrequenciaVisitaErrorCode = "unauthenticated" | "invalid" | "generic"

export type AtualizarFrequenciaVisitaResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: AtualizarFrequenciaVisitaErrorCode } }

/**
 * Edits the standing frequência de visita of an already-"ganho" cliente
 * (VIS-02: editável/cancelável a qualquer momento) and is also the only
 * place a legacy "ganho" cliente (frequência nula, VIS-04) can receive a
 * cadência for the first time. Reads/writes exactly the same
 * `clientes.frequencia_visita` column the `mover_card_funil` RPC writes at
 * the moment of "ganho" (ATV-03) — there is only ever one value, never two
 * parallel fields.
 *
 * Deliberately an ordinary `clientes` UPDATE, NOT a call into
 * `mover_card_funil`: that RPC's purpose is specifically the funnel
 * stage/status transition (etapa/status guards), and reusing it here would
 * reintroduce guards that make no sense for a plain preference edit
 * (13-UI-SPEC.md, Interaction Contract point 4). `nenhuma` is a legitimate
 * value here, not an "erase" — it means "cancel the cadence going forward".
 * This action deliberately never touches the `visitas` table: cancelling
 * the cadence does not cancel or close the visita already agendada, it only
 * stops the next one from being generated once the current one is
 * concluded (Fase 15).
 */
export async function atualizarFrequenciaVisita(
  clienteId: string,
  frequencia: FrequenciaVisita
): Promise<AtualizarFrequenciaVisitaResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  // Server Action nunca confia no que veio do navegador, mesmo tipado.
  if (!isFrequenciaVisita(frequencia)) {
    return { error: { code: "invalid" } }
  }

  const { data: updated, error } = await supabase
    .from("clientes")
    .update({ frequencia_visita: frequencia })
    .eq("id", clienteId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: { code: "generic" } }
  }

  if (!updated) {
    // 0 rows: a RLS policy de UPDATE de `clientes` do 0002 ("vendedor edita
    // os proprios clientes, supervisor edita todos") é a fronteira real que
    // decidiu isso, não esta função — um vendedor tentando alterar a
    // frequência de um cliente alheio cai aqui e falha fechada, em vez de
    // devolver sucesso silencioso.
    return { error: { code: "generic" } }
  }

  revalidatePath("/clientes")
  return { data: { id: updated.id } }
}

export type GetFrequenciasPedidoResult =
  | { data: LookupOption[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" } }

/**
 * Thin Server Action wrapper around getFrequenciasPedidoAtivas() (ATV-02) —
 * no mesmo molde de getMotivosPerda/getTiposTarefa. Leitura de catálogo é
 * aberta a qualquer autenticado, sem checagem de papel: é o que faz o campo
 * "Frequência de pedidos" funcionar para o Vendedor também. A fronteira real
 * continua sendo a regra de leitura da tabela (RLS, migration 0016).
 */
export async function getFrequenciasPedido(): Promise<GetFrequenciasPedidoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  return { data: await getFrequenciasPedidoAtivas() }
}
