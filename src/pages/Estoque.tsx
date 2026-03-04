import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/utils"; 
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RefreshCw, Search, Package, Edit2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Função auxiliar para buscar credenciais
const getApiCredentials = () => {
  return {
    url: localStorage.getItem("onclick_base_url"),
    token: localStorage.getItem("onclick_api_token")
  };
};

export default function Estoque() {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  
  // Estados do Modal
  const [minStock, setMinStock] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Busca dados do ERP + Supabase
  const { data: products = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['onclick-products'],
    queryFn: async () => {
      const { url, token } = getApiCredentials();
      if (!url || !token) throw new Error("Credenciais não configuradas");

      // A. Busca o Estoque Real do ERP
      const { data: erpData, error } = await supabase.functions.invoke('onclick-proxy', {
        body: { action: 'GET_PRODUCTS' },
        headers: {
          'x-onclick-url': url,
          'x-onclick-token': token
        }
      });

      if (error) throw error;
      
      // B. Busca os Estoques Mínimos salvos no seu Supabase
      const { data: supaData } = await supabase
        .from('produtos_cache')
        .select('sku, qtyminstock');

      // Cria um dicionário para cruzar os dados rápido
      const minStockMap: Record<string, number> = {};
      if (supaData) {
        supaData.forEach((p: any) => {
          minStockMap[p.sku] = Number(p.qtyminstock) || 0;
        });
      }
      
      return Array.isArray(erpData) ? erpData.map((item: any) => ({
        id: item.sku, 
        sku: item.sku,
        nome: item.nome,
        estoque: Number(item.estoque),
        estoqueMinimo: minStockMap[item.sku] || 0, // Cruza com a info do Supabase
        parentSku: item.parent_sku || "0", 
        ultimaSync: new Date(item.ultima_atualizacao).toLocaleString("pt-BR")
      })) : [];
    },
    staleTime: 0,                
    refetchInterval: 5000,       
    refetchIntervalInBackground: true, 
    refetchOnWindowFocus: true 
  });

  const filteredProducts = products.filter((p: any) =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  // 2. Handler para abrir o Modal
  const handleEditStock = (product: any) => {
    setSelectedProduct(product);
    // Em vez de limpar, carrega o valor atual salvo no banco!
    setMinStock(product.estoqueMinimo > 0 ? product.estoqueMinimo.toString() : ""); 
    setIsDialogOpen(true);
  };

  // 3. Salvar o Estoque Mínimo via RPC
  const handleSave = async () => {
    if (!minStock || isNaN(Number(minStock))) {
      toast({ variant: "destructive", title: "Atenção", description: "Insira um valor numérico válido." });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('atualizar_estoque_minimo', {
        p_sku: selectedProduct.sku,
        p_qtyminstock: parseInt(minStock, 10)
      });

      if (error) throw error;

      toast({ title: "Sucesso", description: "Estoque mínimo atualizado com sucesso." });
      setIsDialogOpen(false);
      
      // Atualiza a tabela imediatamente após salvar
      refetch(); 
      
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Gestão de Estoque" description="Sincronizado com Onclick ERP">
        <Button onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", (isLoading || isRefetching) && "animate-spin")} />
          {isRefetching ? "Atualizando..." : "Atualizar Lista"}
        </Button>
      </PageHeader>

      <Card className="shadow-card mt-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Produtos ({products.length})
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
          ) : isError ? (
            <div className="text-center text-red-500 p-4">Erro ao carregar dados. Verifique as configurações.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Estoque Real</TableHead>
                  <TableHead className="text-center">SKU Pai</TableHead>
                  {/* Nova coluna na tabela para facilitar a visualização */}
                  <TableHead className="text-center">Estoque Mín.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product: any) => (
                  <TableRow key={product.id || product.sku}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.nome}</TableCell>
                    
                    {/* O estoque fica vermelho na tabela se estiver igual ou abaixo do mínimo */}
                    <TableCell className="text-center font-medium">
                      <span className={cn(product.estoqueMinimo > 0 && product.estoque <= product.estoqueMinimo && "text-red-600 font-bold")}>
                        {product.estoque}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      {product.parentSku === "0" || !product.parentSku ? "Não" : product.parentSku}
                    </TableCell>

                    {/* Exibe o mínimo na tela para consulta rápida */}
                    <TableCell className="text-center font-semibold text-slate-600">
                      {product.estoqueMinimo > 0 ? product.estoqueMinimo : "-"}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditStock(product)}>
                        <Edit2 className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Estoque Mínimo</DialogTitle>
            <DialogDescription>
              Configurando alerta de estoque para: <br/> 
              <span className="font-semibold text-slate-800">{selectedProduct?.nome}</span> (SKU: {selectedProduct?.sku})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="minStock">Estoque Mínimo</Label>
            <Input
              id="minStock"
              type="number"
              min="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="Ex: 10"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="relative w-44">
              <span className={cn("flex items-center gap-2 transition-opacity", isSaving ? "opacity-0" : "opacity-100")}>
                Salvar Estoque Mínimo
              </span>
              <span className={cn("absolute flex items-center gap-2 transition-opacity", isSaving ? "opacity-100" : "opacity-0")}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}