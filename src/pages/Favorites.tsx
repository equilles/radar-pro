import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function Favorites() {
  const [favs, setFavs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/favorites').then(r => r.json()).then(d => setFavs(d));
  }, []);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-slate-50 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-col gap-4">
          {favs.length === 0 && (
            <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-200">
              Nenhum favorito salvo.
            </div>
          )}
          {favs.map(f => (
            <div key={f.bidId} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {f.bidId}
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug whitespace-normal break-words">
                  {f.object}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">Cliente:</span> {f.clientName || 'Nenhum'}
                </div>
              </div>
              <div className="flex flex-col gap-4 md:items-end justify-between md:border-l md:border-slate-100 md:pl-6 md:w-64 shrink-0">
                <div className="flex flex-col gap-2 md:items-end w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Status:</span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-md text-xs font-bold">{f.status}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-500">Probabilidade:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${f.probability === 'Alta' ? 'bg-green-100 text-green-700 border-green-200' : f.probability === 'Média' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {f.probability}
                    </span>
                  </div>
                </div>
                <div className="flex w-full md:w-auto mt-2">
                   <Link 
                      to={`/bids/${f.bidId}`}
                      className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-bold"
                    >
                      <span>Ver Detalhes</span>
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
