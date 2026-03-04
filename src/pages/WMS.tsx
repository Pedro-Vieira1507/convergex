import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Map, UploadCloud, MapPin, RefreshCw, Route as RouteIcon, ListChecks, CheckCircle, X, Check, Edit3, Plus, Trash2, Maximize, Layers, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

// ============================================================================
// TIPAGENS DO SISTEMA
// ============================================================================
interface PickItem {
  codigo: string; sku: string; descricao: string; local: string; qtdeTotal: number; pedidos: string[];
}

interface ColumnData {
  levels: number;
  addresses: string[]; 
}

interface MapElement {
  id: string; name: string; x: number; y: number; w: number; h: number; 
  baseLevels: number; 
  color: string;
  cols: ColumnData[]; 
}

// NOVO: Tipagem para Multi-Almoxarifados
interface Almoxarifado {
  id: string;
  nome: string;
  layout: MapElement[];
}

// ============================================================================
// LAYOUT PADRÃO HELPER E DADOS INICIAIS
// ============================================================================
const createCols = (numCols: number, numLevels: number, defaultAddrs: string[] = []) => {
  return Array.from({ length: numCols }, () => ({
    levels: numLevels,
    addresses: Array.from({ length: numLevels }, (_, i) => defaultAddrs[i] || "")
  }));
};

const DEFAULT_LAYOUT: MapElement[] = [
  { id: '1', name: 'PAREDE ESQ.', x: 0, y: 0, w: 60, h: 600, baseLevels: 4, color: 'bg-orange-500', cols: createCols(4, 4, ["3-F", "3-E", "3-D", "3-C"]) },
  { id: '2', name: 'PAREDE FUNDO', x: 60, y: 0, w: 340, h: 60, baseLevels: 4, color: 'bg-red-600', cols: createCols(4, 4, ["4-A", "4-B", "4-C", "4-D"]) },
  { id: '3', name: 'CENTRAL', x: 140, y: 140, w: 140, h: 360, baseLevels: 4, color: 'bg-yellow-500', cols: createCols(6, 4, ["1-A, 2-A", "1-B, 2-B", "1-C, 2-C", "1-D, 1-E"]) },
  { id: '4', name: 'ENTRADA', x: 300, y: 580, w: 100, h: 20, baseLevels: 1, color: 'bg-green-600', cols: createCols(1, 1) }
];

const COLORS = ['bg-orange-500', 'bg-red-500', 'bg-red-600', 'bg-yellow-500', 'bg-green-600', 'bg-sky-500', 'bg-blue-600', 'bg-purple-600', 'bg-pink-500', 'bg-stone-700', 'bg-stone-500'];

// Fallback das zonas de roteamento (para a linha do chão)
const ZONES = {
  CENTRAL_DIREITA: ["1-A", "1-B", "1-C", "1-D", "1-E", "P12", "P13"],
  CENTRAL_ESQUERDA: ["2-A", "2-B", "2-C", "2-D", "P11", "P10"],
  PAREDE_ESQUERDA: ["4-A1", "3-A", "3-B", "3-C", "3-D", "3-E", "3-F"],
  PAREDE_FUNDO: ["4-A", "4-B", "4-C", "4-D"],
  CORR_PORTA: ["P14"],
  CORR_ESQUERDA: ["P15", "P16", "P17", "P25"],
  CORR_FUNDO: ["P18", "P19", "P20"],
  CORR_DIREITA: ["P21", "P22", "GELADEIRA"],
  CORR_CENTRAL: ["P23", "P24"]
};

// ============================================================================
// LÓGICA DE ROTEAMENTO (Chão)
// ============================================================================
const getBestLocationInfo = (localStr: string) => {
  const locals = localStr.split('/').map(s => s.replace(/\s+/g, '').toUpperCase().replace('1D', '1-D'));
  let bestScore = Infinity;
  let bestPathCoord = { x: 340, y: 580 }; 
  let bestShelfFallbackCoord = { x: 340, y: 580 }; 
  let isValid = false;

  for (const loc of locals) {
    let foundZone: string | null = null;
    let foundIndex = 0;
    let totalLength = 1;

    for (const [zoneName, items] of Object.entries(ZONES)) {
      const idx = items.findIndex(prefix => loc.startsWith(prefix));
      if (idx !== -1) { foundZone = zoneName; foundIndex = idx; totalLength = items.length; break; }
    }

    if (foundZone) {
      isValid = true;
      const ratio = totalLength > 1 ? (foundIndex / (totalLength - 1)) : 0.5;
      let score = 99999; let pCoord = { x: 340, y: 550 }; let sCoord = { x: 340, y: 550 };

      switch(foundZone) {
        case 'CENTRAL_DIREITA': score = 10000 + (ratio * 1000); pCoord = { x: 340, y: 500 - ratio * 360 }; sCoord = { x: 260, y: 500 - ratio * 360 }; break;
        case 'CORR_PORTA': score = 21000 + (ratio * 1000); pCoord = { x: 480, y: 120 - ratio * 100 }; sCoord = { x: 455, y: 120 - ratio * 100 }; break;
        case 'CORR_ESQUERDA': score = 22000 + (ratio * 1000); pCoord = { x: 480 + ratio * 240, y: 50 }; sCoord = { x: 480 + ratio * 240, y: 15 }; break;
        case 'CORR_FUNDO': score = 23000 + (ratio * 1000); pCoord = { x: 720, y: 50 + ratio * 120 }; sCoord = { x: 765, y: 50 + ratio * 120 }; break;
        case 'CORR_DIREITA': score = 24000 + ((1 - ratio) * 1000); pCoord = { x: 720 - ratio * 240, y: 170 }; sCoord = { x: 720 - ratio * 240, y: 205 }; break;
        case 'CORR_CENTRAL': score = 25000 + ((1 - ratio) * 1000); pCoord = { x: 690 - ratio * 160, y: 110 }; sCoord = { x: 690 - ratio * 160, y: 110 }; break;
        case 'PAREDE_FUNDO': score = 30000 + ((1 - ratio) * 1000); pCoord = { x: 120 + ratio * 200, y: 100 }; sCoord = { x: 120 + ratio * 200, y: 30 }; break;
        case 'CENTRAL_ESQUERDA': score = 40000 + ((1 - ratio) * 1000); pCoord = { x: 100, y: 500 - ratio * 360 }; sCoord = { x: 160, y: 500 - ratio * 360 }; break;
        case 'PAREDE_ESQUERDA': score = 40000 + ((1 - ratio) * 1000); pCoord = { x: 100, y: 540 - ratio * 400 }; sCoord = { x: 30, y: 540 - ratio * 400 }; break;
      }
      if (score < bestScore) { bestScore = score; bestPathCoord = pCoord; bestShelfFallbackCoord = sCoord; }
    }
  }
  return { isValid, score: bestScore === Infinity ? 99999 : bestScore, pathCoord: bestPathCoord, shelfFallbackCoord: bestShelfFallbackCoord };
};

const buildPath = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
  let points: {x: number, y: number}[] = [];
  if ((p1.x < 400 && p2.x > 400) || (p1.x > 400 && p2.x < 400)) {
      const doorMain = {x: 340, y: 160}; const doorCorr = {x: 460, y: 160};
      if (p1.x < 400) { points.push(...buildPath(p1, doorMain), doorCorr, ...buildPath(doorCorr, p2)); } 
      else { points.push(...buildPath(p1, doorCorr), doorMain, ...buildPath(doorMain, p2)); }
      return points;
  }
  if (p1.x < 400 && p2.x < 400) {
      if (p1.x !== p2.x && p1.y !== p2.y) {
          if ((p1.x === 100 && p2.x === 340) || (p1.x === 340 && p2.x === 100)) {
              points.push({ x: p1.x, y: (p1.y + p2.y) / 2 < 325 ? 100 : 550 }, { x: p2.x, y: (p1.y + p2.y) / 2 < 325 ? 100 : 550 });
          } else {
              if ((p1.x === 100 || p1.x === 340) && !(p2.x === 100 || p2.x === 340)) points.push({ x: p1.x, y: p2.y });
              else if (!(p1.x === 100 || p1.x === 340) && (p2.x === 100 || p2.x === 340)) points.push({ x: p2.x, y: p1.y });
              else points.push({ x: p1.x, y: p2.y });
          }
      } else if (p1.y === p2.y && p1.y > 100 && p1.y < 550 && p1.x !== p2.x) {
          points.push({ x: p1.x, y: p1.y < 325 ? 100 : 550 }, { x: p2.x, y: p1.y < 325 ? 100 : 550 });
      }
  } else {
       if (p1.x !== p2.x && p1.y !== p2.y) {
          if ((p1.y === 20 && p2.y === 200) || (p1.y === 200 && p2.y === 20)) {
              points.push({ x: (p1.x + p2.x) / 2 < 600 ? 460 : 740, y: p1.y }, { x: (p1.x + p2.x) / 2 < 600 ? 460 : 740, y: p2.y });
          } else {
              if ((p1.y === 20 || p1.y === 200) && !(p2.y === 20 || p2.y === 200)) points.push({ x: p2.x, y: p1.y });
              else if (!(p1.y === 20 || p1.y === 200) && (p2.y === 20 || p2.y === 200)) points.push({ x: p1.x, y: p2.y });
              else points.push({ x: p2.x, y: p1.y });
          }
       } else if (p1.x === p2.x && p1.x > 460 && p1.x < 740 && p1.y !== p2.y) {
          points.push({ x: p1.x < 600 ? 460 : 740, y: p1.y }, { x: p1.x < 600 ? 460 : 740, y: p2.y });
       }
  }
  return points;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function WMS() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'operation' | 'builder'>('operation');
  
  // Operação
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pickingList, setPickingList] = useState<PickItem[]>(() => { const saved = localStorage.getItem("wms_picking_list"); return saved ? JSON.parse(saved) : []; });
  const [checkedItems, setCheckedItems] = useState<number[]>(() => { const saved = localStorage.getItem("wms_checked_items"); return saved ? JSON.parse(saved) : []; });
  const [activePin, setActivePin] = useState<number | null>(null);

  // Câmera 3D Livre
  const [camRot, setCamRot] = useState({ x: 55, z: -35 });
  const [isCamDragging, setIsCamDragging] = useState(false);
  const [camStart, setCamStart] = useState({ x: 0, y: 0 });

  // NOVO: Construtor Multi-Almoxarifados com Migrator
  const [almoxarifados, setAlmoxarifados] = useState<Almoxarifado[]>(() => {
    const saved = localStorage.getItem("wms_custom_layout"); 
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && !('layout' in parsed[0])) {
          const migratedLayout = parsed.map((el: any) => ({
            ...el,
            baseLevels: el.baseLevels || el.levels || 1,
            cols: el.cols || createCols(el.columns || 1, el.levels || 1, el.levelAddresses || [])
          }));
          return [{ id: 'almox-1', nome: 'Almoxarifado Principal', layout: migratedLayout }];
        }
        return parsed;
      } catch(e) {
        return [{ id: 'almox-1', nome: 'Almoxarifado Principal', layout: DEFAULT_LAYOUT }];
      }
    }
    return [{ id: 'almox-1', nome: 'Almoxarifado Principal', layout: DEFAULT_LAYOUT }]; 
  });
  
  const [activeAlmoxId, setActiveAlmoxId] = useState<string>(almoxarifados[0]?.id || 'almox-1');

  // Variáveis Derivadas do Almoxarifado Ativo
  const activeAlmox = almoxarifados.find(a => a.id === activeAlmoxId) || almoxarifados[0];
  const elements = activeAlmox?.layout || [];

  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{id: string, startX: number, startY: number, origX: number, origY: number} | null>(null);

  const updateActiveLayout = (newLayoutOrUpdater: MapElement[] | ((prev: MapElement[]) => MapElement[])) => {
    setAlmoxarifados(prev => prev.map(a => {
      if (a.id === activeAlmoxId) {
        const nextLayout = typeof newLayoutOrUpdater === 'function' ? newLayoutOrUpdater(a.layout) : newLayoutOrUpdater;
        return { ...a, layout: nextLayout };
      }
      return a;
    }));
  };

  // ============================================================================
  // Integração SaaS (Carregamento e Salvamento via Supabase)
  // ============================================================================
  useEffect(() => {
    async function loadLayoutFromDB() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('configuracoes_empresa')
        .select('wms_layout')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (data?.wms_layout && Array.isArray(data.wms_layout)) {
        try {
          const parsed = data.wms_layout;
          if (parsed.length > 0 && !('layout' in parsed[0])) {
            const migratedLayout = parsed.map((el: any) => ({
              ...el, baseLevels: el.baseLevels || el.levels || 1, cols: el.cols || createCols(el.columns || 1, el.levels || 1, el.levelAddresses || [])
            }));
            setAlmoxarifados([{ id: 'almox-1', nome: 'Almoxarifado Principal', layout: migratedLayout }]);
          } else {
            setAlmoxarifados(parsed);
          }
        } catch (e) { console.error("Erro ao processar layout da nuvem", e); }
      }
    }
    loadLayoutFromDB();
  }, []);

  useEffect(() => {
    localStorage.setItem("wms_picking_list", JSON.stringify(pickingList));
    localStorage.setItem("wms_checked_items", JSON.stringify(checkedItems));
    localStorage.setItem("wms_custom_layout", JSON.stringify(almoxarifados));

    const timeoutId = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('configuracoes_empresa')
          .update({ wms_layout: almoxarifados })
          .eq('user_id', session.user.id);
      }
    }, 1500); 

    return () => clearTimeout(timeoutId);
  }, [pickingList, checkedItems, almoxarifados]);


  const handleCamMouseDown = (e: React.MouseEvent) => { setIsCamDragging(true); setCamStart({ x: e.clientX, y: e.clientY }); };
  const handleCamMouseMove = (e: React.MouseEvent) => {
    if (!isCamDragging) return;
    const dx = e.clientX - camStart.x; const dy = e.clientY - camStart.y;
    setCamRot(prev => ({ x: Math.max(0, Math.min(85, prev.x - dy * 0.5)), z: prev.z + dx * 0.5 }));
    setCamStart({ x: e.clientX, y: e.clientY });
  };
  const handleCamMouseUp = () => setIsCamDragging(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]); };

  const handleProcessFile = async () => {
    if (!file) return; setIsProcessing(true);
    try {
      const text = await file.text(); const parser = new DOMParser(); const doc = parser.parseFromString(text, 'text/html');
      const divs = Array.from(doc.querySelectorAll('div'));
      const parsedElements = divs.map(div => ({ top: parseInt(div.style.top || '0', 10), left: parseInt(div.style.left || '0', 10), text: div.textContent?.trim() || '' })).filter(e => e.text);
      const rowsByTop: Record<number, typeof parsedElements> = {};
      parsedElements.forEach(e => { if (!rowsByTop[e.top]) rowsByTop[e.top] = []; rowsByTop[e.top].push(e); });
      const sortedTops = Object.keys(rowsByTop).map(Number).sort((a, b) => a - b);

      let currentPedido = ""; let lastParsedItem: any = null; const rawItems: any[] = [];
      sortedTops.forEach(top => {
        const rowElements = rowsByTop[top].sort((a, b) => a.left - b.left);
        const texts = rowElements.map(e => e.text);
        if (texts[0].startsWith('PEDIDO:')) currentPedido = texts[0].replace('PEDIDO:', '').trim();
        else if (texts[0].startsWith('LOCAL:')) { if (lastParsedItem) lastParsedItem.local = texts[0].replace('LOCAL:', '').trim(); } 
        else if (texts.length >= 7 && (texts[6] === 'SIM' || texts[6] === 'NAO' || texts[6] === 'NÃO')) {
          const qtde = parseFloat(texts[4].replace(/\./g, '').replace(',', '.')); 
          const item = { pedido: currentPedido, codigo: texts[0], sku: texts[1], descricao: texts[2], qtde: qtde, atendido: texts[6] === 'SIM', local: "Sem Local" };
          lastParsedItem = item; rawItems.push(item);
        }
      });

      const batchMap: Record<string, PickItem> = {};
      const unknownLocations = new Set<string>();

      rawItems.filter(item => item.atendido).forEach(item => {
          if (!batchMap[item.codigo]) { batchMap[item.codigo] = { codigo: item.codigo, sku: item.sku, descricao: item.descricao, local: item.local, qtdeTotal: 0, pedidos: [] }; }
          batchMap[item.codigo].qtdeTotal += item.qtde;
          if (!batchMap[item.codigo].pedidos.includes(item.pedido)) batchMap[item.codigo].pedidos.push(item.pedido);

          const locals = item.local.split('/').map(s => s.replace(/\s+/g, '').toUpperCase().replace('1D', '1-D'));
          let isMapped = false;
          for (const loc of locals) {
             let found = false;
             for (const items of Object.values(ZONES)) { if (items.some(prefix => loc.startsWith(prefix))) { found = true; break; } }
             
             for (const el of elements) {
                if(!el.cols) continue; 
                for (const col of el.cols) {
                   for (const addrLine of (col.addresses || [])) {
                     if (addrLine.split(',').some(prefix => loc.startsWith(prefix.trim()))) found = true;
                   }
                }
             }
             if (found) { isMapped = true; break; }
          }
          if (!isMapped) unknownLocations.add(item.local);
      });

      const validItems: PickItem[] = [];
      Object.values(batchMap).forEach(item => { if (getBestLocationInfo(item.local).isValid) validItems.push(item); });
      const finalList = validItems.sort((a, b) => getBestLocationInfo(a.local).score - getBestLocationInfo(b.local).score);

      setPickingList(finalList); setCheckedItems([]); setActivePin(null);
      toast({ title: `Rota Gerada: ${activeAlmox.nome}`, description: `${finalList.length} SKUs encontrados para esta separação.` });

      if (unknownLocations.size > 0) {
        setTimeout(() => {
          toast({ variant: "destructive", title: "Atenção: Endereços não mapeados!", description: `Excluídos da rota: ${Array.from(unknownLocations).join(' | ')}`, duration: 9999999 });
        }, 800); 
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro na leitura", description: "Verifique o arquivo HTML." });
    } finally { setIsProcessing(false); }
  };

  const resetList = () => {
    setPickingList([]); setCheckedItems([]); setActivePin(null); setFile(null);
    localStorage.removeItem("wms_picking_list"); localStorage.removeItem("wms_checked_items");
  };

  const handleToggleCheck = (idx: number, e: React.MouseEvent) => { e.stopPropagation(); setCheckedItems(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]); };
  const handleMapClick = () => { if (activePin !== null) setActivePin(null); };

  const handleCriarAlmoxarifado = () => {
    const newId = `almox-${Date.now()}`;
    const novo: Almoxarifado = { id: newId, nome: `Novo Galpão ${almoxarifados.length + 1}`, layout: [] };
    setAlmoxarifados([...almoxarifados, novo]);
    setActiveAlmoxId(newId);
    setSelectedEl(null);
  };

  const handleExcluirAlmoxarifado = () => {
    if (almoxarifados.length <= 1) {
      toast({ variant: "destructive", title: "Ação não permitida", description: "Você precisa ter pelo menos um almoxarifado." });
      return;
    }
    if (confirm(`Tem certeza que deseja excluir o ${activeAlmox.nome}? O mapa será perdido.`)) {
      const novaLista = almoxarifados.filter(a => a.id !== activeAlmoxId);
      setAlmoxarifados(novaLista);
      setActiveAlmoxId(novaLista[0].id);
      setSelectedEl(null);
    }
  };

  const handleRenomearAlmoxarifado = (novoNome: string) => {
    setAlmoxarifados(prev => prev.map(a => a.id === activeAlmoxId ? { ...a, nome: novoNome } : a));
  };


  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX; const dy = e.clientY - dragging.startY;
    let newX = Math.round((dragging.origX + dx) / 10) * 10; let newY = Math.round((dragging.origY + dy) / 10) * 10;
    if (newX < 0) newX = 0; if (newY < 0) newY = 0;
    updateActiveLayout(prev => prev.map(el => el.id === dragging.id ? { ...el, x: newX, y: newY } : el));
  };
  const handleCanvasMouseUp = () => setDragging(null);
  
  const addNewElement = () => {
    const newEl: MapElement = { id: Date.now().toString(), name: 'NOVA GÔNDOLA', x: 350, y: 250, w: 100, h: 60, baseLevels: 4, color: 'bg-stone-500', cols: createCols(2, 4) };
    updateActiveLayout([...elements, newEl]); setSelectedEl(newEl.id);
  };
  
  const deleteElement = (id: string) => { updateActiveLayout(elements.filter(e => e.id !== id)); if (selectedEl === id) setSelectedEl(null); };
  
  const updateSelected = (key: keyof MapElement, value: any) => {
    if (!selectedEl) return; 
    updateActiveLayout(prev => prev.map(el => el.id === selectedEl ? { ...el, [key]: value } : el));
  };

  const updateColumnsAmount = (amount: number) => {
    if (!selectedEl || amount < 1) return;
    updateActiveLayout(prev => prev.map(el => {
      if (el.id !== selectedEl) return el;
      const newCols = [...(el.cols || [])];
      if (amount > newCols.length) {
        while(newCols.length < amount) newCols.push({ levels: el.baseLevels || 1, addresses: Array(el.baseLevels || 1).fill("") });
      } else { newCols.splice(amount); }
      return { ...el, cols: newCols };
    }));
  };

  const updateColLevels = (colIdx: number, levels: number) => {
    if (!selectedEl || levels < 1) return;
    updateActiveLayout(prev => prev.map(el => {
      if (el.id !== selectedEl) return el;
      const newCols = [...(el.cols || [])];
      const newAddresses = [...newCols[colIdx].addresses];
      if (levels > newAddresses.length) {
        while(newAddresses.length < levels) newAddresses.push("");
      } else { newAddresses.splice(levels); }
      newCols[colIdx] = { ...newCols[colIdx], levels, addresses: newAddresses };
      return { ...el, cols: newCols };
    }));
  };

  const updateColAddress = (colIdx: number, levelIdx: number, val: string) => {
    if (!selectedEl) return;
    updateActiveLayout(prev => prev.map(el => {
      if (el.id !== selectedEl) return el;
      const newCols = [...(el.cols || [])];
      const newAddresses = [...newCols[colIdx].addresses];
      newAddresses[levelIdx] = val;
      newCols[colIdx] = { ...newCols[colIdx], addresses: newAddresses };
      return { ...el, cols: newCols };
    }));
  };

  const fullOrthogonalPath: {x: number, y: number}[] = [{ x: 340, y: 580 }]; 
  
  const visualPins = pickingList.map((item) => {
    const info = getBestLocationInfo(item.local);
    const curr = fullOrthogonalPath[fullOrthogonalPath.length - 1];
    fullOrthogonalPath.push(...buildPath(curr, info.pathCoord)); fullOrthogonalPath.push(info.pathCoord);

    const prefixes = item.local.split('/').map(s => s.replace(/\s+/g, '').toUpperCase());
    let foundEl: MapElement | null = null;
    let foundColIndex = -1;
    let foundLevelIndex = -1;

    for (const el of elements) {
      if (!el.cols) continue;
      for (let c = 0; c < el.cols.length; c++) {
        const colData = el.cols[c];
        for (let l = 0; l < colData.levels; l++) {
          const addrs = (colData.addresses[l] || "").split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
          for (const prefix of prefixes) {
            if (addrs.some(a => prefix.startsWith(a))) {
              foundEl = el; foundColIndex = c; foundLevelIndex = l; break;
            }
          }
          if (foundEl) break;
        }
        if (foundEl) break;
      }
      if (foundEl) break;
    }

    if (foundEl && foundColIndex !== -1 && foundLevelIndex !== -1) {
      const isHorizontal = foundEl.w > foundEl.h;
      const colsCount = foundEl.cols.length;
      let localX = foundEl.w / 2; let localY = foundEl.h / 2;

      if (isHorizontal) { const colW = foundEl.w / colsCount; localX = (foundColIndex * colW) + (colW / 2); } 
      else { const colH = foundEl.h / colsCount; localY = (foundColIndex * colH) + (colH / 2); }

      const totalHeight = (foundEl.baseLevels || 1) * 40;
      const levelHeight = totalHeight / foundEl.cols[foundColIndex].levels;
      const exactZ = (foundLevelIndex * levelHeight) + 15;

      return { x: foundEl.x + localX, y: foundEl.y + localY, z: exactZ };
    } 
    return { x: info.shelfFallbackCoord.x, y: info.shelfFallbackCoord.y, z: -1 }; 
  });

  if (pickingList.length > 0) {
    const curr = fullOrthogonalPath[fullOrthogonalPath.length - 1];
    fullOrthogonalPath.push(...buildPath(curr, { x: 100, y: 580 })); fullOrthogonalPath.push({ x: 100, y: 580 });
  }

  const coordCounts: Record<string, number> = {};
  const adjustedPins = visualPins.map(pt => {
    let finalZ = pt.z;
    if (finalZ === -1) {
      const keyFallback = `${pt.x},${pt.y},fallback`; const c = coordCounts[keyFallback] || 0; coordCounts[keyFallback] = c + 1;
      finalZ = 20 + (c * 35); return { x: pt.x, y: pt.y, z: finalZ };
    } else {
      const key = `${pt.x},${pt.y},${pt.z}`; const c = coordCounts[key] || 0; coordCounts[key] = c + 1;
      const offsetX = (c % 2 === 0 ? 1 : -1) * (Math.floor(c / 2) * 10);
      const offsetY = (c % 3 === 0 ? 1 : -1) * (Math.floor(c / 3) * 10);
      return { x: pt.x + offsetX, y: pt.y + offsetY, z: finalZ };
    }
  });


  return (
    <div className="space-y-6 p-6 text-stone-200">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader title="Roteirização WMS" description="Mapeamento Fino por Coluna e Andar com suporte a múltiplos Galpões." />
        <div className="flex gap-2">
          
          <div className="bg-stone-900 border border-stone-800 p-1 rounded-lg flex shadow-inner">
            <button 
              className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2", 
                activeTab === 'operation' ? "bg-red-600 text-white shadow-md shadow-red-900/20" : "text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              )} 
              onClick={() => setActiveTab('operation')}
            >
              <Maximize className="w-4 h-4"/> Operação 3D
            </button>
            <button 
              className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2", 
                activeTab === 'builder' ? "bg-red-600 text-white shadow-md shadow-red-900/20" : "text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              )} 
              onClick={() => setActiveTab('builder')}
            >
              <Edit3 className="w-4 h-4"/> Construtor 2D
            </button>
          </div>

          {activeTab === 'operation' && pickingList.length > 0 && (
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-md transition-all hover:shadow-red-900/20" 
              onClick={resetList}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Novo Lote
            </Button>
          )}

        </div>
      </div>

      {/* ============================================================================ */}
      {/* MODO: CONSTRUTOR DE PLANTAS                                                  */}
      {/* ============================================================================ */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="shadow-sm border-stone-800 bg-stone-900 lg:col-span-1 h-fit">
            <CardHeader className="border-b border-stone-800 bg-stone-950/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-red-500"><Edit3 className="w-5 h-5"/> Propriedades</CardTitle>
              <CardDescription className="text-stone-400">Crie o mapa e configure cada estrutura.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-6 max-h-[750px] overflow-y-auto custom-scrollbar">
              
              {/* PAINEL DE MULTI-ALMOXARIFADO */}
              <div className="space-y-3 bg-red-950/10 p-4 border border-red-900/30 rounded-lg">
                <label className="text-xs font-bold text-red-400 flex items-center gap-1"><Building2 className="w-4 h-4"/> ALMOXARIFADO ATUAL</label>
                <div className="flex gap-2">
                  <select 
                    value={activeAlmoxId} 
                    onChange={(e) => { setActiveAlmoxId(e.target.value); setSelectedEl(null); }}
                    className="flex h-9 w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-red-500 text-stone-200"
                  >
                    {almoxarifados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                  <Button size="icon" variant="outline" onClick={handleCriarAlmoxarifado} className="h-9 w-9 shrink-0 bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700 hover:text-white" title="Criar Novo Almoxarifado"><Plus className="w-4 h-4"/></Button>
                </div>
                <div className="flex gap-2 items-center pt-2">
                   <Input value={activeAlmox.nome} onChange={(e) => handleRenomearAlmoxarifado(e.target.value)} className="h-8 text-xs bg-stone-950 border-stone-800 text-stone-200" placeholder="Nome do Galpão" />
                   <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-950/40" onClick={handleExcluirAlmoxarifado} title="Excluir Almoxarifado"><Trash2 className="w-4 h-4"/></Button>
                </div>
              </div>

              <Button onClick={addNewElement} className="w-full bg-red-600 hover:bg-red-700 text-white border-none shadow-md transition-all hover:shadow-red-900/20"><Plus className="w-4 h-4 mr-2"/> Nova Estrutura neste Galpão</Button>
              
              {selectedEl ? (() => {
                const el = elements.find(e=>e.id===selectedEl)!;
                return (
                <div className="space-y-4 p-4 bg-stone-950 border border-stone-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-stone-200">Editar Móvel</h3>
                    <button onClick={() => deleteElement(selectedEl)} className="text-red-500 hover:text-red-400 p-1"><Trash2 className="w-4 h-4"/></button>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500">NOME</label>
                    <Input value={el.name} onChange={(e) => updateSelected('name', e.target.value)} className="bg-stone-900 border-stone-800 text-stone-200" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-stone-500">POS. X</label><Input type="number" value={el.x} onChange={(e) => updateSelected('x', parseInt(e.target.value))} className="bg-stone-900 border-stone-800 text-stone-200"/></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-stone-500">POS. Y</label><Input type="number" value={el.y} onChange={(e) => updateSelected('y', parseInt(e.target.value))} className="bg-stone-900 border-stone-800 text-stone-200"/></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-stone-500">LARGURA</label><Input type="number" value={el.w} onChange={(e) => updateSelected('w', parseInt(e.target.value))} className="bg-stone-900 border-stone-800 text-stone-200"/></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-stone-500">ALTURA</label><Input type="number" value={el.h} onChange={(e) => updateSelected('h', parseInt(e.target.value))} className="bg-stone-900 border-stone-800 text-stone-200"/></div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-stone-800 mt-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">Cor da Estrutura</label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => updateSelected('color', c)} className={cn("w-6 h-6 rounded-full border-2", c, el.color === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-110 transition-transform")} />
                      ))}
                    </div>
                  </div>

                  {/* CONFIGURAÇÃO AVANÇADA (ALTURA BASE + COLUNAS) */}
                  <div className="space-y-4 border-t border-stone-800 pt-4 mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-red-500" title="Altura máxima do móvel de aço em 'Andares Padrão'">ALTURA GERAL</label>
                        <Input type="number" min={1} max={10} value={el.baseLevels || 1} onChange={(e) => updateSelected('baseLevels', parseInt(e.target.value))} className="border-stone-800 bg-stone-900 text-stone-200 h-8 text-center"/>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-red-500">QTD COLUNAS</label>
                        <Input type="number" min={1} max={20} value={el.cols?.length || 1} onChange={(e) => updateColumnsAmount(parseInt(e.target.value))} className="border-stone-800 bg-stone-900 text-stone-200 h-8 text-center"/>
                      </div>
                    </div>

                    <label className="text-xs font-bold text-red-500 flex items-center gap-1 mt-4"><Layers className="w-4 h-4"/> MAPEAMENTO POR COLUNA</label>
                    <p className="text-[10px] text-stone-500 leading-tight">Defina quantos andares cada coluna tem, e o que fica em cada andar.</p>
                    
                    {/* SCROLL LATERAL PARA AS COLUNAS */}
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar">
                      {(el.cols || []).map((col, cIdx) => (
                        <div key={cIdx} className="min-w-[180px] bg-stone-900 border border-stone-800 rounded-lg p-3 shadow-sm snap-start shrink-0">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-stone-800">
                            <span className="text-xs font-bold text-stone-300">Coluna {cIdx + 1}</span>
                            <div className="flex items-center gap-1">
                               <span className="text-[9px] text-stone-500">Andares:</span>
                               <Input type="number" min={1} max={15} value={col.levels} onChange={(e) => updateColLevels(cIdx, parseInt(e.target.value))} className="w-12 h-6 text-[10px] px-1 text-center font-bold bg-stone-950 border-stone-700 text-stone-200" />
                            </div>
                          </div>
                          
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                            {Array.from({ length: col.levels }).map((_, lIdx) => (
                              <div key={lIdx} className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-stone-500 w-6">N{lIdx + 1}</span>
                                <Input placeholder="Prefixos..." className="h-6 text-[9px] font-mono px-1.5 bg-stone-950 border-stone-800 text-stone-300" value={col.addresses[lIdx] || ''} onChange={(e) => updateColAddress(cIdx, lIdx, e.target.value)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })() : (
                <div className="p-6 border-2 border-dashed border-stone-800 rounded-lg text-center text-stone-500 text-sm">Clique em um item no mapa para editar ou mapear andares.</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-stone-800 lg:col-span-3 overflow-hidden bg-stone-950 flex justify-center items-center py-8">
            <div 
              className="relative w-[800px] h-[600px] bg-stone-900 shadow-xl border-2 border-stone-700"
              onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
            >
              {/* Grid Dark Mode */}
              <div className="absolute inset-0 bg-[linear-gradient(#292524_1px,transparent_1px),linear-gradient(90deg,#292524_1px,transparent_1px)] bg-[size:10px_10px] opacity-80 pointer-events-none"></div>
              {elements.map(el => (
                <div
                  key={el.id}
                  onMouseDown={(e) => { e.stopPropagation(); setSelectedEl(el.id); setDragging({ id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y }); }}
                  className={cn("absolute shadow-md flex flex-col cursor-move transition-shadow", el.color, selectedEl === el.id ? "ring-2 ring-offset-2 ring-offset-stone-900 ring-red-500 z-50 brightness-110 shadow-2xl" : "hover:brightness-110 z-10")}
                  style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
                >
                  <div className="absolute inset-0 border-b-4 border-black/30 pointer-events-none"></div>
                  
                  {/* Desenho 2D das Divisórias (Colunas) */}
                  <div className={cn("absolute inset-0 flex pointer-events-none", el.w > el.h ? "flex-row" : "flex-col")}>
                     {Array.from({ length: el.cols?.length || 1 }).map((_, c) => (
                        <div key={c} className={cn("flex-1 border-black/30 flex items-center justify-center overflow-hidden", el.w > el.h ? "border-r last:border-r-0" : "border-b last:border-b-0")}>
                           <span className="text-[7px] text-white/50 font-bold mix-blend-overlay">{c+1}</span>
                        </div>
                     ))}
                  </div>

                  <span className={cn("absolute inset-0 flex items-center justify-center font-black text-white/90 truncate px-1 pointer-events-none", el.w < 50 ? "-rotate-90 text-[10px]" : "text-xs")}>{el.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODO: OPERAÇÃO 3D (Picking + Câmera Livre)                                   */}
      {/* ============================================================================ */}
      {activeTab === 'operation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {pickingList.length === 0 && (
            <Card className="shadow-sm lg:col-span-1 h-fit border-stone-800 bg-stone-900">
              <CardHeader className="bg-stone-950/50 border-b border-stone-800 pb-4">
                <CardTitle className="text-lg font-heading flex items-center gap-2 text-red-500"><UploadCloud className="w-5 h-5" />Importar Relatório</CardTitle>
                <CardDescription className="text-stone-400">Configure a separação e faça o upload da lista.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                
                {/* ESCOLHA DO ALMOXARIFADO NA OPERAÇÃO */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-300 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                    Selecione o Galpão:
                  </label>
                  <select 
                    value={activeAlmoxId} 
                    onChange={(e) => setActiveAlmoxId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {almoxarifados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-300 flex items-center gap-2">
                    <span className="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                    Arquivo HTML:
                  </label>
                  <div className="border-2 border-dashed border-stone-700 rounded-lg p-6 text-center hover:bg-stone-800 transition-colors bg-stone-950">
                    <Input type="file" accept=".htm, .html" onChange={handleFileChange} className="cursor-pointer bg-transparent text-stone-300 border-none file:text-stone-300 file:bg-stone-800 file:rounded-md file:border-none file:px-3 file:py-1 file:mr-3" />
                  </div>
                </div>

                <Button className="w-full h-12 text-md shadow-md shadow-red-900/20 bg-red-600 hover:bg-red-700 text-white border-none transition-all" onClick={handleProcessFile} disabled={!file || isProcessing}>
                  {isProcessing ? "Lendo dados..." : "Processar Separação"}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className={`shadow-sm border-stone-800 ${pickingList.length > 0 ? 'lg:col-span-3' : 'lg:col-span-2'} overflow-hidden bg-stone-900`}>
            <CardHeader className="bg-stone-950/50 border-b border-stone-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-heading flex items-center gap-2 text-red-500">
                  <RouteIcon className="w-5 h-5" /> Galpão: {activeAlmox.nome}
                </CardTitle>
                <CardDescription className="text-stone-400"><strong>Arraste o fundo</strong> para girar a câmera. As bolinhas voam exatamente para o compartimento mapeado!</CardDescription>
              </div>
              
              {/* BOTÃO RECENTRALIZAR CÂMERA */}
              <Button 
                size="sm" 
                onClick={() => setCamRot({x:55, z:-35})} 
                className="bg-red-600 hover:bg-red-700 text-white border-none shadow-md transition-all hover:shadow-red-900/20"
              >
                Recentralizar Câmera
              </Button>

            </CardHeader>
            <CardContent className="p-0 bg-stone-950 flex justify-center items-center h-[650px] overflow-hidden relative perspective-[1200px]" >
              
              {pickingList.length > 0 ? (
                // CÂMERA 3D (ORBIT)
                <div 
                  className={cn("relative w-[800px] h-[600px] transition-transform duration-75 [transform-style:preserve-3d]", isCamDragging ? "cursor-grabbing" : "cursor-grab")}
                  onMouseDown={handleCamMouseDown} onMouseMove={handleCamMouseMove} onMouseUp={handleCamMouseUp} onMouseLeave={handleCamMouseUp}
                  style={{ transform: `rotateX(${camRot.x}deg) rotateZ(${camRot.z}deg) scale(0.85)` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(#292524_2px,transparent_2px),linear-gradient(90deg,#292524_2px,transparent_2px)] bg-[size:40px_40px] opacity-80 pointer-events-none"></div>

                  {/* ========================================================= */}
                  {/* RENDERIZA GÔNDOLAS 3D FATIADAS POR COLUNAS E SEUS ANDARES */}
                  {/* ========================================================= */}
                  {elements.map(el => {
                    const totalStructuralHeight = (el.baseLevels || 1) * 40;
                    const isHorizontal = el.w > el.h;
                    const colsCount = el.cols?.length || 1;

                    return (
                    <div key={el.id} className="absolute [transform-style:preserve-3d] pointer-events-none" style={{ left: el.x, top: el.y, width: el.w, height: el.h }}>
                      
                      <div className="absolute inset-0 bg-black/50 blur-sm"></div>

                      {/* Renderiza as Colunas da Gôndola */}
                      {(el.cols || []).map((colData, cIdx) => {
                         const colW = isHorizontal ? el.w / colsCount : el.w;
                         const colH = isHorizontal ? el.h : el.h / colsCount;
                         const colX = isHorizontal ? cIdx * colW : 0;
                         const colY = isHorizontal ? 0 : cIdx * colH;

                         const levelHeight = totalStructuralHeight / colData.levels;

                         return (
                           <div key={`col-${cIdx}`} className="absolute [transform-style:preserve-3d]" style={{ left: colX, top: colY, width: colW, height: colH }}>
                              
                              {/* Renderiza os Andares desta Coluna específica */}
                              {Array.from({ length: colData.levels }).map((_, lIdx) => (
                                 <div key={`lvl-${lIdx}`} className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: `translateZ(${(lIdx + 1) * levelHeight}px)` }}>
                                    <div className={cn("absolute inset-0 opacity-90 border border-black/50 shadow-sm", el.color)}></div>
                                    <div className="absolute top-full left-0 w-full h-[6px] bg-black/60 origin-top" style={{ transform: 'rotateX(-90deg)' }}></div>
                                    <div className="absolute top-0 left-full w-[6px] h-full bg-black/70 origin-left" style={{ transform: 'rotateY(90deg)' }}></div>
                                 </div>
                              ))}
                           </div>
                         );
                      })}

                      {/* Pilares de Sustentação */}
                      <div className="absolute top-0 left-0 w-[4px] bg-stone-900 origin-top shadow-lg" style={{ height: totalStructuralHeight, transform: 'rotateX(-90deg)' }}></div>
                      <div className="absolute top-full left-0 w-[4px] bg-stone-900 origin-top shadow-lg" style={{ height: totalStructuralHeight, transform: 'rotateX(-90deg)' }}></div>
                      <div className="absolute top-0 right-0 w-[4px] bg-stone-900 origin-top shadow-lg" style={{ height: totalStructuralHeight, transform: 'rotateX(-90deg)' }}></div>
                      <div className="absolute top-full right-0 w-[4px] bg-stone-900 origin-top shadow-lg" style={{ height: totalStructuralHeight, transform: 'rotateX(-90deg)' }}></div>

                      {/* Teto Invisível com o Nome */}
                      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateZ(${totalStructuralHeight + 20}px)` }}>
                        <span className="font-black text-stone-200 tracking-widest whitespace-nowrap text-[10px] bg-black/70 px-1.5 py-0.5 border border-stone-600/50 rounded-sm shadow-sm backdrop-blur-sm" style={{ transform: `rotateZ(${-camRot.z}deg) rotateX(${-camRot.x}deg)` }}>
                          {el.name}
                        </span>
                      </div>
                    </div>
                  )})}

                  {/* LINHA ANIMADA DO CAMINHO NO CHÃO */}
                  <svg viewBox="0 0 800 600" className="absolute inset-0 w-full h-full overflow-visible [transform:translateZ(2px)] pointer-events-none">
                    <polyline points={fullOrthogonalPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinejoin="round" strokeDasharray="10,10" className="animate-[dash_20s_linear_infinite]" />
                    <polygon points="95,575 105,575 100,585" fill="#ef4444" className="animate-[dash_20s_linear_infinite]" />
                  </svg>

                  {/* BOLINHAS NO AR (Nas prateleiras corretas!) */}
                  {adjustedPins.map((pos, idx) => {
                    const item = pickingList[idx]; 
                    const isChecked = checkedItems.includes(idx);
                    const isActive = activePin === idx;

                    return (
                      <div 
                        key={idx}
                        className={cn("absolute group transition-all duration-300", isActive ? "z-[999]" : "z-50")}
                        style={{ 
                          left: pos.x - 12, top: pos.y - 12,
                          transform: `translateZ(${isActive ? pos.z + 10 : pos.z}px) rotateZ(${-camRot.z}deg) rotateX(${-camRot.x}deg)` 
                        }}
                        onMouseDown={(e) => e.stopPropagation()} 
                        onClick={(e) => { e.stopPropagation(); setActivePin(isActive ? null : idx); }}
                      >
                        <div className={cn("w-6 h-6 border-2 border-stone-200/50 rounded-full shadow-2xl flex items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-colors",
                          isChecked ? "bg-green-600 hover:bg-green-500" : "bg-stone-800 hover:bg-red-600",
                          isActive && !isChecked && "ring-4 ring-red-500/80", isActive && isChecked && "ring-4 ring-green-500/80"
                        )}>
                          {isChecked ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : (idx + 1)}
                        </div>

                        {/* Modal Aberto */}
                        {isActive && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-stone-900 border border-stone-700 text-stone-200 rounded-lg shadow-2xl origin-bottom animate-in fade-in zoom-in duration-200 cursor-default">
                            <div className="p-3.5 text-[11px] leading-relaxed flex flex-col gap-2">
                              <div className="flex justify-between items-center border-b border-stone-700 pb-2">
                                <span className="font-bold text-red-500 text-xs">TAREFA {idx + 1}</span>
                                <button onClick={() => setActivePin(null)} className="text-stone-400 hover:text-white bg-stone-800 rounded-full p-1"><X className="w-3.5 h-3.5"/></button>
                              </div>
                              <div>
                                <Badge variant="outline" className="text-[10px] h-5 border-stone-700 bg-stone-950 text-stone-300 px-2 rounded-md mb-2"><MapPin className="w-3 h-3 mr-1" /> {item.local}</Badge>
                                <p className="font-mono text-stone-400 mb-1">SKU: <span className="text-stone-200">{item.sku}</span></p>
                                <p className="line-clamp-2 text-stone-300" title={item.descricao}>{item.descricao}</p>
                              </div>
                              <div className="mt-1 pt-2 border-t border-stone-700 flex justify-between items-center">
                                <span className="text-stone-400 uppercase tracking-wider text-[9px] font-bold">A Coletar</span>
                                <span className="font-black text-green-500 text-lg">{item.qtdeTotal} un</span>
                              </div>
                              <Button size="sm" className={cn("w-full mt-1 h-8 font-bold border-none", isChecked ? "bg-stone-700 hover:bg-stone-600 text-white" : "bg-green-600 hover:bg-green-500")} onClick={(e) => { handleToggleCheck(idx, e); setActivePin(null); }}>
                                {isChecked ? "Desmarcar Tarefa" : "Confirmar Coleta"}
                              </Button>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-stone-700"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-stone-500 text-center pointer-events-none" onClick={handleMapClick}>
                  <Map className="w-16 h-16 mx-auto mb-4 opacity-20 text-red-500" />
                  <p>Escolha o galpão e importe um lote para visualizar o trajeto.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* TABELA DE ROTA GERADA */}
          {pickingList.length > 0 && (
            <Card className="shadow-sm border-stone-800 bg-stone-900 lg:col-span-3">
              <CardHeader className="border-b border-stone-800 bg-stone-950/50">
                <CardTitle className="text-lg font-heading flex items-center gap-2 text-red-500"><ListChecks className="w-5 h-5 text-red-500" />Lista de Coleta Sequencial</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t border-stone-800">
                  <Table>
                    <TableHeader className="bg-stone-950">
                      <TableRow className="border-stone-800 hover:bg-transparent">
                        <TableHead className="w-[80px] text-center text-stone-400">Status</TableHead>
                        <TableHead className="w-[150px] text-stone-400">Local</TableHead>
                        <TableHead className="w-[100px] text-stone-400">Código</TableHead>
                        <TableHead className="w-[120px] text-stone-400">SKU</TableHead>
                        <TableHead className="text-stone-400">Produto</TableHead>
                        <TableHead className="text-stone-400">Atende Pedidos</TableHead>
                        <TableHead className="text-right text-stone-400">Qtd. Coletar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-stone-800">
                      {pickingList.map((item, idx) => {
                        const isChecked = checkedItems.includes(idx);
                        return (
                          <TableRow key={idx} className={cn("transition-colors border-stone-800", isChecked ? "bg-green-950/20 hover:bg-green-950/30" : "hover:bg-stone-800/50")}>
                            <TableCell className="text-center font-bold">
                              <div onClick={(e) => handleToggleCheck(idx, e)} className={cn("w-7 h-7 rounded-full flex items-center justify-center mx-auto text-xs cursor-pointer transition-all border-2", isChecked ? "bg-green-600 border-green-600 text-white" : "bg-stone-800 border-stone-700 text-stone-400 hover:border-red-500 hover:text-red-500")}>
                                {isChecked ? <CheckCircle className="w-4 h-4" /> : (idx + 1)}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className={cn("font-mono text-sm", isChecked ? "bg-transparent text-stone-500 border-stone-700" : "bg-stone-800 text-stone-300 border-stone-700")}>{item.local}</Badge></TableCell>
                            <TableCell className={cn("font-mono", isChecked ? "text-stone-600 line-through" : "text-stone-400")}>{item.codigo}</TableCell>
                            <TableCell className={cn("font-mono font-medium", isChecked ? "text-stone-600 line-through" : "text-red-400")}>{item.sku}</TableCell>
                            <TableCell className={cn("font-medium", isChecked ? "text-stone-600 line-through" : "text-stone-200")}>{item.descricao}</TableCell>
                            <TableCell><span className={cn("text-xs", isChecked ? "text-stone-600" : "text-stone-400")}>{item.pedidos.join(', ')}</span></TableCell>
                            <TableCell className="text-right"><span className={cn("text-lg font-bold", isChecked ? "text-stone-600" : "text-green-500")}>{item.qtdeTotal} un</span></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}