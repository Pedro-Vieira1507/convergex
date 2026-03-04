import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FreightOrder } from "@/lib/intelipost-service";

interface AuditoriaTableProps {
  orders: FreightOrder[];
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const getStatusConfig = (status: FreightOrder["status"]) => {
  switch (status) {
    case "auditado":
      return {
        label: "Auditado",
        icon: CheckCircle2,
        className: "bg-success/15 text-success border-success/30"
      };
    case "pendente":
      return {
        label: "Pendente",
        icon: Clock,
        className: "bg-warning/15 text-warning border-warning/30"
      };
    case "divergente":
      return {
        label: "Divergente",
        icon: AlertCircle,
        className: "bg-destructive/15 text-destructive border-destructive/30"
      };
  }
};

function OrderDetailDialog({ order }: { order: FreightOrder }) {
  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-heading">
          Detalhes do Pedido {order.orderNumber}
        </DialogTitle>
        <DialogDescription>
          Informações completas da auditoria de frete
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant="outline" className={cn("gap-1", statusConfig.className)}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Order Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Data do Pedido</p>
            <p className="font-medium">
              {format(new Date(order.orderDate), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Transportadora</p>
            <p className="font-medium">{order.carrier}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Destino</p>
            <p className="font-medium">
              {order.destination.city} - {order.destination.state}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Peso</p>
            <p className="font-medium">{order.weight} kg</p>
          </div>
          {order.cteNumber && (
            <div>
              <p className="text-muted-foreground">Número CT-e</p>
              <p className="font-medium">{order.cteNumber}</p>
            </div>
          )}
        </div>

        {/* Financial Details */}
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-medium text-sm">Comparativo Financeiro</h4>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Valor Cotado</p>
              <p className="text-lg font-semibold text-primary">
                {formatCurrency(order.quotePrice)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Valor CT-e</p>
              <p className="text-lg font-semibold">
                {order.invoicePrice > 0 ? formatCurrency(order.invoicePrice) : "-"}
              </p>
            </div>
            <div className={cn(
              "p-3 rounded-lg",
              order.difference > 0 
                ? "bg-destructive/10" 
                : order.difference < 0 
                  ? "bg-success/10" 
                  : "bg-muted/50"
            )}>
              <p className="text-xs text-muted-foreground">Diferença</p>
              <p className={cn(
                "text-lg font-semibold",
                order.difference > 0 
                  ? "text-destructive" 
                  : order.difference < 0 
                    ? "text-success" 
                    : "text-foreground"
              )}>
                {order.difference !== 0 
                  ? `${order.difference > 0 ? "+" : ""}${formatCurrency(order.difference)}`
                  : "-"
                }
              </p>
            </div>
          </div>

          {order.difference !== 0 && (
            <p className="text-xs text-muted-foreground">
              Variação de {order.differencePercentage.toFixed(2)}% em relação ao valor cotado
            </p>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

export function AuditoriaTable({ orders, isLoading }: AuditoriaTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Transportadora</TableHead>
              <TableHead className="text-right">Cotado</TableHead>
              <TableHead className="text-right">CT-e</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum pedido encontrado</h3>
        <p className="text-muted-foreground">
          Tente ajustar os filtros ou sincronizar com a API para carregar novos dados.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Pedido</TableHead>
            <TableHead className="font-semibold">Data</TableHead>
            <TableHead className="font-semibold">Transportadora</TableHead>
            <TableHead className="text-right font-semibold">Cotado</TableHead>
            <TableHead className="text-right font-semibold">CT-e</TableHead>
            <TableHead className="text-right font-semibold">Diferença</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const StatusIcon = statusConfig.icon;

            return (
              <TableRow key={order.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  {order.orderNumber}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(order.orderDate), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <span className="truncate max-w-[150px] block" title={order.carrier}>
                    {order.carrier}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(order.quotePrice)}
                </TableCell>
                <TableCell className="text-right">
                  {order.invoicePrice > 0 
                    ? formatCurrency(order.invoicePrice) 
                    : <span className="text-muted-foreground">-</span>
                  }
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "font-semibold",
                      order.difference > 0 && "text-destructive",
                      order.difference < 0 && "text-success",
                      order.difference === 0 && "text-muted-foreground"
                    )}
                  >
                    {order.difference !== 0 ? (
                      <>
                        {order.difference > 0 ? "+" : ""}
                        {formatCurrency(order.difference)}
                      </>
                    ) : (
                      "-"
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("gap-1", statusConfig.className)}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <OrderDetailDialog order={order} />
                  </Dialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
