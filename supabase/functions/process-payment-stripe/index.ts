import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "npm:stripe@^14.0.0"

// Inicializa o cliente da Stripe da Convergex
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    // Recebe apenas o valor e o método de pagamento
    const { amount, paymentMethod } = await req.json();

    const totalAmountInCents = Math.round(amount * 100);
    
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalAmountInCents,
      currency: 'brl',
    };

    // FLUXO 1: CARTÃO DE CRÉDITO
    if (paymentMethod === 'credit_card') {
      paymentIntentParams.payment_method_types = ['card'];
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

      return new Response(JSON.stringify({ 
        clientSecret: paymentIntent.client_secret 
      }), { headers, status: 200 });
    } 
    
    // FLUXO 2: PAGAMENTO VIA PIX
    else if (paymentMethod === 'pix') {
      paymentIntentParams.payment_method_types = ['pix'];
      paymentIntentParams.payment_method_data = { type: 'pix' };
      paymentIntentParams.confirm = true;
      paymentIntentParams.return_url = 'https://convergex.com.br/pagamento-confirmado'; // URL atualizada

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
      const pixAction = paymentIntent.next_action?.pix_display_qr_code;

      if (!pixAction) {
        throw new Error("A Stripe não retornou os dados do PIX.");
      }

      return new Response(JSON.stringify({ 
        pixCode: pixAction.data,
        pixQrCode: pixAction.image_url_png
      }), { headers, status: 200 });
    } 
    
    else {
      throw new Error("Método de pagamento não suportado.");
    }

  } catch (error: any) {
    console.error("ERRO STRIPE:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers, status: 400 });
  }
})