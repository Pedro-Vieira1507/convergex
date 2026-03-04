import { FileCheck, TrendingDown, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditoriaStats } from "@/lib/intelipost-service";

interface AuditoriaKPIsProps {
  stats: AuditoriaStats | null;
  isLoading: boolean;
}

export function AuditoriaKPIs({ stats, isLoading }: AuditoriaKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-card">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Total de Pedidos Auditados */}
      <Card className="shadow-card hover:shadow-card-md transition-shadow duration-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Pedidos Auditados
              </p>
              <p className="text-3xl font-heading font-semibold mt-1">
                {stats.totalOrders}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Total de fretes com CT-e processado
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <FileCheck className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Valor Total de Discrepância */}
      <Card className="shadow-card hover:shadow-card-md transition-shadow duration-200 border-destructive/30">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Valor Total de Discrepância
              </p>
              <p className="text-3xl font-heading font-semibold mt-1 text-destructive">
                {formatCurrency(stats.totalDiscrepancy)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Soma das cobranças acima do cotado
              </p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transportadora com Maior Divergência */}
      <Card className="shadow-card hover:shadow-card-md transition-shadow duration-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Maior Divergência
              </p>
              <p className="text-xl font-heading font-semibold mt-1 truncate max-w-[180px]" title={stats.carrierWithMostDivergence.name}>
                {stats.carrierWithMostDivergence.name}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {formatCurrency(stats.carrierWithMostDivergence.totalDivergence)} em {stats.carrierWithMostDivergence.orderCount} pedido(s)
              </p>
            </div>
            <div className="p-3 rounded-lg bg-warning/10 text-warning">
              <Truck className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
