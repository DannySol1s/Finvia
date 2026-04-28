import Dashboard from '@/components/Dashboard';
import { supabase } from '@/lib/supabase';

export default async function DashboardPage() {
  const telegramId = process.env.TELEGRAM_OWNER_ID ? parseInt(process.env.TELEGRAM_OWNER_ID) : 0;
  
  // Buscar el UUID del usuario basado en el telegram_id
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('user_id')
    .eq('telegram_id', telegramId)
    .single();

  const userId = perfil?.user_id || '';

  return (
    <main className="min-h-screen pt-10 pb-20">
      <Dashboard userId={userId} />
    </main>
  );
}
