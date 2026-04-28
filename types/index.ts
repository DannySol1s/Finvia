export interface Perfil {
  user_id: string; // UUID from auth.users
  nombre_completo: string | null;
  presupuesto_semanal_fijo: number;
  telegram_id: number;
  created_at: string;
}

export interface Semana {
  id: string;
  user_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto_actual: number;
  saldo_sobrante_final: number;
  estado: 'abierta' | 'cerrada';
  created_at: string;
}

export interface Gasto {
  id: string;
  user_id: string;
  semana_id: string;
  concepto: string;
  monto: number;
  categoria: string | null;
  created_at: string;
}

export interface DiccionarioCategoria {
  id: string;
  user_id: string;
  palabra_clave: string;
  categoria: string;
}

export interface Ahorro {
  id: string;
  user_id: string;
  monto_total_acumulado: number;
  ultima_actualizacion: string;
}
