/**
 * Lista fixa das 27 siglas de UF brasileiras (26 estados + DF), em ordem
 * alfabética por sigla (09-02, LOC-01). Constante `as const` de frontend —
 * Estado nunca vira tabela no banco (ver 09-RESEARCH.md Pattern 3); esta é a
 * mesma fonte-verdade importada pelo schema Zod (`z.enum(UFS)`), pelos
 * formulários de cadastro/edição, pelo FiltersPopover, e pela validação de
 * importação por planilha.
 */
export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const

export type Uf = (typeof UFS)[number]
