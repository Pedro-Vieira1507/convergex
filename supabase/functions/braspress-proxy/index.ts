import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Sessão expirada.')

    const body = await req.json()
    const { action, cnpj, token, searchType, searchValue } = body

    // 1. OBTÉM CREDENCIAIS DO BANCO
    let finalCnpj = cnpj;
    let finalToken = token;

    if (!finalCnpj || !finalToken) {
      const { data: config, error: configError } = await supabase
        .from('configuracoes_empresa')
        .select('braspress_cnpj, braspress_token')
        .eq('user_id', user.id)
        .single();

      if (configError || !config?.braspress_cnpj || !config?.braspress_token) {
        return new Response(JSON.stringify({ error: 'Credenciais ausentes no Banco. Volte nas Configurações e SALVE os dados da Braspress.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
      finalCnpj = config.braspress_cnpj;
      finalToken = config.braspress_token;
    }

    // 2. PREPARA O BASE64 E OS HEADERS
    let usuarioFormatado = finalCnpj.trim();
    if (usuarioFormatado.match(/^[\d\.\-\/]+$/)) {
      usuarioFormatado = usuarioFormatado.replace(/\D/g, ''); 
    }
    const tokenLimpo = finalToken.trim();
    const base64Credentials = btoa(`${usuarioFormatado}:${tokenLimpo}`);

    const apiHeaders = { 
      'Authorization': `Basic ${base64Credentials}`, 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // ==========================================
    // AÇÃO 1: TESTE DA TELA DE CONFIGURAÇÕES
    // ==========================================
    if (action === 'TEST_CONNECTION') {
      const testUrl = `https://api.braspress.com/v3/tracking/byNumPedido/${usuarioFormatado}/1/json`;
      const response = await fetch(testUrl, { method: 'GET', headers: apiHeaders });

      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ error: 'Credenciais inválidas na Braspress.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
      return new Response(JSON.stringify({ success: true, message: "Conexão validada!" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // AÇÃO 2: BUSCA NA TELA DE AUDITORIA
    // ==========================================
    if (action === 'GET_TRACKING') {
      if (!searchValue) {
        return new Response(JSON.stringify({ error: 'Informe o número da NF ou Pedido.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      const searchClean = searchValue.trim();
      
      // Testando a v2 para a Nota Fiscal (conforme a documentação) e v3 para Pedido
      let url = searchType === 'nf' 
        ? `https://api.braspress.com/v2/tracking/${usuarioFormatado}/${searchClean}/json`
        : `https://api.braspress.com/v3/tracking/byNumPedido/${usuarioFormatado}/${searchClean}/json`;

      const response = await fetch(url, { method: 'GET', headers: apiHeaders });

      // LER A RESPOSTA ANTES DE AVALIAR O STATUS PARA NÃO PERDER A MENSAGEM ORIGINAL
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      // Se der erro (401, 404, 500), devolve a mensagem exata da Braspress
      if (!response.ok) {
        let errorMsg = data.message || text || 'Acesso negado ou NF não encontrada.';
        
        if (data.errorList && data.errorList.length > 0) {
           errorMsg = data.errorList[0];
        }
        
        return new Response(JSON.stringify({ 
          error: `Braspress (${response.status}): ${errorMsg}` 
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: 'Ação não reconhecida.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Erro interno: ${error.message}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})