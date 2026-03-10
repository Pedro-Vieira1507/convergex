import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Importando o cliente FTP compatível com Deno via NPM
import * as ftp from "npm:basic-ftp";
import tls from "node:tls";

// --- HACK PARA CORRIGIR O BUG DO DENO COM FTPS ---
if (tls.TLSSocket && !(tls.TLSSocket.prototype as any).getProtocol) {
  (tls.TLSSocket.prototype as any).getProtocol = function() { return "TLSv1.2"; };
}
if (tls.TLSSocket && !(tls.TLSSocket.prototype as any).getCipher) {
  (tls.TLSSocket.prototype as any).getCipher = function() { return { name: 'TLS', version: 'TLSv1.2' }; };
}
// -------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action } = await req.json();

    if (action === 'LIST_CTE_BRASPRESS') {
      const client = new ftp.Client();
      // client.ftp.verbose = true; // Descomente para ver os logs do FTP no painel do Supabase
      
      try {
        console.log("Conectando ao FTP da Intelipost...");
        
        await client.access({
          host: "edi-prd-v1.intelipost.com.br",
          port: 21,
          user: "client65262",
          password: "qnoc07YNPmsTIqs",
          secure: true // Porta 21 geralmente é FTP padrão
        });

        console.log("Navegando para /BRASPRESS/CTE...");
        await client.cd("/BRASPRESS/CTE");

        // Lista os arquivos na pasta
        const list = await client.list();
        
        // Filtra para pegar apenas os arquivos (ignora pastas) e formata a saída
        const files = list.filter(item => item.isFile).map(file => ({
          fileName: file.name,
          size: file.size,
          date: file.date,
          // Dependendo do volume, você pode querer baixar o arquivo e ler o conteúdo aqui,
          // mas por enquanto vamos apenas listar para garantir que a conexão funciona.
        }));

        console.log(`Sucesso! Encontrados ${files.length} arquivos.`);

        return new Response(JSON.stringify({ files }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } finally {
        client.close();
      }
    }

    throw new Error("Action not found");

  } catch (error: any) {
    console.error("Erro no FTP:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})