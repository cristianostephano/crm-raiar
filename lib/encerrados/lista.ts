import { addDays, startOfDay, subDays } from "date-fns"

import { nomeExibicaoCliente } from "@/lib/clientes/nomeExibicao"

/**
 * Camada pura da tela Encerrados (Fase 29, D-07). Sem import do cliente
 * Supabase nem do módulo de cabeçalhos/cookies do Next — mesma disciplina de
 * lib/dashboard/periodo.ts e lib/clientes/nomeExibicao.ts, para ser
 * importável tanto pela Server Action (app/actions/encerrados.ts) quanto
 * pelo Client Component da tela (plano 29-06).
 *
 * Irmã deliberada — não generalização — de lib/perdidos/lista.ts (Fase 28,
 * Pitfall 4 da pesquisa): mesmo formato de período/validação/busca, sem
 * nenhum import cruzado entre as duas fases.
 */

/**
 * Espelha as 7 colunas de `clientes_encerrados` (migration 0036, plano
 * 29-01). Acrescentar qualquer dado de meio de comunicação com a pessoa do
 * cliente muda o escopo de dado pessoal desta tela (LGPD) e precisa de
 * aprovação do dono do projeto antes — não adicionar campo novo aqui sem
 * essa conversa.
 */
export type ClienteEncerrado = {
  clienteId: string
  razaoSocial: string | null
  nomeFantasia: string | null
  motivoEncerramentoNome: string | null
  encerradoEm: string
  responsavel: string
  responsavelNome: string | null
}

/** Texto único para quando o nome do motivo do encerramento vier nulo
 * (motivo apagado do catálogo depois do registro) — garante que a linha
 * nunca fique em branco. */
export const MOTIVO_ENCERRAMENTO_AUSENTE = "Motivo não informado"

export type PeriodoPresetEncerrados = "tudo" | "30dias" | "90dias" | "personalizado"

export const PERIODO_PADRAO_ENCERRADOS: PeriodoPresetEncerrados = "tudo"

export const PERIODO_PRESETS_ENCERRADOS: readonly {
  value: PeriodoPresetEncerrados
  label: string
}[] = [
  { value: "tudo", label: "Tudo" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "personalizado", label: "Personalizado" },
]

export type IntervaloEncerrados = { inicio: string | null; fim: string | null }

/**
 * Resolve um preset (ou um intervalo personalizado explícito) num par
 * {inicio, fim} em ISO 8601, pronto para virar p_inicio/p_fim da RPC
 * `clientes_encerrados`. As janelas móveis (30dias/90dias) nunca têm limite
 * superior — para que um encerramento registrado depois deste cálculo nunca
 * fique de fora da lista. O banco trata o fim como limite EXCLUSIVO, por
 * isso o personalizado manda a meia-noite do dia SEGUINTE ao último dia
 * escolhido (o último dia inteiro entra). As datas de entrada são lidas no
 * fuso do navegador (o time está em São Paulo) e convertidas para instante
 * ISO.
 */
export function resolvePeriodoEncerrados(
  preset: PeriodoPresetEncerrados,
  custom?: { from: Date; to: Date },
  agora: Date = new Date()
): IntervaloEncerrados {
  switch (preset) {
    case "tudo":
      return { inicio: null, fim: null }
    case "30dias":
      return { inicio: subDays(agora, 30).toISOString(), fim: null }
    case "90dias":
      return { inicio: subDays(agora, 90).toISOString(), fim: null }
    case "personalizado":
      if (!custom) return { inicio: null, fim: null }
      return {
        inicio: startOfDay(custom.from).toISOString(),
        fim: startOfDay(addDays(custom.to, 1)).toISOString(),
      }
  }
}

/**
 * Verdadeiro só quando o preset recorta de fato o período (não "tudo", e
 * não "personalizado" sem intervalo aplicado) — é o que a tela usa para
 * escolher entre os dois textos de lista vazia do UI-SPEC (sem recorte vs.
 * com recorte).
 */
export function temRecortePeriodoEncerrados(
  preset: PeriodoPresetEncerrados,
  custom?: { from: Date; to: Date }
): boolean {
  if (preset === "tudo") return false
  if (preset === "personalizado") return Boolean(custom)
  return true
}

export type ValidacaoPeriodoEncerrados =
  | { valido: true; intervalo: IntervaloEncerrados }
  | { valido: false; message: string }

const PERIODO_INVALIDO_MESSAGE = "Período inválido."

/**
 * Normaliza uma chave (inicio ou fim) vinda de `entrada: unknown`.
 * `undefined` = ausente/nula (vira "sem limite"); `null` = valor rejeitado
 * pelo chamador (nem ausente nem data válida) — usado só internamente para
 * diferenciar os dois casos antes de decidir se a entrada inteira é
 * inválida.
 */
function parseChaveData(valor: unknown): string | null | undefined {
  if (valor === undefined || valor === null) return undefined
  if (typeof valor !== "string" || Number.isNaN(Date.parse(valor))) return null
  return valor
}

/**
 * Valida o intervalo vindo do navegador ANTES de qualquer chamada ao banco
 * — a Server Action é um endpoint público, e esta validação é de ENTRADA,
 * não de autorização (autorização é só a RLS dentro de
 * `clientes_encerrados`).
 */
export function validarPeriodoEncerrados(entrada: unknown): ValidacaoPeriodoEncerrados {
  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
    return { valido: false, message: PERIODO_INVALIDO_MESSAGE }
  }

  const { inicio: inicioBruto, fim: fimBruto } = entrada as {
    inicio?: unknown
    fim?: unknown
  }

  const inicioParseado = parseChaveData(inicioBruto)
  const fimParseado = parseChaveData(fimBruto)

  if (inicioParseado === null || fimParseado === null) {
    return { valido: false, message: PERIODO_INVALIDO_MESSAGE }
  }

  const inicio = inicioParseado ?? null
  const fim = fimParseado ?? null

  if (inicio !== null && fim !== null && Date.parse(inicio) >= Date.parse(fim)) {
    return {
      valido: false,
      message: "A data inicial precisa ser anterior à final.",
    }
  }

  return { valido: true, intervalo: { inicio, fim } }
}

/**
 * Busca pelo NOME EXIBIDO (razão social, com queda para Nome Fantasia) —
 * mesma regra da busca do Kanban (T-26-15, KanbanBoard.tsx). Nunca muta a
 * lista de entrada.
 */
export function filtrarEncerradosPorNome(
  lista: readonly ClienteEncerrado[],
  busca: string
): ClienteEncerrado[] {
  const termo = busca.trim().toLowerCase()
  if (termo === "") return [...lista]
  return lista.filter((cliente) =>
    nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)
      .toLowerCase()
      .includes(termo)
  )
}
