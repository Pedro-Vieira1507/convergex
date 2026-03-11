import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Resposta para o preflight (CORS)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autorizado. Token ausente.')

    // 1. Cliente Admin (Para poder criar utilizadores e contornar RLS)
    // O Supabase tem o SERVICE_ROLE_KEY escondido no ambiente automaticamente
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Cliente normal (Apenas para descobrir quem fez o pedido)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Utilizador não autenticado.')

    // 3. Obter o empresa_id de quem está a convidar
    const { data: perfilLogado, error: perfilError } = await supabaseAdmin
      .from('perfis')
      .select('empresa_id')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfilLogado?.empresa_id) {
      throw new Error('Não foi possível encontrar a empresa da sua conta.')
    }

    const { email, role } = await req.json()
    if (!email) throw new Error('Email é obrigatório.')

    // 4. Convidar o utilizador através da API de Admin do Supabase
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (inviteError) throw inviteError

    // 5. Vincular o novo utilizador à mesma empresa e definir o cargo (role)
    if (inviteData?.user) {
      const { error: updateError } = await supabaseAdmin
        .from('perfis')
        .upsert({ 
          id: inviteData.user.id, 
          email: email,
          role: role || 'operador',
          empresa_id: perfilLogado.empresa_id // Mágica acontece aqui!
        }, { onConflict: 'id' })

      if (updateError) throw updateError
    }

    return new Response(JSON.stringify({ success: true, message: 'Convite enviado.' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })
  }
})