import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_URL = 'https://api.intelipost.com.br/api/v1'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autorizado. Token JWT ausente.')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Utilizador não autenticado.')

    const { data: config } = await supabaseAdmin
      .from('configuracoes_empresa')
      .select('intelipost_token')
      .eq('user_id', user.id)
      .single()

    const { data: perfil } = await supabaseAdmin.from('perfis').select('empresa_id').eq('id', user.id).single()
    const empresaId = perfil?.empresa_id || user.id;

    if (!config || !config.intelipost_token) {
        throw new Error('Chave da Intelipost não configurada.')
    }

    const INTELIPOST_API_KEY = config.intelipost_token;

    const { transportadora, dataInicial, dataFinal } = await req.json()
    if (!transportadora || !dataInicial || !dataFinal) {
        throw new Error('Parâmetros em falta.')
    }

    const [anoIni, mesIni, diaIni] = dataInicial.split('-').map(Number)
    const start = new Date(anoIni, mesIni - 1, diaIni, 0, 0, 0)
    const [anoFim, mesFim, diaFim] = dataFinal.split('-').map(Number)
    const end = new Date(anoFim, mesFim - 1, diaFim, 23, 59, 59, 999)

    const bucketName = 'arquivos-edi'
    const folderPath = `${empresaId}/${transportadora.toLowerCase()}`

    const { data: files, error: listError } = await supabaseAdmin.storage.from(bucketName).list(folderPath, { limit: 1000 })
    if (listError) throw listError

    const arquivosValidos = files.filter(file => {
        const fileDate = new Date(file.created_at)
        const isDateValid = fileDate >= start && fileDate <= end
        
        // 🎯 AJUSTE 1: A Jamef agora aceita formalmente os arquivos .xml
        const isTypeValid = 
            (transportadora === 'Braspress' && (file.name.toLowerCase().endsWith('.xml'))) ||
            (transportadora === 'Jamef' && (file.name.toLowerCase().endsWith('.xml') || file.name.toLowerCase().endsWith('.txt') || file.name.toUpperCase().includes('NOTFIS') || file.name.toUpperCase().includes('CONEMB'))) ||
            (transportadora === 'Movvi' && (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.xlsx')));
        
        return isDateValid && isTypeValid && file.name !== '.emptyFolderPlaceholder'
    })

    if (arquivosValidos.length === 0) {
        return new Response(JSON.stringify({ resultados: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const resultadosAninhados = await Promise.all(arquivosValidos.map(async (file, index) => {
        const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage.from(bucketName).download(`${folderPath}/${file.name}`)
        if (downloadError || !fileBlob) return []

        let itensDoArquivo: any[] = []

        const isExcel = file.name.toLowerCase().endsWith('.xlsx')
        let text = ""
        let arrayBuffer: ArrayBuffer | null = null

        if (isExcel) {
            arrayBuffer = await fileBlob.arrayBuffer()
        } else {
            text = await fileBlob.text()
        }

        // ================= BRASPRESS =================
        if (transportadora === 'Braspress') {
            let freteReal = 0, chaveNFe = "N/A", numeroCTe = file.name, valorCarga = 0
            
            const vTPrestMatch = text.match(/<vTPrest>([^<]+)<\/vTPrest>/)
            if (vTPrestMatch) freteReal = parseFloat(vTPrestMatch[1])
            const nCTMatch = text.match(/<nCT>([^<]+)<\/nCT>/)
            if (nCTMatch) numeroCTe = `CTe-${nCTMatch[1]}`
            const vCargaMatch = text.match(/<vCarga>([^<]+)<\/vCarga>/)
            if (vCargaMatch) valorCarga = parseFloat(vCargaMatch[1])

            const nfes = []
            const chaveRegex = /<chave>([^<]{44})<\/chave>/g
            let match
            while ((match = chaveRegex.exec(text)) !== null) {
                nfes.push(match[1].substring(25, 34).replace(/^0+/, ''))
            }
            if (nfes.length > 0) chaveNFe = nfes.join(', ')

            itensDoArquivo.push({
                id: file.id, awb: numeroCTe, pedido: chaveNFe, transportadora,
                frete_real: freteReal, data: file.created_at, tipo_registro: 'pacote',
                raw_data: { fileName: file.name, valorCarga }
            })
        }

        // ================= JAMEF =================
        if (transportadora === 'Jamef') {
            const isXml = file.name.toLowerCase().endsWith('.xml')

            // 🎯 AJUSTE 2: Nova lógica híbrida da Jamef
            if (isXml) {
                // LÓGICA XML (Idêntica à Braspress)
                let freteReal = 0, chaveNFe = "N/A", numeroCTe = file.name, valorCarga = 0
                
                const vTPrestMatch = text.match(/<vTPrest>([^<]+)<\/vTPrest>/)
                if (vTPrestMatch) freteReal = parseFloat(vTPrestMatch[1])
                
                const nCTMatch = text.match(/<nCT>([^<]+)<\/nCT>/)
                if (nCTMatch) numeroCTe = `CTe-${nCTMatch[1]}`
                
                const vCargaMatch = text.match(/<vCarga>([^<]+)<\/vCarga>/)
                if (vCargaMatch) valorCarga = parseFloat(vCargaMatch[1])

                const nfes = []
                const chaveRegex = /<chave>([^<]{44})<\/chave>/g
                let match
                while ((match = chaveRegex.exec(text)) !== null) {
                    nfes.push(match[1].substring(25, 34).replace(/^0+/, ''))
                }
                if (nfes.length > 0) chaveNFe = nfes.join(', ')

                itensDoArquivo.push({
                    id: file.id, awb: numeroCTe, pedido: chaveNFe, transportadora,
                    frete_real: freteReal, data: file.created_at, tipo_registro: 'pacote',
                    raw_data: { fileName: file.name, valorCarga, tipo: 'XML' }
                })
            } else {
                // LÓGICA TXT (Mantida para o legado de NOTFIS / CONEMB)
                const textUpper = text.toUpperCase()
                const isConemb = textUpper.includes('320CONHE') || file.name.toUpperCase().includes('CONEMB')
                const linhas = text.split('\n')

                if (isConemb) {
                    linhas.forEach((linha, i) => {
                       if (linha.startsWith('322')) {
                          const cte = linha.substring(18, 30).trim() || `CTE-L${i}`
                          let nf = "N/A"
                          const nfeMatch = linha.match(/088450410001901\s+(\d{8})/)
                          if (nfeMatch) {
                              nf = nfeMatch[1].replace(/^0+/, '') 
                          } else {
                              const fallbackNf = linha.match(/\s{2}(\d{8})\s{2,}/)
                              if(fallbackNf) nf = fallbackNf[1].replace(/^0+/, '')
                          }
                          let frete = 0
                          const valorString = linha.substring(61, 76)
                          if (!isNaN(Number(valorString))) {
                              frete = Number(valorString) / 100 
                          }
                          itensDoArquivo.push({
                              id: `${file.id}-${cte}`, awb: cte, pedido: nf, transportadora,
                              frete_real: frete, data: file.created_at, tipo_registro: 'pacote',
                              raw_data: { fileName: file.name, tipo: 'CONEMB' }
                          })
                       }
                    })
                } else {
                    let freteDestacado = 0, chaveNFe = "N/A"
                    linhas.forEach(linha => {
                       if (linha.startsWith('313')) {
                          const match44 = linha.match(/\d{44}/)
                          if (match44) chaveNFe = match44[0].substring(25, 34).replace(/^0+/, '')
                          const matchFrete = linha.match(/\s+(\d{15})[A-Z]\s+/)
                          if (matchFrete) freteDestacado = parseFloat(matchFrete[1]) / 100
                       }
                    })
                    itensDoArquivo.push({
                        id: file.id, awb: file.name, pedido: chaveNFe, transportadora,
                        frete_real: freteDestacado, data: file.created_at, tipo_registro: 'pacote',
                        raw_data: { fileName: file.name, tipo: 'NOTFIS' }
                    })
                }
            }
        }

        // ================= MOVVI (Lógica NATIVA do Excel) =================
        if (transportadora === 'Movvi') {
            let linhasMatriz: any[][] = [];

            if (isExcel && arrayBuffer) {
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0]; 
                linhasMatriz = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            } 
            else if (text) {
                const linhasTexto = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if(linhasTexto.length > 0) {
                   const separador = linhasTexto[0].includes(';') ? ';' : ',';
                   linhasMatriz = linhasTexto.map(linha => linha.split(separador).map(c => c.replace(/["\r]/g, '').trim()));
                }
            }

            if (linhasMatriz.length > 0) {
                let headerIndex = -1;
                for (let i = 0; i < Math.min(15, linhasMatriz.length); i++) {
                    const row = linhasMatriz[i] || [];
                    const rowStr = row.map(c => String(c).toUpperCase()).join('|');
                    if (rowStr.includes('CTRC') || rowStr.includes('CTE')) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex !== -1) {
                    const headers = linhasMatriz[headerIndex].map(h => String(h || '').toUpperCase().trim());
                    
                    const idxCTe = headers.findIndex(h => h === 'CTRC' || h.includes('CTRC') || h === 'CTE' || h === 'CONHECIMENTO');
                    const idxNF = headers.findIndex(h => h === 'NF' || h === 'NOTA FISCAL' || h.includes('NOTA') || h.includes('PEDIDO'));
                    const idxValor = headers.findIndex(h => h === 'VALOR FRETE' || h === 'VLR FRETE' || h === 'VLR. FRETE' || h === 'VALORFRETE' || h === 'FRETE');

                    for (let i = headerIndex + 1; i < linhasMatriz.length; i++) {
                        const colunas = linhasMatriz[i] || [];
                        if (colunas.length < 2) continue; 

                        let cte = idxCTe >= 0 ? String(colunas[idxCTe] || '').trim() : '';
                        if (!cte || cte === '' || cte.toUpperCase().includes('TOTAL')) continue;

                        let nf = idxNF >= 0 ? String(colunas[idxNF] || '').trim() : 'N/A';
                        nf = nf.replace(/^0+/, ''); 
                        if (!nf || nf === '-') nf = 'N/A';

                        let valorFrete = 0;
                        if (idxValor >= 0) {
                            let val = colunas[idxValor];
                            if (typeof val === 'number') {
                                valorFrete = val;
                            } else if (typeof val === 'string') {
                                let valorStr = val.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
                                valorFrete = parseFloat(valorStr);
                            }
                        }
                        if (isNaN(valorFrete)) valorFrete = 0;

                        itensDoArquivo.push({
                            id: `${file.id}-${cte}`,
                            awb: cte, 
                            pedido: nf, 
                            transportadora,
                            frete_real: valorFrete, 
                            data: file.created_at,
                            tipo_registro: 'pacote', 
                            raw_data: { fileName: file.name, linhaExcel: i, ctrc: cte, nota: nf }
                        });
                    }
                }
            }
        }

        // ================= CRUZAMENTO INTELIPOST PARA TODOS =================
        for (let item of itensDoArquivo) {
            item.frete_estimado = 0
            item.divergencia_financeira = 0
            item.status = item.frete_real > 0 ? 'Faturado' : (transportadora === 'Jamef' ? 'Aguardando CT-e' : 'Lido')

            const nfParaBusca = item.pedido.split(', ')[0]
            
            if (nfParaBusca && nfParaBusca !== 'N/A') {
                try {
                    const response = await fetch(`${BASE_URL}/shipment_order/invoice/${nfParaBusca}`, {
                        headers: { 'api-key': INTELIPOST_API_KEY, 'Accept': 'application/json' }
                    })
                    
                    if (response.ok) {
                        const data = await response.json()
                        if (data.content && data.content.length > 0) {
                            item.intelipost_data = data.content[0]
                            item.frete_estimado = item.intelipost_data.provider_shipping_cost || 0

                            if (item.frete_estimado > 0 && item.frete_real > 0) {
                                item.divergencia_financeira = item.frete_real - item.frete_estimado
                                item.status = item.divergencia_financeira > 0.5 ? 'Prejuízo TMS' : (item.divergencia_financeira < -0.5 ? 'Lucro TMS' : 'Conciliado')
                            } else if (item.frete_estimado > 0 && item.frete_real === 0) {
                                item.status = 'Aguardando CT-e'
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Erro na Intelipost NF ${nfParaBusca}`, err)
                }
            }
        }

        return itensDoArquivo
    }))

    const processados = resultadosAninhados.flat().filter(r => r !== null && r !== undefined)

    if (processados.length > 0) {
        const registrosParaSalvar = processados.map(r => ({
            empresa_id: empresaId,
            awb: r.awb,
            pedido: r.pedido,
            transportadora: r.transportadora,
            frete_estimado: r.frete_estimado,
            frete_real: r.frete_real,
            divergencia: r.divergencia_financeira,
            status: r.status,
            data_emissao: r.data,
            raw_data: r.raw_data
        }))

        const { error: dbError } = await supabaseAdmin
            .from('auditorias_historico')
            .upsert(registrosParaSalvar, { onConflict: 'empresa_id, awb' })
        
        if (dbError) console.error("Erro ao salvar histórico:", dbError)
    }

    return new Response(JSON.stringify({ resultados: processados }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 })
  }
})