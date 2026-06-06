import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [notes, setNotes] = useState("");

  const load = () => fetch('/api/clients').then(r => r.json()).then(setClients);

  useEffect(() => { load() }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, segment, notes })
    });
    setName(""); setSegment(""); setNotes("");
    load();
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Novo Cliente</h3>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome da Empresa</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Segmento</label>
            <input value={segment} onChange={e => setSegment(e.target.value)} className="w-full px-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" />
          </div>
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Observações</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors">
            Adicionar
          </button>
        </form>
      </div>

      <div className="bg-slate-50 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-col gap-4">
          {clients.length === 0 && (
            <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-200">
              Nenhum cliente cadastrado.
            </div>
          )}
          {clients.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-bold text-slate-900 leading-snug break-words whitespace-normal">{c.name}</h3>
                <div className="text-sm text-slate-600 break-words whitespace-normal">{c.notes}</div>
              </div>
              <div className="flex flex-col gap-4 md:items-end justify-between md:border-l md:border-slate-100 md:pl-6 md:w-64 shrink-0">
                 <div className="flex flex-col gap-2 md:items-end w-full">
                    <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase tracking-wider w-fit">
                      {c.segment}
                    </span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
