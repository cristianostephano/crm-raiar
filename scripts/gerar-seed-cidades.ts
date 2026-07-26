// Script de autoria única (offline) — roda uma vez, na hora de escrever a
// migration 0007, para gerar o corpo do `insert into cidades (...) values`.
// NÃO é código de app, NÃO roda no runtime do CRM.
//
// Uso: node --experimental-strip-types scripts/gerar-seed-cidades.ts > seed.sql
//
// Faz um único fetch na API oficial do IBGE
// (https://servicodados.ibge.gov.br/api/v1/localidades/municipios), extrai
// nome + sigla da UF de cada município, ordena por (uf, nome) para manter o
// diff estável entre execuções, escapa apóstrofos duplicando-os (regra do
// literal SQL: "d'Oeste" -> "d''Oeste"), e imprime o corpo do INSERT em lotes
// de ~1000 linhas por statement (Source: 09-RESEARCH.md Pattern 2 / Pitfall
// "COPY FROM não sobrevive a supabase db push contra projeto hospedado").

const IBGE_MUNICIPIOS_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"

type UfInfo = {
  sigla: string
}

type IbgeMunicipio = {
  nome: string
  // A maioria dos municípios tem microrregiao.mesorregiao.UF preenchido, mas
  // ao menos 1 registro do IBGE (ex: "Boa Esperança do Norte") vem com
  // microrregiao: null — nesse caso a UF só existe no caminho alternativo
  // regiao-imediata.regiao-intermediaria.UF. Tratar os dois caminhos evita
  // que o script quebre no meio do fetch (confirmado ao rodar contra a API
  // real nesta sessão).
  microrregiao: {
    mesorregiao: {
      UF: UfInfo
    }
  } | null
  "regiao-imediata"?: {
    "regiao-intermediaria"?: {
      UF: UfInfo
    }
  }
}

type Cidade = {
  nome: string
  uf: string
}

function escaparApostrofo(valor: string): string {
  return valor.replace(/'/g, "''")
}

function extrairUf(item: IbgeMunicipio): string {
  const uf =
    item.microrregiao?.mesorregiao.UF.sigla ??
    item["regiao-imediata"]?.["regiao-intermediaria"]?.UF.sigla

  if (!uf) {
    throw new Error(
      `Não foi possível determinar a UF do município "${item.nome}" — formato inesperado da API do IBGE.`
    )
  }
  return uf
}

async function buscarMunicipios(): Promise<Cidade[]> {
  const response = await fetch(IBGE_MUNICIPIOS_URL)
  if (!response.ok) {
    throw new Error(
      `Falha ao buscar municípios do IBGE: HTTP ${response.status}`
    )
  }
  const dados = (await response.json()) as IbgeMunicipio[]

  return dados.map((item) => ({
    nome: item.nome,
    uf: extrairUf(item),
  }))
}

function ordenar(cidades: Cidade[]): Cidade[] {
  return [...cidades].sort((a, b) => {
    if (a.uf !== b.uf) return a.uf.localeCompare(b.uf)
    return a.nome.localeCompare(b.nome, "pt-BR")
  })
}

function gerarInsert(cidades: Cidade[], tamanhoLote = 1000): string {
  const blocos: string[] = []

  for (let inicio = 0; inicio < cidades.length; inicio += tamanhoLote) {
    const lote = cidades.slice(inicio, inicio + tamanhoLote)
    const valores = lote
      .map(
        (c) => `  ('${escaparApostrofo(c.nome)}', '${escaparApostrofo(c.uf)}')`
      )
      .join(",\n")
    blocos.push(`insert into cidades (nome, uf) values\n${valores};`)
  }

  return blocos.join("\n\n")
}

async function main() {
  const cidades = ordenar(await buscarMunicipios())
  process.stderr.write(`Total de municípios obtidos do IBGE: ${cidades.length}\n`)
  process.stdout.write(gerarInsert(cidades) + "\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
