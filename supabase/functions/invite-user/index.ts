import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Trata o CORS (Preflight)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Cabeçalho de autorização ausente.');

    // 1. Instancia o cliente do utilizador para verificar permissões
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Pega o utilizador da sessão
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Sessão expirada ou inválida.');

    // Verifica se é Admin
    const { data: adminPerfil, error: perfilError } = await userClient
      .from('perfis')
      .select('empresa_id, role')
      .eq('id', user.id)
      .single();
      
    if (perfilError) throw new Error('Erro ao validar permissões: ' + perfilError.message);
    if (adminPerfil?.role !== 'admin') throw new Error('Apenas Administradores podem convidar membros para a equipa.');

    // Lê os dados enviados pelo frontend
    const body = await req.json();
    const email = body.email;
    const role = body.role || 'operador';

    if (!email) throw new Error('O e-mail é obrigatório.');

    // 2. Cria o cliente Admin (Service Role) para conseguir disparar o convite
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Dispara o e-mail de convite
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email);
    if (inviteError) throw new Error('Falha no Supabase ao enviar convite: ' + inviteError.message);

    // 4. Vincula o perfil recém-criado à mesma empresa do Admin
    const { error: updateError } = await adminSupabase.from('perfis').update({
      empresa_id: adminPerfil.empresa_id,
      role: role
    }).eq('id', inviteData.user.id);

    if (updateError) throw new Error('O convite foi enviado, mas houve erro ao vincular a empresa: ' + updateError.message);

    // Sucesso
    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("ERRO EDGE FUNCTION:", error.message);
    // TRUQUE: Retornamos status 200 para o frontend não ocultar o erro, e mandamos a chave 'error'
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
})