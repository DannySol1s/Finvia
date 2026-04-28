<div align="center">
  <h1>💸 Finvia</h1>
  <h3>Smart Wallet & Gestión Inteligente de Finanzas</h3>
  
  [![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](#)
  [![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](#)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](#)
  [![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](#)
  [![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](#)

  <i>"El puente definitivo entre tus hábitos diarios y tu libertad financiera."</i>
</div>

---

## 🧐 ¿Qué es?

**Finvia** es un sistema integral de gestión de finanzas personales diseñado para romper con la fricción de llevar un presupuesto. En lugar de obligar al usuario a abrir una aplicación compleja para anotar cada centavo, Finvia utiliza un bot de Telegram como puente principal. Los usuarios simplemente envían un mensaje natural (ej. "Tacos 150" o "/ingreso 200") y el sistema clasifica, calcula y alerta automáticamente.

El núcleo del proyecto gira en torno al concepto de **Presupuestos Semanales Dinámicos**. Al finalizar cada semana, el sistema evalúa tu desempeño: si ahorraste, te premia permitiéndote acumular el sobrante; si gastaste de más, aplica un "castigo" deduciendo el déficit de tu siguiente semana, fomentando así la disciplina financiera real.

Para la visualización de los datos, cuenta con un potente y elegante **Dashboard Web** construido con una estética *Glassmorphism*. Este panel se actualiza en tiempo real, permitiendo a los usuarios ver cómo sus barras de presupuesto se mueven instantáneamente al enviar un mensaje por Telegram.

## ✨ Características Principales

| Icono | Característica | Descripción |
|:---:|---|---|
| 🤖 | **Webhook Bot Inteligente** | Procesador de lenguaje natural básico en Telegram que distingue entre ingresos, comandos y gastos diarios, aprendiendo automáticamente nuevas palabras clave. |
| 📊 | **Dashboard Glassmorphism** | Interfaz web premium con diseño de cristal esmerilado (`backdrop-blur`), temática oscura y gráficas interactivas con *Recharts*. |
| ⚡ | **Actualizaciones Realtime** | Sincronización instantánea de gastos en pantalla utilizando los canales y suscripciones de *Supabase Realtime*. |
| ⚖️ | **Cierres Semanales** | Sistema de cierre con lógica de premios (ahorrar o acumular) y castigos (reducción de presupuesto) para incentivar el control de gastos. |
| 🔐 | **Validación de Identidad** | Sistema de seguridad ligado al `Telegram ID` (Owner) y políticas estrictas de seguridad (RLS) en la base de datos PostgreSQL. |

## 📁 Contenido de Base de Datos

| # | Dato | Categoría | Descripción Breve |
|:---:|---|---|---|
| 1 | 👤 **Perfiles** | Configuración | Registra el usuario ligado a `auth.users`, su ID de Telegram y su presupuesto base. |
| 2 | 📅 **Semanas** | Motor de Lógica | El corazón del sistema. Almacena el saldo actual, el sobrante final y el estado (abierta/cerrada). |
| 3 | 💸 **Gastos** | Transacciones | Registro individual de cada transacción deducida del presupuesto, clasificada por categoría. |
| 4 | 🧠 **Diccionario** | Aprendizaje | Mapeo único por usuario de palabras clave (ej: "cine") a categorías globales (ej: "Ocio"). |
| 5 | 🏦 **Ahorros** | Historial | Acumulado total histórico de los sobrantes semanales guardados exitosamente. |

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico
```tree
Finvia App
├── Frontend
│   ├── Framework: Next.js 14+ (App Router, Server & Client Components)
│   ├── Estilos: Tailwind CSS v4 (Glassmorphism UI)
│   ├── Iconografía: Lucide React
│   └── Gráficos: Recharts
├── Backend
│   ├── API: Next.js Route Handlers (Webhook)
│   └── BaaS: Supabase (PostgreSQL, Realtime, Auth UUIDs)
└── Integraciones
    └── Interfaz Externa: Telegram Bot API (vía peticiones Fetch)
```

### Estructura de Archivos
```bash
/
├── app/
│   ├── api/bot/route.ts   # Webhook principal que recibe y procesa JSON de Telegram
│   ├── dashboard/         # Ruta privada para la visualización de datos
│   │   └── page.tsx       # Componente de servidor, lee variables y conecta UUIDs
│   ├── globals.css        # Importación de Tailwind y variables base
│   └── layout.tsx         # Layout principal con suppressHydrationWarning
├── components/
│   └── Dashboard.tsx      # Componente cliente con gráficas, lógica UI y Realtime
├── lib/
│   └── supabase.ts        # Inicialización del cliente Supabase (Service Role / Anon)
├── supabase_schema.sql    # DDL del esquema de PostgreSQL y políticas RLS
├── types/
│   └── index.ts           # Interfaces TypeScript (Perfil, Semana, Gasto, etc.)
└── .env.local             # Variables de entorno secretas (no rastreadas)
```

## ⚙️ Arquitectura Técnica Central

**Flujo de Ejecución del Webhook (Detección de Gasto):**
```text
[📱 Usuario Telegram] --("Pizza 200")--> [🌐 API de Telegram]
                                                │
                                        (POST Webhook HTTP)
                                                ▼
[🛠️ Next.js Route Handler (/api/bot)]
  │
  ├── 1. Valida `telegram_id` del sender contra `MY_TELEGRAM_ID`.
  ├── 2. Consulta `perfiles` en Supabase para extraer el `user_id` (UUID).
  ├── 3. Expresión regular extrae monto (200) y concepto ("Pizza").
  ├── 4. Consulta `diccionario_categorias` buscando "pizza".
  │       ├─ Si existe -> Avanza al paso 5.
  │       └─ Si NO existe -> Retorna mensaje con Botones para aprender categoría.
  │
  ├── 5. Consulta tabla `semanas` (estado='abierta') para calcular saldo disponible.
  │       └─ Si (Disponible < Monto) -> Dispara Alerta de Saldo Negativo.
  │
  ├── 6. Inserta registro en tabla `gastos` y descuenta lógicamente.
  │
  └── 7. Retorna `sendMessage` a [📱 Usuario Telegram] confirmando registro.

(Supabase dispara evento Realtime 'postgres_changes' -> 💻 Cliente Web Dashboard se actualiza visualmente)
```

## 🚀 Cómo Ejecutar

### Prerrequisitos
- Node.js 18+
- Proyecto activo en Supabase (con el `schema.sql` ejecutado).
- Bot de Telegram (Token generado vía *BotFather*).

### Instalación Local
```bash
# 1. Clonar el repositorio
git clone https://github.com/DannySol1s/finvia.git
cd finvia

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (copiar .env.example a .env.local y llenar)
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo
npm run dev
```

### Comandos Útiles
| Comando | Acción |
|---|---|
| `npm run dev` | Inicia el entorno de desarrollo con Turbopack en `localhost:3000`. |
| `npm run build` | Compila la aplicación para producción. |
| `npm start` | Inicia el servidor optimizado para producción. |

*(Nota: Para testear el webhook en local, se recomienda el uso de túneles como `ngrok` o despliegue en Vercel).*

## 📱 Diseño Responsivo

| Breakpoint | Dispositivo Target | Comportamiento del Layout |
|:---:|---|---|
| `< 768px` | Móviles | Dashboard de una sola columna. Tarjetas de resumen apiladas verticalmente. Ocultamiento de ejes excesivos en las gráficas de Recharts. |
| `768px - 1024px` | Tablets | Layout de tarjetas en cuadrícula de 3 columnas (`md:grid-cols-3`). Gráficas y tabla de historial ocupan el 100% del ancho. |
| `> 1024px` | Laptops/Desktop | Distribución a pantalla completa con `max-w-6xl`. Sección inferior dividida equitativamente entre gráfica comparativa (50%) y scroll de últimos gastos (50%). |

## 🎨 Sistema de Diseño

```css
/* Variables y Configuración Base Tailwind (v4) / Globals */
@import "tailwindcss";

@theme {
  --background: #0f172a; /* Slate 900 - Fondo Profundo */
  --foreground: #f8fafc; /* Slate 50 - Texto Principal */
}

/* Tokens Glassmorphism implementados vía utilidades in-line */
/* 
  Efecto Panel Base:
  bg-white/5 
  backdrop-blur-lg 
  border border-white/10 
  shadow-xl
  
  Colores de Identidad (Gradientes):
  Gradiente Cyan a Púrpura (from-cyan-400 to-purple-500)
  Acentos de Éxito: emerald-400
  Acentos de Alerta: rose-400
  
  Tipografía:
  Fuente principal: 'Inter', sans-serif (Google Fonts)
  Variables: font-geist-sans y font-geist-mono para complementos técnicos.
*/
```

## 🧠 Valor Formativo

> *"La mejor forma de ahorrar no es una hoja de cálculo tediosa, sino integrar las finanzas en la aplicación de mensajería que ya usas todo el día."*

Este proyecto representó un desafío técnico de nivel intermedio-avanzado que abarcó:
- **Diseño de Modelos Relacionales (PostgreSQL)**: Construcción de una base de datos atada a un sistema de identidades seguro (`auth.users`) y control de acceso mediante RLS (Row Level Security).
- **Procesamiento de Lenguaje y Expresiones Regulares**: Implementación de algoritmos para parsear intenciones de usuario a partir de cadenas de texto informales.
- **Micro-arquitectura Event-Driven**: Conexión de estados del backend hacia el frontend de forma reactiva mediante websockets (*Supabase Realtime*).
- **Consumo de APIs de Terceros**: Manejo directo del Webhook de la API de Telegram, evitando la sobrecarga de librerías de terceros (Serverless Functions adaptadas).
- **Maquetación Moderna**: Uso avanzado de transparencias y difuminado de fondos para lograr el efecto *Glassmorphism* sin sacrificar rendimiento.

## 👨‍💻 Autor

**DannySol1s**
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/DannySol1s)

---
<div align="center">
  <small>© 2026 Finvia. <i>Tomando el control de tus bolsillos, un mensaje a la vez.</i></small>
</div>
