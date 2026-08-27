/**
 * Completa os produtos consumidos das linhas gravadas sem razão social
 * (Fase 26 Plano 3, T-26-09). Módulo puro — sem import de Supabase, sem
 * diretiva "use client"/"use server" — mesma disciplina de
 * lib/importacao/dedupe.ts/confirmar.ts, totalmente testável sem
 * .env.local.
 *
 * POR QUE este módulo existe: a função de gravação em lote
 * (`importar_clientes_lote`, migration 0019) grava os clientes numa
 * instrução e, numa SEGUNDA instrução, liga os produtos consumidos
 * comparando a razão social da carga com a razão social das linhas recém-
 * gravadas (`r.razao_social = t.razao_social`). No Postgres, comparar dois
 * valores nulos com igualdade nunca resulta em verdadeiro — resulta em
 * desconhecido. Para toda linha gravada com razão social nula, essa ligação
 * nunca casa, e os produtos consumidos daquela linha simplesmente não são
 * gravados, sem erro e sem aviso. Este módulo calcula, a partir da MESMA
 * carga enviada à gravação, quais linhas caíram nessa lacuna, para que a
 * própria ação de servidor complete os vínculos que faltaram.
 *
 * POR QUE Nome Fantasia é uma chave segura aqui: é campo obrigatório da
 * planilha de prospecção desde a Fase 26 Plano 2 (PROSP-02), e a chave de
 * reserva de duplicados criada no mesmo plano (lib/importacao/dedupe.ts)
 * impede que duas linhas sem razão social com o mesmo Nome Fantasia entrem
 * juntas no mesmo lote — então, DENTRO de um único lote confirmado, um Nome
 * Fantasia normalizado nunca deveria identificar mais de um cliente recém-
 * gravado. Ainda assim, `resolverProdutosPendentes` trata esse caso como
 * ambíguo em vez de presumir a garantia acima, porque a garantia é sobre o
 * lote ENVIADO, não sobre o que já existia no banco antes dele — um cliente
 * já cadastrado antes deste lote poderia coincidir de Nome Fantasia com uma
 * das linhas novas.
 *
 * Solução definitiva (fora do escopo travado desta fase, recomendação de
 * trabalho futuro): recriar `importar_clientes_lote` ligando os produtos
 * consumidos por POSIÇÃO da linha (índice do array enviado), não por razão
 * social — eliminaria esta lacuna pela raiz, para qualquer campo que se
 * revele nulável no futuro, não só razão social.
 */

import { normalizeRazaoSocial } from "@/lib/importacao/dedupe"
import type { RpcClienteRow } from "@/lib/importacao/confirmar"

/** Uma pendência: uma linha da carga enviada à gravação cuja razão social é
 * nula, cujo Nome Fantasia está presente, e cujos produtos consumidos não
 * puderam ser ligados pela segunda instrução da função de gravação. */
export type ProdutoPendente = {
  nomeFantasia: string
  produtoIds: string[]
}

/**
 * Calcula as pendências a partir da carga enviada à gravação
 * (`RpcClienteRow[]`, o mesmo `rowsToInsert` que a ação de confirmação
 * monta): uma entrada por linha cuja razão social é nula E cuja lista de
 * produtos não é vazia E cujo Nome Fantasia não é vazio. Uma carga sem
 * nenhuma linha nessas condições devolve lista vazia — inclusive quando
 * TODAS as linhas têm razão social (o caminho de hoje, custo zero).
 */
export function produtosPendentesDaCarga(
  rowsToInsert: RpcClienteRow[]
): ProdutoPendente[] {
  const pendencias: ProdutoPendente[] = []

  for (const row of rowsToInsert) {
    if (row.razao_social !== null) continue
    if (row.produto_ids.length === 0) continue

    const nomeFantasia = row.nome_fantasia?.trim()
    if (!nomeFantasia) continue

    pendencias.push({ nomeFantasia, produtoIds: row.produto_ids })
  }

  return pendencias
}

/** Um cliente recém-gravado sem razão social — identificador do registro
 * criado pela função de gravação e seu Nome Fantasia, para casar contra as
 * pendências. */
export type ClienteRecemGravado = {
  id: string
  nomeFantasia: string
}

export type ResolverProdutosPendentesResult = {
  vinculos: { clienteId: string; produtoId: string }[]
  naoResolvidas: ProdutoPendente[]
}

/**
 * Casa cada pendência com o cliente recém-gravado de mesmo Nome Fantasia
 * normalizado (case/acento/pontuação-insensível, reusando
 * `normalizeRazaoSocial` de lib/importacao/dedupe.ts — a mesma normalização
 * já reusada pelo resto da importação para categoria/produto/vendedor) e
 * expande cada produto da pendência num par identificador-de-cliente/
 * identificador-de-produto.
 *
 * Quando dois (ou mais) clientes recém-gravados têm o mesmo Nome Fantasia
 * normalizado, ou quando nenhum cliente recém-gravado casa, a pendência é
 * devolvida em `naoResolvidas` em vez de ligada a um cliente — nunca
 * "chuta" um cliente numa ambiguidade.
 */
export function resolverProdutosPendentes(
  pendencias: ProdutoPendente[],
  clientesRecemGravados: ClienteRecemGravado[]
): ResolverProdutosPendentesResult {
  const candidatosPorChave = new Map<string, ClienteRecemGravado[]>()

  for (const cliente of clientesRecemGravados) {
    const chave = normalizeRazaoSocial(cliente.nomeFantasia)
    if (!chave) continue

    const lista = candidatosPorChave.get(chave) ?? []
    lista.push(cliente)
    candidatosPorChave.set(chave, lista)
  }

  const vinculos: { clienteId: string; produtoId: string }[] = []
  const naoResolvidas: ProdutoPendente[] = []

  for (const pendencia of pendencias) {
    const chave = normalizeRazaoSocial(pendencia.nomeFantasia)
    const candidatos = candidatosPorChave.get(chave) ?? []

    if (candidatos.length !== 1) {
      naoResolvidas.push(pendencia)
      continue
    }

    const cliente = candidatos[0]
    for (const produtoId of pendencia.produtoIds) {
      vinculos.push({ clienteId: cliente.id, produtoId })
    }
  }

  return { vinculos, naoResolvidas }
}
