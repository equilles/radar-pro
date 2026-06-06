import React, { useState } from "react";
import { Search as SearchIcon, Terminal, Database, Activity, Code, Bug } from "lucide-react";
import { format } from "date-fns";

export default function Diagnostics() {
  const [query, setQuery] = useState("");
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setDiagnostic(null);
    try {
      const params = new URLSearchParams({ q: query, startDate: '2020-01-01' }); // Set an example start date to trigger filters
      const res = await fetch(`/api/bids/search?${params.toString()}`);
      const data = await res.json();
      setDiagnostic(data.diagnostics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full max-w-5xl mx-auto my-0 p-4">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-4">
           <Bug className="w-5 h-5 text-purple-600" />
           <h2 className="text-lg font-semibold text-slate-900">Diagnóstico de Pesquisa e Retenção</h2>
        </div>
        
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Digite o termo para diagnosticar (ex: café)..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runDiagnostics()}
            />
          </div>
          <button 
            onClick={runDiagnostics}
            disabled={!query || loading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Diagnosticando..." : "Diagnosticar"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center flex flex-col items-center flex-1 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4 justify-center">
          <Activity className="w-8 h-8 text-purple-500 animate-pulse" />
          <p className="text-slate-500">Executando rastreio no PNCP e no Banco Local...</p>
        </div>
      )}

      {diagnostic && !loading && (
        <div className="flex flex-col gap-6 pb-12">
          <div className="bg-slate-900 text-green-400 p-6 rounded-xl shadow-xl border border-slate-800 font-mono text-xs overflow-hidden">
            <div className="flex items-center space-x-2 text-white border-b border-slate-700 pb-3 mb-5">
              <Terminal className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Integração e Filtro (Consulta API e SQLite)</h3>
            </div>
            
            <div className="space-y-6">
              <div className="bg-black/20 p-4 rounded-lg border border-slate-800/50">
                <span className="text-slate-500 block mb-2 font-semibold">CONSULTA ENVIADA PARA A API:</span>
                <div className="text-blue-400 break-all whitespace-normal">{diagnostic.apiQuery}</div>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="bg-black/20 p-4 rounded-lg border border-slate-800/50">
                  <span className="text-slate-500 block mb-2 font-semibold">CAMPO DE DATA UTILIZADO NA API:</span>
                  <div className="text-white font-bold whitespace-normal break-words">{diagnostic.apiDateFields}</div>
                </div>
                
                <div className="bg-black/20 p-4 rounded-lg border border-slate-800/50">
                  <span className="text-slate-500 block mb-2 font-semibold">CAMPO SQL LOCAL / FILTRO APLICAÇÃO:</span>
                  <div className="text-white font-bold whitespace-normal break-words">{diagnostic.sqlLocalDateField}</div>
                </div>
              </div>
              
              <div className="bg-slate-800/30 p-5 rounded-lg border border-slate-700">
                <span className="text-red-400 block mb-3 font-bold text-sm tracking-wide">[ FILTRO DE RETENÇÃO PÓS-CONSULTA (APLICAÇÃO) ]</span>
                <p className="mb-4 text-slate-300 leading-relaxed">Como a busca em tempo real ignora / falha na busca direta por datas dependendo do endpoint, realizamos uma restrição complementar a nível de aplicação.</p>
                
                <div className="flex flex-col gap-4 mt-4 border-t border-slate-700 pt-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 font-semibold tracking-wider">REGISTROS ANTES DO FILTRO:</span>
                    <span className="text-yellow-400 text-2xl font-bold">{diagnostic.itemsBeforePostFilter}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 font-semibold tracking-wider">REGISTROS DEPOIS DO FILTRO:</span>
                    <span className="text-green-400 text-2xl font-bold">{diagnostic.itemsAfterPostFilter}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
