import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";

// Importações do Supabase e Login
import { supabase } from "@/lib/supabase"; 
import { Login } from "./pages/Login"; 

// IMPORTANTE: Importe o guardião que criamos
import { SubscriptionGuard } from "@/components/SubscriptionGuard"; // Ajuste o caminho de acordo com onde você salvou

import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Rastreio from "./pages/Rastreio";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import WMS from "./pages/WMS";
import Auditoria from "./pages/Auditoria";
import Pedidos from "./pages/Pedidos"; 

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
            {/* Rota Pública */}
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />

            {/* Rotas Privadas com a Trava de Assinatura */}
            {/* MUDANÇA AQUI: Abraçamos o MainLayout com o SubscriptionGuard */}
            <Route 
              element={
                session ? (
                  <SubscriptionGuard>
                    <MainLayout />
                  </SubscriptionGuard>
                ) : (
                  <Navigate to="/login" />
                )
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/wms" element={<WMS />} />
              <Route path="/rastreio" element={<Rastreio />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/auditoria" element={<Auditoria />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;