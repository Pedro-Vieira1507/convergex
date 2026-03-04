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
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog"; 
import { 
  Search, 
  RefreshCw, 
  Loader2, 
  Truck, 
  DollarSign, 
  FileSearch, 
  UploadCloud, 
  AlertTriangle,
  ArrowLeft,
  Package,
  CalendarClock,
  MapPin,
  Scale,
  FileText,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuditoriaFretes() {
  const { toast } = useToast();

  const [view, setView] = useState<'selecao' | 'tabela'>('selecao');
  const [transportadoraAtiva, setTransportadoraAtiva] = useState<string>('');

  const [searchType, setSearchType] = useState<'pedido' | 'nf'>('pedido');
  const [searchValue, setSearchValue] = useState("");
  
  // Adicionado 'rastreio' nas opções de busca dos Correios
  const [correiosTipoBusca, setCorreiosTipoBusca] = useState<'faturas' | 'divergencias' | 'rastreio'>('faturas');
  const [dataInicial, setDataInicial] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split('T')[0];
  });
  const [dataFinal, setDataFinal] = useState(() => new Date().toISOString().split('T')[0]);
  const [correiosRastreio, setCorreiosRastreio] = useState("");

  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  
  const [auditorias, setAuditorias] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);

  const handleSelectTransportadora = (nome: string) => {
    setTransportadoraAtiva(nome);
    setView('tabela');
    setAuditorias([]); 
    setSearchValue('');
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

  const handlePesquisarBraspress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchValue.trim()) return;
    setIsSearchingApi(true);
    setAuditorias([]);

    try {
      const { data, error } = await supabase.functions.invoke('braspress-proxy', {
        body: { action: 'GET_TRACKING', searchType: searchType, searchValue: searchValue }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const conhecimentos = data.conhecimentos || [];
      if (conhecimentos.length === 0) {
        toast({ title: "Nenhum resultado", description: "Não encontrado." });
        return;
      }

      const formatados = conhecimentos.map((c: any) => ({
        id: c.numero,
        pedido: searchValue,
        awb: c.numero,
        transportadora: 'Braspress',
        frete_estimado: 0,
        frete_real: c.totalFrete,
        divergencia: 0 - c.totalFrete,
        status: c.status,
        data: c.emissao,
        raw_data: c 
      }));

      setAuditorias(formatados);
      toast({ title: "Sucesso!", description: `${formatados.length} registro(s) encontrado(s).` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Falha na busca", description: err.message });
    } finally {
      setIsSearchingApi(false);
    }
  };

  const handlePesquisarCorreios = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearchingApi(true);
    setAuditorias([]);

    try {
      let formatados = [];

      // SE BUSCA FOR RASTREIO INDIVIDUAL
      if (correiosTipoBusca === 'rastreio') {
        if (!correiosRastreio.trim()) {
          toast({ variant: "destructive", title: "Atenção", description: "Digite um código de rastreio válido." });
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

        // Pega o último evento para exibir na tabela
        const ultimoEvento = (data.eventos && data.eventos.length > 0) ? data.eventos[0] : null;

        formatados = [{
          id: data.codObjeto,
          tipo_registro: 'rastreio',
          awb: data.codObjeto,
          transportadora: 'Correios',
          frete_estimado: 0, // A API SRO não retorna custo de frete na busca básica
          frete_real: 0,
          divergencia: 0,
          status: data.mensagem || (ultimoEvento ? ultimoEvento.descricao : 'Aguardando Postagem'),
          data: data.dtPrevista || (ultimoEvento ? ultimoEvento.dtHrCriado : null),
          raw_data: data 
        }];
        
        setAuditorias(formatados);
        toast({ title: "Sucesso", description: `Rastreio atualizado.` });

      } else {
        // SE BUSCA FOR FATURA OU DIVERGÊNCIA LOTE
        if (!dataInicial || !dataFinal) {
           toast({ variant: "destructive", title: "Atenção", description: "Selecione o período de datas." });
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
          formatados = data.map((d: any) => ({
            id: d.fatura,
            tipo_registro: 'fatura',
            awb: d.fatura,
            transportadora: 'Correios',
            frete_estimado: d.valor, 
            frete_real: d.valorEmAberto, 
            divergencia: 0,
            status: d.status,
            data: d.vencimento,
            raw_data: d 
          }));
        } else {
          formatados = data.map((d: any) => ({
            id: d.codigoObjeto,
            tipo_registro: 'pacote',
            awb: d.codigoObjeto,
            transportadora: 'Correios',
            frete_estimado: d.valorTarifadoFinanceiro || 0,
            frete_real: d.valorTarifadoSgpb || 0, 
            divergencia: d.diferencaValorFinanceiroSgpb || 0, 
            status: d.tipoPendencia || 'Divergente',
            data: d.dataPostagem,
            raw_data: d 
          }));
        }
        
        setAuditorias(formatados);
        toast({ title: "Resultados", description: `${formatados.length} registro(s) listado(s).` });
      }

    } catch (err: any) {
      toast({ variant: "destructive", title: "Falha na busca", description: err.message });
    } finally {
      setIsSearchingApi(false);
    }
  };

  if (view === 'selecao') {
    return (
      <div className="space-y-6 w-full pb-6 text-stone-200 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-100 flex items-center gap-3">
            <FileSearch className="w-8 h-8 text-red-500" /> Auditoria de Fretes
          </h1>
          <p className="text-stone-400">Selecione a transportadora para iniciar a auditoria.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-4">
          <div onClick={() => handleSelectTransportadora('Braspress')} className="group bg-stone-900 border border-stone-800 hover:border-emerald-500 hover:bg-stone-900/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all duration-300 rounded-xl p-6 cursor-pointer flex flex-col items-center text-center gap-4">
            <div className="w-full h-28 bg-white/90 rounded-lg flex items-center justify-center p-4 border border-stone-800"><img src="https://logodownload.org/wp-content/uploads/2019/11/braspress-logo.png" alt="Braspress" className="max-h-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" /></div>
            <div><h3 className="text-lg font-bold text-stone-200 group-hover:text-emerald-400">Braspress</h3><span className="text-xs text-stone-500 font-medium mt-1 block uppercase tracking-wider">Busca Individual</span></div>
          </div>
          <div onClick={() => handleSelectTransportadora('Correios')} className="group bg-stone-900 border border-stone-800 hover:border-yellow-500 hover:bg-stone-900/80 hover:shadow-[0_0_20px_rgba(234,179,8,0.1)] transition-all duration-300 rounded-xl p-6 cursor-pointer flex flex-col items-center text-center gap-4">
            <div className="w-full h-28 bg-yellow-400/10 rounded-lg flex items-center justify-center p-4 border border-stone-800"><Package className="w-16 h-16 text-yellow-500/60 group-hover:text-yellow-500" /></div>
            <div><h3 className="text-lg font-bold text-stone-200 group-hover:text-yellow-500">Correios</h3><span className="text-xs text-stone-500 font-medium mt-1 block uppercase tracking-wider">Auditoria de Faturas e Rastreio</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-6 text-stone-200 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="flex items-center gap-4 w-full">
        <Button variant="ghost" size="icon" onClick={handleVoltar} className="text-stone-400 hover:text-white hover:bg-stone-800 rounded-full w-10 h-10 shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-100 flex items-center gap-3">
          Auditoria: <span className={transportadoraAtiva === 'Correios' ? 'text-yellow-500' : 'text-emerald-500'}>{transportadoraAtiva}</span>
        </h1>
      </div>

      <Card className="bg-stone-900 border-stone-800 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {transportadoraAtiva === 'Braspress' ? (
            <form onSubmit={handlePesquisarBraspress} className="flex flex-col sm:flex-row gap-4 items-end w-full">
              <div className="w-full sm:w-1/3"><label className="text-sm font-medium text-stone-400 mb-1 block">Tipo de Busca</label><select className="flex h-10 w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-sm focus:ring-emerald-500" value={searchType} onChange={(e) => setSearchType(e.target.value as 'pedido' | 'nf')}><option value="pedido">Número do Pedido</option><option value="nf">Número da Nota Fiscal</option></select></div>
              <div className="w-full sm:w-1/2"><label className="text-sm font-medium text-stone-400 mb-1 block">{searchType === 'pedido' ? 'Digite o Número' : 'Digite a Nota Fiscal'}</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" /><Input className="pl-9 bg-stone-950 border-stone-800 focus-visible:ring-emerald-500" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} /></div></div>
              <Button type="submit" disabled={isSearchingApi || !searchValue.trim()} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-10 px-8">{isSearchingApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} Consultar API</Button>
            </form>
          ) : (
            <form onSubmit={handlePesquisarCorreios} className="flex flex-col sm:flex-row gap-4 items-end w-full">
              <div className="w-full sm:w-1/3">
                <label className="text-sm font-medium text-stone-400 mb-1 block">O que deseja analisar?</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  value={correiosTipoBusca}
                  onChange={(e) => {
                    setCorreiosTipoBusca(e.target.value as 'faturas' | 'divergencias' | 'rastreio');
                    setAuditorias([]); 
                  }}
                >
                  <option value="faturas">Resumo de Faturas (Totais)</option>
                  <option value="divergencias">Pacotes Divergentes (Prejuízo)</option>
                  <option value="rastreio">Rastreio Individual (SRO)</option>
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
              
              <Button type="submit" disabled={isSearchingApi || (correiosTipoBusca === 'rastreio' && !correiosRastreio.trim())} className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-stone-950 font-bold shadow-sm h-10 px-8">
                {isSearchingApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} Buscar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {auditorias.length > 0 && (
        <div className="rounded-md border border-stone-800 bg-stone-900 shadow-sm overflow-hidden w-full mt-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full caption-bottom text-sm min-w-[800px]">
              <thead className="bg-stone-950 border-b border-stone-800">
                <tr>
                  <th className="h-10 sm:h-12 px-4 text-left font-medium text-stone-400">
                    {auditorias[0].tipo_registro === 'fatura' ? 'Nº Fatura' : 'Rastreio (Objeto)'}
                  </th>
                  <th className="h-10 sm:h-12 px-4 text-left font-medium text-stone-400">
                    {auditorias[0].tipo_registro === 'fatura' ? 'Vencimento' : (auditorias[0].tipo_registro === 'rastreio' ? 'Previsão / Data' : 'Data Postagem')}
                  </th>
                  {auditorias[0].tipo_registro !== 'rastreio' && (
                    <>
                      <th className="h-10 sm:h-12 px-4 text-right font-medium text-stone-400">
                        {auditorias[0].tipo_registro === 'fatura' ? 'Valor Total' : 'Estimado'}
                      </th>
                      <th className="h-10 sm:h-12 px-4 text-right font-medium text-stone-400">
                        {auditorias[0].tipo_registro === 'fatura' ? 'A Pagar' : 'Cobrado'}
                      </th>
                    </>
                  )}
                  {auditorias[0].tipo_registro === 'pacote' && (
                    <th className="h-10 sm:h-12 px-4 text-right font-medium text-stone-400">Divergência</th>
                  )}
                  <th className="h-10 sm:h-12 px-4 text-center font-medium text-stone-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {auditorias.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-800/50 transition-colors">
                    <td className="p-3 sm:p-4">
                      <button onClick={() => handleAuditClick(item)} className={`font-bold hover:underline flex items-center gap-1 sm:gap-2 whitespace-nowrap ${transportadoraAtiva === 'Correios' ? 'text-yellow-500' : 'text-emerald-400'}`}>
                        {item.awb}
                      </button>
                    </td>
                    <td className="p-3 sm:p-4 text-stone-300 whitespace-nowrap">{item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '-'}</td>
                    
                    {item.tipo_registro !== 'rastreio' && (
                      <>
                        <td className="p-3 sm:p-4 text-right text-stone-400 whitespace-nowrap">{Number(item.frete_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="p-3 sm:p-4 text-right font-medium text-stone-200 whitespace-nowrap">{Number(item.frete_real).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </>
                    )}
                    
                    {item.tipo_registro === 'pacote' && (
                      <td className={`p-3 sm:p-4 text-right font-bold whitespace-nowrap ${item.divergencia > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {item.divergencia > 0 ? '+' : ''}{Number(item.divergencia).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    )}
                    
                    <td className="p-3 sm:p-4 text-center whitespace-nowrap"><StatusBadge status={item.status} tipo={item.tipo_registro || transportadoraAtiva} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL UNIFICADO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-stone-900 border-stone-800 text-stone-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-100 text-xl">
              {selectedAudit?.tipo_registro === 'fatura' ? <FileText className="h-6 w-6 text-yellow-500" /> : <Package className="h-6 w-6 text-yellow-500" />} 
              Detalhes <span className="text-stone-400">{selectedAudit?.awb}</span>
            </DialogTitle>
          </DialogHeader>

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
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
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

          {/* DADOS DOS CORREIOS - PACOTE DIVERGENTE (Mantido Igual) */}
          {selectedAudit?.tipo_registro === 'pacote' && selectedAudit?.raw_data && (
            <div className="space-y-6 mt-4">
              <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-lg flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-red-400 uppercase tracking-wider text-sm mb-1">{selectedAudit.raw_data.tipoPendencia}</h4>
                  <p className="text-sm text-stone-300">Houve uma divergência entre as medidas informadas no envio e as medidas aferidas pela triagem (MECTRI) dos Correios.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-stone-800 text-[10px] px-2 py-1 font-bold text-stone-400 rounded-bl-lg uppercase tracking-wider">O que você informou</div>
                  <h4 className="font-semibold text-stone-300 mb-3 flex items-center gap-2"><Scale className="w-4 h-4 text-stone-500" /> Dados Sistema</h4>
                  <div className="space-y-1 text-sm text-stone-400">
                    <p>Peso: <strong className="text-stone-200">{selectedAudit.raw_data.pesoTarifadoFinanceiro} kg</strong></p>
                    <p>Dimensões: <span className="text-stone-200">{selectedAudit.raw_data.comprimentoFinanceiro}x{selectedAudit.raw_data.larguraFinanceiro}x{selectedAudit.raw_data.alturaFinanceiro} cm</span></p>
                    <p className="pt-2 text-stone-500">Valor Estimado: <strong className="text-stone-200">{Number(selectedAudit.raw_data.valorTarifadoFinanceiro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
                  </div>
                </div>
                <div className="bg-red-950/10 p-4 rounded-lg border border-red-900/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-red-900/50 text-[10px] px-2 py-1 font-bold text-red-200 rounded-bl-lg uppercase tracking-wider">Aferido pela Balança</div>
                  <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2"><Scale className="w-4 h-4" /> Dados Correios (MECTRI)</h4>
                  <div className="space-y-1 text-sm text-stone-300">
                    <p>Peso Real: <strong className="text-red-300">{selectedAudit.raw_data.pesoRealMectri} kg</strong></p>
                    <p>Dimensões: <span className="text-stone-200">{selectedAudit.raw_data.comprimentoMectri}x{selectedAudit.raw_data.larguraMectri}x{selectedAudit.raw_data.alturaMectri} cm</span></p>
                    <p className="pt-2 text-stone-400">Valor Cobrado: <strong className="text-red-400 text-base">{Number(selectedAudit.raw_data.valorTarifadoSgpb).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DADOS DOS CORREIOS - FATURA COM BOTÕES DE DOWNLOAD (Mantido Igual) */}
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
                    {isDownloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 text-stone-400" />} Baixar Extrato Sintético (PDF)
                 </Button>
                 <Button onClick={() => handleDownloadPdf('boleto')} disabled={isDownloadingPdf} variant="outline" className="w-full bg-stone-950 border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-white">
                    {isDownloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 text-stone-400" />} Baixar Boleto de Pagamento
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
  
  if (tipo === 'fatura') {
    if (normalized === 'aberta') colorClass = "text-yellow-400 bg-yellow-950/40 border-yellow-900/50";
    else if (normalized === 'fechada' || normalized === 'paga') colorClass = "text-green-400 bg-green-950/40 border-green-900/50";
    else if (normalized === 'cancelada') colorClass = "text-red-400 bg-red-950/40 border-red-900/50";
  } else if (tipo === 'pacote') {
    colorClass = "text-red-400 bg-red-950/40 border-red-900/50";
  } else if (tipo === 'rastreio' || tipo === 'Braspress') {
    if (normalized.includes('entregue') || normalized.includes('ok')) colorClass = "text-emerald-400 bg-emerald-950/40 border-emerald-900/50";
    else if (normalized.includes('rota') || normalized.includes('viagem') || normalized.includes('encaminhado')) colorClass = "text-blue-400 bg-blue-950/40 border-blue-900/50";
    else if (normalized.includes('pendencia') || normalized.includes('devolu') || normalized.includes('aguardando')) colorClass = "text-red-400 bg-red-950/40 border-red-900/50";
    else colorClass = "text-yellow-400 bg-yellow-950/40 border-yellow-900/50";
  }
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border uppercase tracking-wider ${colorClass}`}>
      {status || "N/A"}
    </span>
  );
}