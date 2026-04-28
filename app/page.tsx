import { redirect } from 'next/navigation';

export default function Home() {
  // Redirigir inmediatamente al dashboard
  redirect('/dashboard');
}
