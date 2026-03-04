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
  Building2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge"; // Certifique-se de que este import existe

// 1. ADICIONAMOS A REGRA DE QUEM PODE VER O QUÊ
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", allowedRoles: ['admin', 'gerente'] },
  { icon: Package, label: "Estoque", path: "/estoque", allowedRoles: ['admin', 'gerente', 'operador'] },
  { icon: Truck, label: "Rastreio", path: "/rastreio", allowedRoles: ['admin', 'gerente', 'operador'] },
  { icon: ShoppingCart, label: "Pedidos Site", path: "/pedidos", allowedRoles: ['admin', 'gerente'] },
  { icon: Map, label: "WMS Logística", path: "/wms", allowedRoles: ['admin', 'gerente', 'operador'] },
  { icon: Settings, label: "Configurações", path: "/configuracoes", allowedRoles: ['admin'] },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  
  // Novos estados para guardar o Perfil e a Empresa
  const [empresaNome, setEmpresaNome] = useState("Carregando...");
  const [userRole, setUserRole] = useState<string | null>(null);

  // 2. BUSCAR O CARGO (ROLE) E A EMPRESA AO MESMO TEMPO
  useEffect(() => {
    async function fetchPerfilEEmpresa() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Vai à tabela de perfis buscar a role e traz junto o nome da empresa associada
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
        
        // Trata o retorno do Supabase (que pode vir como objeto ou array dependendo da relação)
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

  // 3. FILTRA O MENU COM BASE NA PERMISSÃO
  // Se ainda não carregou a role, não mostra nada para evitar "piscar" menus errados
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
      <div className="border-t border-stone-800/60 p-3 space-y-1 shrink-0 bg-stone-950">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-2 py-2 mb-2 bg-stone-900/50 rounded-lg border border-stone-800/50">
              <Building2 className="w-8 h-8 text-stone-400 flex-shrink-0 p-1 bg-stone-800 rounded-md" />
              <div className="flex flex-col overflow-hidden leading-tight w-full">
                <span className="text-sm font-bold text-stone-200 truncate" title={empresaNome}>
                  {empresaNome}
                </span>
                {/* 4. MOSTRA O CARGO DO UTILIZADOR */}
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
            </div>
            
            <Link 
              to="/conta" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-400 hover:bg-stone-800/50 hover:text-stone-200 transition-all duration-200"
            >
              <KeyRound className="w-5 h-5 flex-shrink-0" />
              <span>Alterar Senha</span>
            </Link>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-950/30 transition-all duration-200 w-full text-left"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span>Sair do Sistema</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Building2 className="w-8 h-8 text-stone-400 mb-2 mt-1 p-1.5 bg-stone-900 rounded-lg border border-stone-800" title={empresaNome} />
            
            <Link 
              to="/conta" 
              title="Alterar Senha"
              className="p-2.5 rounded-lg text-stone-400 hover:bg-stone-800/50 hover:text-stone-200 transition-all duration-200"
            >
              <KeyRound className="w-5 h-5" />
            </Link>

            <button 
              onClick={handleLogout}
              title="Sair do Sistema"
              className="p-2.5 rounded-lg text-red-500 hover:bg-red-950/30 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="h-px bg-stone-800/60 my-2 w-full" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-stone-500 hover:bg-stone-800/50 hover:text-stone-300 h-10"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  );
}