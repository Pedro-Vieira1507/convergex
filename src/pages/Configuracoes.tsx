import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Truck, CheckCircle2, XCircle, Loader2, ShoppingBag, Mail, Shield, User, UserPlus, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ==========================================
  // ESTADOS - GESTÃO DE EQUIPA
  // ==========================================
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operador");

  // ==========================================
  // ESTADOS - INTEGRAÇÕES (API)
  // ==========================================
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");

  const [intelipostUrl, setIntelipostUrl] = useState("https://api.intelipost.com.br/api/v1/");
  const [intelipostKey, setIntelipostKey] = useState("");
  const [isTestingIntelipost, setIsTestingIntelipost] = useState(false);
  const [intelipostStatus, setIntelipostStatus] = useState<"idle" | "success" | "error">("idle");

  const [bizUrl, setBizUrl] = useState("https://www.forlabexpress.com.br");
  const [bizToken, setBizToken] = useState("");
  const [isTestingBiz, setIsTestingBiz] = useState(false);
  const [bizStatus, setBizStatus] = useState<"idle" | "success" | "error">("idle");

  const [braspressCnpj, setBraspressCnpj] = useState("");
  const [braspressToken, setBraspressToken] = useState("");
  const [isTestingBraspress, setIsTestingBraspress] = useState(false);
  const [braspressStatus, setBraspressStatus] = useState<"idle" | "success" | "error">("idle");

  const [correiosContrato, setCorreiosContrato] = useState("");
  const [correiosDr, setCorreiosDr] = useState("");
  const [correiosToken, setCorreiosToken] = useState("");
  const [isTestingCorreios, setIsTestingCorreios] = useState(false);
  const [correiosStatus, setCorreiosStatus] = useState<"idle" | "success" | "error">("idle");

  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);

  // ==========================================
  // QUERIES E MUTAÇÕES - EQUIPA
  // ==========================================
  const { data: membros = [], isLoading: isLoadingMembros } = useQuery({
    queryKey: ['equipa-membros'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const { data: meuPerfil, error: perfilError } = await supabase
        .from('perfis')
        .select('empresa_id')
        .eq('id', session.user.id)
        .single();
      
      if (perfilError) throw perfilError;

      if (!meuPerfil?.empresa_id) {
         const { data } = await supabase
          .from('perfis')
          .select('id, nome_completo, email, role, created_at')
          .eq('id', session.user.id);
         return data || [];
      }

      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome_completo, email, role, created_at')
        .eq('empresa_id', meuPerfil.empresa_id) 
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const convidarMembro = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Convite enviado!", description: `Um e-mail foi enviado para ${email}.` });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ['equipa-membros'] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro ao convidar", description: err.message });
    }
  });

  // MUTAÇÃO: ALTERAR PERMISSÃO DE UM USUÁRIO
  const alterarPermissao = useMutation({
    mutationFn: async ({ userId, novoRole }: { userId: string, novoRole: string }) => {
      const { error } = await supabase
        .from('perfis')
        .update({ role: novoRole })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Permissão atualizada!", description: "O nível de acesso foi alterado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ['equipa-membros'] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro ao atualizar permissão", description: err.message });
    }
  });

  const handleConvidar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    convidarMembro.mutate();
  };

  // ==========================================
  // CARREGAR CONFIGURAÇÕES DE API
  // ==========================================
  useEffect(() => {
    async function loadConfigs() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('configuracoes_empresa')
          .select('onclick_url, onclick_token, intelipost_url, intelipost_token, magento_url, magento_token, braspress_cnpj, braspress_token, correios_contrato, correios_dr, correios_token')
          .eq('user_id', session.user.id)
          .maybeSingle(); 

        if (error) throw error;

        if (data) {
          if (data.onclick_url) setBaseUrl(data.onclick_url);
          if (data.onclick_token) setApiToken(data.onclick_token);
          if (data.intelipost_url) setIntelipostUrl(data.intelipost_url);
          if (data.intelipost_token) setIntelipostKey(data.intelipost_token);
          if (data.magento_url) setBizUrl(data.magento_url);
          if (data.magento_token) setBizToken(data.magento_token);
          if (data.braspress_cnpj) setBraspressCnpj(data.braspress_cnpj);
          if (data.braspress_token) setBraspressToken(data.braspress_token);
          if (data.correios_contrato) setCorreiosContrato(data.correios_contrato);
          if (data.correios_dr) setCorreiosDr(data.correios_dr);
          if (data.correios_token) setCorreiosToken(data.correios_token);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      } finally {
        setIsLoadingConfigs(false);
      }
    }
    loadConfigs();
  }, []);

  // ==========================================
  // SALVAR CONFIGURAÇÕES DE API
  // ==========================================
  const saveToDatabase = async (updateData: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('configuracoes_empresa')
        .upsert(
          { user_id: session.user.id, ...updateData }, 
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
      return false;
    }
  };

  const handleSaveOnclick = async () => {
    if (!baseUrl || !apiToken) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preencha a URL base e o Token da API Onclick." });
      return;
    }
    const sucesso = await saveToDatabase({ onclick_url: baseUrl, onclick_token: apiToken });
    if (sucesso) toast({ title: "Configurações Onclick salvas", description: "As credenciais foram atualizadas na nuvem." });
  };

  const handleTestOnclick = async () => {
    if (!baseUrl || !apiToken) return;
    setIsTesting(true);
    setConnectionStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke('onclick-proxy', {
        body: { action: 'GET_PRODUCTS' },
        headers: { 'x-onclick-url': baseUrl, 'x-onclick-token': apiToken }
      });
      if (error) throw error;
      if (data && (data.error || data.message)) throw new Error(data.error || data.message);
      setConnectionStatus("success");
      handleSaveOnclick(); 
    } catch (error: any) {
      setConnectionStatus("error");
      toast({ variant: "destructive", title: "Falha na conexão Onclick", description: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveIntelipost = async () => {
    if (!intelipostUrl || !intelipostKey) return;
    const sucesso = await saveToDatabase({ intelipost_url: intelipostUrl, intelipost_token: intelipostKey });
    if (sucesso) toast({ title: "Configurações Intelipost salvas", description: "As credenciais foram atualizadas na nuvem." });
  };

  const handleTestIntelipost = async () => {
    if (!intelipostUrl || !intelipostKey) return;
    setIsTestingIntelipost(true);
    setIntelipostStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke('intelipost-proxy', {
        body: { action: 'TEST_CONNECTION' },
        headers: { 'x-intelipost-url': intelipostUrl, 'api-key': intelipostKey }
      });
      if (error) throw error;
      if (data && (data.error || (data.status && data.status !== "OK"))) throw new Error(data.error || "Erro de API");
      setIntelipostStatus("success");
      handleSaveIntelipost();
    } catch (error: any) {
      setIntelipostStatus("error");
      toast({ variant: "destructive", title: "Falha na conexão Intelipost", description: error.message });
    } finally {
      setIsTestingIntelipost(false);
    }
  };

  const handleSaveBiz = async () => {
    if (!bizUrl || !bizToken) return;
    const sucesso = await saveToDatabase({ magento_url: bizUrl, magento_token: bizToken });
    if (sucesso) toast({ title: "Configurações BizCommerce salvas", description: "As credenciais foram atualizadas na nuvem." });
  };

  const handleTestBiz = async () => {
    if (!bizUrl || !bizToken) return;
    setIsTestingBiz(true);
    setBizStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke('sync-magento-orders', {
        body: { action: 'TEST_CONNECTION', magentoUrl: bizUrl, magentoToken: bizToken }
      });
      if (error) throw error;
      if (data && data.message && data.message.includes("401")) throw new Error("Acesso negado. Verifique o Token.");
      setBizStatus("success");
      handleSaveBiz();
    } catch (error: any) {
      setBizStatus("error");
      toast({ variant: "destructive", title: "Falha na conexão BizCommerce", description: error.message });
    } finally {
      setIsTestingBiz(false);
    }
  };

  const handleSaveBraspress = async () => {
    if (!braspressCnpj || !braspressToken) return;
    const sucesso = await saveToDatabase({ braspress_cnpj: braspressCnpj, braspress_token: braspressToken });
    if (sucesso) toast({ title: "Configurações Braspress salvas", description: "As credenciais foram atualizadas na nuvem." });
  };

  const handleTestBraspress = async () => {
    if (!braspressCnpj || !braspressToken) return;
    setIsTestingBraspress(true);
    setBraspressStatus("idle");
    try {
      const { error } = await supabase.functions.invoke('braspress-proxy', {
        body: { action: 'TEST_CONNECTION', cnpj: braspressCnpj, token: braspressToken }
      });
      if (error) throw error;
      setBraspressStatus("success");
      handleSaveBraspress();
    } catch (error: any) {
      setBraspressStatus("error");
      toast({ variant: "destructive", title: "Falha na conexão Braspress", description: error.message });
    } finally {
      setIsTestingBraspress(false);
    }
  };

  const handleSaveCorreios = async () => {
    if (!correiosContrato || !correiosDr || !correiosToken) return;
    const sucesso = await saveToDatabase({ correios_contrato: correiosContrato, correios_dr: correiosDr, correios_token: correiosToken });
    if (sucesso) toast({ title: "Configurações Correios salvas", description: "As credenciais foram atualizadas na nuvem." });
  };

  const handleTestCorreios = async () => {
    if (!correiosContrato || !correiosDr || !correiosToken) return;
    setIsTestingCorreios(true);
    setCorreiosStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke('correios-proxy', {
        body: { action: 'TEST_CONNECTION', contrato: correiosContrato, dr: correiosDr, token: correiosToken }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setCorreiosStatus("success");
      handleSaveCorreios();
    } catch (error: any) {
      setCorreiosStatus("error");
      toast({ variant: "destructive", title: "Falha na conexão Correios", description: error.message });
    } finally {
      setIsTestingCorreios(false);
    }
  };

  if (isLoadingConfigs) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-red-500 w-8 h-8" /></div>;
  }

  return (
    <div className="space-y-10 text-stone-200 pb-10">
      <PageHeader title="Configurações da Empresa" description="Faça a gestão da equipe e das integrações de API da sua conta." />

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          Gestão de Equipe
        </h2>
        
        <div className="grid gap-6 md:grid-cols-[350px_1fr]">
          <Card className="bg-stone-900 border-stone-800 shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-lg text-stone-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-500" />
                Convidar Membro
              </CardTitle>
              <CardDescription className="text-stone-400">
                Envie um acesso ao sistema para a sua equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConvidar} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-stone-400">E-mail do funcionário</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                    <Input 
                      type="email" 
                      required
                      placeholder="exemplo@empresa.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 bg-stone-950 border-stone-800 focus-visible:ring-red-500 text-stone-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-stone-400">Permissão (Cargo)</Label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-stone-950"
                  >
                    <option value="admin">Administrador (Acesso Total)</option>
                    <option value="gerente">Gerente (Relatórios e Pedidos)</option>
                    <option value="operador">Operador (Apenas Separação/WMS)</option>
                  </select>
                </div>

                <Button 
                  type="submit" 
                  disabled={convidarMembro.isPending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white border-none shadow-md transition-all hover:shadow-red-900/20"
                >
                  {convidarMembro.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enviar Convite
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-stone-900 border-stone-800 shadow-sm">
            <CardHeader className="border-b border-stone-800 bg-stone-950/50">
              <CardTitle className="text-stone-100 flex items-center gap-2">
                <User className="w-5 h-5 text-stone-400" />
                Membros da Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingMembros ? (
                 <div className="flex justify-center items-center p-12"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-stone-950">
                      <TableRow className="border-stone-800 hover:bg-transparent">
                        <TableHead className="text-stone-400 font-semibold">Utilizador</TableHead>
                        <TableHead className="text-stone-400 font-semibold">Nível de Acesso</TableHead>
                        <TableHead className="text-stone-400 font-semibold">Data de Registo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-stone-800">
                      {membros.map((membro) => (
                        <TableRow key={membro.id} className="hover:bg-stone-800/30 border-stone-800 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-stone-400" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium text-stone-200">{membro.nome_completo}</span>
                                <span className="text-xs text-stone-500">{membro.email}</span>
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* MENU DROPDOWN PARA ALTERAR PERMISSÃO */}
                          <TableCell>
                            <select
                              value={membro.role}
                              onChange={(e) => alterarPermissao.mutate({ userId: membro.id, novoRole: e.target.value })}
                              disabled={alterarPermissao.isPending}
                              className={cn(
                                "flex h-8 w-[130px] rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-950 appearance-none cursor-pointer",
                                membro.role === 'admin' ? 'bg-red-950/40 text-red-400 border-red-900/50 focus:ring-red-500' : 
                                membro.role === 'gerente' ? 'bg-blue-950/40 text-blue-400 border-blue-900/50 focus:ring-blue-500' : 
                                'bg-stone-800 text-stone-300 border-stone-700 focus:ring-stone-500'
                              )}
                            >
                              <option value="admin">ADMIN</option>
                              <option value="gerente">GERENTE</option>
                              <option value="operador">OPERADOR</option>
                            </select>
                          </TableCell>

                          <TableCell className="text-stone-400">
                            {new Date(membro.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4 pt-4 border-t border-stone-800">
        <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-stone-400" />
          Integrações de API
        </h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* CARD ONCLICK */}
          <Card className="bg-stone-900 border-stone-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2 text-stone-100">
                <Settings className="w-5 h-5 text-stone-400" /> Credenciais Onclick
              </CardTitle>
              <CardDescription className="text-stone-400">Dados de conexão com o Onclick ERP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="text-stone-400">URL Base da API</Label>
                <Input id="baseUrl" placeholder="Ex: https://api.onclick.com.br/api/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-red-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiToken" className="text-stone-400">Token de Acesso (API Key)</Label>
                <Input id="apiToken" type="password" placeholder="Cole seu Token aqui" value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-red-500" />
              </div>
              {connectionStatus !== "idle" && (
                <div className={cn("flex items-center gap-2 p-3 rounded-lg text-sm border", connectionStatus === "success" ? "bg-green-950/40 text-green-400 border-green-900/50" : "bg-red-950/40 text-red-400 border-red-900/50")}>
                  {connectionStatus === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">{connectionStatus === "success" ? "Conectado com sucesso!" : "Falha na conexão."}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveOnclick} variant="outline" className="bg-stone-950 border-stone-700 text-stone-200 hover:bg-stone-800 hover:text-white">Salvar</Button>
                <Button onClick={handleTestOnclick} disabled={isTesting} className="bg-stone-800 hover:bg-stone-700 text-white">
                  {isTesting ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : "Testar Conexão"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* CARD BIZCOMMERCE */}
          <Card className="bg-stone-900 border-orange-900/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2 text-stone-100">
                <ShoppingBag className="w-5 h-5 text-orange-500" /> Credenciais BizCommerce
              </CardTitle>
              <CardDescription className="text-stone-400">Conexão com loja Magento 2.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bizUrl" className="text-stone-400">URL da Loja</Label>
                <Input id="bizUrl" placeholder="Ex: https://www.sua-loja.com.br" value={bizUrl} onChange={(e) => setBizUrl(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-orange-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bizToken" className="text-stone-400">Access Token (Integration)</Label>
                <Input id="bizToken" type="password" placeholder="Token de Integração" value={bizToken} onChange={(e) => setBizToken(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-orange-500" />
              </div>
              {bizStatus !== "idle" && (
                <div className={cn("flex items-center gap-2 p-3 rounded-lg text-sm border", bizStatus === "success" ? "bg-green-950/40 text-green-400 border-green-900/50" : "bg-red-950/40 text-red-400 border-red-900/50")}>
                  {bizStatus === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">{bizStatus === "success" ? "Loja Conectada!" : "Falha na conexão."}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveBiz} variant="outline" className="bg-stone-950 border-stone-700 text-stone-200 hover:bg-stone-800 hover:text-white">Salvar</Button>
                <Button onClick={handleTestBiz} disabled={isTestingBiz} className="bg-orange-600 hover:bg-orange-700 text-white border-none">
                  {isTestingBiz ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : "Testar Magento"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* CARD INTELIPOST */}
          <Card className="bg-stone-900 border-blue-900/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2 text-stone-100">
                <Package className="w-5 h-5 text-blue-500" /> Credenciais Intelipost
              </CardTitle>
              <CardDescription className="text-stone-400">API para cálculo de frete e rastreio (TMS).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="intelipostUrl" className="text-stone-400">URL Base da API</Label>
                <Input id="intelipostUrl" placeholder="Ex: https://api.intelipost.com.br/api/v1/" value={intelipostUrl} onChange={(e) => setIntelipostUrl(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intelipostKey" className="text-stone-400">API Key (Chave de Acesso)</Label>
                <Input id="intelipostKey" type="password" placeholder="Sua API Key Intelipost" value={intelipostKey} onChange={(e) => setIntelipostKey(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-blue-500" />
              </div>
              {intelipostStatus !== "idle" && (
                <div className={cn("flex items-center gap-2 p-3 rounded-lg text-sm border", intelipostStatus === "success" ? "bg-green-950/40 text-green-400 border-green-900/50" : "bg-red-950/40 text-red-400 border-red-900/50")}>
                  {intelipostStatus === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">{intelipostStatus === "success" ? "Intelipost Conectado!" : "Falha na conexão."}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveIntelipost} variant="outline" className="bg-stone-950 border-stone-700 text-stone-200 hover:bg-stone-800 hover:text-white">Salvar</Button>
                <Button onClick={handleTestIntelipost} disabled={isTestingIntelipost} className="bg-blue-600 hover:bg-blue-700 text-white border-none">
                  {isTestingIntelipost ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : "Testar Intelipost"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* CARD BRASPRESS */}
          <Card className="bg-stone-900 border-emerald-900/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2 text-stone-100">
                <Truck className="w-5 h-5 text-emerald-500" /> Credenciais Braspress
              </CardTitle>
              <CardDescription className="text-stone-400">Conexão direta com a API Braspress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="braspressCnpj" className="text-stone-400">CNPJ (Apenas números)</Label>
                <Input id="braspressCnpj" placeholder="Ex: 12345678000199" value={braspressCnpj} onChange={(e) => setBraspressCnpj(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="braspressToken" className="text-stone-400">Token de Acesso / Senha</Label>
                <Input id="braspressToken" type="password" placeholder="Sua senha ou token Braspress" value={braspressToken} onChange={(e) => setBraspressToken(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-emerald-500" />
              </div>
              {braspressStatus !== "idle" && (
                <div className={cn("flex items-center gap-2 p-3 rounded-lg text-sm border", braspressStatus === "success" ? "bg-green-950/40 text-green-400 border-green-900/50" : "bg-red-950/40 text-red-400 border-red-900/50")}>
                  {braspressStatus === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">{braspressStatus === "success" ? "Braspress Conectada!" : "Falha na conexão."}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveBraspress} variant="outline" className="bg-stone-950 border-stone-700 text-stone-200 hover:bg-stone-800 hover:text-white">Salvar</Button>
                <Button onClick={handleTestBraspress} disabled={isTestingBraspress} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                  {isTestingBraspress ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : "Testar Braspress"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* CARD CORREIOS */}
          <Card className="bg-stone-900 border-yellow-900/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-heading flex items-center gap-2 text-stone-100">
                <Package className="w-5 h-5 text-yellow-500" /> Credenciais Correios
              </CardTitle>
              <CardDescription className="text-stone-400">API de Faturas e Divergências (Meu Correios).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="space-y-2 w-2/3">
                  <Label htmlFor="correiosContrato" className="text-stone-400">Contrato</Label>
                  <Input id="correiosContrato" placeholder="Ex: 9912345678" value={correiosContrato} onChange={(e) => setCorreiosContrato(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-yellow-500" />
                </div>
                <div className="space-y-2 w-1/3">
                  <Label htmlFor="correiosDr" className="text-stone-400">DR</Label>
                  <Input id="correiosDr" placeholder="Ex: 74" value={correiosDr} onChange={(e) => setCorreiosDr(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-yellow-500" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="correiosToken" className="text-stone-400">Token de Acesso (API Key)</Label>
                <Input id="correiosToken" type="password" placeholder="Chave de Acesso" value={correiosToken} onChange={(e) => setCorreiosToken(e.target.value)} className="bg-stone-950 border-stone-800 text-stone-200 focus-visible:ring-yellow-500" />
              </div>
              {correiosStatus !== "idle" && (
                <div className={cn("flex items-center gap-2 p-3 rounded-lg text-sm border", correiosStatus === "success" ? "bg-green-950/40 text-green-400 border-green-900/50" : "bg-red-950/40 text-red-400 border-red-900/50")}>
                  {correiosStatus === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">{correiosStatus === "success" ? "Correios Conectado!" : "Falha na conexão."}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveCorreios} variant="outline" className="bg-stone-950 border-stone-700 text-stone-200 hover:bg-stone-800 hover:text-white">Salvar</Button>
                <Button onClick={handleTestCorreios} disabled={isTestingCorreios} className="bg-yellow-600 hover:bg-yellow-700 text-white border-none">
                  {isTestingCorreios ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : "Testar Correios"}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>
    </div>
  );
}