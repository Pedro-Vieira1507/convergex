import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-onclick-url, x-onclick-token, x-intelipost-url, api-key, x-supabase-client-platform, x-supabase-client-version',
}

const INTELIPOST_API_URL = "https://api.intelipost.com.br/api/v1/";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { startDate, endDate, logisticProviderId } = await req.json();

    if (!startDate || !endDate) throw new Error("Datas obrigatórias.");
    if (!logisticProviderId) throw new Error("ID da Transportadora obrigatório.");

    const apiKey = req.headers.get('api-key') || Deno.env.get('INTELIPOST_API_KEY');
    if (!apiKey) throw new Error("API Key não encontrada.");

    // Monta a URL com os parâmetros
    // NOTA: A documentação pode pedir 'logisticProviderId' (singular) ou 'logisticProviderIds' (plural/lista)
    // Vamos tentar passar como está na doc que você mandou: logisticProviderId
    const params = new URLSearchParams({
        startDate: startDate,
        endDate: endDate,
        logisticProviderId: logisticProviderId.toString()
    });

    // Endpoint: Tentei /audit/pre-invoice/byDate antes e falhou (retornou vazio ou erro).
    // Vamos tentar o endpoint padrão de listagem: /audit/pre-invoice
    const targetUrl = `${INTELIPOST_API_URL}audit/pre-invoice?${params.toString()}`;

    console.log(`[Audit Proxy] Buscando: ${targetUrl}`);

    const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'token': apiKey, // Header 'token'
            'platform': 'SoftwareGerencial'
        }
    });

    if (!resp.ok) {
        const errorText = await resp.text();
        console.error("Erro API Intelipost:", errorText);
        throw new Error(`Erro Intelipost [${resp.status}]: ${errorText}`);
    }

    const data = await resp.json();
    
    // Log para debug
    console.log(`[Audit Proxy] Status: ${data.status}, Content Length: ${data.content?.length || 0}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("Erro na Auditoria:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})