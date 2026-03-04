import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function MainLayout() {
  // Estado opcional para controlar se o menu fecha ao clicar em um link
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      
      {/* 1. SIDEBAR DESKTOP */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* 2. ÁREA PRINCIPAL DA APLICAÇÃO */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* CABEÇALHO MOBILE (Visível apenas no mobile) */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-30 shadow-sm">
          
          <div className="flex items-center gap-3">
            {/* O BOTÃO DO MENU HAMBÚRGUER ESTÁ AQUI */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button 
                  className="p-2 -ml-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors flex items-center justify-center"
                  aria-label="Abrir menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r-0 bg-sidebar">
                <div onClick={() => setOpen(false)} className="h-full">
                   <AppSidebar />
                </div>
              </SheetContent>
            </Sheet>

            {/* Título do Cabeçalho Mobile */}
            <div className="font-heading font-bold text-lg tracking-tight text-foreground">
              Convergex
            </div>
          </div>
          
        </header>

        {/* CONTEÚDO DAS PÁGINAS (Dashboard, Estoque, etc) */}
        {/* A classe 'max-w-7xl mx-auto w-full' centraliza o conteúdo em telas grandes, 
            e os 'px-4 sm:px-6' dão o respiro correto nas laterais em telas pequenas. */}
        <main className="flex-1 overflow-x-hidden bg-muted/20">
          <div className="max-w-7xl mx-auto w-full p-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
        
      </div>
    </div>
  );
}