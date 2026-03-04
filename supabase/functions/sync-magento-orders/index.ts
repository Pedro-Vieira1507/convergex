import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ==============================================================================
    // 1. IDENTIFICAR O USUÁRIO E A EMPRESA
    // ==============================================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Não autorizado. Você precisa estar logado para sincronizar dados.');
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Sessão expirada ou inválida.');

    // Descobrir o ID da Empresa deste usuário
    const { data: perfil, error: perfilError } = await userClient
      .from('perfis')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (perfilError || !perfil?.empresa_id) {
      throw new Error('Nenhuma empresa vinculada a este usuário.');
    }
    const minhaEmpresaId = perfil.empresa_id;

    // ==============================================================================
    // 2. OBTER AS CREDENCIAIS (Body ou Banco de Dados)
    // ==============================================================================
    let body: any = {};
    try {
        body = await req.json();
    } catch {
        // Segue em frente sem body
    }

    const isBackfill = body.backfill === true;
    const action = body.action; // Pode vir como "TEST_CONNECTION"
    
    let magentoUrl = body.magentoUrl;
    let magentoToken = body.magentoToken;

    // Se NÃO veio do body (ou seja, é uma sincronização real), busca no banco
    if (!magentoUrl || !magentoToken) {
      const { data: configData, error: configError } = await userClient
        .from('configuracoes_empresa')
        .select('magento_url, magento_token')
        .eq('user_id', user.id) // Busca pela config salva por este usuário
        .single();

      if (configError || !configData?.magento_url || !configData?.magento_token) {
        throw new Error('As credenciais do Magento não estão configuradas para a sua empresa.');
      }

      magentoUrl = configData.magento_url;
      magentoToken = configData.magento_token;
    }

    // Garantir que a URL base termine com o endpoint correto de pedidos
    const finalUrl = magentoUrl.includes('/rest/default/V1/orders') 
      ? magentoUrl 
      : `${magentoUrl.replace(/\/$/, '')}/rest/default/V1/orders`;

    // ==============================================================================
    // 3. BUSCAR PEDIDOS NO MAGENTO
    // ==============================================================================
    let queryParams = new URLSearchParams();

    // Se for só para testar a conexão, trazemos apenas 1 pedido de forma rápida
    if (action === 'TEST_CONNECTION') {
        console.log("🛠️ MODO TESTE: Verificando conexão...");
        queryParams = new URLSearchParams({ 'searchCriteria[pageSize]': '1' });
    } else if (isBackfill) {
        console.log("⚠️ MODO BACKFILL ATIVADO");
        queryParams = new URLSearchParams({
            'searchCriteria[filterGroups][0][filters][0][field]': 'created_at',
            'searchCriteria[filterGroups][0][filters][0][value]': '2026-01-01 00:00:00',
            'searchCriteria[filterGroups][0][filters][0][conditionType]': 'gte',
            'searchCriteria[filterGroups][1][filters][0][field]': 'created_at',
            'searchCriteria[filterGroups][1][filters][0][value]': '2026-01-31 23:59:59',
            'searchCriteria[filterGroups][1][filters][0][conditionType]': 'lte',
            'searchCriteria[pageSize]': '500', 
            'searchCriteria[currentPage]': '1'
        });
    } else {
        console.log("🔄 MODO SYNC PADRÃO: Últimos pedidos");
        queryParams = new URLSearchParams({
            'searchCriteria[pageSize]': '20',
            'searchCriteria[sortOrders][0][field]': 'created_at',
            'searchCriteria[sortOrders][0][direction]': 'DESC'
        });
    }

    const responseMagento = await fetch(`${finalUrl}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${magentoToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!responseMagento.ok) {
      const txt = await responseMagento.text();
      throw new Error(`Erro Magento: ${txt}`);
    }

    const data = await responseMagento.json();
    
    // Se a ação era só de teste, encerra aqui com sucesso sem salvar nada no banco!
    if (action === 'TEST_CONNECTION') {
        return new Response(JSON.stringify({ 
            success: true, 
            message: "Conexão com Magento bem-sucedida!" 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orders = data.items || [];

    // ==============================================================================
    // 4. SALVAR PEDIDOS NO SUPABASE 
    // ==============================================================================
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const pedidosFormatados = orders.map((order: any) => ({
      id: order.entity_id,
      increment_id: order.increment_id,
      created_at: order.created_at,
      status: order.status,
      customer_firstname: order.customer_firstname,
      customer_lastname: order.customer_lastname,
      grand_total: order.grand_total,
      empresa_id: minhaEmpresaId
    }));

    if (pedidosFormatados.length > 0) {
      const { error } = await adminClient
        .from('pedidos_magento')
        .upsert(pedidosFormatados, { onConflict: 'increment_id' }); 

      if (error) throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      mode: isBackfill ? 'backfill_jan_2026' : 'realtime',
      count: pedidosFormatados.length 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})