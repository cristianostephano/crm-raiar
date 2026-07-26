import { normalizeRazaoSocial } from "@/lib/importacao/dedupe"

/**
 * Pure membership check: cidade pertence a estado, contra a MESMA fonte
 * estruturada (lista da tabela `cidades`, via `cidades_por_estado` RPC ou um
 * select narrow) usada pelos formulários, pelo filtro, e pela validação de
 * importação — nunca uma lógica paralela de texto livre (09-06, LOC-02).
 *
 * Módulo puro (sem Supabase, sem "use client"/"use server") — reusa
 * `normalizeRazaoSocial` de lib/importacao/dedupe.ts para comparar nomes de
 * cidade case/acento/trim-insensível, mesma convenção já usada por
 * lib/importacao/annotarLinha.ts's findByNome. Usado tanto por annotarLinha
 * (import por planilha, LOC-01/LOC-02) quanto por createCliente/updateCliente
 * (app/actions/clientes.ts) para re-validar server-side que a Cidade enviada
 * genuinamente pertence ao Estado enviado — nunca confiando só no Combobox
 * do cliente (regra CLAUDE.md / T-09-09).
 */

export type CidadeLookupItem = { nome: string; uf: string }

/** Retorna true sse existir em `cidades` um item cujo uf bate (comparação
 * exata, já normalizada para maiúscula pelo chamador) e cujo nome bate
 * case/acento/trim-insensível com `cidade`. */
export function cidadeValida(
  cidade: string,
  estado: string,
  cidades: CidadeLookupItem[]
): boolean {
  const estadoNormalizado = estado.trim().toUpperCase()
  const cidadeKey = normalizeRazaoSocial(cidade)

  return cidades.some(
    (item) =>
      item.uf === estadoNormalizado && normalizeRazaoSocial(item.nome) === cidadeKey
  )
}

/** Devolve o `nome` canônico (o valor exato armazenado em `cidades`) do item
 * que casou com `cidade`/`estado`, ou null se nenhum casar — usado para
 * normalizar o valor resolvido (ex: "campinas" -> "Campinas"). */
export function cidadeCanonica(
  cidade: string,
  estado: string,
  cidades: CidadeLookupItem[]
): string | null {
  const estadoNormalizado = estado.trim().toUpperCase()
  const cidadeKey = normalizeRazaoSocial(cidade)

  const match = cidades.find(
    (item) =>
      item.uf === estadoNormalizado && normalizeRazaoSocial(item.nome) === cidadeKey
  )

  return match ? match.nome : null
}
