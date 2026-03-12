import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Zap, ArrowRight, Loader2, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase'; 

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const planIntent = location.state?.plan;
  const [activeTab, setActiveTab] = useState(planIntent ? 'register' : 'login');

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', companyName: '', document: '', 
  });

  const handleAuth = async (action: 'login' | 'register') => {
    if (!formData.email || !formData.password) {
      toast.error("Preencha e-mail e senha."); return;
    }
    setLoading(true);
    try {
      if (action === 'register') {
        if (!formData.name || !formData.companyName || !formData.document) {
          toast.error("Preencha todos os campos obrigatórios para criar a conta.");
          setLoading(false); return;
        }

        const { data: empresaExistente } = await supabase.from('empresas').select('id, nome').ilike('nome', formData.companyName.trim()).maybeSingle();
        if (empresaExistente) {
          toast.error("Esta empresa já possui cadastro. Faça login ou peça um convite.");
          setLoading(false); return; 
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({ email: formData.email, password: formData.password });
        if (authError) throw authError;

        if (authData.user) {
          const { data: empresaData, error: empresaError } = await supabase.from('empresas').insert({ nome: formData.companyName.trim() }).select('id').single();
          if (empresaError) throw new Error("Erro ao criar os dados da empresa.");

          const { error: perfilError } = await supabase.from('perfis').insert({
            id: authData.user.id, empresa_id: empresaData.id, nome_completo: formData.name, email: formData.email, role: 'admin' 
          });
          if (perfilError) throw new Error("Erro ao configurar seu perfil.");
        }
        toast.success("Conta criada! Redirecionando para o pagamento...");

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
      }

      if (planIntent) {
        navigate('/checkout', { state: { plan: planIntent, billingInfo: { companyName: formData.companyName, document: formData.document } } });
      } else {
        navigate('/dashboard'); 
      }
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro ao processar sua solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const scrollToPlanos = () => {
    navigate('/'); setTimeout(() => { document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
  };

  const inputClass = "flex h-11 w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all";

  return (
    <div className="min-h-screen flex bg-stone-950 text-stone-200 selection:bg-red-500/30">
      
      {/* Lado Esquerdo - Formulário */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 overflow-y-auto py-12 relative z-10">
        
        {/* Efeito de Luz Fundo Formulario */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
           <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-600/5 blur-[120px] rounded-full"></div>
        </div>

        <div className="mx-auto w-full max-w-sm lg:w-[420px]">
          
          <div className="mb-8">
            <Link to="/" className="flex items-center gap-2 text-red-500">
              <Zap className="w-8 h-8 fill-red-500" />
              <span className="font-bold text-2xl text-stone-100 tracking-tight">ConvergeX</span>
            </Link>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-stone-100">
              Acesse sua conta
            </h2>
            {planIntent && (
              <p className="mt-3 text-sm text-red-400 font-medium bg-red-950/20 p-3 rounded-lg border border-red-900/30">
                Finalize seu cadastro para assinar o <strong className="text-red-300">{planIntent.name}</strong>.
              </p>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-stone-900 border border-stone-800 p-1 rounded-lg">
              <TabsTrigger value="login" className="rounded-md data-[state=active]:bg-stone-800 data-[state=active]:text-stone-100 text-stone-400">Entrar</TabsTrigger>
              <TabsTrigger value="register" className="rounded-md data-[state=active]:bg-stone-800 data-[state=active]:text-stone-100 text-stone-400">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1.5">
                <Label htmlFor="email-login" className="text-xs font-semibold text-stone-400 uppercase tracking-wider">E-mail corporativo</Label>
                <input id="email-login" type="email" placeholder="voce@suaempresa.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password-login" className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Senha</Label>
                  <a href="#" className="text-[11px] text-red-500 hover:text-red-400 transition-colors">Esqueceu a senha?</a>
                </div>
                <input id="password-login" type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className={inputClass} />
              </div>
              <Button className="w-full h-11 mt-2 bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-lg shadow-red-900/20 border-none" onClick={() => handleAuth('login')} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Entrar na Plataforma
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {!planIntent ? (
                <div className="text-center py-8 px-4 bg-stone-900 border border-stone-800 rounded-xl shadow-sm">
                  <div className="w-16 h-16 bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/30">
                    <PackageSearch className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-100 mb-2">Escolha um plano primeiro</h3>
                  <p className="text-sm text-stone-400 mb-6">Para criar uma nova conta na ConvergeX, você precisa selecionar o plano ideal para a sua empresa.</p>
                  <Button className="w-full h-11 bg-stone-800 hover:bg-stone-700 text-white border border-stone-700" onClick={scrollToPlanos}>Ver Planos ConvergeX</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="name-register" className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Nome completo</Label>
                    <input id="name-register" placeholder="Seu nome completo" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="company-register" className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Empresa</Label>
                      <input id="company-register" placeholder="Sua Empresa" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="document-register" className="text-xs font-semibold text-stone-400 uppercase tracking-wider">CNPJ / CPF</Label>
                      <input id="document-register" placeholder="00.000.000/0000" value={formData.document} onChange={(e) => setFormData({...formData, document: e.target.value})} className={inputClass} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-register" className="text-xs font-semibold text-stone-400 uppercase tracking-wider">E-mail corporativo</Label>
                    <input id="email-register" type="email" placeholder="voce@suaempresa.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password-register" className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Senha</Label>
                    <input id="password-register" type="password" placeholder="Crie uma senha forte" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className={inputClass} />
                  </div>
                  <Button className="w-full h-11 mt-2 bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-lg shadow-red-900/20 border-none" onClick={() => handleAuth('register')} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Criar conta e Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Lado Direito - Banner */}
      <div className="hidden lg:block lg:flex-1 relative bg-stone-900 overflow-hidden">
        {/* Grid Pattern que você usa no App */}
        <div className="absolute inset-0 bg-[linear-gradient(#292524_1px,transparent_1px),linear-gradient(90deg,#292524_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 pointer-events-none z-10"></div>
        <div className="absolute inset-0 bg-red-950/40 mix-blend-multiply opacity-80 z-10"></div>
        <img className="absolute inset-0 h-full w-full object-cover grayscale opacity-30" src="https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070&auto=format&fit=crop" alt="Dashboard Convergex" />
        
        <div className="absolute inset-0 flex items-center justify-center p-12 bg-gradient-to-t from-stone-950 via-transparent to-transparent z-20">
          <div className="max-w-lg text-center">
            <h3 className="text-3xl font-bold text-white mb-4">Transforme a operação da sua empresa</h3>
            <p className="text-stone-400 text-lg">Junte-se a centenas de empresas que já otimizaram seus processos com a tecnologia da ConvergeX.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;