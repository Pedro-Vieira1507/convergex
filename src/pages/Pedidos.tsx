import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog"; 
import { Calendar as CalendarIcon, Search, RefreshCw, Loader2, Package, Truck, DollarSign } from "lucide-react";

// Suas credenciais
const supabase = createClient(
  'https://foulnpmrfyuwvqppdrnt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWxucG1yZnl1d3ZxcHBkcm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDE1NjYsImV4cCI6MjA4NTA3NzU2Nn0.NX3r510aLr4CAROBdFV75VvVjbIz4aj9qEetsF6UQBU'
);

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Filtros
  const [buscaId, setBuscaId] = useState("");
  const [buscaData, setBuscaData] = useState("");

  // Estados do Modal de Detalhes
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Busca lista local
  const fetchLocalOrders = async () => {
    if (pedidos.length === 0) setLoading(true);
    const { data, error } = await supabase
      .from('pedidos_magento')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setPedidos(data || []);
    setLoading(false);
  };

  // Sincronização
  const handleSync = async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-magento-orders');
      if (error) throw error;
      await fetchLocalOrders();
      if (!silent) alert('Sincronização concluída!');
    } catch (err: any) {
      if (!silent) alert('Erro: ' + err.message);
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  // Busca detalhes ao clicar
  const handleOrderClick = async (incrementId: string) => {
    setSelectedOrderId(incrementId);
    setIsModalOpen(true);
    setLoadingDetails(true);
    setOrderDetails(null); 

    try {
      const { data, error } = await supabase.functions.invoke('get-order-details', {
        body: { orderId: incrementId }
      });

      if (error) throw error;
      setOrderDetails(data);
    } catch (err) {
      console.error("Erro ao buscar detalhes:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchLocalOrders();
    const intervalo = setInterval(() => handleSync(true), 60000);
    return () => clearInterval(intervalo);
  }, []);

  // Filtragem local
  const pedidosFiltrados = pedidos.filter(pedido => {
    const matchId = pedido.increment_id.includes(buscaId);
    const dataPedido = new Date(pedido.created_at).toISOString().split('T')[0];
    const matchData = buscaData ? dataPedido === buscaData : true;
    return matchId && matchData;
  });

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-6 text-stone-200">
      
      {/* Cabeçalho e Botões */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-100">
          Gerenciamento de Pedidos
        </h1>
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
           <span className="text-xs sm:text-sm text-stone-400 animate-pulse">
             {syncing ? 'Sincronizando...' : 'Auto-sync ativo'}
           </span>
           <Button onClick={() => handleSync(false)} disabled={syncing} className="bg-red-600 hover:bg-red-700 text-white shadow-sm h-9 sm:h-10 text-sm border-none">
             <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
             Sincronizar
           </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-stone-900 p-4 rounded-lg shadow-sm border border-stone-800 flex flex-col sm:flex-row gap-4 items-end w-full">
        <div className="w-full sm:w-1/3">
          <label className="text-sm font-medium text-stone-400 mb-1 block">Número do Pedido</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-500" />
            <Input 
              placeholder="Ex: 000040046" 
              className="pl-9 bg-stone-950 border-stone-800 text-stone-200 placeholder:text-stone-600 focus-visible:ring-red-500" 
              value={buscaId} 
              onChange={(e) => setBuscaId(e.target.value)} 
            />
          </div>
        </div>
        <div className="w-full sm:w-1/3">
          <label className="text-sm font-medium text-stone-400 mb-1 block">Data</label>
          <div className="relative">
             <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-500" />
             <Input 
               type="date" 
               className="pl-9 bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-red-500 [color-scheme:dark]" 
               value={buscaData} 
               onChange={(e) => setBuscaData(e.target.value)} 
             />
          </div>
        </div>
        <Button variant="outline" className="w-full sm:w-auto bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-white" onClick={() => { setBuscaId(''); setBuscaData(''); }}>
          Limpar Filtros
        </Button>
      </div>

      {/* Tabela Principal COM SCROLL HORIZONTAL (overflow-x-auto) */}
      <div className="rounded-md border border-stone-800 bg-stone-900 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full caption-bottom text-sm min-w-[600px]">
            <thead className="bg-stone-950 border-b border-stone-800">
              <tr>
                <th className="h-10 sm:h-12 px-4 text-left font-medium text-stone-400">Pedido</th>
                <th className="h-10 sm:h-12 px-4 text-left font-medium text-stone-400">Data</th>
                <th className="h-10 sm:h-12 px-4 text-left font-medium text-stone-400">Cliente</th>
                <th className="h-10 sm:h-12 px-4 text-left font-medium text-stone-400">Total</th>
                <th className="h-10 sm:h-12 px-4 text-center font-medium text-stone-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {loading && pedidos.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-stone-500">Carregando pedidos...</td></tr>
              ) : pedidosFiltrados.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-stone-500">Nenhum pedido encontrado.</td></tr>
              ) : pedidosFiltrados.map((pedido) => (
                <tr key={pedido.id} className="hover:bg-stone-800/50 transition-colors">
                  <td className="p-3 sm:p-4">
                    <button 
                      onClick={() => handleOrderClick(pedido.increment_id)}
                      className="font-bold text-red-500 hover:underline hover:text-red-400 flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                    >
                      #{pedido.increment_id}
                    </button>
                  </td>
                  <td className="p-3 sm:p-4 text-stone-400 whitespace-nowrap">
                    {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-3 sm:p-4 text-stone-300 truncate max-w-[200px]" title={`${pedido.customer_firstname} ${pedido.customer_lastname}`}>
                    {pedido.customer_firstname} {pedido.customer_lastname}
                  </td>
                  <td className="p-3 sm:p-4 font-medium text-stone-200 whitespace-nowrap">
                    {Number(pedido.grand_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="p-3 sm:p-4 text-center whitespace-nowrap">
                    <StatusBadge status={pedido.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL DE DETALHES --- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-stone-900 border-stone-800 text-stone-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-100">
              <Package className="h-5 w-5 text-red-500 flex-shrink-0" /> 
              Detalhes do Pedido <span className="text-red-500">#{selectedOrderId}</span>
            </DialogTitle>
            <DialogDescription className="text-stone-400">Dados atualizados em tempo real do Magento.</DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-red-500" />
              <p className="text-sm text-stone-500">Consultando API da Loja...</p>
            </div>
          ) : orderDetails ? (
            <div className="space-y-6 mt-2">
              
              {/* Bloco de Frete e Totais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-stone-950 p-3 sm:p-4 rounded-lg border border-stone-800 flex items-start gap-3">
                  <div className="bg-stone-900 p-2 rounded-full border border-stone-800 shadow-sm flex-shrink-0">
                    <Truck className="h-5 w-5 text-stone-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-stone-300">Entrega</h4>
                    <p className="text-xs sm:text-sm text-stone-500 mt-1 truncate" title={orderDetails.metodo_frete}>
                      {orderDetails.metodo_frete}
                    </p>
                    <p className="text-sm font-bold text-stone-200 mt-1">
                      Frete: {Number(orderDetails.frete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>

                <div className="bg-stone-950 p-3 sm:p-4 rounded-lg border border-stone-800 flex items-start gap-3">
                  <div className="bg-stone-900 p-2 rounded-full border border-stone-800 shadow-sm flex-shrink-0">
                    <DollarSign className="h-5 w-5 text-stone-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-stone-300">Total Geral</h4>
                    <p className="text-xl sm:text-2xl font-bold text-red-400 mt-1">
                      {Number(orderDetails.total_pedido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabela de Itens */}
              <div>
                <h4 className="font-semibold text-sm mb-3 text-stone-400">Itens Comprados ({orderDetails.itens?.length || 0})</h4>
                <div className="border border-stone-800 rounded-lg overflow-x-auto w-full custom-scrollbar">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-stone-950 text-stone-400 font-medium sticky top-0">
                      <tr>
                        <th className="px-3 py-2 sm:px-4 sm:py-3 text-left">Produto</th>
                        <th className="px-3 py-2 sm:px-4 sm:py-3 text-center">Qtd</th>
                        <th className="px-3 py-2 sm:px-4 sm:py-3 text-right">Preço Un.</th>
                        <th className="px-3 py-2 sm:px-4 sm:py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {orderDetails.itens?.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-stone-800/30">
                          <td className="px-3 py-2 sm:px-4 sm:py-3 max-w-[200px]">
                            <div className="font-medium text-stone-200 truncate" title={item.nome}>{item.nome}</div>
                            <div className="text-xs text-stone-500 truncate">SKU: {item.sku}</div>
                          </td>
                          <td className="px-3 py-2 sm:px-4 sm:py-3 text-center font-medium text-stone-300">{Number(item.qtd)}</td>
                          <td className="px-3 py-2 sm:px-4 sm:py-3 text-right text-stone-400 whitespace-nowrap">
                            {Number(item.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="px-3 py-2 sm:px-4 sm:py-3 text-right font-bold text-stone-200 whitespace-nowrap">
                            {(Number(item.preco) * Number(item.qtd)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-6 text-red-500 bg-red-950/20 rounded-lg border border-red-900/30">
              Não foi possível carregar os detalhes. Verifique a conexão com a loja.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-950/40 border-yellow-900/50", 
    processing: "text-blue-400 bg-blue-950/40 border-blue-900/50", 
    integrado: "text-indigo-400 bg-indigo-950/40 border-indigo-900/50", 
    complete: "text-green-400 bg-green-950/40 border-green-900/50", 
    faturado: "text-purple-400 bg-purple-950/40 border-purple-900/50", 
    closed: "text-stone-400 bg-stone-800 border-stone-700", 
    canceled: "text-red-400 bg-red-950/40 border-red-900/50" 
  };
  const normalized = status?.toLowerCase() || "";
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border uppercase tracking-wider ${styles[normalized] || "bg-stone-800 text-stone-400 border-stone-700"}`}>
      {status}
    </span>
  );
}