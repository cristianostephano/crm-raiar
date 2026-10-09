import { format, isValid, parseISO } from "date-fns"

/**
 * Regra única da "Data do ganho" do cliente (quick 261008-rxw, D-17/P-14).
 * Funções puras, sem Supabase nem next/headers: valem igual no navegador
 * (ficha do cliente) e no servidor (updateCliente, via updateClienteSchema).
 *
 * A data anterior ao cadastro do cliente no CRM é permitida DE PROPÓSITO
 * (D-17): o ganho real pode ser mais antigo que a importação do cliente.
 */

/** Menor data aceita — só para pegar erro de digitação do ano. */
export const DATA_GANHO_MINIMA = "1990-01-01"

const MENSAGEM_INVALIDA = "Informe uma data válida."
const MENSAGEM_FUTURO = "A data do ganho não pode ser no futuro."
const MENSAGEM_MINIMA = "Informe uma data a partir de 01/01/1990."

/**
 * Hoje em São Paulo no formato "AAAA-MM-DD" (fuso America/Sao_Paulo, o mesmo
 * da regra automática do banco). `agora` existe só para os testes.
 */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora)
}

/**
 * Devolve a mensagem de erro (em português) ou nulo quando a data é válida.
 * "" é válido e significa "limpar a data". `hoje` é "AAAA-MM-DD" em São Paulo
 * (use hojeEmSaoPaulo()). Comparações por texto: o formato AAAA-MM-DD ordena
 * como as datas.
 */
export function validarDataDoGanho(valor: string, hoje: string): string | null {
  if (valor === "") return null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return MENSAGEM_INVALIDA

  // Data de calendário real: 2024-02-30 e 2024-13-01 não existem.
  const data = parseISO(valor)
  if (!isValid(data) || format(data, "yyyy-MM-dd") !== valor) {
    return MENSAGEM_INVALIDA
  }

  if (valor > hoje) return MENSAGEM_FUTURO
  if (valor < DATA_GANHO_MINIMA) return MENSAGEM_MINIMA

  return null
}
