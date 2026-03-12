import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase'; // Ajuste para o caminho do supabase do seu App Principal

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function checkSubscription() {
      try {
        // 1. Pega o usuário logado atualmente
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return; // Se não tiver usuário, o AuthGuard normal do seu app deve expulsá-lo pro Login
        }

        // 2. Busca o perfil para descobrir o ID da empresa
        const { data: perfil } = await supabase
          .from('perfis')
          .select('empresa_id')
          .eq('id', user.id)
          .single();

        if (perfil?.empresa_id) {
          // 3. Busca o status da assinatura na tabela empresas
          const { data: empresa } = await supabase
            .from('empresas')
            .select('status_assinatura')
            .eq('id', perfil.empresa_id)
            .single();

          setStatus(empresa?.status_assinatura || 'pendente');
        }
      } catch (error) {
        console.error("Erro ao verificar status da assinatura:", error);
      } finally {
        setLoading(false);
      }
    }

    checkSubscription();
  }, []);

  // Tela de carregamento enquanto consulta o banco
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="mt-4 text-slate-500 font-medium">Verificando credenciais...</p>
      </div>
    );
  }

  // TELA DE BLOQUEIO: Se o status for pendente (ou nulo)
  if (status !== 'ativo') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Assinatura Pendente</h2>
          <p className="text-slate-600 mb-8">
            Para liberar o acesso da sua equipe à plataforma Convergex, você precisa finalizar a configuração e o pagamento do seu plano.
          </p>
          
          <Button 
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              // Redireciona de volta para o site institucional no checkout
              // Se estiver rodando localmente o site institucional na porta 5174, troque a URL abaixo para testes
              window.location.href = 'https://convergex.com.br/checkout'; 
            }}
          >
            Finalizar Assinatura <ArrowRight className="ml-2 w-4 h-4" />
          </Button>

          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = 'https://convergex.com.br/login';
            }}
            className="mt-6 text-sm text-slate-500 hover:text-slate-800 font-medium"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  // Se o status for "ativo", renderiza o aplicativo normalmente!
  return <>{children}</>;
}