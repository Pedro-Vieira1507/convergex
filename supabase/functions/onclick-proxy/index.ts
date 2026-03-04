import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-onclick-url, x-onclick-token, x-supabase-client-platform, x-supabase-client-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action } = await req.json()
    
    const rawKey = req.headers.get('x-onclick-token')
    const onclickKey = rawKey ? rawKey.trim() : null
    const baseUrl = "http://api.onclick.com.br:8085"
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const headersOnclick = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'secretKey': onclickKey,
      'company': '2',
      'businessUnit': '9'
    }

    if (action === 'GET_PRODUCTS') {
        let stockMap = new Map(); 
        let skusToProcess = new Set<string>();

        // 1. LEITURA DA FILA DE ESTOQUE (Limitado a 100 itens da Onclick)
        try {
            const resp = await fetch(`${baseUrl}/api/v2/Stock?limit=100`, { method: 'GET', headers: headersOnclick });
            if (resp.ok) {
                const json = await resp.json();
                if (json.stocks) {
                    json.stocks.forEach((item: any) => {
                        const cleanSku = item.sku.toString().trim();
                        stockMap.set(cleanSku, item.stock);
                        skusToProcess.add(cleanSku);
                    });
                }
            }
        } catch (e) { console.error("Erro ao ler estoque da Onclick:", e); }

        // 2. BUSCA ITENS SEM NOME OU SEM PAI NO BANCO (Autocorreção)
        const { data: missingInfo } = await supabase
            .from('produtos_cache')
            .select('sku')
            .or('nome.eq.Produto Sincronizado,parent_sku.eq.0,parent_sku.is.null')
            .limit(15); // Limite menor para evitar timeout, já que faremos mais chamadas por item

        if (missingInfo) {
            missingInfo.forEach((p: any) => {
                if(p.sku) skusToProcess.add(p.sku.toString().trim());
            });
        }

        // 3. PROCESSAMENTO (API -> BANCO)
        if (skusToProcess.size > 0) {
            const itemsToUpsert = await Promise.all(Array.from(skusToProcess).map(async (sku) => {
                let nomeFinal = "Produto Sincronizado";
                let parentSku = "0"; 
                let estoqueCalculado = 0;

                // Consulta estado atual no banco
                const { data: current } = await supabase.from('produtos_cache').select('*').eq('sku', sku).single();
                
                // BUSCA NOME REAL NA API (Se necessário)
                if (!current?.nome || current.nome === "Produto Sincronizado") {
                    try {
                        // Novo endpoint conforme documentação enviada
                        const urlProd = `${baseUrl}/api/v2/Product/GetBySku/${encodeURIComponent(sku)}`;
                        const respProd = await fetch(urlProd, { method: 'GET', headers: headersOnclick });
                        
                        if (respProd.ok) {
                            const jsonProd = await respProd.json();
                            // Acessando o primeiro item do array de produtos
                            if (jsonProd.success && jsonProd.products && jsonProd.products.length > 0) {
                                nomeFinal = jsonProd.products[0].productName || nomeFinal;
                            }
                        }
                    } catch (e) { console.error(`Erro ao buscar dados do SKU ${sku}:`, e); }
                } else {
                    nomeFinal = current.nome;
                }

                // Lógica de Estoque
                if (stockMap.has(sku)) {
                    estoqueCalculado = (stockMap.get(sku) ?? 0) - 1000;
                } else {
                    estoqueCalculado = current?.estoque || 0;
                }

                // Lógica de Parent Sku (Mantém se já tiver no banco ou busca na API)
                if (current?.parent_sku && current.parent_sku !== "0") {
                    parentSku = current.parent_sku;
                } else {
                    try {
                        const urlParent = `${baseUrl}/api/v2/ParentSku?sku=${encodeURIComponent(sku)}`;
                        const respParent = await fetch(urlParent, { method: 'GET', headers: headersOnclick });
                        if (respParent.ok) {
                            const jsonParent = await respParent.json();
                            if (jsonParent.success && jsonParent.parentSku) {
                                parentSku = jsonParent.parentSku;
                            }
                        }
                    } catch (err) { console.error("Erro ParentSku:", err); }
                }

                return {
                    sku: sku,
                    nome: nomeFinal,
                    estoque: estoqueCalculado,
                    parent_sku: parentSku,
                    ultima_atualizacao: new Date().toISOString()
                };
            }));

            // Upsert no Supabase
            await supabase.from('produtos_cache').upsert(itemsToUpsert, { onConflict: 'sku' });
        }

        // 4. RETORNO DA LISTA COMPLETA
        const { data: fullList } = await supabase
            .from('produtos_cache')
            .select('*')
            .order('nome', { ascending: true });

        return new Response(JSON.stringify(fullList), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ msg: "Ação não encontrada" }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})