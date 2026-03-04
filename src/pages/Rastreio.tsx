import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, ShoppingCart, Truck, FileText, Loader2, RefreshCw, MapPin, DollarSign, X, Eye, Package, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

// --- HELPERS ---

const getStatusBadgeColor = (status: string) => {
  const s = status?.toUpperCase() || "";
  if (s === "DELIVERED") return "bg-green-950/40 text-green-400 border-green-900/50 hover:bg-green-900/50";
  if (s === "SHIPPED" || s === "IN_TRANSIT") return "bg-blue-950/40 text-blue-400 border-blue-900/50 hover:bg-blue-900/50";
  if (s === "READY_FOR_SHIPPING") return "bg-yellow-950/40 text-yellow-400 border-yellow-900/50 hover:bg-yellow-900/50";
  if (s === "CANCELED") return "bg-red-950/40 text-red-400 border-red-900/50 hover:bg-red-900/50";
  return "bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700";
};

const formatDateTime = (isoDate: string | number) => {
    if (!isoDate) return "-";
    const date = new Date(isoDate);
    return date.toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: '2-digit', 
        hour: '2-digit', minute: '2-digit' 
    });
};

const getInvoiceNumber = (pedido: any) => {
    if (pedido.invoice_number) return pedido.invoice_number;
    if (pedido.shipment_order_volume_array && Array.isArray(pedido.shipment_order_volume_array)) {
        const volume = pedido.shipment_order_volume_array[0];
        if (volume && volume.shipment_order_volume_invoice) {
            return volume.shipment_order_volume_invoice.invoice_number;
        }
    }
    return null;
};

// --- COMPONENTES ---

// Modal de Detalhes do Produto
const ProductDetailsModal = ({ orderNumber, onClose }: { orderNumber: string, onClose: () => void }) => {
    const { data: details, isLoading } = useQuery({
        queryKey: ['order-details', orderNumber],
        queryFn: async () => {
            const url = localStorage.getItem("intelipost_base_url");
            const key = localStorage.getItem("intelipost_api_key");
            
            const { data, error } = await supabase.functions.invoke('intelipost-proxy', {
                body: { action: 'GET_SHIPMENT_DETAILS', order_number: orderNumber },
                headers: { 'x-intelipost-url': url || "", 'api-key': key || "" }
            });

            if (error) throw error;
            return data.content; 
        }
    });

    const products: any[] = [];
    if (details?.shipment_order_volume_array) {
        details.shipment_order_volume_array.forEach((vol: any) => {
            if (vol.products && Array.isArray(vol.products)) {
                products.push(...vol.products);
            }
        });
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-stone-900 border-stone-800 text-stone-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-stone-100">
                        <Package className="w-5 h-5 text-red-500" />
                        Detalhes do Pedido: <span className="text-red-500">{orderNumber}</span>
                    </DialogTitle>
                    <DialogDescription className="text-stone-400">
                        Visão detalhada dos produtos e dados de entrega.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                        <p className="text-sm text-stone-400 mt-2">Buscando produtos...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-stone-950 border border-stone-800 p-4 rounded-lg">
                            <div>
                                <span className="font-semibold text-stone-400 block">Número de Venda (Sales):</span>
                                <span className="font-mono text-stone-200">{details?.sales_order_number || "-"}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-stone-400 block">Método de Entrega:</span>
                                <span className="text-stone-200">{details?.delivery_method_name}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-stone-400 block">Destinatário:</span>
                                <span className="text-stone-200">{details?.end_customer?.first_name} {details?.end_customer?.last_name}</span>
                            </div>
                             <div>
                                <span className="font-semibold text-stone-400 block">Rastreio:</span>
                                {details?.tracking_url ? (
                                    <a href={details.tracking_url} target="_blank" rel="noreferrer" className="text-red-500 hover:text-red-400 underline flex items-center gap-1 transition-colors">
                                        Link Externo <ExternalLink className="w-3 h-3" />
                                    </a>
                                ) : <span className="text-stone-500">-</span>}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-stone-300">
                                <ShoppingCart className="w-4 h-4 text-stone-400" /> Produtos ({products.length})
                            </h4>
                            <div className="border border-stone-800 rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-stone-950 border-stone-800 hover:bg-stone-950">
                                            <TableHead className="text-stone-400">SKU</TableHead>
                                            <TableHead className="text-stone-400">Descrição</TableHead>
                                            <TableHead className="text-right text-stone-400">Qtd</TableHead>
                                            <TableHead className="text-right text-stone-400">Preço</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y divide-stone-800">
                                        {products.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-4 text-stone-500">
                                                    Nenhum produto listado neste pedido.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            products.map((prod: any, idx: number) => (
                                                <TableRow key={idx} className="hover:bg-stone-800/30 border-stone-800">
                                                    <TableCell className="font-mono text-xs text-stone-400">{prod.sku}</TableCell>
                                                    <TableCell className="font-medium text-sm text-stone-200">{prod.description}</TableCell>
                                                    <TableCell className="text-right text-stone-300">{prod.quantity}</TableCell>
                                                    <TableCell className="text-right font-medium text-stone-200">
                                                        {Number(prod.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button onClick={onClose} variant="outline" className="bg-stone-950 border-stone-700 text-stone-200 hover:bg-stone-800 hover:text-white">Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Modal de Rastreio
const TrackingModal = ({ order, onClose }: { order: any, onClose: () => void }) => {
    if (!order) return null;

    let history: any[] = [];
    if (order.shipment_order_volume_array && Array.isArray(order.shipment_order_volume_array)) {
        order.shipment_order_volume_array.forEach((vol: any) => {
            if (vol.shipment_order_volume_state_history_array) {
                const events = vol.shipment_order_volume_state_history_array.map((evt: any) => ({
                    ...evt,
                    volume_number: vol.shipment_order_volume_number
                }));
                history = [...history, ...events];
            }
        });
    }

    history.sort((a, b) => {
        const dateA = new Date(a.event_date_iso || a.created_iso).getTime();
        const dateB = new Date(b.event_date_iso || b.created_iso).getTime();
        return dateB - dateA;
    });

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-stone-900 border-stone-800 text-stone-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-stone-100">
                         <Truck className="w-5 h-5 text-red-500" /> Rastreamento do Pedido
                    </DialogTitle>
                    <DialogDescription className="text-stone-400">
                        Histórico de movimentação da transportadora.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-2">
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-stone-500">
                            Nenhum histórico disponível para este pedido.
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-stone-700 ml-3 space-y-8">
                            {history.map((event: any, idx: number) => (
                                <div key={idx} className="relative pl-8">
                                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-stone-900 ${idx === 0 ? 'bg-red-500 ring-4 ring-red-500/20' : 'bg-stone-600'}`}></div>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                        <div>
                                            <p className={`font-semibold text-sm ${idx === 0 ? 'text-red-400' : 'text-stone-300'}`}>
                                                {event.shipment_order_volume_state_localized || event.shipment_volume_micro_state?.name || "Status desconhecido"}
                                            </p>
                                            {event.shipment_volume_micro_state?.description && (
                                                <p className="text-xs text-stone-500 mt-1 max-w-md">
                                                    {event.shipment_volume_micro_state.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-mono text-white bg-stone-950 border border-stone-800 px-2 py-1 rounded">
                                                {formatDateTime(event.event_date_iso || event.created_iso)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={onClose} variant="outline" className="bg-stone-950 border-stone-700 text-stone-200 hover:bg-stone-800 hover:text-white">Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// --- PÁGINA PRINCIPAL ---

export default function Pedidos() {
  const [searchNf, setSearchNf] = useState(""); 
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<any>(null);
  const [selectedProductOrder, setSelectedProductOrder] = useState<string | null>(null);
  
  const { toast } = useToast();

  const { data: rawData = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['intelipost-pedidos', activeSearch], 
    queryFn: async () => {
      const url = localStorage.getItem("intelipost_base_url");
      const key = localStorage.getItem("intelipost_api_key");

      if (!key) return [];

      const action = activeSearch ? 'SEARCH_BY_INVOICE' : 'GET_SHIPMENTS';
      const bodyPayload = activeSearch ? { action, invoice_number: activeSearch } : { action };

      const { data, error } = await supabase.functions.invoke('intelipost-proxy', {
        body: bodyPayload,
        headers: { 'x-intelipost-url': url || "", 'api-key': key || "" }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.content?.shipments || [];
    },
    refetchInterval: activeSearch ? false : 30000, 
    retry: false
  });

  const pedidos = Array.isArray(rawData) ? rawData : [];

  const handleSearch = () => {
    if (!searchNf.trim()) {
        toast({ title: "Digite o número da Nota Fiscal" });
        return;
    }
    setActiveSearch(searchNf.trim());
  };

  const clearSearch = () => {
    setSearchNf("");
    setActiveSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="space-y-6 text-stone-200">
      <PageHeader title="Gestão de Entregas" description="Monitoramento via Intelipost (TMS)">
        <Button 
          onClick={() => refetch()} 
          disabled={isRefetching || isLoading} 
          className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg transition-all hover:shadow-red-900/20"
        >
            <span className="mr-2">
                {isRefetching ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            </span>
            {isRefetching ? "Atualizando..." : "Atualizar Lista"}
        </Button>
      </PageHeader>

      {selectedTrackingOrder && (
          <TrackingModal order={selectedTrackingOrder} onClose={() => setSelectedTrackingOrder(null)} />
      )}

      {selectedProductOrder && (
          <ProductDetailsModal orderNumber={selectedProductOrder} onClose={() => setSelectedProductOrder(null)} />
      )}

      <Card className="bg-stone-900 border-stone-800 shadow-sm">
        <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/3 space-y-2">
                    <label className="text-sm font-medium leading-none text-stone-400">
                        Consultar Nota Fiscal (API)
                    </label>
                    <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                        <Input 
                            placeholder="Digite o número da NF..." 
                            value={searchNf}
                            onChange={(e) => setSearchNf(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-9 pr-20 bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-red-500"
                        />
                        {activeSearch && (
                            <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-red-500 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                
                <Button 
                    onClick={handleSearch} 
                    disabled={isLoading} 
                    className="mb-[2px] bg-red-600 hover:bg-red-700 text-white border-none shadow-md transition-all hover:shadow-red-900/20"
                >
                    <span className="mr-2 flex items-center">
                        {isLoading ? (
                            <Loader2 className="animate-spin w-4 h-4 text-white" />
                        ) : (
                            <SearchIcon className="w-4 h-4" />
                        )}
                    </span>
                    Buscar na Intelipost
                </Button>
                
                {activeSearch && (
                    <div className="mb-2 text-sm text-stone-400">
                        Filtro ativo: <strong className="text-stone-200">{activeSearch}</strong>
                        <span className="mx-2">•</span>
                        <span className="cursor-pointer text-red-500 hover:text-red-400 underline transition-colors" onClick={clearSearch}>Limpar</span>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-stone-900 border-stone-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-stone-400">Total Visualizado</CardTitle>
            <ShoppingCart className="h-4 w-4 text-stone-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-stone-100">{pedidos.length}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-stone-900 border-stone-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-stone-400">Status Recente</CardTitle>
            <Truck className="h-4 w-4 text-stone-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate text-stone-100">
              {pedidos.length > 0 ? pedidos[0]?.shipment_order_status : "-"}
            </div>
            <p className="text-xs text-stone-500 mt-1">Última atualização</p>
          </CardContent>
        </Card>

        <Card className="bg-stone-900 border-stone-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-stone-400">Frete Total (Lista)</CardTitle>
            <DollarSign className="h-4 w-4 text-stone-500" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold text-stone-100">
               {pedidos.reduce((acc: number, item: any) => acc + (item.customer_shipping_costs || 0), 0)
                .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-stone-900 border-stone-800 shadow-sm">
        <CardHeader className="border-b border-stone-800 bg-stone-950/50">
            <div className="flex items-center justify-between">
                <CardTitle className="text-stone-100">{activeSearch ? `Resultados da busca: ${activeSearch}` : "Últimos Pedidos"}</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-4">
                    <Loader2 className="animate-spin w-8 h-8 text-red-500" />
                    <p className="text-sm text-stone-500">Consultando Intelipost...</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-stone-950">
                            <TableRow className="border-stone-800 hover:bg-transparent">
                                <TableHead className="text-stone-400 font-semibold">Pedido</TableHead>
                                <TableHead className="text-stone-400 font-semibold">Emissão</TableHead>
                                <TableHead className="text-stone-400 font-semibold">Cliente</TableHead>
                                <TableHead className="text-stone-400 font-semibold">NF</TableHead>
                                <TableHead className="text-stone-400 font-semibold">Transportadora</TableHead>
                                <TableHead className="text-center text-stone-400 font-semibold">Rastreio</TableHead>
                                <TableHead className="text-right text-stone-400 font-semibold">Frete</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-stone-800">
                            {pedidos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-32 text-stone-500">
                                        {activeSearch 
                                            ? "Nenhum pedido encontrado com esta Nota Fiscal." 
                                            : "Nenhum pedido recente encontrado."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pedidos.map((pedido: any, index: number) => {
                                    const uniqueKey = pedido.order_number 
                                        ? `${pedido.order_number}-${index}` 
                                        : `pedido-${index}`;
                                    
                                    const notaFiscal = getInvoiceNumber(pedido);

                                    return (
                                    <TableRow key={uniqueKey} className="hover:bg-stone-800/30 border-stone-800 transition-colors">
                                        <TableCell className="font-medium">
                                            {/* CLICÁVEL: Abre Modal de Produtos */}
                                            <button 
                                                onClick={() => setSelectedProductOrder(pedido.order_number)}
                                                className="font-mono text-red-500 hover:text-red-400 hover:underline flex flex-col items-start transition-colors"
                                            >
                                                {pedido.order_number}
                                                <span className="text-[10px] text-stone-500 no-underline mt-0.5">
                                                    Vol: {pedido.shipment_order_volume_number || 1}
                                                </span>
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-stone-300">
                                            {pedido.created ? new Date(pedido.created).toLocaleDateString('pt-BR') : "-"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col max-w-[180px]">
                                                <span className="font-medium truncate text-stone-200" title={pedido.end_customer?.first_name}>
                                                    {pedido.end_customer?.first_name} {pedido.end_customer?.last_name}
                                                </span>
                                                <span className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                                                    <MapPin className="w-3 h-3" />
                                                    {pedido.end_customer?.city}/{pedido.end_customer?.state}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {notaFiscal ? (
                                                <Badge variant="outline" className="font-mono bg-stone-950 border-stone-700 text-stone-300">
                                                    {notaFiscal}
                                                </Badge>
                                            ) : <span className="text-stone-600">-</span>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-stone-200">{pedido.logistic_provider_name || "N/A"}</span>
                                                <span className="text-xs text-stone-500 truncate max-w-[150px] mt-0.5" title={pedido.delivery_method_name}>
                                                    {pedido.delivery_method_name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        
                                        <TableCell className="text-center">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className={cn("h-7 px-3 text-[10px] font-bold tracking-wider transition-colors", getStatusBadgeColor(pedido.shipment_order_status))}
                                                onClick={() => setSelectedTrackingOrder(pedido)}
                                            >
                                                <Eye className="w-3 h-3 mr-1" /> 
                                                {pedido.shipment_order_status || "VER STATUS"}
                                            </Button>
                                        </TableCell>

                                        <TableCell className="text-right font-medium text-stone-200">
                                            {pedido.customer_shipping_costs !== undefined && pedido.customer_shipping_costs !== null
                                                ? Number(pedido.customer_shipping_costs).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : "-"}
                                        </TableCell>
                                    </TableRow>
                                )})
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}