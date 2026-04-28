'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Wallet, TrendingDown, PiggyBank, Activity } from 'lucide-react';

export default function Dashboard({ userId }: { userId: string }) {
  const [semana, setSemana] = useState<any>(null);
  const [gastos, setGastos] = useState<any[]>([]);
  const [ahorros, setAhorros] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Supabase Realtime Subscriptions
    const channelGastos = supabase
      .channel('realtime_gastos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => {
        fetchData();
      })
      .subscribe();

    const channelSemanas = supabase
      .channel('realtime_semanas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'semanas' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelGastos);
      supabase.removeChannel(channelSemanas);
    };
  }, [userId]);

  const fetchData = async () => {
    // Fetch Active Week
    const { data: activeWeek } = await supabase
      .from('semanas')
      .select('*')
      .eq('user_id', userId)
      .eq('estado', 'abierta')
      .single();

    if (activeWeek) {
      setSemana(activeWeek);
      // Fetch Expenses
      const { data: gastosData } = await supabase
        .from('gastos')
        .select('*')
        .eq('semana_id', activeWeek.id);
      
      setGastos(gastosData || []);
    }

    // Fetch Ahorros
    const { data: ahorroData } = await supabase
      .from('ahorros')
      .select('monto_total_acumulado')
      .eq('user_id', userId)
      .single();
      
    if (ahorroData) {
      setAhorros(ahorroData.monto_total_acumulado);
    }
    
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Cargando Finvia...</div>;
  }

  if (!semana) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold mb-2">No hay semana activa</h2>
          <p className="text-gray-300">Abre tu Telegram y envía /start al bot para comenzar a usar Finvia.</p>
        </div>
      </div>
    );
  }

  const totalGastos = gastos.reduce((acc, curr) => acc + Number(curr.monto), 0);
  const presupuestoActual = Number(semana.presupuesto_actual);
  const saldoDisponible = presupuestoActual - totalGastos;

  const chartData = [
    { name: 'Presupuesto', valor: presupuestoActual, fill: '#38bdf8' },
    { name: 'Gastos', valor: totalGastos, fill: '#f43f5e' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text">
            Finvia Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Gestión Inteligente de Finanzas Personales</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-lg border border-white/10 shadow-xl py-2 px-4 rounded-full">
          <Activity className="w-5 h-5 text-green-400 animate-pulse" />
          <span className="text-sm font-medium">Live</span>
        </div>
      </header>

      {/* Tarjetas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-300">
          <div className="bg-cyan-500/20 p-4 rounded-full mb-4">
            <Wallet className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-gray-400 font-medium">Saldo Disponible</p>
          <p className={`text-4xl font-bold mt-2 ${saldoDisponible < 0 ? 'text-red-400' : 'text-white'}`}>
            ${saldoDisponible.toFixed(2)}
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-300">
          <div className="bg-rose-500/20 p-4 rounded-full mb-4">
            <TrendingDown className="w-8 h-8 text-rose-400" />
          </div>
          <p className="text-gray-400 font-medium">Gastos de la Semana</p>
          <p className="text-4xl font-bold mt-2 text-white">
            ${totalGastos.toFixed(2)}
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-300">
          <div className="bg-emerald-500/20 p-4 rounded-full mb-4">
            <PiggyBank className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-gray-400 font-medium">Ahorros Totales</p>
          <p className="text-4xl font-bold mt-2 text-white">
            ${ahorros.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfica */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl h-96 flex flex-col">
          <h3 className="text-xl font-bold mb-6">Comparativa Semanal</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                />
                <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Últimos Gastos */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-96">
          <h3 className="text-xl font-bold mb-4">Últimos Gastos</h3>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
            {gastos.length === 0 ? (
              <p className="text-gray-400 text-center mt-10">No hay gastos registrados aún.</p>
            ) : (
              [...gastos].reverse().map(gasto => (
                <div key={gasto.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div>
                    <p className="font-semibold">{gasto.concepto}</p>
                    <p className="text-xs text-cyan-400 mt-1">{gasto.categoria || 'Sin clasificar'}</p>
                  </div>
                  <p className="font-bold text-rose-400">-${gasto.monto}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
