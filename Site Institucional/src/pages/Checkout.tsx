import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, CreditCard, ArrowRight, Building2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';

import Header from '@/components/Header';
import Footer from '@/components/Footer';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';

// Sua Chave Pública Stripe
const stripePromise = loadStripe('pk_test_sua_chave_publica_aqui');

const CheckoutForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  
  const stripe = useStripe();
  const elements = useElements();

  const selectedPlan = location.state?.plan || { id: 'convergex-pro', name: 'Plano Convergex Pro', price: 297.00 };
  const initialBillingInfo = location.state?.billingInfo || { companyName: '', document: '' };

  const [billingInfo, setBillingInfo] = useState({ companyName: initialBillingInfo.companyName, document: initialBillingInfo.document });
  const [paymentData, setPaymentData] = useState({ method: 'credit_card', card_holder: '' });

  // Configuração crucial para a Stripe funcionar no Dark Mode!
  const stripeElementOptions = {
    style: {
      base: {
        fontSize: '15px',
        color: '#e7e5e4', // text-stone-200
        iconColor: '#ef4444', // text-red-500
        '::placeholder': { color: '#57534e' }, // text-stone-600
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      invalid: { color: '#ef4444', iconColor: '#ef4444' }
    },
  };

  const handleFinalizeOrder = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-payment-stripe', {
        body: { amount: selectedPlan.price, paymentMethod: paymentData.method }
      });
      if (invokeError) throw new Error("Erro de conexão com o servidor de pagamentos.");
      const responseBody = typeof data === 'string' ? JSON.parse(data) : data;
      if (data?.error) throw new Error(data.error);

      if (paymentData.method === 'credit_card') {
        const clientSecret = responseBody?.clientSecret;
        if (!clientSecret) throw new Error("Falha ao inicializar o pagamento seguro.");
        const cardElement = elements.getElement(CardNumberElement);
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement!, billing_details: { name: paymentData.card_holder || billingInfo.companyName } },
        });

        if (stripeError) throw new Error(stripeError.message);

        if (paymentIntent?.status === 'succeeded') {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: perfil } = await supabase.from('perfis').select('empresa_id').eq('id', user.id).single();
              if (perfil?.empresa_id) {
                await supabase.from('empresas').update({ status_assinatura: 'ativo', plano_atual: selectedPlan.id }).eq('id', perfil.empresa_id);
              }
            }
          } catch (dbErr) { console.error(dbErr); }

          toast.success("Pagamento aprovado! Sua conta foi ativada.");
          window.location.href = 'https://app.convergex.com.br/'; // Link para o seu App em produção
        }
      } 
    } catch (err: any) {
      toast.error(err.message || "Não foi possível processar seu pagamento.");
    } finally { setLoading(false); }
  };

  // Classe padrão dos inputs Dark Mode
  const inputClass = "flex h-11 w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-3 text-sm text-stone-200 placeholder:text-stone-600 focus-within:ring-2 focus-within:ring-red-500/50 focus-within:border-red-500 transition-all";
  const standardInputClass = "flex h-11 w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all";

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-200 selection:bg-red-500/30">
      <Header />
      
      <main className="flex-1 py-12 border-t border-stone-900 relative">
        {/* Efeito sutil de fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="container max-w-6xl mx-auto px-4 relative z-10">
          
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-100">Finalizar Contratação</h1>
            <p className="text-stone-400 mt-2">Você está a um passo de transformar sua operação com a ConvergeX.</p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7 space-y-8">
              
              {/* Box Faturamento */}
              <div className="bg-stone-900 p-6 md:p-8 rounded-2xl shadow-xl border border-stone-800">
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-6 text-stone-100">
                   <Building2 className="text-red-500 w-5 h-5"/> Dados de Faturamento
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="space-y-1.5 md:col-span-2">
                     <Label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Nome da Empresa (Razão Social)</Label>
                     <input className={standardInputClass} value={billingInfo.companyName} onChange={(e) => setBillingInfo({...billingInfo, companyName: e.target.value})} />
                   </div>
                   <div className="space-y-1.5 md:col-span-2">
                     <Label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">CNPJ / CPF</Label>
                     <input className={standardInputClass} value={billingInfo.document} onChange={(e) => setBillingInfo({...billingInfo, document: e.target.value})} />
                   </div>
                 </div>
              </div>

              {/* Box Pagamento */}
              <div className="bg-stone-900 p-6 md:p-8 rounded-2xl shadow-xl border border-stone-800">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-stone-100">
                  <CreditCard className="text-red-500 w-5 h-5"/> Pagamento Seguro
                </h3>
                
                <Tabs defaultValue="credit_card" onValueChange={(v) => setPaymentData({...paymentData, method: v})} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-8 bg-stone-950 border border-stone-800 p-1 h-12 rounded-lg">
                    <TabsTrigger value="credit_card" className="rounded-md text-sm data-[state=active]:bg-stone-800 data-[state=active]:text-stone-100 text-stone-400">Cartão de Crédito</TabsTrigger>
                    <TabsTrigger value="pix" className="rounded-md text-sm data-[state=active]:bg-stone-800 data-[state=active]:text-stone-100 text-stone-400">PIX</TabsTrigger>
                  </TabsList>

                  <TabsContent value="credit_card" className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Número do Cartão</Label>
                      <div className={inputClass}>
                        <CardNumberElement options={stripeElementOptions} className="w-full" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Nome impresso no Cartão</Label>
                      <input className={standardInputClass} placeholder="Ex: JOAO M SILVA" value={paymentData.card_holder} onChange={(e) => setPaymentData({...paymentData, card_holder: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Validade (MM/AA)</Label>
                        <div className={inputClass}>
                          <CardExpiryElement options={stripeElementOptions} className="w-full" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">CVC</Label>
                        <div className={inputClass}>
                          <CardCvcElement options={stripeElementOptions} className="w-full" />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="pix" className="text-center py-10 bg-stone-950/50 border border-dashed border-stone-800 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <QrCode size={48} className="mx-auto mb-4 text-red-500 opacity-50" />
                      <h4 className="text-lg font-bold text-stone-100 mb-1">Pagamento Rápido via PIX</h4>
                      <p className="text-sm text-stone-400 max-w-xs mx-auto">O QR Code será gerado assim que você confirmar a assinatura.</p>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-stone-900 p-6 md:p-8 rounded-2xl shadow-xl border border-stone-800 sticky top-24">
                <h3 className="text-xl font-bold mb-6 border-b border-stone-800 pb-4 text-stone-100">Resumo da Assinatura</h3>
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-bold text-stone-100">{selectedPlan.name}</h4>
                    <p className="text-sm text-stone-400 mt-1">Acesso completo à plataforma</p>
                  </div>
                  <span className="font-bold text-stone-100">R$ {selectedPlan.price.toFixed(2).replace('.', ',')}</span>
                </div>
                
                <div className="mt-6 pt-6 border-t border-dashed border-stone-800 flex justify-between items-center">
                  <span className="text-stone-400 font-semibold uppercase tracking-wider text-sm">Total Mensal</span>
                  <span className="text-3xl font-black text-red-500">R$ {selectedPlan.price.toFixed(2).replace('.', ',')}</span>
                </div>

                <Button className="w-full h-14 text-lg font-bold mt-8 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 border-none transition-all" onClick={handleFinalizeOrder} disabled={loading || !stripe}>
                  {loading ? "Processando..." : <><ShieldCheck className="mr-2 w-5 h-5"/> Confirmar Assinatura <ArrowRight className="ml-2 w-5 h-5"/></>}
                </Button>
                
                <p className="text-xs text-center text-stone-500 mt-4 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Pagamento 100% seguro via Stripe
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default function Checkout() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}