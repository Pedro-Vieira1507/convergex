import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept-language',
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
    const { action, contrato, dr, token, dataInicial, dataFinal, codigoObjeto } = body

    // 1. OBTÉM CREDENCIAIS
    let finalContrato = contrato;
    let finalDr = dr;
    let finalToken = token;

    if (!finalContrato || !finalDr || !finalToken) {
      const { data: config, error: configError } = await supabase
        .from('configuracoes_empresa')
        .select('correios_contrato, correios_dr, correios_token')
        .eq('user_id', user.id)
        .single();

      if (configError || !config?.correios_contrato || !config?.correios_token) {
        return new Response(JSON.stringify({ error: 'Credenciais ausentes no Banco. Volte nas Configurações e SALVE os dados dos Correios.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
      finalContrato = config.correios_contrato;
      finalDr = config.correios_dr;
      finalToken = config.correios_token;
    }

    // ADICIONADO: Accept-Language para evitar o erro SRO-018
    const apiHeaders = { 
      'Authorization': `Bearer ${finalToken.trim()}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'pt-BR' 
    };

    const formatarDataInput = (dataStr: string) => {
      if (!dataStr) return '';
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}-${mes}-${ano}`;
    };

    // ==========================================
    // AÇÃO 1: TESTE DA TELA DE CONFIGURAÇÕES
    // ==========================================
    if (action === 'TEST_CONNECTION') {
      const hoje = new Date();
      const sessentaDiasAtras = new Date(hoje.getTime() - (60 * 24 * 60 * 60 * 1000));
      const formatarData = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      const testUrl = `https://api.correios.com.br/faturas/v1/faturas?contrato=${finalContrato.trim()}&dr=${finalDr.trim()}&dataInicial=${formatarData(sessentaDiasAtras)}&dataFinal=${formatarData(hoje)}`;
      
      const response = await fetch(testUrl, { method: 'GET', headers: apiHeaders });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!response.ok) {
        let errorMsg = data.message || text || 'Erro de autenticação.';
        if (data.msgs && data.msgs.length > 0) errorMsg = data.msgs[0];
        if (response.status === 404 && errorMsg.includes('FAT-001')) {
           return new Response(JSON.stringify({ success: true, message: "Conexão estabelecida! (Nenhuma fatura nos últimos 60 dias)." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: `Correios (${response.status}): ${errorMsg}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
      return new Response(JSON.stringify({ success: true, message: "Conexão com a API validada!" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // AÇÕES 2 E 3: BUSCAR FATURAS OU DIVERGÊNCIAS
    // ==========================================
    if (action === 'GET_FATURAS' || action === 'GET_DIVERGENCIAS') {
      const dInicial = formatarDataInput(dataInicial);
      const dFinal = formatarDataInput(dataFinal);
      
      let url = `https://api.correios.com.br/faturas/v1/faturas?contrato=${finalContrato.trim()}&dr=${finalDr.trim()}&dataInicial=${dInicial}&dataFinal=${dFinal}`;
      if (action === 'GET_DIVERGENCIAS') {
        url = `https://api.correios.com.br/faturas/v1/faturas/divergencias?contrato=${finalContrato.trim()}&dr=${finalDr.trim()}&dataInicial=${dInicial}&dataFinal=${dFinal}`;
      }

      const response = await fetch(url, { method: 'GET', headers: apiHeaders });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!response.ok) {
        let errorMsg = data.message || text || 'Erro ao consultar faturas.';
        if (data.msgs && data.msgs.length > 0) errorMsg = data.msgs[0];
        return new Response(JSON.stringify({ error: `Correios (${response.status}): ${errorMsg}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // AÇÃO 4: DOWNLOAD DE PDF
    // ==========================================
    if (action === 'DOWNLOAD_PDF') {
      const { fatura, tipoDocumento, drFatura, itemFatura, tipoPdf } = body;
      if (!fatura || !tipoDocumento || !drFatura || !itemFatura || !tipoPdf) {
         return new Response(JSON.stringify({ error: 'Parâmetros incompletos.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const url = `https://api.correios.com.br/faturas/v1/faturas/${fatura}/${tipoPdf}/pdf?tipoDocumento=${tipoDocumento}&drFatura=${drFatura}&itemFatura=${itemFatura}`;
      const response = await fetch(url, { method: 'GET', headers: apiHeaders });

      if (!response.ok) {
        const text = await response.text();
        let errorMsg = 'Erro ao baixar PDF.';
        try { const d = JSON.parse(text); if(d.msgs) errorMsg = d.msgs[0]; } catch(e){}
        return new Response(JSON.stringify({ error: `Correios (${response.status}): ${errorMsg}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binaryStr = '';
      for (let i = 0; i < bytes.byteLength; i++) { binaryStr += String.fromCharCode(bytes[i]); }
      const base64Str = btoa(binaryStr);
      return new Response(JSON.stringify({ success: true, base64: base64Str }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // AÇÃO 5: RASTREAMENTO INDIVIDUAL (SRO)
    // ==========================================
    if (action === 'GET_RASTREIO') {
      if (!codigoObjeto || typeof codigoObjeto !== 'string') {
        return new Response(JSON.stringify({ error: 'Código de rastreio inválido.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const objLimpo = codigoObjeto.trim().toUpperCase();
      const url = `https://api.correios.com.br/srorastro/v1/objetos/${objLimpo}?resultado=T`;

      const response = await fetch(url, { method: 'GET', headers: apiHeaders });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!response.ok) {
        let errorMsg = data.message || text || 'Erro ao consultar rastreio.';
        if (data.msgs && data.msgs.length > 0) errorMsg = data.msgs[0];
        return new Response(JSON.stringify({ error: `Correios (${response.status}): ${errorMsg}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!data.objetos || data.objetos.length === 0) {
        return new Response(JSON.stringify({ error: 'Nenhum dado retornado para este objeto.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify(data.objetos[0]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: 'Ação não reconhecida.' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Erro interno: ${error.message}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})