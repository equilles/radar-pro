import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function Keywords() {
  const [keys, setKeys] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/keywords').then(r => r.json()).then(setKeys);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-50 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-col gap-4">
          {keys.length === 0 && (
            <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-200">
              Nenhuma palavra-chave salva.
            </div>
          )}
          {keys.map(k => (
            <div key={k.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <h3 className="text-lg font-bold text-slate-900 leading-snug break-words whitespace-normal">{k.keyword}</h3>
                <div className="text-xs font-semibold text-slate-400">
                   Atualizado em: {format(new Date(k.lastUpdated), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
              <div className="flex flex-col gap-4 md:items-end justify-between md:border-l md:border-slate-100 md:pl-6 md:w-64 shrink-0">
                 <div className="flex flex-col gap-2 md:items-end w-full">
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-semibold text-slate-500">Resultados previstos:</span>
                       <span className="text-lg font-bold font-mono text-blue-600">{k.resultsCount}</span>
                    </div>
                 </div>
                 <div className="flex w-full md:w-auto mt-2">
                    <Link 
                       to={`/search?q=${encodeURIComponent(k.keyword)}`}
                       className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-bold"
                     >
                       <span>Pesquisar Agora</span>
                     </Link>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
