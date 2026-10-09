/**
 * Regra pura do filtro de vendedor do Dashboard (quick 261009-npp). Sem React,
 * sem Supabase.
 *
 * So confere o FORMATO do id vindo do navegador (higiene de entrada): quem
 * decide o que cada pessoa pode ver e a RLS do banco, nunca esta funcao. Vazio
 * (nulo, indefinido, texto em branco) significa "Todos os vendedores".
 */
export type VendedorFiltroNormalizado = { ok: true; vendedorId: string | null } | { ok: false }

// 8-4-4-4-12 hexadecimal, maiusculas ou minusculas, sem exigir a versao do uuid.
const FORMATO_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function normalizarVendedorFiltro(
  valor: string | null | undefined
): VendedorFiltroNormalizado {
  if (valor === null || valor === undefined || valor.trim() === "") {
    return { ok: true, vendedorId: null }
  }
  if (FORMATO_UUID.test(valor)) {
    return { ok: true, vendedorId: valor }
  }
  return { ok: false }
}
