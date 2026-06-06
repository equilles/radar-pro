import { useState, useEffect } from "react";
import { History, Search as SearchIcon } from "lucide-react";
import { format } from "date-fns";

export default function Prices() {
  const [prices, setPrices] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  const fetchPrices = async () => {
    const q = new URLSearchParams();
    if (query) q.append('q', query);
    const res = await fetch(`/api/prices?${q.toString()}`);
    setPrices(await res.json());
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start space-x-3 shrink-0">
        <History className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-blue-900 text-sm">
          <p className="font-bold mb-1">Histórico de Preços (Banco de Preços)</p>
          <p>Consulte valores homologados em licitações anteriores. Pesquise por Produto, CATMAT ou CATSER para precificar suas propostas corretamente.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Pesquisar histórico por produto, serviço, CATMAT ou CATSER..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchPrices()}
            />
          </div>
          <button 
            onClick={fetchPrices}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            Pesquisar
          </button>
        </div>
      </div>

      <div className="bg-slate-50 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-col gap-4">
          {prices.length === 0 && (
            <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-200">
              Nenhum histórico encontrado para sua pesquisa.
            </div>
          )}
          {prices.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                   <div className="text-xs font-semibold text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded w-fit">
                      {p.catmat ? `M: ${p.catmat}` : p.catser ? `S: ${p.catser}` : 'Sem código'}
                   </div>
                   <div className="text-xs font-semibold text-slate-400">
                      {format(new Date(p.date), 'dd/MM/yyyy')}
                   </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug break-words whitespace-normal">{p.product}</h3>
                <div className="flex flex-col gap-1 text-sm text-slate-600">
                  <div><span className="font-semibold text-slate-700">Órgão:</span> <span className="break-words whitespace-normal">{p.organ}</span></div>
                  <div><span className="font-semibold text-slate-700">Fornecedor:</span> <span className="break-words whitespace-normal">{p.supplier}</span></div>
                </div>
              </div>
              <div className="flex flex-col gap-4 md:items-end justify-between md:border-l md:border-slate-100 md:pl-6 md:w-64 shrink-0">
                 <div className="flex flex-col gap-2 md:items-end w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Unitário:</span>
                      <span className="font-mono font-medium text-slate-900">{Number(p.unitPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-semibold text-slate-500">Total:</span>
                       <span className="text-lg font-bold font-mono text-slate-800">{Number(p.totalPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
