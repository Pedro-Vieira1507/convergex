import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Headers para permitir requisições do seu frontend (CORS)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações do Magento (mantendo as mesmas da função de sync)
const MAGENTO_TOKEN = '5qq4ag1cwq044maru56ng1glkfpc3lm9'; 
const MAGENTO_BASE_URL = 'https://www.forlabexpress.com.br/rest/default/V1/orders';

Deno.serve(async (req) => {
  // Responde ao "preflight" do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error('ID do pedido é obrigatório');
    }

    // Filtra pelo increment_id (número visual do pedido)
    // Usamos filterGroups para buscar exatamente este pedido
    const queryParams = new URLSearchParams({
      'searchCriteria[filterGroups][0][filters][0][field]': 'increment_id',
      'searchCriteria[filterGroups][0][filters][0][value]': orderId,
      'searchCriteria[filterGroups][0][filters][0][conditionType]': 'eq'
    });

    const magentoUrl = `${MAGENTO_BASE_URL}?${queryParams.toString()}`;
    
    console.log(`Consultando pedido ${orderId} no Magento...`);

    const responseMagento = await fetch(magentoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MAGENTO_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!responseMagento.ok) {
      const errText = await responseMagento.text();
      throw new Error(`Erro Magento (${responseMagento.status}): ${errText}`);
    }

    const data = await responseMagento.json();
    
    // O Magento retorna uma lista "items", pegamos o primeiro resultado
    const pedidoCompleto = data.items && data.items.length > 0 ? data.items[0] : null;

    if (!pedidoCompleto) {
        throw new Error('Pedido não encontrado.');
    }

    // Extrai apenas os dados necessários para o Popover
    const resultado = {
        frete: pedidoCompleto.shipping_amount || 0,
        metodo_frete: pedidoCompleto.shipping_description || 'Não informado',
        total_pedido: pedidoCompleto.grand_total,
        itens: pedidoCompleto.items.map((item: any) => ({
            nome: item.name,
            sku: item.sku,
            preco: item.price,
            qtd: item.qty_ordered,
            tipo: item.product_type,
            total_item: item.row_total
        }))
    };

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Bad Request
    });
  }
})