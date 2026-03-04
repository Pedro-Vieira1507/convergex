import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

const variantStyles = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatsCard({ title, value, icon: Icon, trend, variant = "default" }: StatsCardProps) {
  return (
    <Card className="shadow-card hover:shadow-card-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground ">{title}</p>
            <p className="text-2xl font-heading font-semibold mt-1">{value}</p>
            {trend && (
              <p className={cn(
                "text-xs mt-2 font-medium",
                trend.isPositive ? "text-success" : "text-destructive invisible"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}% em relação ao mês anterior
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-lg", variantStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
