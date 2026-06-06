import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, Filter, AlertCircle, Clock, RefreshCw, MapPin, Tag, Download, BookMarked } from "lucide-react";
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
    <div className="flex flex-col items-end">
      {bid.valueSource && (
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1 cursor-help" title={titleTxt}>
           Fonte: {bid.valueSource}
        </span>
      )}
      <div className={`text-xl font-bold font-mono ${showZero ? 'text-slate-400' : 'text-slate-800'}`}>
         {showZero ? 'Valor não informado' : displayVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </div>
    </div>
  );
}

export default function Search() {
  const location = new URLSearchParams(window.location.search);
  const initialQ = location.get('q') || "";
  const [query, setQuery] = useState(initialQ);
  const [status, setStatus] = useState("A Receber / Recebendo Proposta");
  const [portal, setPortal] = useState("");
  const [capag, setCapag] = useState("");
  const [state, setState] = useState("");
  const [modality, setModality] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const fetchBids = async (pageNum = page) => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (query) qParams.append('q', query);
      if (status && status !== 'Todos') qParams.append('status', status);
      if (portal) qParams.append('portal', portal);
      if (capag) qParams.append('capag', capag);
      if (state) qParams.append('state', state);
      if (modality) qParams.append('modality', modality);
      if (startDate) qParams.append('startDate', startDate);
      if (endDate) qParams.append('endDate', endDate);
      qParams.append('page', pageNum.toString());
      
      const res = await fetch(`/api/bids/search?${qParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBids(data.items || []);
        setTotalResults(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setDiagnostics(data.diagnostics || null);
        setPage(pageNum);
      } else {
        setBids([]);
        setTotalResults(0);
        setDiagnostics(null);
      }
    } catch {
      setBids([]);
      setTotalResults(0);
      setDiagnostics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBids(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    fetchBids(1);
  };

  const handleExport = (bid: any) => {
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

  const [savingFavs, setSavingFavs] = useState<Record<string, boolean>>({});
  
  const handleQuickFav = async (bidId: string) => {
    setSavingFavs(p => ({ ...p, [bidId]: true }));
    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, status: 'Novo', probability: 'Média' })
      });
      alert('Contratação salva nos favoritos!');
    } catch {
      alert('Erro ao salvar.');
    } finally {
      setSavingFavs(p => ({ ...p, [bidId]: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Pesquisar por objeto, itens, órgão ou código..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <select 
            value={status} 
            onChange={e => setStatus(e.target.value)} 
            className="w-64 bg-slate-100 border-transparent rounded-lg px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
          >
            <option value="A Receber / Recebendo Proposta">A Receber / Recebendo Proposta</option>
            <option value="Em Julgamento / Propostas Encerradas">Em Julgamento / Propostas Encerradas</option>
            <option value="Encerradas">Encerradas</option>
            <option value="Todos">Todos</option>
          </select>
          <button 
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            Pesquisar
          </button>
        </div>
        
        <button className="flex items-center space-x-2 text-sm text-slate-500 hover:text-slate-700 transition" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-4 h-4" />
          <span>Filtros avançados (Portal, CAPAG, Estado, Modalidade)</span>
        </button>

        {showFilters && (
          <div className="pt-4 border-t border-slate-100 flex gap-4 flex-wrap">
            <select value={portal} onChange={e => setPortal(e.target.value)} className="bg-slate-100 border-transparent rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none">
              <option value="">Portal (Todos)</option>
              <option value="PNCP">PNCP</option>
              <option value="Compras.gov.br">Compras.gov.br</option>
              <option value="Portal de Compras Públicas">Portal de Compras Públicas</option>
            </select>
            <select value={capag} onChange={e => setCapag(e.target.value)} className="bg-slate-100 border-transparent rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none">
              <option value="">CAPAG (Todas)</option>
              <option value="A">CAPAG A</option>
              <option value="B">CAPAG B</option>
              <option value="C">CAPAG C</option>
            </select>
            <select value={state} onChange={e => setState(e.target.value)} className="bg-slate-100 border-transparent rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none">
              <option value="">Estado (Todos)</option>
              <option value="AC">Acre (AC)</option>
              <option value="AL">Alagoas (AL)</option>
              <option value="AP">Amapá (AP)</option>
              <option value="AM">Amazonas (AM)</option>
              <option value="BA">Bahia (BA)</option>
              <option value="CE">Ceará (CE)</option>
              <option value="DF">Distrito Federal (DF)</option>
              <option value="ES">Espírito Santo (ES)</option>
              <option value="GO">Goiás (GO)</option>
              <option value="MA">Maranhão (MA)</option>
              <option value="MT">Mato Grosso (MT)</option>
              <option value="MS">Mato Grosso do Sul (MS)</option>
              <option value="MG">Minas Gerais (MG)</option>
              <option value="PA">Pará (PA)</option>
              <option value="PB">Paraíba (PB)</option>
              <option value="PR">Paraná (PR)</option>
              <option value="PE">Pernambuco (PE)</option>
              <option value="PI">Piauí (PI)</option>
              <option value="RJ">Rio de Janeiro (RJ)</option>
              <option value="RN">Rio Grande do Norte (RN)</option>
              <option value="RS">Rio Grande do Sul (RS)</option>
              <option value="RO">Rondônia (RO)</option>
              <option value="RR">Roraima (RR)</option>
              <option value="SC">Santa Catarina (SC)</option>
              <option value="SP">São Paulo (SP)</option>
              <option value="SE">Sergipe (SE)</option>
              <option value="TO">Tocantins (TO)</option>
            </select>
            <select value={modality} onChange={e => setModality(e.target.value)} className="bg-slate-100 border-transparent rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none">
              <option value="">Modalidade (Todas)</option>
              <option value="Pregão - Eletrônico">Pregão - Eletrônico</option>
              <option value="Pregão - Presencial">Pregão - Presencial</option>
              <option value="Concorrência - Eletrônica">Concorrência - Eletrônica</option>
              <option value="Concurso">Concurso</option>
              <option value="Leilão">Leilão</option>
              <option value="Diálogo Competitivo">Diálogo Competitivo</option>
              <option value="Dispensa">Dispensa de Licitação</option>
              <option value="Inexigibilidade">Inexigibilidade de Licitação</option>
            </select>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              title="Data Inicial"
              className="bg-slate-100 border-transparent rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              title="Data Final"
              className="bg-slate-100 border-transparent rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
            <button onClick={handleSearch} className="text-blue-600 font-medium text-sm px-4 py-2 hover:bg-blue-50 rounded-md transition-colors">
              Aplicar Filtros
            </button>
          </div>
        )}

        {/* Stats Section Removed - Showing simple text instead */}
        {totalResults > 0 && !loading && (
          <div className="flex flex-col gap-2 p-2">
            <div className="flex justify-between items-center text-sm text-slate-500">
              <span>Encontrados <strong>{totalResults.toLocaleString()}</strong> resultados nas fontes integradas.</span>
              <div className="flex gap-4">
                {diagnostics && (
                  <button onClick={() => setShowDiagnostics(!showDiagnostics)} className="text-blue-600 hover:underline">
                    {showDiagnostics ? 'Ocultar Diagnóstico' : 'Ver Diagnóstico'}
                  </button>
                )}
                <span>Página {page} de {totalPages}</span>
              </div>
            </div>
            {showDiagnostics && diagnostics && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm font-mono text-slate-700 mt-2">
                <p><strong>Diagnóstico de Busca API/Local:</strong></p>
                <ul className="mt-2 space-y-1">
                  <li>Quantidade retornada pela API/BD: {diagnostics.apiReturned}</li>
                  <li>Quantidade após filtro de status: {diagnostics.afterStatusFilter}</li>
                  <li>Quantidade após filtro de data: {diagnostics.afterDateFilter}</li>
                  <li>Quantidade exibida na página atual: {diagnostics.finalDisplayed}</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
             <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
             <p className="font-medium text-slate-700">Pesquisando editais...</p>
             <p className="text-sm mt-1">Isso pode levar alguns segundos dependendo da quantidade de resultados.</p>
          </div>
        ) : bids.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Nenhum resultado encontrado</h3>
            <p className="text-slate-500 mt-2">
              Sua busca não retornou resultados na base de dados <strong>local</strong> do aplicativo.
            </p>
            <p className="text-slate-500 mt-1">
              Caso esteja buscando por estados específicos, certifique-se de realizar uma nova <Link to="/keywords" className="text-blue-600 font-medium hover:underline">Sincronização</Link> para baixar os dados mais recentes do portal do governo primeiramente.
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 bg-slate-50 p-4 lg:p-6">
            <div className="flex flex-col gap-4">
              {bids.map((bid) => (
                <div key={bid.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors flex flex-col md:flex-row gap-6">
                  
                  {/* Left / Main Section */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">{bid.portal}</span>
                      <span>{bid.organ}</span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 leading-snug break-words whitespace-normal" title={bid.object}>
                      {bid.object}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="whitespace-normal break-words">{bid.municipality} - {bid.state}</span>
                      </div>
                      <span className="text-slate-300 hidden md:inline">•</span>
                      <div className="flex items-center gap-1.5 hidden md:flex">
                        <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="whitespace-normal break-words">{bid.modality}</span>
                      </div>
                    </div>

                    {showDiagnostics && (
                      <div className="mt-3 bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800 space-y-1 font-mono">
                        <p><strong>Status API Original:</strong> {bid.originalStatus || 'Desconhecido'}</p>
                        <p><strong>Status Convertido (Sistema):</strong> {bid.status}</p>
                        <p><strong>Publicação:</strong> {bid.publicationDate || bid.openDate || 'Não informado'}</p>
                        <p><strong>Abertura:</strong> {bid.openingDate || 'Não informado'}</p>
                        <p><strong>Encerramento / Limite:</strong> {bid.requestEndDate || 'Não informado'}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Section / Info & Actions */}
                  <div className="flex flex-col gap-4 md:items-end justify-between md:border-l md:border-slate-100 md:pl-6 md:w-64 shrink-0">
                    <div className="flex flex-col gap-2 md:items-end w-full">
                      <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold w-fit ${bid.status === 'A Receber / Recebendo Proposta' ? 'bg-green-100 text-green-700' : bid.status === 'Em Julgamento / Propostas Encerradas' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${bid.status === 'A Receber / Recebendo Proposta' ? 'bg-green-500' : bid.status === 'Em Julgamento / Propostas Encerradas' ? 'bg-orange-500' : 'bg-slate-500'}`}></span>
                        <span>{bid.status}</span>
                      </div>
                      
                      <div className="mt-2">
                        <BidValueDisplay bid={bid} />
                      </div>
                    </div>

                    <div className="flex flex-col w-full md:w-auto mt-2 space-y-2">
                       <Link 
                          to={`/bids/${bid.id}`}
                          className="w-full justify-center inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-bold"
                        >
                          <span>Ver Detalhes</span>
                        </Link>
                        <div className="flex space-x-2">
                           <button 
                             onClick={() => handleExport(bid)}
                             className="flex-1 justify-center inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors text-xs font-semibold"
                             title="Exportar TXT"
                           >
                              <Download className="w-3.5 h-3.5" />
                              <span>Exportar</span>
                           </button>
                           <button 
                             onClick={() => handleQuickFav(bid.id)}
                             disabled={savingFavs[bid.id]}
                             className="flex-1 justify-center inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 focus:outline-none rounded-lg transition-colors text-xs font-semibold"
                             title="Favoritar"
                           >
                              <BookMarked className="w-3.5 h-3.5" />
                              <span>{savingFavs[bid.id] ? '...' : 'Salvar'}</span>
                           </button>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Pagination Controls */}
        {bids.length > 0 && totalPages > 1 && (
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50 mt-auto shrink-0">
             <button 
               onClick={() => fetchBids(page - 1)}
               disabled={page <= 1 || loading}
               className="px-4 py-2 border border-slate-300 rounded-md bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
               Página Anterior
             </button>
             <span className="text-sm text-slate-500 font-medium">
               Página {page} de {totalPages.toLocaleString()}
             </span>
             <button 
               onClick={() => fetchBids(page + 1)}
               disabled={page >= totalPages || loading}
               className="px-4 py-2 border border-slate-300 rounded-md bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
               Próxima Página
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
