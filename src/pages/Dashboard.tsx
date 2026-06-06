import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Building2, Briefcase, Star, History } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setData(d));
  }, []);

  if (!data) return <div className="animate-pulse flex space-y-4 flex-col"><div className="h-32 bg-gray-200 rounded-xl"></div></div>;

  const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0284c7'];

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <StatCard title="Total no Banco" value={data.totalBids} subtitle="Base Localizada" valueColor="" />
        <StatCard title="Oportunidades PGC" value={`R$ 14.2M`} subtitle="Próximos 6 meses" valueColor="text-orange-600" />
        <StatCard title="Em Análise (CRM)" value={data.favBids} subtitle="Aguardando Proposta" valueColor="" />
        <StatCard title="Novas Hoje" value="12" subtitle="+12% vs. ontem" valueColor="text-blue-600" subtitleColor="text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-6 uppercase tracking-wider">Licitações por Portal</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byPortal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {data.byPortal.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-6 uppercase tracking-wider">Volume por Portal</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byPortal}>
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, valueColor = "", subtitleColor = "text-slate-400" }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{title}</p>
      <h3 className={`text-2xl font-bold ${valueColor}`}>{value}</h3>
      <p className={`text-[10px] mt-1 ${subtitleColor}`}>{subtitle}</p>
    </div>
  );
}
