import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // As Server Actions de importação de planilha (validarLoteAtivos/
      // confirmarLoteAtivos em app/actions/importacaoAtivos.ts, e as
      // equivalentes de prospecção validarLoteImportacao/
      // confirmarLoteImportacao em app/actions/importacao.ts) recebem o
      // lote inteiro de linhas já parseadas no navegador (via SheetJS)
      // como argumento — um payload JSON que cresce proporcionalmente ao
      // número de linhas da planilha e ultrapassa o limite default de
      // 1MB do Next.js em planilhas de milhares de linhas (caso real:
      // 1909 linhas de "Clientes Ativos").
      //
      // Este valor NÃO deve subir indefinidamente: o teto real em
      // produção é o limite de tamanho de payload de Serverless Function
      // da plataforma de deploy (Vercel, mesmo no plano gratuito/Hobby,
      // gira em torno de 4.5MB) — uma restrição de infraestrutura da
      // plataforma, não configurável por este arquivo. Aumentar este
      // número muito além disso (ex.: "50mb") não resolveria nada em
      // produção, só mascararia o problema em ambiente local.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
