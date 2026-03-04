import { useState } from "react";
import { Calendar, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface AuditoriaFiltersState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  carrier: string;
  status: string;
}

interface AuditoriaFiltersProps {
  carriers: string[];
  filters: AuditoriaFiltersState;
  onFiltersChange: (filters: AuditoriaFiltersState) => void;
}

export function AuditoriaFilters({ carriers, filters, onFiltersChange }: AuditoriaFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClearFilters = () => {
    onFiltersChange({
      dateFrom: undefined,
      dateTo: undefined,
      carrier: "all",
      status: "all"
    });
  };

  const hasActiveFilters = 
    filters.dateFrom || 
    filters.dateTo || 
    (filters.carrier && filters.carrier !== "all") || 
    (filters.status && filters.status !== "all");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              Ativo
            </span>
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="gap-2 text-muted-foreground"
          >
            <X className="w-4 h-4" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-4 bg-muted/50 rounded-lg border">
          {/* Date From */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateFrom 
                    ? format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data Fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateTo 
                    ? format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Carrier */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transportadora</Label>
            <Select
              value={filters.carrier}
              onValueChange={(value) => onFiltersChange({ ...filters, carrier: value })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">Todas</SelectItem>
                {carriers.map((carrier) => (
                  <SelectItem key={carrier} value={carrier}>
                    {carrier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="auditado">Auditado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="divergente">Divergente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
