import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react"; // Ícone de carregamento

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // --- LÓGICA DE LOGIN ---
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        toast({ title: "Bem-vindo de volta!" });
        navigate("/"); // Vai para o Dashboard
        
      } else {
        // --- LÓGICA DE CADASTRO ---
        const { data, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              nome_empresa: nomeEmpresa // O Gatilho SQL vai ler isso aqui!
            }
          }
        });
        
        if (signUpError) throw signUpError;

        toast({ title: "Cadastro realizado!", description: "Você já pode acessar o sistema." });
        setIsLogin(true); // Volta para a tela de login
      }
    } catch (error: any) {
      toast({ 
        title: "Erro na autenticação", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-stone-950 overflow-hidden px-4">
      
      {/* Efeitos de Luz / Fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(#292524_1px,transparent_1px),linear-gradient(90deg,#292524_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

      {/* Container do Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-stone-900/80 backdrop-blur-xl p-8 shadow-2xl border border-stone-800">
        
        {/* Logo e Cabeçalho */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logo.png" 
            alt="ConvergeX Logo" 
            className="h-16 w-auto object-contain mb-6 drop-shadow-lg"
          />
          <h2 className="text-2xl font-bold tracking-tight text-stone-100">
            {isLogin ? "Acessar Sistema" : "Criar uma Conta"}
          </h2>
          <p className="text-sm text-stone-400 mt-2 text-center">
            {isLogin 
              ? "Insira suas credenciais para entrar no hub." 
              : "Cadastre sua empresa e comece a integrar."}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {!isLogin && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Nome da Empresa</label>
              <input
                type="text"
                required
                className="flex h-11 w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                placeholder="Ex: Minha Loja Ltda"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">E-mail</label>
            <input
              type="email"
              required
              className="flex h-11 w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Senha</label>
              {isLogin && (
                <button type="button" className="text-[11px] text-red-500 hover:text-red-400 transition-colors">
                  Esqueceu a senha?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              className="flex h-11 w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-70 bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:shadow-red-900/20 h-11 px-4 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aguarde...
              </>
            ) : isLogin ? (
              "Entrar"
            ) : (
              "Cadastrar Empresa"
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-stone-800 pt-6">
          <p className="text-sm text-stone-400">
            {isLogin ? "Sua empresa não tem conta? " : "Já possui conta? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                // Limpa os campos ao alternar entre login e cadastro
                setNomeEmpresa("");
                setPassword("");
              }}
              className="font-bold text-red-500 hover:text-red-400 hover:underline transition-colors ml-1"
            >
              {isLogin ? "Cadastre-se" : "Faça login"}
            </button>
          </p>
        </div>
      </div>

    </div>
  );
}