import { useState, useEffect } from "react";
import { Info, Search as SearchIcon } from "lucide-react";

export default function Opportunities() {
  const [opps, setOpps] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  const fetchOpps = async () => {
    const q = new URLSearchParams();
    if (query) q.append('q', query);
    const res = await fetch(`/api/opportunities?${q.toString()}`);
    setOpps(await res.json());
  };

  useEffect(() => {
    fetchOpps();
  }, []);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start space-x-3 shrink-0">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-blue-900 text-sm">
          <p className="font-bold mb-1">Plano de Contratações Governamentais (PGC)</p>
          <p>Este módulo consolida dados do Plano de Contratações e permite que você identifique intenções de compras dos órgãos antes mesmo da publicação dos editais, auxiliando na prospecção de vendas diretas ou preparação antecipada.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Pesquisar oportunidades futuras por órgão ou item planejado..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOpps()}
            />
          </div>
          <button 
            onClick={fetchOpps}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            Pesquisar
          </button>
        </div>
      </div>

      <div className="bg-slate-50 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-col gap-4">
          {opps.length === 0 && (
            <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-200">
              Sua busca não encontrou resultados.
            </div>
          )}
          {opps.map(o => (
            <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <h3 className="text-lg font-bold text-slate-900 leading-snug whitespace-normal break-words">{o.organ}</h3>
                <div className="text-sm font-medium text-slate-700 whitespace-normal break-words">{o.item}</div>
              </div>
              <div className="flex flex-col gap-4 md:items-end justify-between md:border-l md:border-slate-100 md:pl-6 md:w-64 shrink-0">
                 <div className="flex flex-col gap-2 md:items-end w-full">
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold w-fit">
                      {o.expectedPeriod}
                    </span>
                    <div className={`text-xl font-bold font-mono ${Number(o.estimatedValue) === 0 ? 'text-slate-400' : 'text-slate-800'} mt-2`}>
                       {Number(o.estimatedValue) === 0 ? 'Valor não informado' : Number(o.estimatedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
