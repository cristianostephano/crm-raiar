"use server"

import { revalidatePath } from "next/cache"

import type { AgendaItem, ClienteSemDiaFixo } from "@/lib/agenda/itens"
import { geraProximaVisita, type FrequenciaVisita } from "@/lib/funil/frequencia"
import {
  getAgenda,
  getAgendaConcluidos,
  getClientesSemDiaFixo,
} from "@/lib/supabase/queries/agenda"
import { createClient } from "@/lib/supabase/server"
import { validarIntervaloHistorico, validarResumo } from "@/lib/validations/agenda"

/**
 * Embrulho fino que o Client Component da Agenda (plano 14-03) chama:
 * `getAgenda()` depende de `cookies()` via lib/supabase/server.ts, então só
 * pode ser invocada a partir daqui.
 *
 * A partir da Fase 15 este arquivo deixa de ser somente leitura: além da
 * ação de leitura original (intocada), ele ganha as duas ações de escrita
 * de conclusão (CONC-01/VIS-03) abaixo. A atomicidade das três tabelas
 * (tarefas/visitas + trilha de auditoria) e a obrigatoriedade do resumo
 * moram no banco (RPCs `concluir_tarefa_prospeccao`/`concluir_visita`,
 * migration 0015) — nunca aqui; estas ações só revalidam o resumo do lado
 * de cá (defesa em profundidade, já que ação de servidor é endpoint
 * público) e chamam a RPC correspondente, nunca `.update()`/`.insert()`
 * direto em `tarefas`/`visitas`/`historico`.
 *
 * `getAgendaPendentesCount()` não tem Server Action própria: o menu é
 * renderizado por Server Component (plano 14-04) e chama a query
 * diretamente.
 *
 * A partir da Fase 22 as duas ações de conclusão também carregam o motivo
 * de conclusão remota (CONC-02): as DUAS precisam ser mantidas em
 * sincronia, porque a janela que as chama (ConcluirItemDialog.tsx) é uma
 * só — estender só uma delas quebra a outra em silêncio.
 */

export type AgendaErrorCode = "unauthenticated" | "fetch_falhou"

export type GetAgendaResult =
  | { data: AgendaItem[]; error?: undefined }
  | { data?: undefined; error: { code: AgendaErrorCode; message: string } }

export async function getAgendaAction(): Promise<GetAgendaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getAgenda() }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar sua agenda. Tente novamente.",
      },
    }
  }
}

/** Mensagem genérica reutilizada dos diálogos já existentes do projeto
 * (GanhoFrequenciaDialog/PerdaMotivoDialog) — a mensagem crua do banco
 * nunca é repassada à tela (T-15-23). */
const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."

export type ConcluirErrorCode =
  | "unauthenticated"
  | "resumo_invalido"
  | "data_nao_confirmada"
  | "salvar_falhou"

export type ConcluirResult =
  | { data: true; error?: undefined }
  | { data?: undefined; error: { code: ConcluirErrorCode; message: string } }

/**
 * Conclui uma tarefa de prospecção (CONC-01), chamando exatamente a RPC
 * `concluir_tarefa_prospeccao` do Plano 15-01 — nunca uma escrita direta em
 * `tarefas`.
 *
 * `motivoConclusaoRemotaId` (Fase 22, CONC-02) é opcional e sempre o
 * ÚLTIMO parâmetro: repassado sem validação adicional para a RPC, que já
 * faz a guarda real (existe + ativo) dentro do plano 22-01 — validar de
 * novo aqui seria uma segunda ida ao banco sem ganhar fronteira nenhuma.
 */
export async function concluirTarefaProspeccao(
  tarefaId: string,
  resumo: string,
  motivoConclusaoRemotaId?: string | null
): Promise<ConcluirResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  // Revalidação obrigatória do lado do servidor: ação de servidor é
  // endpoint público, e o botão desabilitado da tela não é fronteira
  // nenhuma (T-15-20). Mesmo esquema/limites que o banco impõe.
  const validacao = validarResumo(resumo)
  if (!validacao.valido) {
    return {
      error: { code: "resumo_invalido", message: validacao.message },
    }
  }

  // Texto vazio ou só espaços vira vazio de verdade antes de seguir para
  // o banco — mesma normalização que motivoConclusaoRemotaId recebe em
  // concluirVisita, abaixo.
  const motivoNormalizado = motivoConclusaoRemotaId?.trim() || null

  const { error } = await supabase.rpc("concluir_tarefa_prospeccao", {
    p_tarefa_id: tarefaId,
    p_resumo: validacao.resumo,
    p_motivo_conclusao_remota_id: motivoNormalizado,
  })

  if (error) {
    return { error: { code: "salvar_falhou", message: GENERIC_ERROR } }
  }

  // A mesma tarefa aparece na ficha do cliente (checklist FUN-08).
  revalidatePath("/agenda")
  revalidatePath("/clientes")
  return { data: true }
}

/**
 * Conclui uma visita (VIS-03), chamando exatamente a RPC `concluir_visita`
 * do Plano 15-01 — nunca uma escrita direta em `visitas`.
 *
 * `frequenciaVisita` é a frequência já carregada no próprio item de agenda
 * (nunca uma segunda leitura): usada apenas para decidir, do lado de cá, se
 * a data deve ser enviada — as duas guardas reais continuam sendo as do
 * banco, que relê a frequência da própria tabela `clientes` (T-15-22).
 *
 * `motivoConclusaoRemotaId` (Fase 22, CONC-02) é opcional e sempre o
 * ÚLTIMO parâmetro, depois de `proximaData` — mesma postura de
 * `concluirTarefaProspeccao` acima: repassado sem validação adicional, e o
 * bloco que decide se a próxima data é enviada (D-07) não muda em nada.
 */
export async function concluirVisita(
  visitaId: string,
  resumo: string,
  frequenciaVisita: FrequenciaVisita | null,
  proximaData: string | null,
  motivoConclusaoRemotaId?: string | null
): Promise<ConcluirResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const validacao = validarResumo(resumo)
  if (!validacao.valido) {
    return {
      error: { code: "resumo_invalido", message: validacao.message },
    }
  }

  const precisaDeData = geraProximaVisita(frequenciaVisita)

  // Cliente com cadência real e sem data confirmada: recusa aqui mesmo,
  // sem ida inútil ao servidor — a RPC recusaria do mesmo jeito (VIS-03).
  if (precisaDeData && !proximaData) {
    return {
      error: {
        code: "data_nao_confirmada",
        message: "Confirme a data da próxima visita antes de concluir.",
      },
    }
  }

  // Texto vazio ou só espaços vira vazio de verdade antes de seguir para
  // o banco — mesma normalização que concluirTarefaProspeccao aplica.
  const motivoNormalizado = motivoConclusaoRemotaId?.trim() || null

  const { error } = await supabase.rpc("concluir_visita", {
    p_visita_id: visitaId,
    p_resumo: validacao.resumo,
    // Cliente sem cadência: envia vazio independentemente do que a tela
    // mandou — a guarda de verdade continua sendo a do banco.
    p_proxima_data: precisaDeData ? proximaData : null,
    p_motivo_conclusao_remota_id: motivoNormalizado,
  })

  if (error) {
    return { error: { code: "salvar_falhou", message: GENERIC_ERROR } }
  }

  // A próxima visita (quando criada) também afeta a ficha do cliente.
  revalidatePath("/agenda")
  revalidatePath("/clientes")
  return { data: true }
}

export type AgendaConcluidosErrorCode =
  | "unauthenticated"
  | "intervalo_invalido"
  | "fetch_falhou"

export type GetAgendaConcluidosResult =
  | { data: AgendaItem[]; error?: undefined }
  | { data?: undefined; error: { code: AgendaConcluidosErrorCode; message: string } }

/**
 * AGD-13 (Fase 21): leitura do histórico (itens já concluídos) do
 * contêiner do calendário, limitada a um intervalo obrigatório.
 *
 * Ação de servidor é endpoint público, e o intervalo calculado no
 * navegador (`intervaloDeHistorico`, lib/agenda/itens.ts) não é fronteira
 * nenhuma — por isso a guarda de RECURSO (`validarIntervaloHistorico`) é
 * aplicada AQUI, ANTES de qualquer ida ao banco, sem exceção: sem esta
 * guarda alguém poderia pedir anos de histórico numa chamada só e furar a
 * restrição de desempenho travada nesta fase. A guarda é de recurso, não
 * de autorização — quem decide o que cada usuário enxerga continua sendo
 * exclusivamente a RLS no banco; nenhuma linha desta ação pode virar
 * checagem de permissão.
 *
 * Sem revalidação de rota: é leitura pura, chamada a partir do navegador
 * conforme o usuário navega — revalidar rota aqui provocaria recargas em
 * cascata.
 */
export async function getAgendaConcluidosAction(
  inicio: string,
  fim: string
): Promise<GetAgendaConcluidosResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const validacao = validarIntervaloHistorico(inicio, fim)
  if (!validacao.valido) {
    return {
      error: { code: "intervalo_invalido", message: validacao.message },
    }
  }

  try {
    return {
      data: await getAgendaConcluidos(validacao.inicio, validacao.fim),
    }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar o histórico. Tente novamente.",
      },
    }
  }
}

export type ClientesSemDiaFixoErrorCode = "unauthenticated" | "fetch_falhou"

export type GetClientesSemDiaFixoResult =
  | { data: ClienteSemDiaFixo[]; error?: undefined }
  | {
      data?: undefined
      error: { code: ClientesSemDiaFixoErrorCode; message: string }
    }

/**
 * AGENDA-01 (Fase 24): embrulho fino da leitura nova de clientes ativos sem
 * dia fixo, mesmo molde de `getAgendaAction()` — checa sessão, chama a
 * leitura, devolve o mesmo par de resultado em união discriminada.
 *
 * Sem revalidação de rota própria: `atualizarFrequenciaVisita`
 * (app/actions/clientes.ts, Plano 24-02) já revalida `/agenda` ao gravar a
 * âncora — esta ação é chamada a partir do navegador conforme o `reloadKey`
 * da Agenda avança, igual a `getAgendaAction()`.
 */
export async function getClientesSemDiaFixoAction(): Promise<GetClientesSemDiaFixoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getClientesSemDiaFixo() }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar a lista de clientes sem dia fixo. Tente novamente.",
      },
    }
  }
}
