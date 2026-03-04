import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Truck,
  Map,
  LogOut,
  KeyRound,
  Building2,
  FileSearch // 1. Ícone adicionado para a Auditoria
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

// 2. ATUALIZAMOS A LISTA DE MENUS (Adicionando Auditoria de Fretes após Rastreio)
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", allowedRoles: ['admin', 'gerente'] },
  { icon: Package, label: "Estoque", path: "/estoque", allowedRoles: ['admin', 'gerente', 'operador'] },
  { icon: Truck, label: "Rastreio", path: "/rastreio", allowedRoles: ['admin', 'gerente', 'operador'] },
  { icon: FileSearch, label: "Auditoria de Fretes", path: "/auditoria", allowedRoles: ['admin', 'gerente'] }, // <- NOVO MENU
  { icon: ShoppingCart, label: "Pedidos Site", path: "/pedidos", allowedRoles: ['admin', 'gerente'] },
  { icon: Map, label: "WMS Logística", path: "/wms", allowedRoles: ['admin', 'gerente', 'operador'] },
  { icon: Settings, label: "Configurações", path: "/configuracoes", allowedRoles: ['admin'] },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  
  // Estados para guardar o Perfil e a Empresa
  const [empresaNome, setEmpresaNome] = useState("Carregando...");
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Controla a visibilidade do menu do utilizador
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // BUSCAR O CARGO (ROLE) E A EMPRESA AO MESMO TEMPO
  useEffect(() => {
    async function fetchPerfilEEmpresa() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("perfis")
        .select(`
          role,
          empresas ( nome )
        `)
        .eq("id", user.id)
        .single();

      if (data && !error) {
        setUserRole(data.role);
        
        const nomeDaEmpresa = Array.isArray(data.empresas) 
          ? data.empresas[0]?.nome 
          : (data.empresas as any)?.nome;
          
        setEmpresaNome(nomeDaEmpresa || "Minha Empresa");
      }
    }
    
    fetchPerfilEEmpresa();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // FILTRA O MENU COM BASE NA PERMISSÃO
  const filteredNavItems = navItems.filter(item => 
    userRole && item.allowedRoles.includes(userRole)
  );

  return (
    <aside 
      className={cn(
        "flex bg-stone-950 text-stone-300 flex-col border-r border-stone-800/60 transition-all duration-300 h-[100dvh] sticky top-0 z-50",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand - Logo ConvergeX */}
      <div className="border-b border-stone-800/60 flex items-center justify-center w-full h-24 overflow-hidden bg-black/20 shrink-0">
        {!collapsed ? (
          <img 
            src="/logo.png" 
            alt="ConvergeX" 
            className="w-full h-full object-cover" 
            fetchpriority="high"
          />
        ) : (
          <img 
            src="/logo.png" 
            alt="ConvergeX" 
            className="h-10 w-10 object-cover rounded-md" 
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-hidden">
        {!collapsed && (
          <span className="text-xs uppercase text-stone-500 font-bold px-3 py-2 block mb-2 tracking-wider">
            Menu Principal
          </span>
        )}
        
        {/* RENDERIZA APENAS OS MENUS PERMITIDOS */}
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-200",
                isActive 
                  ? "bg-stone-900 text-stone-100 border-l-2 border-red-600 shadow-sm" 
                  : "text-stone-400 hover:bg-stone-800/40 hover:text-stone-200 border-l-2 border-transparent"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-colors",
                isActive ? "text-red-500" : "text-stone-400"
              )} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé Compacto */}
      <div className="border-t border-stone-800/60 p-3 space-y-1 shrink-0 bg-stone-950 flex flex-col justify-end">
        
        {/* Menu expansível (Visível apenas se isUserMenuOpen for true) */}
        {isUserMenuOpen && (
          <div className={cn(
            "flex flex-col gap-1 mb-2 animate-in slide-in-from-bottom-2 fade-in-50",
            collapsed ? "items-center" : "px-1"
          )}>
            <Link 
              to="/conta" 
              title={collapsed ? "Alterar Senha" : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium text-stone-400 hover:bg-stone-800/50 hover:text-stone-200 transition-all duration-200",
                collapsed ? "p-2.5 justify-center w-full" : "gap-3 px-3 py-2.5"
              )}
            >
              <KeyRound className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Alterar Senha</span>}
            </Link>

            <button 
              onClick={handleLogout}
              title={collapsed ? "Sair do Sistema" : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium text-red-500 hover:bg-red-950/30 transition-all duration-200 text-left",
                collapsed ? "p-2.5 justify-center w-full" : "gap-3 px-3 py-2.5 w-full"
              )}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Sair do Sistema</span>}
            </button>
          </div>
        )}

        {/* Box da Empresa (Agora atua como um botão para expandir/recolher o menu) */}
        <div 
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={cn(
            "cursor-pointer bg-stone-900/50 rounded-lg border border-stone-800/50 hover:bg-stone-800/80 transition-colors flex items-center select-none",
            collapsed ? "p-1.5 justify-center mb-2 mx-auto w-10 h-10 mt-1" : "gap-3 px-2 py-2 mb-2 w-full text-left"
          )}
          title={collapsed ? empresaNome : undefined}
        >
          <Building2 className={cn("text-stone-400 flex-shrink-0", collapsed ? "w-6 h-6" : "w-8 h-8 p-1 bg-stone-800 rounded-md")} />
          
          {!collapsed && (
            <div className="flex flex-col overflow-hidden leading-tight w-full">
              <span className="text-sm font-bold text-stone-200 truncate" title={empresaNome}>
                {empresaNome}
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                  Minha Conta
                </span>
                {userRole && (
                  <Badge variant="outline" className={cn(
                    "text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider",
                    userRole === 'admin' ? "bg-red-950/40 text-red-400 border-red-900/50" : 
                    userRole === 'gerente' ? "bg-blue-950/40 text-blue-400 border-blue-900/50" : 
                    "bg-stone-800 text-stone-400 border-stone-700"
                  )}>
                    {userRole}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-stone-800/60 my-2 w-full" />

        {/* Botão de Fechar/Abrir o Sidebar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCollapsed(!collapsed);
            setIsUserMenuOpen(false); // Recolhe o menu de usuário automaticamente ao mudar o sidebar
          }}
          className="w-full justify-center text-stone-500 hover:bg-stone-800/50 hover:text-stone-300 h-10"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  );
}