import { supabase } from "@/lib/utils"; 
import { format } from "date-fns";

export interface FreightOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  carrier: string;
  carrierCnpj: string;
  quotePrice: number;
  invoicePrice: number;
  difference: number;
  differencePercentage: number;
  status: "auditado" | "pendente" | "divergente";
  cteNumber?: string;
  invoiceNumber?: string;
  weight: number;
  destination: {
    city: string;
    state: string;
  };
}

export interface AuditoriaStats {
  totalOrders: number;
  totalDiscrepancy: number;
  carrierWithMostDivergence: {
    name: string;
    totalDivergence: number;
    orderCount: number;
  };
}

interface SyncAuditResponse {
  success: boolean;
  message?: string;
  syncedCount?: number;
  data?: {
    orders: FreightOrder[];
    stats: AuditoriaStats;
  };
  error?: string;
}

// Mock data para fallback
const mockOrders: FreightOrder[] = [
  {
    id: "1",
    orderNumber: "PED-MOCK-001",
    orderDate: new Date().toISOString(),
    carrier: "Exemplo Transportadora",
    carrierCnpj: "00.000.000/0001-00",
    quotePrice: 50.00,
    invoicePrice: 55.00,
    difference: 5.00,
    differencePercentage: 10,
    status: "divergente",
    weight: 1.5,
    destination: { city: "São Paulo", state: "SP" }
  }
];

export const intelipostService = {
  /**
   * Fetch orders - Carrega dados iniciais.
   */
  async fetchOrders(): Promise<FreightOrder[]> {
    return []; 
  },

  /**
   * Calcula estatísticas baseadas nos pedidos listados
   */
  calculateStats(orders: FreightOrder[]): AuditoriaStats {
    const totalDiscrepancy = orders
      .filter(o => o.difference > 0)
      .reduce((sum, o) => sum + o.difference, 0);
    
    const carrierDivergence = orders.reduce((acc, order) => {
      if (order.difference > 0) {
        if (!acc[order.carrier]) {
          acc[order.carrier] = { total: 0, count: 0 };
        }
        acc[order.carrier].total += order.difference;
        acc[order.carrier].count += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const carrierWithMost = Object.entries(carrierDivergence)
      .sort(([, a], [, b]) => b.total - a.total)[0];

    return {
      totalOrders: orders.length,
      totalDiscrepancy,
      carrierWithMostDivergence: carrierWithMost 
        ? {
            name: carrierWithMost[0],
            totalDivergence: carrierWithMost[1].total,
            orderCount: carrierWithMost[1].count
          }
        : { name: "-", totalDivergence: 0, orderCount: 0 }
    };
  },

  /**
   * Extrai lista única de transportadoras
   */
  getCarriers(orders: FreightOrder[]): string[] {
    return [...new Set(orders.map(o => o.carrier))].sort();
  },

  /**
   * Sincroniza com a API Intelipost via Edge Function (intelipost-audit)
   */
  async syncWithApi(dateFrom: Date, dateTo: Date, providerId: string): Promise<SyncAuditResponse> {
    try {
      const url = localStorage.getItem("intelipost_base_url");
      const key = localStorage.getItem("intelipost_api_key");

      if (!key) throw new Error("Chave de API não configurada.");
      
      // Validação Extra
      if (!providerId) throw new Error("ID da Transportadora é obrigatório.");

      const formattedStart = format(dateFrom, 'yyyy-MM-dd');
      const formattedEnd = format(dateTo, 'yyyy-MM-dd');

      console.log(`Sincronizando ID ${providerId} de ${formattedStart} até ${formattedEnd}`);

      const { data, error } = await supabase.functions.invoke('intelipost-audit', {
        body: { 
            startDate: formattedStart,
            endDate: formattedEnd,
            logisticProviderId: providerId 
        },
        headers: { 
            'x-intelipost-url': url || "", 
            'api-key': key 
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // 4. Mapeia o retorno da API
      const rawList = data.content || (Array.isArray(data) ? data : []);
      
      const mappedOrders: FreightOrder[] = rawList.map((item: any) => {
          const quote = Number(item.quote_price || 0);
          const invoice = Number(item.invoice_price || 0);
          const diff = invoice - quote;
          
          let status: "auditado" | "divergente" | "pendente" = "auditado";
          if (invoice === 0 && quote > 0) status = "pendente"; 
          else if (Math.abs(diff) > 0.05) status = "divergente";

          return {
              id: item.order_number || Math.random().toString(),
              orderNumber: item.order_number || "-",
              orderDate: item.created_iso || new Date().toISOString(),
              carrier: item.logistic_provider_name || "Desconhecido",
              carrierCnpj: item.logistic_provider_cnpj || "",
              quotePrice: quote,
              invoicePrice: invoice,
              difference: diff,
              differencePercentage: quote > 0 ? (diff / quote) * 100 : 0,
              status: status,
              cteNumber: item.cte_number,
              invoiceNumber: item.invoice_number,
              weight: Number(item.weight || 0),
              destination: {
                  city: item.destination_city || "",
                  state: item.destination_state || ""
              }
          };
      });

      return {
        success: true,
        syncedCount: mappedOrders.length,
        data: {
            orders: mappedOrders,
            stats: this.calculateStats(mappedOrders)
        }
      };

    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      
      return {
        success: false,
        error: error.message || "Falha na comunicação com a API"
      };
    }
  },

  async getShipmentDetails(orderId: string): Promise<FreightOrder | null> {
      return mockOrders.find(o => o.orderNumber === orderId) || null;
  }
};