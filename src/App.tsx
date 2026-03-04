import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Adicionado Navigate
import { MainLayout } from "@/components/layout/MainLayout";

// Importações do Supabase e Login
import { supabase } from "@/lib/supabase"; // Confirme se o caminho está correto
import { Login } from "./pages/Login"; // Confirme se o caminho está correto

import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Rastreio from "./pages/Rastreio";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import WMS from "./pages/WMS";

// Aqui está a correção: Importar Pedidos apenas uma vez
import Pedidos from "./pages/Pedidos"; 

const queryClient = new QueryClient();

const App = () => {
  // Estados para controlar a sessão do usuário e o tempo de carregamento
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Busca a sessão atual assim que o app abre
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // 2. Fica escutando caso o usuário faça login ou logout para atualizar o app em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Tela de carregamento simples para evitar que a tela de login pisque antes de ler a sessão
  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Carregando sistema...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rota Pública: Se já estiver logado, joga para o Dashboard ("/"). Se não, mostra o Login. */}
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />

            {/* Rotas Privadas: Envolvemos o MainLayout. Se NÃO tiver sessão, joga de volta pro "/login" */}
            <Route element={session ? <MainLayout /> : <Navigate to="/login" />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/wms" element={<WMS />} />
              <Route path="/rastreio" element={<Rastreio />} />
              {/* Esta rota vai carregar a integração com Magento */}
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;