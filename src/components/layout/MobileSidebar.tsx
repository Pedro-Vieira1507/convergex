import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./MobileSidebar"; // Importe o seu componente de Sidebar atual aqui

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="md:hidden p-2 text-gray-600 hover:text-gray-900">
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      {/* O side="left" faz o menu abrir da esquerda. Ajuste a cor de fundo (bg-slate-900) para combinar com a sua sidebar */}
      <SheetContent side="left" className="p-0 w-72 bg-[#1a202c] border-r-0">
        <Sidebar /> 
      </SheetContent>
    </Sheet>
  );
}