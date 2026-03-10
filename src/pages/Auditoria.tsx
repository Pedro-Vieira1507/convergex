import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"; 
import { 
  Search, 
  RefreshCw, 
  Loader2, 
  AlertTriangle,
  ArrowLeft,
  Package,
  CalendarClock,
  MapPin,
  Scale,
  FileText,
  Download,
  FolderSync,
  DollarSign,
  Truck
} from "lucide-react";

export default function AuditoriaFretes() {
  const { toast } = useToast();

  const [view, setView] = useState<'selecao' | 'tabela'>('selecao');
  const [transportadoraAtiva, setTransportadoraAtiva] = useState<string>('');
  
  // Estados - Data Global
  const [dataInicial, setDataInicial] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split('T')[0];
  });
  const [dataFinal, setDataFinal] = useState(() => new Date().toISOString().split('T')[0]);

  // Estados - Correios
  const [correiosTipoBusca, setCorreiosTipoBusca] = useState<'faturas' | 'divergencias' | 'rastreio'>('faturas');
  const [correiosRastreio, setCorreiosRastreio] = useState("");

  // Estados - UI e Loading
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [loadingIntelipost, setLoadingIntelipost] = useState(false);
  
  // Estados - Dados
  const [auditorias, setAuditorias] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);

  const handleSelectTransportadora = (nome: string) => {
    setTransportadoraAtiva(nome);
    setView('tabela');
    setAuditorias([]); 
    setCorreiosRastreio('');
  };

  const handleVoltar = () => {
    setView('selecao');
    setTransportadoraAtiva('');
  };

  const handleAuditClick = (auditoria: any) => {
    setSelectedAudit(auditoria);
    setIsModalOpen(true);
  };

  // ============================================================
  // FUNÇÃO: CRUZAMENTO COM INTELIPOST (TMS) VIA NOTA FISCAL
  // ============================================================
  const cruzarComIntelipost = async (resultadosTransportadora: any[]) => {
    setLoadingIntelipost(true);
    const resultadosAuditoria = [...resultadosTransportadora];

    try {
      await Promise.all(resultadosAuditoria.map(async (item) => {
        // Ignora faturas, arquivos puros ou itens sem NF vinculada
        if (item.tipo_registro === 'fatura' || item.tipo_registro === 'ftp_file' || !item.pedido || item.pedido === 'N/A') return;

        try {
          // Extrai a PRIMEIRA nota fiscal para a busca
          const nfParaBusca = item.pedido.split(', ')[0];
          
          // Define qual função chamar (braspress, jamef ou correios)
          let nomeDaFuncao = 'intelipost-proxy'; // Default para correios
          let actionDaFuncao = 'GET_ESTIMATIVA'; // Default para correios

          if (item.transportadora === 'Braspress' || item.transportadora === 'Jamef') {
              nomeDaFuncao = 'braspress-proxy'; // Nosso hub que consulta a NF na Intelipost
              actionDaFuncao = 'GET_BY_INVOICE';
          }

          const res = await supabase.functions.invoke(nomeDaFuncao, {
            body: { 
              action: actionDaFuncao, 
              invoiceNumber: nfParaBusca,
              trackingCode: item.awb, 
              orderNumber: item.pedido 
            }
          });

          if (res.data && res.data.estimado !== undefined) {
            item.frete_estimado = res.data.estimado;
            
            // Guarda o payload completo da Intelipost para renderizar no modal
            if (res.data.dados_completos) {
               item.intelipost_data = res.data.dados_completos;
            }
            
            if (item.frete_estimado > 0 && item.frete_real > 0) {
                item.divergencia_financeira = item.frete_real - item.frete_estimado;
                item.status = item.divergencia_financeira > 0.5 ? 'Prejuízo TMS' : (item.divergencia_financeira < -0.5 ? 'Lucro TMS' : 'Conciliado');
            } else if (item.frete_estimado > 0 && item.frete_real === 0) {
                item.status = 'Aguardando CT-e'; // Atualizado para clareza
            }
          }
        } catch (e) {
          console.error(`Erro ao cruzar NF ${item.pedido}:`, e);
        }
      }));

      setAuditorias(resultadosAuditoria);
    } catch (err) {
      console.error("Falha no cruzamento com Intelipost", err);
    } finally {
      setLoadingIntelipost(false);
    }
  };

  // ============================================================
  // FUNÇÃO: BUSCAR E LER OS XMLs DO STORAGE (BRASPRESS)
  // ============================================================
  const handleListarStorageBraspress = async () => {
    if (!dataInicial || !dataFinal) {
      toast({ variant: "destructive", title: "Atenção", description: "Selecione a Data Inicial e Final." });
      return;
    }

    setIsSearchingApi(true);
    setAuditorias([]);

    try {
      const [anoIni, mesIni, diaIni] = dataInicial.split('-').map(Number);
      const start = new Date(anoIni, mesIni - 1, diaIni, 0, 0, 0);

      const [anoFim, mesFim, diaFim] = dataFinal.split('-').map(Number);
      const end = new Date(anoFim, mesFim - 1, diaFim, 23, 59, 59, 999);

      const { data: files, error: listError } = await supabase.storage
        .from('edi-braspress') 
        .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

      if (listError) throw listError;

      const arquivosValidos = files?.filter(file => {
        return file.name !== '.emptyFolderPlaceholder' && !file.name.toLowerCase().endsWith('.txt');
      }) || [];

      if (arquivosValidos.length === 0) {
        toast({ title: "Nenhum arquivo", description: "Não há arquivos brutos no Storage no momento." });
        setIsSearchingApi(false);
        return;
      }

      toast({ title: "Analisando XMLs...", description: `Lendo ${arquivosValidos.length} arquivos para extrair dados...` });

      const formatadosBrutos = await Promise.all(arquivosValidos.map(async (file, index) => {
        const { data: fileBlob } = await supabase.storage
          .from('edi-braspress')
          .download(file.name);

        let freteReal = 0;
        let chaveNFe = "Desconhecida";
        let numeroCTe = file.name;
        let dataEmissao = file.created_at; 
        
        let componentesFrete: { nome: string, valor: number }[] = [];
        let peso = 0;
        let volumes = 0;
        let valorCarga = 0;

        if (fileBlob) {
          try {
            const xmlText = await fileBlob.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const getNodes = (doc: any, tag: string) => {
                let nodes = doc.getElementsByTagName(tag);
                if (nodes.length === 0) nodes = doc.getElementsByTagNameNS("*", tag);
                return nodes;
            };

            const vTPrestNode = getNodes(xmlDoc, "vTPrest")[0];
            if (vTPrestNode) freteReal = parseFloat(vTPrestNode.textContent || "0");

            const nCTNode = getNodes(xmlDoc, "nCT")[0];
            if (nCTNode) numeroCTe = `CTe-${nCTNode.textContent}`;

            const chaveNodes = getNodes(xmlDoc, "chave");
            const nfes = [];
            for (let i = 0; i < chaveNodes.length; i++) {
                const chave = chaveNodes[i].textContent || "";
                if (chave.length === 44) {
                    nfes.push(chave.substring(25, 34).replace(/^0+/, ''));
                }
            }
            if (nfes.length > 0) chaveNFe = nfes.join(', ');

            const dhEmiNode = getNodes(xmlDoc, "dhEmi")[0];
            if (dhEmiNode) dataEmissao = dhEmiNode.textContent;

            const compNodes = getNodes(xmlDoc, "Comp");
            for (let i = 0; i < compNodes.length; i++) {
                const nome = getNodes(compNodes[i], "xNome")[0]?.textContent || "";
                const valor = parseFloat(getNodes(compNodes[i], "vComp")[0]?.textContent || "0");
                if (nome && !isNaN(valor)) componentesFrete.push({ nome, valor });
            }

            const vCargaNode = getNodes(xmlDoc, "vCarga")[0];
            if (vCargaNode) valorCarga = parseFloat(vCargaNode.textContent || "0");

            const infQNodes = getNodes(xmlDoc, "infQ");
            for (let i = 0; i < infQNodes.length; i++) {
                const tpMed = getNodes(infQNodes[i], "tpMed")[0]?.textContent || "";
                const qCarga = parseFloat(getNodes(infQNodes[i], "qCarga")[0]?.textContent || "0");
                
                if (tpMed.toUpperCase().includes("PESO")) peso = qCarga;
                if (tpMed.toUpperCase().includes("CAIXA") || tpMed.toUpperCase().includes("VOLUME") || tpMed.toUpperCase().includes("UNID")) volumes = qCarga;
            }

          } catch (e) {
             console.error(`Erro ao fazer parser do arquivo ${file.name}`, e);
          }
        }

        return {
          id: file.id || `xml-${index}`,
          tipo_registro: 'pacote', 
          pedido: chaveNFe,        
          awb: numeroCTe,
          transportadora: 'Braspress',
          frete_estimado: 0,       
          frete_real: freteReal,   
          divergencia_financeira: 0,
          status: freteReal > 0 ? 'Lido com sucesso' : 'Arquivo Inválido',
          data: dataEmissao, 
          raw_data: { 
             fileName: file.name,
             componentesFrete,
             peso,
             volumes,
             valorCarga
          }
        };
      }));

      const formatados = formatadosBrutos.filter(item => {
        if (!item.data) return false;
        const itemDate = new Date(item.data);
        return itemDate >= start && itemDate <= end;
      });

      if (formatados.length === 0) {
         toast({ variant: "destructive", title: "Fora do Período", description: `Lemos os arquivos, mas nenhum CT-e foi EMITIDO nesse período.` });
         setIsSearchingApi(false);
         return;
      }

      setAuditorias(formatados);
      
      const sucesso = formatados.filter(f => f.frete_real > 0).length;
      toast({ title: "Leitura Concluída", description: `${sucesso} CT-es encontrados no período. Cruzando com TMS...` });

      cruzarComIntelipost(formatados);

    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message || "Falha ao ler o Storage." });
    } finally {
      setIsSearchingApi(false);
    }
  };

  // ============================================================
  // FUNÇÃO: BUSCAR E LER OS TXTs DO STORAGE (JAMEF PROCEDA)
  // ============================================================
  const handleListarStorageJamef = async () => {
    if (!dataInicial || !dataFinal) {
      toast({ variant: "destructive", title: "Atenção", description: "Selecione a Data Inicial e Final." });
      return;
    }

    setIsSearchingApi(true);
    setAuditorias([]);

    try {
      const [anoIni, mesIni, diaIni] = dataInicial.split('-').map(Number);
      const start = new Date(anoIni, mesIni - 1, diaIni, 0, 0, 0);

      const [anoFim, mesFim, diaFim] = dataFinal.split('-').map(Number);
      const end = new Date(anoFim, mesFim - 1, diaFim, 23, 59, 59, 999);

      const { data: files, error: listError } = await supabase.storage
        .from('edi-jamef') 
        .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

      if (listError) throw listError;

      const arquivosValidos = files?.filter(file => {
        return file.name !== '.emptyFolderPlaceholder' && file.name.toLowerCase().endsWith('.txt');
      }) || [];

      if (arquivosValidos.length === 0) {
        toast({ title: "Nenhum arquivo", description: "Não há arquivos TXT da Jamef no Storage no momento." });
        setIsSearchingApi(false);
        return;
      }

      toast({ title: "Analisando TXTs...", description: `Lendo ${arquivosValidos.length} arquivos da Jamef...` });

      const formatadosBrutos = await Promise.all(arquivosValidos.map(async (file, index) => {
        const { data: fileBlob } = await supabase.storage
          .from('edi-jamef')
          .download(file.name);

        let freteReal = 0;
        let chaveNFe = "N/A"; 
        let numeroCTe = file.name;
        let dataEmissao = file.created_at; 
        
        let componentesFrete: { nome: string, valor: number }[] = [];
        let peso = 0;
        let volumes = 0;
        let valorCarga = 0;

        if (fileBlob) {
          try {
            const text = await fileBlob.text();
            const linhas = text.split('\n');
            
            // Verifica se é um arquivo de envio (NOTFIS) que não deve ser faturado como real
            const isNotfis = file.name.toUpperCase().includes('NOTFIS') || file.name.toUpperCase().includes('NOTFI');
            let freteDestacado = 0;

            linhas.forEach(linha => {
               // LINHA 313: DADOS DA NF, VALOR DA MERCADORIA E FRETE DESTACADO
               if (linha.startsWith('313')) {
                  const match44 = linha.match(/\d{44}/);
                  if (match44) {
                      chaveNFe = match44[0].substring(25, 34).replace(/^0+/, '');
                  }

                  const matchValores = linha.match(/CAIXAS\s+(\d{5})(\d{14})/);
                  if (matchValores) {
                      volumes = parseInt(matchValores[1], 10);
                      valorCarga = parseFloat(matchValores[2]) / 100;
                  }

                  const matchFrete = linha.match(/\s+(\d{15})[A-Z]\s+/);
                  if (matchFrete) {
                      freteDestacado = parseFloat(matchFrete[1]) / 100;
                  }
               }

               // LINHA 318: DADOS DE PESO
               if (linha.startsWith('318')) {
                  const pesoStr = linha.substring(48, 63);
                  if (pesoStr && !isNaN(Number(pesoStr))) {
                      peso = parseFloat(pesoStr) / 100;
                  }
               }
            });

            // LÓGICA DE BLINDAGEM DA AUDITORIA
            if (isNotfis) {
                freteReal = 0; // Força zero, pois NOTFIS não é cobrança real
                componentesFrete.push({ nome: "Frete Previsto (Arquivo NOTFIS)", valor: freteDestacado });
            } else {
                // Quando chegar o CONEMB/DOCCOB real
                freteReal = freteDestacado; 
                componentesFrete.push({ nome: "Frete Cobrado (CT-e)", valor: freteReal });
            }

          } catch (e) {
             console.error(`Erro ao ler o TXT ${file.name}`, e);
          }
        }

        return {
          id: file.id || `txt-${index}`,
          tipo_registro: 'pacote', 
          pedido: chaveNFe,        
          awb: numeroCTe,
          transportadora: 'Jamef',
          frete_estimado: 0,       
          frete_real: freteReal,   
          divergencia_financeira: 0,
          status: freteReal === 0 ? 'Aguardando CT-e' : 'Faturado',
          data: dataEmissao, 
          raw_data: { 
             fileName: file.name,
             componentesFrete,
             peso,
             volumes,
             valorCarga
          }
        };
      }));

      const formatados = formatadosBrutos.filter(item => {
        if (!item.data) return false;
        const itemDate = new Date(item.data);
        return itemDate >= start && itemDate <= end;
      });

      if (formatados.length === 0) {
         toast({ variant: "destructive", title: "Fora do Período", description: `Nenhum arquivo TXT encontrado nesse período.` });
         setIsSearchingApi(false);
         return;
      }

      setAuditorias(formatados);
      toast({ title: "Leitura Concluída", description: `Buscando valores na Intelipost para as notas encontradas...` });

      cruzarComIntelipost(formatados);

    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message || "Falha ao ler o Storage." });
    } finally {
      setIsSearchingApi(false);
    }
  };

  // ============================================================
  // FUNÇÃO: BUSCAR CORREIOS (API)
  // ============================================================
  const handlePesquisarCorreios = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearchingApi(true);
    setAuditorias([]);

    try {
      let formatados = [];

      if (correiosTipoBusca === 'rastreio') {
        if (!correiosRastreio.trim()) {
          toast({ variant: "destructive", title: "Atenção", description: "Digite um código válido." });
          setIsSearchingApi(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('correios-proxy', {
          body: { action: 'GET_RASTREIO', codigoObjeto: correiosRastreio }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        if (!data || !data.codObjeto) {
           toast({ title: "Nenhum resultado", description: "Objeto não encontrado nos Correios." });
           return;
        }

        const ultimoEvento = (data.eventos && data.eventos.length > 0) ? data.eventos[0] : null;

        formatados = [{
          id: data.codObjeto || `rastreio-${Date.now()}`,
          tipo_registro: 'rastreio',
          pedido: 'N/A',
          awb: data.codObjeto,
          transportadora: 'Correios',
          frete_estimado: 0, 
          frete_real: 0,
          divergencia_financeira: 0,
          status: data.mensagem || (ultimoEvento ? ultimoEvento.descricao : 'Aguardando Postagem'),
          data: data.dtPrevista || (ultimoEvento ? ultimoEvento.dtHrCriado : null),
          raw_data: data 
        }];
        
        setAuditorias(formatados);
        toast({ title: "Sucesso", description: `Cruzando dados com Intelipost...` });
        cruzarComIntelipost(formatados);

      } else {
        if (!dataInicial || !dataFinal) {
           toast({ variant: "destructive", title: "Atenção", description: "Selecione o período." });
           setIsSearchingApi(false);
           return;
        }

        const action = correiosTipoBusca === 'faturas' ? 'GET_FATURAS' : 'GET_DIVERGENCIAS';
        const { data, error } = await supabase.functions.invoke('correios-proxy', {
          body: { action, dataInicial, dataFinal }
        });

        if (error) throw error;
        if (data.error) {
          if (data.error.includes('FAT-001') || data.error.includes('FAT-023')) {
            toast({ title: "Tudo OK", description: "Nenhum dado retornado para este período." });
            return;
          }
          throw new Error(data.error);
        }

        if (!Array.isArray(data) || data.length === 0) {
          toast({ title: "Vazio", description: "Nenhum registro encontrado no período." });
          return;
        }

        if (correiosTipoBusca === 'faturas') {
          formatados = data.map((d: any, index: number) => ({
            id: d.fatura || `fatura-${index}`,
            tipo_registro: 'fatura',
            pedido: 'N/A',
            awb: d.fatura,
            transportadora: 'Correios',
            frete_estimado: d.valor, 
            frete_real: d.valorEmAberto, 
            divergencia_financeira: 0,
            status: d.status,
            data: d.vencimento,
            raw_data: d 
          }));
          setAuditorias(formatados);
          toast({ title: "Resultados", description: `${formatados.length} faturas listadas.` });
        } else {
          formatados = data.map((d: any, index: number) => ({
            id: d.codigoObjeto || `pacote-${index}`,
            tipo_registro: 'pacote',
            pedido: 'N/A',
            awb: d.codigoObjeto,
            transportadora: 'Correios',
            frete_estimado: 0, 
            frete_real: d.valorTarifadoSgpb || 0, 
            divergencia_financeira: 0, 
            status: 'Aguardando TMS...',
            data: d.dataPostagem,
            raw_data: d 
          }));
          setAuditorias(formatados);
          toast({ title: "Resultados", description: `Cruzando ${formatados.length} pacotes com Intelipost...` });
          cruzarComIntelipost(formatados);
        }
      }

    } catch (err: any) {
      toast({ variant: "destructive", title: "Falha na busca", description: err.message });
    } finally {
      setIsSearchingApi(false);
    }
  };

  const handleDownloadPdf = async (tipoPdf: 'sintetico' | 'boleto') => {
    if (!selectedAudit?.raw_data) return;
    setIsDownloadingPdf(true);
    
    try {
      const payload = {
        action: 'DOWNLOAD_PDF',
        fatura: selectedAudit.raw_data.fatura,
        tipoDocumento: selectedAudit.raw_data.tipoDocumento,
        drFatura: selectedAudit.raw_data.drFatura,
        itemFatura: selectedAudit.raw_data.itemFatura,
        tipoPdf: tipoPdf
      };

      const { data, error } = await supabase.functions.invoke('correios-proxy', { body: payload });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Correios_${tipoPdf}_${selectedAudit.raw_data.fatura}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: "Download Concluído", description: `O arquivo ${tipoPdf} foi salvo.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro no download", description: err.message });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // ============================================================
  // RENDERIZAÇÃO: TELA INICIAL (SELEÇÃO)
  // ============================================================
  if (view === 'selecao') {
    return (
      <div className="space-y-6 w-full pb-6 text-stone-200 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-100 flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-500" /> Auditoria Integrada (TMS)
          </h1>
          <p className="text-stone-400">Auditoria automatizada: As cobranças das transportadoras são cruzadas em tempo real com os valores da Intelipost.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
          
          {/* CARD BRASPRESS */}
          <div onClick={() => handleSelectTransportadora('Braspress')} className="group bg-stone-900 border border-stone-800 hover:border-emerald-500 hover:bg-stone-900/80 cursor-pointer rounded-xl p-6 flex flex-col items-center text-center gap-4 transition-all">
            <div className="w-full h-28 bg-white/90 rounded-lg flex items-center justify-center p-4">
              <img src="https://logodownload.org/wp-content/uploads/2019/11/braspress-logo.png" alt="Braspress" className="max-h-full grayscale group-hover:grayscale-0 transition-all" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-200">Braspress</h3>
              <span className="text-xs text-stone-500 mt-1 flex items-center justify-center gap-1 uppercase">
                <FolderSync className="w-3 h-3" /> Integração em Nuvem
              </span>
            </div>
          </div>

          {/* CARD JAMEF */}
          <div onClick={() => handleSelectTransportadora('Jamef')} className="group bg-stone-900 border border-stone-800 hover:border-red-500 hover:bg-stone-900/80 cursor-pointer rounded-xl p-6 flex flex-col items-center text-center gap-4 transition-all">
            <div className="w-full h-28 bg-red-950/20 rounded-lg flex items-center justify-center p-4">
              <Truck className="w-16 h-16 text-red-500/60 group-hover:text-red-600 transition-colors" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-200">Jamef</h3>
              <span className="text-xs text-stone-500 mt-1 flex items-center justify-center gap-1 uppercase">
                <FolderSync className="w-3 h-3" /> Integração em Nuvem
              </span>
            </div>
          </div>

          {/* CARD CORREIOS */}
          <div onClick={() => handleSelectTransportadora('Correios')} className="group bg-stone-900 border border-stone-800 hover:border-yellow-500 hover:bg-stone-900/80 cursor-pointer rounded-xl p-6 flex flex-col items-center text-center gap-4 transition-all">
            <div className="w-full h-28 bg-yellow-400/10 rounded-lg flex items-center justify-center p-4">
              <Package className="w-16 h-16 text-yellow-500/60 group-hover:text-yellow-500 transition-colors" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-200">Correios</h3>
              <span className="text-xs text-stone-500 mt-1 block uppercase">Auditoria de Faturas / PLP</span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ============================================================
  // RENDERIZAÇÃO: TELA DE TABELA / FILTROS
  // ============================================================
  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-6 text-stone-200 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="flex items-center gap-4 w-full">
        <Button variant="ghost" size="icon" onClick={handleVoltar} className="text-stone-400 hover:text-white hover:bg-stone-800 rounded-full w-10 h-10 shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-100 flex items-center gap-3">
          Auditoria: <span className={transportadoraAtiva === 'Correios' ? 'text-yellow-500' : (transportadoraAtiva === 'Jamef' ? 'text-red-500' : 'text-emerald-500')}>{transportadoraAtiva}</span>
        </h1>
      </div>

      <Card className="bg-stone-900 border-stone-800 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {transportadoraAtiva === 'Braspress' || transportadoraAtiva === 'Jamef' ? (
            <div className="flex flex-col sm:flex-row gap-4 items-end w-full bg-stone-950 p-4 rounded-lg border border-stone-800">
              <div className="w-full sm:w-1/3">
                <h3 className="text-lg font-bold text-stone-200 flex items-center gap-2 mb-1">
                  <FolderSync className={`w-5 h-5 ${transportadoraAtiva === 'Jamef' ? 'text-red-500' : 'text-emerald-500'}`} /> Diretório de Faturas
                </h3>
                <p className="text-sm text-stone-400">Filtrando arquivos sincronizados no Storage.</p>
              </div>
              <div className="w-full sm:w-1/4">
                <label className="text-sm font-medium text-stone-400 mb-1 block">Data Inicial</label>
                <Input type="date" className={`bg-stone-950 border-stone-800 focus-visible:ring-${transportadoraAtiva === 'Jamef' ? 'red' : 'emerald'}-500 [color-scheme:dark]`} value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
              </div>
              <div className="w-full sm:w-1/4">
                <label className="text-sm font-medium text-stone-400 mb-1 block">Data Final</label>
                <Input type="date" className={`bg-stone-950 border-stone-800 focus-visible:ring-${transportadoraAtiva === 'Jamef' ? 'red' : 'emerald'}-500 [color-scheme:dark]`} value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
              </div>
              <Button 
                onClick={transportadoraAtiva === 'Braspress' ? handleListarStorageBraspress : handleListarStorageJamef} 
                disabled={isSearchingApi} 
                className={`w-full sm:w-auto text-white shadow-sm h-10 px-6 ${transportadoraAtiva === 'Jamef' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {isSearchingApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} 
                Auditar Período
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePesquisarCorreios} className="flex flex-col sm:flex-row gap-4 items-end w-full">
              <div className="w-full sm:w-1/3">
                <label className="text-sm font-medium text-stone-400 mb-1 block">O que deseja analisar?</label>
                <select className="flex h-10 w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-sm focus:ring-yellow-500" value={correiosTipoBusca} onChange={(e) => { setCorreiosTipoBusca(e.target.value as any); setAuditorias([]); }}>
                  <option value="faturas">1. Resumo de Faturas</option>
                  <option value="divergencias">2. Auditoria Completa de Lote (Cruzamento TMS)</option>
                  <option value="rastreio">3. Rastreio Individual (SLA)</option>
                </select>
              </div>
              
              {correiosTipoBusca === 'rastreio' ? (
                 <div className="w-full sm:w-1/2">
                    <label className="text-sm font-medium text-stone-400 mb-1 block">Código de Rastreio</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                      <Input placeholder="Ex: AA123456789BR" className="pl-9 bg-stone-950 border-stone-800 focus-visible:ring-yellow-500" value={correiosRastreio} onChange={(e) => setCorreiosRastreio(e.target.value.toUpperCase())} />
                    </div>
                 </div>
              ) : (
                <>
                  <div className="w-full sm:w-1/4"><label className="text-sm font-medium text-stone-400 mb-1 block">Data Inicial</label><Input type="date" className="bg-stone-950 border-stone-800 focus-visible:ring-yellow-500 [color-scheme:dark]" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} /></div>
                  <div className="w-full sm:w-1/4"><label className="text-sm font-medium text-stone-400 mb-1 block">Data Final</label><Input type="date" className="bg-stone-950 border-stone-800 focus-visible:ring-yellow-500 [color-scheme:dark]" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} /></div>
                </>
              )}
              
              <Button type="submit" disabled={isSearchingApi || loadingIntelipost || (correiosTipoBusca === 'rastreio' && !correiosRastreio.trim())} className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-stone-950 font-bold shadow-sm h-10 px-8">
                {(isSearchingApi || loadingIntelipost) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} Auditar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ALERTA DE PROCESSAMENTO EM SEGUNDO PLANO */}
      {loadingIntelipost && (
        <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-lg flex items-center gap-3 text-blue-400 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Buscando valores originais na Intelipost e calculando divergências...</span>
        </div>
      )}

      {/* TABELA DE RESULTADOS */}
      {auditorias.length > 0 && (
        <div className="rounded-md border border-stone-800 bg-stone-900 shadow-sm overflow-hidden w-full mt-4">
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full caption-bottom text-sm min-w-[800px]">
              <thead className="bg-stone-950 border-b border-stone-800">
                <tr>
                  <th className="h-10 px-4 text-left font-medium text-stone-400">
                    {auditorias[0].tipo_registro === 'ftp_file' ? 'Nome do Arquivo (Nuvem)' : (auditorias[0].tipo_registro === 'fatura' ? 'Nº Fatura' : 'Rastreio / AWB')}
                  </th>
                  <th className="h-10 px-4 text-left font-medium text-stone-400">
                    {auditorias[0].tipo_registro === 'ftp_file' ? 'Data de Modificação' : (auditorias[0].tipo_registro === 'fatura' ? 'Vencimento' : (auditorias[0].tipo_registro === 'rastreio' ? 'Previsão / Data' : 'Data Postagem'))}
                  </th>
                  {auditorias[0].tipo_registro !== 'rastreio' && auditorias[0].tipo_registro !== 'ftp_file' && (
                    <>
                      <th className="h-10 px-4 text-right font-medium text-stone-400">{auditorias[0].tipo_registro === 'fatura' ? 'Valor Total' : 'Estimado (TMS)'}</th>
                      <th className="h-10 px-4 text-right font-medium text-stone-400">{auditorias[0].tipo_registro === 'fatura' ? 'A Pagar' : 'Cobrado Real'}</th>
                    </>
                  )}
                  {auditorias[0].tipo_registro === 'pacote' && <th className="h-10 px-4 text-right font-medium text-stone-400">Divergência R$</th>}
                  <th className="h-10 px-4 text-center font-medium text-stone-400">
                    {auditorias[0].tipo_registro === 'ftp_file' ? 'Tamanho' : 'Status Auditoria'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {auditorias.map((item, index) => (
                  <tr key={item.id ? `${item.id}-${index}` : `row-${index}`} className="hover:bg-stone-800/50">
                    <td className="p-3 font-bold text-stone-200">
                      <button onClick={() => handleAuditClick(item)} className={`font-bold hover:underline flex items-center gap-1 sm:gap-2 whitespace-nowrap ${transportadoraAtiva === 'Correios' ? 'text-yellow-500' : (transportadoraAtiva === 'Jamef' ? 'text-red-400' : 'text-emerald-400')}`}>
                        {item.awb}
                      </button>
                    </td>
                    <td className="p-3 text-stone-300 whitespace-nowrap">
                      {item.data ? new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    
                    {item.tipo_registro !== 'rastreio' && item.tipo_registro !== 'ftp_file' && (
                      <>
                        <td className="p-3 text-right text-stone-400 whitespace-nowrap">
                          {item.frete_estimado > 0 ? Number(item.frete_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (loadingIntelipost && item.tipo_registro === 'pacote' ? 'Calculando...' : 'Não achou TMS')}
                        </td>
                        <td className="p-3 text-right font-medium text-stone-200 whitespace-nowrap">
                          {item.frete_real > 0 ? Number(item.frete_real).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                      </>
                    )}
                    
                    {item.tipo_registro === 'pacote' && (
                      <td className={`p-3 text-right font-bold whitespace-nowrap ${item.divergencia_financeira > 0.5 ? 'text-red-400' : item.divergencia_financeira < -0.5 ? 'text-green-400' : 'text-stone-500'}`}>
                         {item.divergencia_financeira !== 0 ? (item.divergencia_financeira > 0 ? '+' : '') + Number(item.divergencia_financeira).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                      </td>
                    )}
                    
                    <td className="p-3 text-center whitespace-nowrap"><StatusBadge status={item.status} tipo={item.tipo_registro || transportadoraAtiva} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL UNIFICADO PARA DETALHES */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-stone-900 border-stone-800 text-stone-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-100 text-xl">
              {selectedAudit?.tipo_registro === 'fatura' ? <FileText className="h-6 w-6 text-yellow-500" /> : 
               selectedAudit?.tipo_registro === 'ftp_file' ? <FolderSync className="h-6 w-6 text-emerald-500" /> :
               <Package className={`h-6 w-6 ${selectedAudit?.transportadora === 'Jamef' ? 'text-red-500' : 'text-emerald-500'}`} />} 
              Detalhes <span className="text-stone-400">{selectedAudit?.awb}</span>
            </DialogTitle>
          </DialogHeader>

          {/* DADOS STORAGE BRASPRESS/JAMEF */}
          {selectedAudit?.tipo_registro === 'ftp_file' && selectedAudit?.raw_data && (
            <div className="space-y-4 mt-4">
              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
                <p className="text-sm text-stone-400 mb-2">Este é um arquivo EDI/XML salvo no Supabase pelo Make.com. O próximo passo será ler o conteúdo para exibir os valores cobrados nesta fatura.</p>
                <div className="bg-stone-900 p-3 rounded border border-stone-800 font-mono text-xs text-stone-400 space-y-1">
                  <p><strong>Nome no bucket:</strong> {selectedAudit.raw_data.name}</p>
                  <p><strong>Adicionado em:</strong> {new Date(selectedAudit.raw_data.created_at).toLocaleString('pt-BR')}</p>
                  <p><strong>Tamanho (bytes):</strong> {selectedAudit.raw_data.metadata?.size || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* DADOS DOS CORREIOS - RASTREIO INDIVIDUAL */}
          {selectedAudit?.tipo_registro === 'rastreio' && selectedAudit?.raw_data && (
            <div className="space-y-6 mt-4">
              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 flex flex-wrap gap-y-4 justify-between">
                 <div><span className="text-xs text-stone-400 uppercase tracking-wider block mb-1">Previsão Entrega</span><span className="text-sm font-bold text-stone-200 flex items-center gap-1"><CalendarClock className="w-4 h-4 text-stone-400" /> {selectedAudit.raw_data.dtPrevista ? new Date(selectedAudit.raw_data.dtPrevista).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                 <div><span className="text-xs text-stone-400 uppercase tracking-wider block mb-1">Peso / Formato</span><span className="text-sm font-medium text-stone-200">{selectedAudit.raw_data.peso}g ({selectedAudit.raw_data.formato})</span></div>
              </div>

              {selectedAudit.raw_data.eventos && selectedAudit.raw_data.eventos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-4 text-stone-400 uppercase tracking-wider border-b border-stone-800 pb-2">Linha do Tempo (Eventos)</h4>
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-800 before:to-transparent">
                    {selectedAudit.raw_data.eventos.map((evento: any, idx: number) => (
                      <div key={`evento-${idx}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-stone-900 bg-yellow-500 z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm"></div>
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-stone-950 border border-stone-800 p-3 rounded-lg shadow-sm">
                          <span className="font-bold text-stone-200 text-sm block">{evento.descricao}</span>
                          {evento.unidade && <span className="text-xs text-stone-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {evento.unidade.tipo} - {evento.unidade.endereco?.cidade}/{evento.unidade.endereco?.uf}</span>}
                          <span className="text-xs text-stone-500 mt-2 block">{new Date(evento.dtHrCriado).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DADOS DO PACOTE (SEPARADO POR TRANSPORTADORA) */}
          {selectedAudit?.tipo_registro === 'pacote' && selectedAudit?.raw_data && (
            <div className="space-y-6 mt-4">
              
              {/* MODAL EXCLUSIVO DA BRASPRESS & JAMEF */}
              {(selectedAudit.transportadora === 'Braspress' || selectedAudit.transportadora === 'Jamef') && (
                <>
                  <div className={`bg-${selectedAudit.transportadora === 'Jamef' ? 'red' : 'emerald'}-950/20 border border-${selectedAudit.transportadora === 'Jamef' ? 'red' : 'emerald'}-900/50 p-4 rounded-lg flex items-start gap-4`}>
                    <FileText className={`w-5 h-5 text-${selectedAudit.transportadora === 'Jamef' ? 'red' : 'emerald'}-500 mt-0.5 shrink-0`} />
                    <div>
                      <h4 className={`font-bold text-${selectedAudit.transportadora === 'Jamef' ? 'red' : 'emerald'}-400 uppercase tracking-wider text-sm mb-1`}>Leitura do Arquivo Concluída</h4>
                      <p className="text-sm text-stone-300">Cruzamento de dados entre o arquivo da {selectedAudit.transportadora} e a estimativa do Intelipost (TMS).</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bloco INTELIPOST */}
                    <div className="bg-blue-950/10 p-4 rounded-lg border border-blue-900/30 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-blue-900/50 text-[10px] px-2 py-1 font-bold text-blue-200 rounded-bl-lg uppercase tracking-wider">Previsto no TMS</div>
                      <h4 className="font-semibold text-blue-400 mb-4 flex items-center gap-2 pb-2 border-b border-blue-900/30"><Scale className="w-4 h-4" /> Dados Intelipost</h4>
                      
                      {selectedAudit.intelipost_data ? (
                        <div className="space-y-3 text-sm text-stone-300">
                          <div className="flex justify-between"><span>Status Pedido:</span> <strong className="text-blue-300">{selectedAudit.intelipost_data.shipment_order_volume_state}</strong></div>
                          
                          {selectedAudit.intelipost_data.shipment_order_volume_array?.[0] && (
                            <>
                              <div className="flex justify-between"><span>Peso Estimado:</span> <strong>{selectedAudit.intelipost_data.shipment_order_volume_array[0].weight} kg</strong></div>
                              <div className="flex justify-between"><span>Dimensões:</span> <strong>{selectedAudit.intelipost_data.shipment_order_volume_array[0].length}x{selectedAudit.intelipost_data.shipment_order_volume_array[0].width}x{selectedAudit.intelipost_data.shipment_order_volume_array[0].height} cm</strong></div>
                            </>
                          )}
                          
                          <div className="pt-3 mt-3 border-t border-blue-900/30 flex justify-between items-center text-blue-400 font-bold text-base">
                              <span>Valor Estimado (TMS)</span>
                              <span>{Number(selectedAudit.frete_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-stone-500 text-sm text-center py-6">
                           Aguardando consulta ou nota fiscal não encontrada no Intelipost.
                        </div>
                      )}
                    </div>

                    {/* Bloco TRANSPORTADORA */}
                    <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-stone-800 text-[10px] px-2 py-1 font-bold text-stone-400 rounded-bl-lg uppercase tracking-wider">Cobrado na Fatura</div>
                      <h4 className={`font-semibold text-${selectedAudit.transportadora === 'Jamef' ? 'red' : 'emerald'}-500 mb-4 flex items-center gap-2 pb-2 border-b border-stone-800`}><Package className="w-4 h-4" /> Dados {selectedAudit.transportadora}</h4>
                      <div className="space-y-3 text-sm text-stone-400">
                        <div className="flex justify-between"><span>Nota Fiscal:</span> <strong className="text-stone-200">{selectedAudit.pedido || 'N/A'}</strong></div>
                        <div className="flex justify-between"><span>Peso Informado:</span> <strong className="text-stone-200">{selectedAudit.raw_data?.peso || 0} kg</strong></div>
                        <div className="flex justify-between"><span>Volumes / Caixas:</span> <strong className="text-stone-200">{selectedAudit.raw_data?.volumes || 0} un.</strong></div>
                        <div className="flex justify-between"><span>Valor Carga:</span> <strong className="text-stone-200">{Number(selectedAudit.raw_data?.valorCarga || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
                        
                        <div className={`pt-3 mt-3 border-t border-stone-800 flex justify-between items-center text-${selectedAudit.transportadora === 'Jamef' ? 'red' : 'emerald'}-400 font-bold text-base`}>
                            <span>Valor Cobrado (CT-e)</span>
                            <span>{selectedAudit.frete_real === 0 ? 'Aguardando CT-e' : Number(selectedAudit.frete_real).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Detalhamento do Frete */}
                  <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 mt-4">
                    <h4 className="font-semibold text-stone-300 mb-4 flex items-center gap-2 pb-2 border-b border-stone-800"><DollarSign className={`w-4 h-4 text-${selectedAudit.transportadora === 'Jamef' ? 'red' : 'emerald'}-500`} /> Composição do Frete {selectedAudit.transportadora}</h4>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-stone-400">
                      {selectedAudit.raw_data?.componentesFrete?.map((comp: any, i: number) => (
                        <div key={i} className="flex justify-between items-center col-span-2 sm:col-span-1">
                            <span className="capitalize">{comp.nome.toLowerCase()}</span>
                            <strong className="text-stone-200">{comp.valor === 0 ? '-' : Number(comp.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </div>
                      ))}
                      {(!selectedAudit.raw_data?.componentesFrete || selectedAudit.raw_data.componentesFrete.length === 0) && (
                          <p className="text-stone-500 col-span-2">Nenhum detalhamento encontrado no arquivo.</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* MODAL EXCLUSIVO DOS CORREIOS (MECTRI) */}
              {selectedAudit.transportadora === 'Correios' && (
                <>
                  <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-lg flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-red-400 uppercase tracking-wider text-sm mb-1">{selectedAudit.raw_data.tipoPendencia || 'Divergência'}</h4>
                      <p className="text-sm text-stone-300">Houve uma divergência entre as medidas informadas no envio e as medidas aferidas pela triagem (MECTRI) dos Correios.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-stone-800 text-[10px] px-2 py-1 font-bold text-stone-400 rounded-bl-lg uppercase tracking-wider">O que você informou</div>
                      <h4 className="font-semibold text-stone-300 mb-3 flex items-center gap-2"><Scale className="w-4 h-4 text-stone-500" /> Dados Sistema</h4>
                      <div className="space-y-1 text-sm text-stone-400">
                        <p>Peso: <strong className="text-stone-200">{selectedAudit.raw_data.pesoTarifadoFinanceiro || 0} kg</strong></p>
                        <p>Dimensões: <span className="text-stone-200">{selectedAudit.raw_data.comprimentoFinanceiro || 0}x{selectedAudit.raw_data.larguraFinanceiro || 0}x{selectedAudit.raw_data.alturaFinanceiro || 0} cm</span></p>
                        <p className="pt-2 text-stone-500">Valor Estimado: <strong className="text-stone-200">{Number(selectedAudit.raw_data.valorTarifadoFinanceiro || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
                      </div>
                    </div>
                    <div className="bg-red-950/10 p-4 rounded-lg border border-red-900/30 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-red-900/50 text-[10px] px-2 py-1 font-bold text-red-200 rounded-bl-lg uppercase tracking-wider">Aferido pela Balança</div>
                      <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2"><Scale className="w-4 h-4" /> Dados Correios</h4>
                      <div className="space-y-1 text-sm text-stone-300">
                        <p>Peso Real: <strong className="text-red-300">{selectedAudit.raw_data.pesoRealMectri || 0} kg</strong></p>
                        <p>Dimensões: <span className="text-stone-200">{selectedAudit.raw_data.comprimentoMectri || 0}x{selectedAudit.raw_data.larguraMectri || 0}x{selectedAudit.raw_data.alturaMectri || 0} cm</span></p>
                        <p className="pt-2 text-stone-400">Valor Cobrado: <strong className="text-red-400 text-base">{Number(selectedAudit.raw_data.valorTarifadoSgpb || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* DADOS DOS CORREIOS - FATURA */}
          {selectedAudit?.tipo_registro === 'fatura' && selectedAudit?.raw_data && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
                  <div className="flex items-center gap-2 text-stone-400 mb-2"><FileText className="w-4 h-4" /> <span className="text-sm font-medium">Dados da Fatura</span></div>
                  <p className="text-sm text-stone-400">Contrato: <span className="text-stone-200">{selectedAudit.raw_data.contrato}</span></p>
                  <p className="text-sm text-stone-400 mt-1">Vencimento: <span className="text-stone-200">{selectedAudit.raw_data.vencimento ? new Date(selectedAudit.raw_data.vencimento).toLocaleDateString('pt-BR') : '-'}</span></p>
                </div>
                <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
                  <div className="flex items-center gap-2 text-stone-400 mb-2"><DollarSign className="w-4 h-4" /> <span className="text-sm font-medium">Valores</span></div>
                  <p className="text-sm text-stone-400">Valor Total: <span className="text-stone-200 font-bold">{Number(selectedAudit.raw_data.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                  <p className="text-sm text-stone-400 mt-1">A Pagar: <span className="text-red-400 font-bold">{Number(selectedAudit.raw_data.valorEmAberto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-stone-800">
                 <Button onClick={() => handleDownloadPdf('sintetico')} disabled={isDownloadingPdf} variant="outline" className="w-full bg-stone-950 border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-white">
                    {isDownloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 text-stone-400" />} Baixar Extrato Sintético
                 </Button>
                 <Button onClick={() => handleDownloadPdf('boleto')} disabled={isDownloadingPdf} variant="outline" className="w-full bg-stone-950 border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-white">
                    {isDownloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 text-stone-400" />} Baixar Boleto
                 </Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status, tipo }: { status: string, tipo: string }) {
  const normalized = status?.toLowerCase() || "";
  let colorClass = "text-stone-400 bg-stone-800 border-stone-700"; 
  
  if (tipo === 'ftp_file') {
    colorClass = "text-emerald-400 bg-emerald-950/40 border-emerald-900/50";
  } else if (normalized.includes('prejuízo') || normalized.includes('divergent')) {
    colorClass = "text-red-400 bg-red-950/40 border-red-900/50";
  } else if (normalized.includes('lucro') || normalized.includes('conciliado') || normalized.includes('paga')) {
    colorClass = "text-green-400 bg-green-950/40 border-green-900/50";
  } else if (normalized.includes('aguardando') || normalized.includes('aberta') || normalized.includes('fatura') || normalized.includes('tms') || normalized.includes('ct-e')) {
    colorClass = "text-yellow-400 bg-yellow-950/40 border-yellow-900/50";
  } else if (tipo === 'rastreio') {
    if (normalized.includes('entregue') || normalized.includes('ok')) colorClass = "text-emerald-400 bg-emerald-950/40 border-emerald-900/50";
    else if (normalized.includes('rota') || normalized.includes('viagem') || normalized.includes('encaminhado')) colorClass = "text-blue-400 bg-blue-950/40 border-blue-900/50";
  }
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border uppercase tracking-wider ${colorClass}`}>
      {status || "N/A"}
    </span>
  );
}