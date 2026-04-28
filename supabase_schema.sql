-- ==========================================================
-- SCHEMA: Smart Wallet - Sistema de Gastos Semanales
-- Descripción: Tablas para manejo de presupuesto dinámico,
--              ingresos extra y aprendizaje de categorías.
-- ==========================================================

-- 1. Tabla de Perfiles (Configuración fija del usuario)
CREATE TABLE IF NOT EXISTS perfiles (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre_completo TEXT,
  presupuesto_semanal_fijo DECIMAL(10,2) DEFAULT 0.00,
  telegram_id BIGINT UNIQUE, -- Para validar que solo tú uses el bot
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Semanas (El corazón del sistema)
CREATE TABLE IF NOT EXISTS semanas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE NOT NULL,
  -- presupuesto_actual inicia con (fijo + arrastre) y aumenta con ingresos extra
  presupuesto_actual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  saldo_sobrante_final DECIMAL(10,2) DEFAULT 0.00,
  estado TEXT CHECK (estado IN ('abierta', 'cerrada')) DEFAULT 'abierta',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Gastos
CREATE TABLE IF NOT EXISTS gastos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  semana_id uuid REFERENCES semanas ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  categoria TEXT DEFAULT 'Otros',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Tabla de Diccionario (Aprendizaje del Bot)
CREATE TABLE IF NOT EXISTS diccionario_categorias (
    id uuid DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id uuid REFERENCES auth.users ON DELETE CASCADE,
    palabra_clave TEXT NOT NULL, -- Ej: 'tacos'
    categoria TEXT NOT NULL, -- Ej: 'Comida'
    UNIQUE (user_id, palabra_clave) -- Cada usuario tiene su propio diccionario
);

-- 5. Tabla de Ahorros
CREATE TABLE IF NOT EXISTS ahorros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  monto_total_acumulado DECIMAL(10,2) DEFAULT 0.00,
  ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================================
-- POLÍTICAS DE SEGURIDAD (RLS) OPCIONALES
-- ==========================================================
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE semanas ENABLE ROW LEVEL SECURITY;

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

ALTER TABLE diccionario_categorias ENABLE ROW LEVEL SECURITY;

ALTER TABLE ahorros ENABLE ROW LEVEL SECURITY;

-- Nota para el desarrollador:
-- Recuerda configurar las políticas para que cada user_id solo vea su propia data.