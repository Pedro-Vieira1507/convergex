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
    
    // Adicionado trackingCode para a nova funcionalidade de auditoria
    const { action, invoice_number, order_number, trackingCode } = bodyJson as any; 

    const reqHeaders = req.headers;
    // Tenta pegar do header ou do Deno.env
    let apiKey = reqHeaders.get('api-key') || Deno.env.get('INTELIPOST_API_KEY');

    // Se ainda não tiver a apiKey, tenta buscar no banco do Supabase baseado no token do usuário
    if (!apiKey) {
       const authHeader = req.headers.get('Authorization');
       if (authHeader) {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
          );
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
             const { data: config } = await supabase
               .from('configuracoes_empresa')
               .select('intelipost_token')
               .eq('user_id', user.id)
               .single();
             if (config?.intelipost_token) apiKey = config.intelipost_token;
          }
       }
    }

    if (!apiKey) throw new Error("API Key da Intelipost não fornecida ou não encontrada no banco.");

    const intelipostHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': apiKey,
        'platform': 'SoftwareGerencial',
        'platform-version': '1.0.0'
    };

    console.log(`[Proxy] Ação: ${action}`);

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
    
    // --- AÇÃO 3: Buscar Detalhes do Pedido ---
    if (action === 'GET_SHIPMENT_DETAILS') {
        if (!order_number) throw new Error("Número do Pedido é obrigatório.");

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

    // --- AÇÃO 4: NOVA AÇÃO PARA A TELA DE AUDITORIA (CRUZAMENTO DE CUSTO) ---
    if (action === 'GET_ESTIMATIVA') {
      let endpoint = '';
      
      // Tenta pelo código de rastreio primeiro, se não tiver, tenta pelo pedido
      if (trackingCode && trackingCode !== 'N/A') {
        endpoint = `shipment_order/tracking_data/${trackingCode}`;
      } else if (order_number && order_number !== 'N/A') {
        endpoint = `shipment_order/${order_number}`;
      } else {
        return new Response(JSON.stringify({ estimado: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`Buscando Estimativa (GET): ${INTELIPOST_OFFICIAL_URL}${endpoint}`);
      const response = await fetch(`${INTELIPOST_OFFICIAL_URL}${endpoint}`, { method: 'GET', headers: intelipostHeaders });
      
      if (!response.ok) {
         // Não damos throw error para não quebrar a tabela se um pacote não existir no TMS
         return new Response(JSON.stringify({ estimado: 0, msg: "Não encontrado no TMS" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      let valorEstimado = 0;

      // Pega o custo de envio do provedor dependendo de como a API retornou o objeto
      if (data && data.content) {
         if (data.content.provider_shipping_cost !== undefined) {
             valorEstimado = data.content.provider_shipping_cost;
         } else if (data.content.shipment_order && data.content.shipment_order.provider_shipping_cost !== undefined) {
             valorEstimado = data.content.shipment_order.provider_shipping_cost;
         } else if (data.content.client_shipping_cost !== undefined) {
             // Fallback para o custo do cliente caso o provedor venha zerado
             valorEstimado = data.content.client_shipping_cost;
         }
      }

      return new Response(JSON.stringify({ estimado: valorEstimado, raw_tms: data.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- AÇÃO 5: Teste de Conexão ---
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