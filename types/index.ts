export interface Perfil {
  user_id: number;
  presupuesto_semanal_fijo: number;
  created_at: string;
}

export interface Semana {
  id: string;
  user_id: number;
  fecha_inicio: string;
  presupuesto_actual: number;
  saldo_sobrante: number;
  estado: 'abierta' | 'cerrada';
  created_at: string;
}

export interface Gasto {
  id: string;
  semana_id: string;
  concepto: string;
  monto: number;
  categoria: string | null;
  created_at: string;
}

export interface DiccionarioCategoria {
  id: string;
  user_id: number;
  palabra_clave: string;
  categoria: string;
}

export interface Ahorro {
  id: string;
  user_id: number;
  monto_total_acumulado: number;
  created_at: string;
  updated_at: string;
}
