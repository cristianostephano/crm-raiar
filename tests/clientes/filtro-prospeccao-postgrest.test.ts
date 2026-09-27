import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { STATUS_FORA_DA_PROSPECCAO_LISTA } from "../../lib/funil/prospeccao"
import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Prova ao vivo contra o PostgREST real (Fase 28, fecha a premissa A1 da
 * pesquisa 28-RESEARCH.md; Fase 29, D-13, estende para 3 status) — confirma
 * que o filtro de exclusão por lista usado no Kanban
 * (`.not("status_acompanhamento", "in", "(...)")`) é aceito pelo PostgREST e
 * exclui os três status ("ganho", "perdido" e "encerrado") corretamente.
 *
 * Usa SÓ o cliente de serviço (nenhum login, nenhuma chamada a
 * `signInWithPassword`, logo nenhum risco do limite de autenticação conhecido
 * do projeto): o que se prova aqui é a SINTAXE do filtro, não a RLS — a RLS
 * do Kanban não muda nesta fase (Fase 28, D-06; Fase 29, D-13).
 * `createTestMember` só fornece um `responsavel` válido para o insert (a
 * coluna é `not null references profiles(id)`); nunca atribuímos um cliente
 * de teste a um vendedor real, porque ele apareceria no Kanban de alguém de
 * verdade.
 *
 * O filtro é montado SEMPRE a partir de `STATUS_FORA_DA_PROSPECCAO_LISTA`
 * (lib/funil/prospeccao.ts) — nunca da literal escrita à mão — para este
 * teste acompanhar a regra de produção se ela mudar.
 */

const razaoSocialPrefixo = `Teste FiltroProspeccaoPostgrest ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let responsavel: TestMember
let motivoPerdaId: string
let motivoEncerramentoId: string
const clienteIds: Record<
  "emAndamento" | "perdido" | "ganho" | "encerrado",
  string
> = {
  emAndamento: "",
  perdido: "",
  ganho: "",
  encerrado: "",
}

function camposEnderecoFicticio() {
  return {
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
  }
}

beforeAll(async () => {
  responsavel = await createTestMember("vendedor", "filtro-prospeccao")

  const { data: motivo, error: motivoError } = await serviceClient()
    .from("motivos_perda")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()

  if (motivoError || !motivo) {
    throw new Error(
      `Falha ao ler um motivo de perda ativo para o fixture: ${motivoError?.message}`
    )
  }
  motivoPerdaId = motivo.id as string

  const { data: motivoEncerramento, error: motivoEncerramentoError } =
    await serviceClient()
      .from("motivos_encerramento")
      .select("id")
      .eq("ativo", true)
      .limit(1)
      .single()

  if (motivoEncerramentoError || !motivoEncerramento) {
    throw new Error(
      `Falha ao ler um motivo de encerramento ativo para o fixture: ${motivoEncerramentoError?.message}`
    )
  }
  motivoEncerramentoId = motivoEncerramento.id as string

  const { data: rows, error } = await serviceClient()
    .from("clientes")
    .insert([
      {
        razao_social: `${razaoSocialPrefixo} em_andamento`,
        ...camposEnderecoFicticio(),
        responsavel: responsavel.id,
        etapa: "aguardando_contato",
        status_acompanhamento: "em_andamento",
      },
      {
        razao_social: `${razaoSocialPrefixo} perdido`,
        ...camposEnderecoFicticio(),
        responsavel: responsavel.id,
        etapa: "aguardando_contato",
        status_acompanhamento: "perdido",
        motivo_perda_id: motivoPerdaId,
      },
      {
        razao_social: `${razaoSocialPrefixo} ganho`,
        ...camposEnderecoFicticio(),
        responsavel: responsavel.id,
        etapa: "primeira_venda",
        status_acompanhamento: "ganho",
      },
      {
        razao_social: `${razaoSocialPrefixo} encerrado`,
        ...camposEnderecoFicticio(),
        responsavel: responsavel.id,
        etapa: "primeira_venda",
        status_acompanhamento: "encerrado",
        motivo_encerramento_id: motivoEncerramentoId,
      },
    ])
    .select("id, status_acompanhamento")

  if (error || !rows) {
    throw new Error(`Falha ao semear os 4 clientes fixture: ${error?.message}`)
  }

  for (const row of rows) {
    if (row.status_acompanhamento === "em_andamento") {
      clienteIds.emAndamento = row.id
    } else if (row.status_acompanhamento === "perdido") {
      clienteIds.perdido = row.id
    } else if (row.status_acompanhamento === "ganho") {
      clienteIds.ganho = row.id
    } else if (row.status_acompanhamento === "encerrado") {
      clienteIds.encerrado = row.id
    }
  }
})

afterAll(async () => {
  const ids = Object.values(clienteIds).filter(Boolean)
  if (ids.length > 0) {
    await serviceClient().from("clientes").delete().in("id", ids)
  }
  // Ordem obrigatória: clientes primeiro (FK sem ON DELETE), membro depois.
  await deleteTestMember(responsavel.id)
})

describe("filtro de exclusão do PostgREST usado no Kanban (Fase 28, A1; Fase 29, D-13)", () => {
  it("controle: consultando pelo cliente de serviço os 4 clientes semeados só por id, voltam as 4 linhas", async () => {
    const ids = Object.values(clienteIds)

    const { data, error } = await serviceClient()
      .from("clientes")
      .select("id")
      .in("id", ids)

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.map((r) => r.id).sort()).toEqual([...ids].sort())
  })

  it("sintaxe-not-in: .not('status_acompanhamento', 'in', ...) montado a partir da lista volta sem erro e só com o id em andamento", async () => {
    const ids = Object.values(clienteIds)

    const { data, error } = await serviceClient()
      .from("clientes")
      .select("id")
      .in("id", ids)
      .not(
        "status_acompanhamento",
        "in",
        `(${STATUS_FORA_DA_PROSPECCAO_LISTA.join(",")})`
      )

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.map((r) => r.id)).toEqual([clienteIds.emAndamento])
  })
})
