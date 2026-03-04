import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-onclick-url, x-onclick-token, x-intelipost-url, api-key, x-supabase-client-platform, x-supabase-client-version',
}

const INTELIPOST_OFFICIAL_URL = "https://api.intelipost.com.br/api/v1/";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    let bodyJson = {};
    try { bodyJson = await req.json(); } catch {}
    const { action, invoice_number, order_number } = bodyJson as any; // Adicionado order_number

    const reqHeaders = req.headers;
    const apiKey = reqHeaders.get('api-key') || Deno.env.get('INTELIPOST_API_KEY');

    if (!apiKey) throw new Error("API Key da Intelipost não fornecida.");

    const intelipostHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': apiKey,
        'platform': 'SoftwareGerencial',
        'platform-version': '1.0.0'
    };

    console.log(`[Proxy] Ação: ${action}`);

    // ... (MANTENHA AS AÇÕES GET_SHIPMENTS, SEARCH_BY_INVOICE, TEST_CONNECTION AQUI IGUAIS AO QUE ESTAVAM) ...
    // Estou omitindo para economizar espaço, mas NÃO APAGUE o código anterior dessas ações.
    
    // --- AÇÃO 1: Listagem Geral (POST) ---
    if (action === 'GET_SHIPMENTS') {
        const resp = await fetch(`${INTELIPOST_OFFICIAL_URL}shipment_order/search`, {
            method: 'POST',
            headers: intelipostHeaders,
            body: JSON.stringify({ "page": 1, "page_size": 50, "sort": "created:desc" })
        });
        if (!resp.ok) {
             const txt = await resp.text();
             throw new Error(`Erro Listagem [${resp.status}]: ${txt}`);
        }
        const data = await resp.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- AÇÃO 2: Busca por Nota Fiscal (GET) ---
    if (action === 'SEARCH_BY_INVOICE') {
        if (!invoice_number) throw new Error("Número da Nota Fiscal é obrigatório.");
        const num = invoice_number.toString().trim();
        const endpoint = `shipment_order/invoice/${encodeURIComponent(num)}`;
        console.log(`Buscando (GET): ${INTELIPOST_OFFICIAL_URL}${endpoint}`);

        const resp = await fetch(`${INTELIPOST_OFFICIAL_URL}${endpoint}`, {
            method: 'GET',
            headers: intelipostHeaders
        });

        if (!resp.ok) {
            if (resp.status === 404) {
                 return new Response(JSON.stringify({ content: { shipments: [] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            const txt = await resp.text();
            throw new Error(`Erro Busca NF [${resp.status}]: ${txt}`);
        }
        
        const data = await resp.json();
        let normalizedContent = [];
        if (data.content) {
            if (Array.isArray(data.content)) {
                normalizedContent = data.content;
            } else {
                normalizedContent = [data.content];
            }
        }
        return new Response(JSON.stringify({ content: { shipments: normalizedContent } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // --- NOVA AÇÃO: Buscar Detalhes do Pedido ---
    if (action === 'GET_SHIPMENT_DETAILS') {
        if (!order_number) throw new Error("Número do Pedido é obrigatório.");

        // Endpoint: /shipment_order/{order_number}
        const endpoint = `shipment_order/${encodeURIComponent(order_number)}`;
        console.log(`Detalhes (GET): ${INTELIPOST_OFFICIAL_URL}${endpoint}`);

        const resp = await fetch(`${INTELIPOST_OFFICIAL_URL}${endpoint}`, {
            method: 'GET',
            headers: intelipostHeaders
        });

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Erro Detalhes [${resp.status}]: ${txt}`);
        }

        const data = await resp.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- AÇÃO 3: Teste de Conexão ---
    if (action === 'TEST_CONNECTION') {
        const resp = await fetch(`${INTELIPOST_OFFICIAL_URL}info`, { method: 'GET', headers: intelipostHeaders });
        if (!resp.ok) {
            const resp2 = await fetch(`${INTELIPOST_OFFICIAL_URL}shipment_order/search`, { 
                method: 'POST', 
                headers: intelipostHeaders, 
                body: JSON.stringify({ page:1, page_size:1 }) 
            });
            if (resp2.status === 401 || resp2.status === 403) throw new Error("Chave de API inválida.");
        }
        return new Response(JSON.stringify({ status: "OK" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: "Action not found" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("Erro Proxy:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});