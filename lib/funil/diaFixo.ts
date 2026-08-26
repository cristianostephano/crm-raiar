/**
 * Vocabulário do dia fixo na recorrência de visita (Fase 24, ANCORA-01/
 * ANCORA-02) — dia da semana e semana do mês, os dois guards de tipo, a
 * regra de qual frequência exige semana do mês, a normalização de âncora
 * por frequência e a checagem de âncora completa.
 *
 * Mesma forma de `lib/funil/frequencia.ts` (lista `as const` + tipo
 * derivado + mapa de rótulos + lista de itens derivada do mapa + guard de
 * tipo) — o molde já estabelecido neste projeto para vocabulário fechado
 * compartilhado por Componente de Cliente e Ação de Servidor.
 *
 * Módulo PURO: nada de `next/*`, `@supabase/*` nem React. É importado tanto
 * pela ficha do cliente (Client Component) quanto pela ação de servidor que
 * grava a âncora (`app/actions/clientes.ts`) — qualquer dependência de
 * servidor aqui vazaria para o pacote do navegador.
 *
 * IMPORTANTE — os rótulos internos abaixo precisam bater EXATAMENTE com os
 * do tipo enumerado da migration 0026 (`dia_semana_enum`,
 * `semana_do_mes_enum`): uma divergência de letra não é pega pelo
 * compilador TypeScript, só vira erro do Postgres em tempo de execução
 * quando o UPDATE tentar gravar um valor fora do enum.
 *
 * ARMADILHA — os rótulos `segunda` e `quarta` existem nas DUAS listas deste
 * módulo com significados diferentes: em `DIAS_SEMANA` são o dia da semana;
 * em `SEMANAS_DO_MES` são a ordem da ocorrência dentro do mês. São tipos
 * TypeScript distintos (`DiaSemanaVisita` x `SemanaDoMesVisita`)
 * justamente para o compilador nunca deixar um valor de uma lista ser usado
 * como se fosse da outra — mas nenhuma função deste módulo deve receber um
 * dos dois rótulos ambíguos sem o tipo correspondente já resolvido pelo
 * chamador.
 *
 * Reuso obrigatório: a pergunta "esta frequência gera próxima visita?" já
 * existe em `lib/funil/frequencia.ts` (`geraProximaVisita`) e é a MESMA
 * pergunta que "esta frequência pede dia da semana?" — reaproveitada aqui
 * em vez de reescrita com o mesmo significado.
 */

import { geraProximaVisita, type FrequenciaVisita } from "@/lib/funil/frequencia"

// ─────────────────────────────────────────────────────────────────────────
// Dia da semana — espelha `dia_semana_enum` (migration 0026), começando no
// domingo.
// ─────────────────────────────────────────────────────────────────────────

export const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const

export type DiaSemanaVisita = (typeof DIAS_SEMANA)[number]

export const DIA_SEMANA_LABELS: Record<DiaSemanaVisita, string> = {
  domingo: "Domingo",
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
}

export const DIA_SEMANA_ITEMS: { value: DiaSemanaVisita; label: string }[] =
  DIAS_SEMANA.map((value) => ({ value, label: DIA_SEMANA_LABELS[value] }))

/** Guard de tipo, no molde exato de `isFrequenciaVisita` — usado pela ação
 * de servidor para revalidar o que veio do navegador antes de gravar. */
export function isDiaSemanaVisita(value: unknown): value is DiaSemanaVisita {
  return (
    typeof value === "string" &&
    (DIAS_SEMANA as readonly string[]).includes(value)
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Semana do mês — espelha `semana_do_mes_enum` (migration 0026).
// Vocabulário fechado em 1ª/2ª/3ª/4ª/Última, nunca uma sexta opção.
// ─────────────────────────────────────────────────────────────────────────

export const SEMANAS_DO_MES = [
  "primeira",
  "segunda",
  "terceira",
  "quarta",
  "ultima",
] as const

export type SemanaDoMesVisita = (typeof SEMANAS_DO_MES)[number]

export const SEMANA_DO_MES_LABELS: Record<SemanaDoMesVisita, string> = {
  primeira: "1ª semana",
  segunda: "2ª semana",
  terceira: "3ª semana",
  quarta: "4ª semana",
  ultima: "Última semana",
}

export const SEMANA_DO_MES_ITEMS: { value: SemanaDoMesVisita; label: string }[] =
  SEMANAS_DO_MES.map((value) => ({ value, label: SEMANA_DO_MES_LABELS[value] }))

/** Guard de tipo, mesmo molde de `isDiaSemanaVisita` acima. */
export function isSemanaDoMesVisita(
  value: unknown
): value is SemanaDoMesVisita {
  return (
    typeof value === "string" &&
    (SEMANAS_DO_MES as readonly string[]).includes(value)
  )
}

/**
 * Responde se a frequência informada exige o campo de semana do mês —
 * verdadeiro apenas para `mensal`. Autoridade ÚNICA dessa decisão no código
 * de aplicação: a ficha e a ação de servidor chamam esta função em vez de
 * comparar `frequencia === "mensal"` soltamente.
 */
export function exigeSemanaDoMes(
  frequencia: FrequenciaVisita | null | undefined
): boolean {
  return frequencia === "mensal"
}

/** Par de valores de âncora, sempre os dois campos juntos — nunca um sem o
 * outro no tipo, mesmo quando só um deles se aplica à frequência atual. */
export type AncoraVisita = {
  diaSemana: DiaSemanaVisita | null
  semanaDoMes: SemanaDoMesVisita | null
}

/**
 * Normaliza o par de âncora conforme a frequência, aplicando a regra de
 * quais campos sobrevivem a cada cadência (T-24-09): sem cadência (frequência
 * ausente ou "nenhuma") limpa os dois; semanal/quinzenal preserva o dia da
 * semana e limpa a semana do mês (reusa `geraProximaVisita` — mesma pergunta
 * de "esta frequência pede dia da semana?"); mensal preserva os dois. É esta
 * função, e só ela, que decide o que sobrevive a uma troca de frequência —
 * nem a ficha nem a ação de servidor podem repetir esta decisão com
 * comparação de texto solta.
 */
export function normalizarAncora(
  frequencia: FrequenciaVisita | null | undefined,
  diaSemana: DiaSemanaVisita | null | undefined,
  semanaDoMes: SemanaDoMesVisita | null | undefined
): AncoraVisita {
  if (!geraProximaVisita(frequencia)) {
    return { diaSemana: null, semanaDoMes: null }
  }

  if (exigeSemanaDoMes(frequencia)) {
    return {
      diaSemana: diaSemana ?? null,
      semanaDoMes: semanaDoMes ?? null,
    }
  }

  return { diaSemana: diaSemana ?? null, semanaDoMes: null }
}

/**
 * Responde se o dia fixo está completamente definido para a frequência
 * informada (D-01): verdadeiro quando a frequência não gera próxima visita
 * (nada a definir); para semanal/quinzenal, verdadeiro só com o dia da
 * semana preenchido; para mensal, verdadeiro só com os DOIS campos
 * preenchidos. É esta função que a ficha usa para decidir se mostra a linha
 * explicando que o cálculo antigo ainda vale.
 */
export function ancoraCompleta(
  frequencia: FrequenciaVisita | null | undefined,
  diaSemana: DiaSemanaVisita | null | undefined,
  semanaDoMes: SemanaDoMesVisita | null | undefined
): boolean {
  if (!geraProximaVisita(frequencia)) {
    return true
  }

  if (exigeSemanaDoMes(frequencia)) {
    return diaSemana != null && semanaDoMes != null
  }

  return diaSemana != null
}
