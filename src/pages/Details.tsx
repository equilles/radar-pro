import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Download, Star, CheckCircle, Package, FileText, Info, Building2, MapPin, Banknote, CalendarDays as CalendarDay } from "lucide-react";
import { format } from "date-fns";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

function BidValueDisplay({ bid }: { bid: any }) {
  const displayVal = Number(bid.estimatedValue || 0);
  const showZero = displayVal === 0 && bid.valueSource === 'Não informado';

  const titleTxt = `Origem: ${bid.valueSource}
Campo da API: ${bid.apiField}
Valor API Original: ${bid.originalApiValue || 0}
Endpoint Buscado: ${bid.apiUrl || 'Nenhum'}`;

  return (
    <div className="flex flex-col items-start">
      <div className={`text-lg font-bold font-mono ${showZero ? 'text-slate-400' : 'text-slate-800'}`}>
         {showZero ? 'Valor não informado' : displayVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </div>
      {bid.valueSource && (
        <div className="text-[10px] text-slate-400 font-medium uppercase mt-1 cursor-help" title={titleTxt}>
          Origem do Valor: {bid.valueSource}
        </div>
      )}
    </div>
  );
}

export default function Details() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [savingFav, setSavingFav] = useState(false);

  // Fav state
  const [status, setStatus] = useState("Novo");
  const [prob, setProb] = useState("Média");
  const [client, setClient] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch(`/api/bids/${id}`).then(r => r.json()).then(d => {
      setData(d);
      if (d.favorite) {
        setStatus(d.favorite.status || "Novo");
        setProb(d.favorite.probability || "Média");
        setClient(d.favorite.clientId?.toString() || "");
        setNotes(d.favorite.notes || "");
      }
    });
    fetch('/api/clients').then(r => r.json()).then(c => setClients(c));
  }, [id]);

  if (!data) return <div className="p-8 text-center animate-pulse">Carregando detalhes...</div>;
  if (!data.bid) return <div className="p-8 text-center text-red-500 font-medium">Detalhes da licitação não encontrados no banco de dados. Tente sincronizar os dados novamente.</div>;

  const { bid } = data;

  const handleSaveFavorite = async () => {
    setSavingFav(true);
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bidId: bid.id,
        status,
        probability: prob,
        clientId: client || null,
        notes
      })
    });
    setSavingFav(false);
    alert('Salvo nos favoritos (CRM) com sucesso!');
  };

  const handleExport = () => {
    if (!bid) return;
    const valText = (Number(bid.estimatedValue) === 0 && bid.valueSource === 'Não informado') 
      ? 'Valor não informado' 
      : Number(bid.estimatedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const txt = `Órgão: ${bid.organ}
Objeto: ${bid.object}
Município: ${bid.municipality}
Estado: ${bid.state}
CAPAG: ${bid.capag}
Valor Estimado: ${valText} (Fonte: ${bid.valueSource || 'N/A'})
Status: ${bid.status}
Portal: ${bid.portal}
Probabilidade: ${prob}
Observações: ${notes}
`;
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Licitacao_${bid.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full gap-6 max-w-5xl mx-auto w-full pb-20">
      <Link to="/search" className="inline-flex items-center space-x-2 text-slate-500 hover:text-blue-600 text-sm font-medium shrink-0">
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para resultados</span>
      </Link>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-2">
              <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${bid.status === 'A Receber / Recebendo Proposta' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                {bid.status}
              </span>
              <span className="text-xs font-semibold text-slate-400 uppercase">{bid.portal} • {bid.id}</span>
              <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${bid.verifiedOrigin ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                {bid.verifiedOrigin ? '✓ Origem Verificada' : '✗ Origem Não Verificada'}
              </span>
              {bid.syncDate && (
                <span className="text-xs font-semibold text-slate-400">
                  Data de Sincronização: {format(new Date(bid.syncDate), "dd/MM/yyyy HH:mm")}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">{bid.object}</h1>
          </div>
          <div className="flex space-x-3">
            <button onClick={handleExport} className="inline-flex items-center space-x-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />
              <span>Exportar TXT</span>
            </button>
            <a href={(bid.linkSistemaOrigem || `https://pncp.gov.br/app/editais?q=${bid.id}`).replace('/compras/', '/app/editais/')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-10 h-10 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors" title="Abrir no Portal Original">
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-y border-slate-100">
          <DetailItem icon={Building2} label="Órgão" value={bid.organ} />
          <DetailItem icon={MapPin} label="Localidade" value={`${bid.municipality} - ${bid.state} (CAPAG ${bid.capag})`} />
          <DetailItem icon={Banknote} label="Valor Estimado / Global" value={<BidValueDisplay bid={bid} />} />
          <DetailItem icon={CalendarDay} label="Abertura" value={format(new Date(bid.openDate), "dd/MM/yyyy HH:mm")} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 flex items-center space-x-2">
                <Package className="w-4 h-4 text-slate-400" />
                <span>Itens da Licitação / CATMAT</span>
              </h3>
              <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                <ul className="space-y-2">
                  {bid.items.map((item: any, i: number) => (
                    <li key={i} className="flex flex-col space-y-1">
                      <div className="flex items-start space-x-3 text-sm text-slate-700 font-medium">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <span>{item.name || item}</span>
                      </div>
                      {(item.catmat || item.catser) && (
                        <div className="pl-7 text-xs text-slate-500 font-mono">
                          {item.catmat && <span className="mr-3">CATMAT: {item.catmat}</span>}
                          {item.catser && <span>CATSER: {item.catser}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            
            <section>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 flex items-center space-x-2">
                <Info className="w-4 h-4 text-slate-400" />
                <span>Deduplicação & Fontes</span>
              </h3>
              <div className="text-sm text-slate-600">
                <p>Encontrada em:</p>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> <span className="font-medium text-slate-700">{bid.portal}</span></span>
                  {bid.duplicateIds.length === 0 && <span className="text-slate-400 italic">Sem duplicatas identificadas</span>}
                </div>
              </div>
            </section>
          </div>

          <div>
            <div className="bg-[#F8FAFC] border border-blue-100 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-blue-100 pb-2 mb-4 flex items-center space-x-2">
                <Star className="w-3.5 h-3.5 text-blue-600 fill-current" />
                <span>Gestão Comercial (CRM)</span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold tracking-wide text-slate-500 uppercase mb-1">Status Interno</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-white border border-slate-200 rounded-md py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600">
                    <option value="Novo">Novo</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Participar">Participar</option>
                    <option value="Proposta enviada">Proposta enviada</option>
                    <option value="Aguardando resultado">Aguardando resultado</option>
                    <option value="Encerrado">Encerrado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wide text-slate-500 uppercase mb-1">Probabilidade</label>
                  <select value={prob} onChange={e => setProb(e.target.value)} className="w-full bg-white border border-slate-200 rounded-md py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600">
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wide text-slate-500 uppercase mb-1">Cliente Alvo</label>
                  <select value={client} onChange={e => setClient(e.target.value)} className="w-full bg-white border border-slate-200 rounded-md py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600">
                    <option value="">Nenhum</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wide text-slate-500 uppercase mb-1">Observações</label>
                  <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    rows={3} 
                    className="w-full bg-white border border-slate-200 rounded-md py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600" 
                    placeholder="Estratégia, margem, etc..." 
                  />
                </div>

                <button 
                  onClick={handleSaveFavorite} 
                  disabled={savingFav}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2 rounded-md transition-colors"
                >
                  {savingFav ? 'Salvando...' : 'Salvar no CRM'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex space-x-3">
      <div className="bg-slate-50 p-2.5 rounded-lg shrink-0 border border-slate-100">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  )
}

