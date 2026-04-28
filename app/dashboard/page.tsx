import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  // Asumiremos por defecto el ID del owner si está presente,
  // O en un escenario real se sacaría de una sesión (next-auth, Supabase Auth).
  // Para esta demostración, tomamos el OWNER_ID del env o un valor predeterminado seguro para cargar algo.
  const userId = process.env.TELEGRAM_OWNER_ID ? parseInt(process.env.TELEGRAM_OWNER_ID) : 0;

  return (
    <main className="min-h-screen pt-10 pb-20">
      <Dashboard userId={userId} />
    </main>
  );
}
