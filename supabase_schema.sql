-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE perfiles (
  user_id BIGINT PRIMARY KEY, -- Telegram User ID
  presupuesto_semanal_fijo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE semanas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES perfiles(user_id) ON DELETE CASCADE,
  fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  presupuesto_actual NUMERIC NOT NULL DEFAULT 0,
  saldo_sobrante NUMERIC DEFAULT 0,
  estado VARCHAR(20) CHECK (estado IN ('abierta', 'cerrada')) DEFAULT 'abierta',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semana_id UUID REFERENCES semanas(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  categoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE diccionario_categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES perfiles(user_id) ON DELETE CASCADE,
  palabra_clave TEXT NOT NULL,
  categoria TEXT NOT NULL,
  UNIQUE(user_id, palabra_clave)
);

CREATE TABLE ahorros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES perfiles(user_id) ON DELETE CASCADE UNIQUE,
  monto_total_acumulado NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
