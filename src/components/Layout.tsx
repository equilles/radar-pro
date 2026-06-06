import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, LayoutDashboard, Star, Users, Tags, CalendarClock, History, Activity, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);

  const menu = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Pesquisa Global", path: "/search", icon: Search },
    { name: "Favoritos (CRM)", path: "/favorites", icon: Star },
    { name: "Clientes Alvo", path: "/clients", icon: Users },
    { name: "Palavras-chave", path: "/keywords", icon: Tags },
    { name: "Oportunidades (PGC)", path: "/opportunities", icon: CalendarClock },
    { name: "Histórico de Preços", path: "/prices", icon: History },
    { name: "Diagnóstico (Integrações)", path: "/diagnostics", icon: Activity },
  ];

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/keywords/sync', { method: 'POST' });
      // Simulate sync finish in UI
      setTimeout(() => setSyncing(false), 2000);
    } catch {
      setSyncing(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900">
      <aside className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded">
            <Search className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">RADAR PRO</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4 px-2">Menu</div>
          {menu.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-blue-600 font-medium"
                    : "text-slate-300 hover:bg-slate-800"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 mt-auto border-t border-slate-800">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            <span>{syncing ? "Sincronizando..." : "Sincronizar Portais"}</span>
          </button>
          <div className="mt-4 flex flex-col gap-1 text-center">
            <span className="text-[10px] text-slate-400">Última sync: Hoje, 08:30</span>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">
            {menu.find(m => location.pathname === m.path || (m.path !== '/' && location.pathname.startsWith(m.path)))?.name || "Detalhes"}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end pt-1">
               <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Sincronização Local</span>
               <span className="text-[11px] text-green-600 flex items-center gap-1 font-medium">
                 <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span> Conectado: 100% Sincronizado
               </span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-6 h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
