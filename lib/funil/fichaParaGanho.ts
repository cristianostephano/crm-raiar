/**
 * Módulo puro (Fase 23, GANHO-01) que decide quais campos faltam na ficha
 * de um cliente para ele poder virar "ganho", e monta a mensagem que a
 * tela mostra ao vendedor quando algum falta.
 *
 * Sem nenhuma importação de Supabase, de `next/*` ou de React — mesma
 * postura de `lib/clientes/completude.ts`, que já existe exatamente por
 * esse motivo: precisa poder ser importado tanto de código de servidor
 * (`app/actions/funil.ts`) quanto de um Client Component eventual, sem
 * arrastar `next/headers` para o pacote do navegador.
 *
 * Este módulo é a autoridade ÚNICA da pergunta "esta ficha está completa
 * para virar ganho" do lado TypeScript. O guard PL/pgSQL de
 * `mover_card_funil` (migration 0025, plano 23-01) é a autoridade
 * equivalente do lado do banco — os dois precisam concordar campo por
 * campo. Qualquer mudança futura em um exige a mesma mudança no outro:
 * "endereço completo" é exatamente os 5 campos (cep, rua, numero, cidade,
 * estado) que a migration 0023 tornou nullable, `complemento` fica de
 * fora nos dois lados (D-04), e um valor conta como ausente quando é nulo
 * OU, depois de aparar espaços, texto vazio — nos dois lados também.
 */

/**
 * As seis colunas que `mover_card_funil` (migration 0025) lê para decidir
 * se a ficha está completa para o ganho. Nomes de coluna do banco (não
 * camelCase) de propósito, para o objeto poder vir direto do `select` do
 * Supabase sem tradução no meio — é onde erro de digitação se esconde.
 */
export type FichaParaGanhoInput = {
  razao_social: string | null
  cep: string | null
  rua: string | null
  numero: string | null
  cidade: string | null
  estado: string | null
}

const CAMPOS_EM_ORDEM: { campo: keyof FichaParaGanhoInput; rotulo: string }[] = [
  { campo: "razao_social", rotulo: "razão social" },
  { campo: "cep", rotulo: "CEP" },
  { campo: "rua", rotulo: "rua" },
  { campo: "numero", rotulo: "número" },
  { campo: "cidade", rotulo: "cidade" },
  { campo: "estado", rotulo: "estado" },
]

function estaVazio(valor: string | null | undefined): boolean {
  return valor == null || valor.trim() === ""
}

/**
 * Devolve a lista de rótulos legíveis dos campos que faltam para o
 * cliente virar ganho, sempre na ordem fixa: razão social, CEP, rua,
 * número, cidade, estado. Um campo conta como faltando quando é nulo OU,
 * depois de aparar espaços, texto vazio. `complemento` nunca é avaliado —
 * não é campo desta trava (D-04).
 */
export function camposFaltandoParaGanho(
  ficha: FichaParaGanhoInput
): string[] {
  return CAMPOS_EM_ORDEM.filter(({ campo }) => estaVazio(ficha[campo])).map(
    ({ rotulo }) => rotulo
  )
}

/**
 * Monta a mensagem para o vendedor a partir da lista de rótulos faltando.
 * Sempre começa orientando a completar a ficha do cliente antes de marcar
 * como ganho; com lista vazia devolve só a orientação, sem lista
 * pendurada.
 */
export function mensagemFichaIncompleta(camposFaltando: string[]): string {
  const orientacao = "Complete a ficha do cliente antes de marcar como ganho"

  if (camposFaltando.length === 0) {
    return `${orientacao}.`
  }

  return `${orientacao}: ${camposFaltando.join(", ")}.`
}
