import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-onclick-url, x-onclick-token, x-intelipost-url, api-key, x-supabase-client-platform, x-supabase-client-version',
}

const INTELIPOST_API_URL = "https://api.intelipost.com.br/api/v1/";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json();
    const { action } = payload; // Lendo a action enviada pelo React

    const apiKey = req.headers.get('api-key') || Deno.env.get('INTELIPOST_API_KEY');
    if (!apiKey) throw new Error("API Key não encontrada.");

    // =======================================================
    // ROTA 1: A NOVA BUSCA DE PRÉ-FATURAS
    // =======================================================
    if (action === 'GET_PRE_INVOICE_BY_DATE') {
      const { startDate, endDate, logisticProviderId } = payload;
      
      if (!startDate || !endDate) throw new Error("Datas obrigatórias.");
      if (!logisticProviderId) throw new Error("ID da Transportadora obrigatório.");

      const params = new URLSearchParams({
          startDate: startDate,
          endDate: endDate,
          logisticProviderId: logisticProviderId.toString()
      });

      const targetUrl = `${INTELIPOST_API_URL}audit/pre-invoice/byDate?${params.toString()}`;
      
      const resp = await fetch(targetUrl, {
          method: 'GET',
          headers: {
              'Accept': 'application/json',
              'token': apiKey
          }
      });

      if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`Erro Intelipost: ${errorText}`);
      }

      const data = await resp.json();
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =======================================================
    // ROTA 2: A SUA ROTA ANTIGA (NÃO APAGUE A SUA LÓGICA AQUI)
    // =======================================================
    if (action === 'GET_ESTIMATIVA') {
       // Cole aqui a lógica original que você já tinha para a ação GET_ESTIMATIVA
       // que recebe trackingCode e orderNumber...
       
       return new Response(JSON.stringify({ estimado: 0 /* seu retorno original */ }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
    }

    // Se chegar aqui e não for nenhuma das actions mapeadas, devolve o erro que você viu
    throw new Error("Action not found");

  } catch (error: any) {
    console.error("Erro na Function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, // <-- O status 400 que apareceu no seu console
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})