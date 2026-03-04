import { cn } from "@/lib/utils";

type StatusType = "pendente" | "faturado" | "enviado" | "entregue" | "cancelado";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-warning/15 text-warning border-warning/30",
  },
  faturado: {
    label: "Faturado",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  enviado: {
    label: "Enviado",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  entregue: {
    label: "Entregue",
    className: "bg-success/15 text-success border-success/30",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
