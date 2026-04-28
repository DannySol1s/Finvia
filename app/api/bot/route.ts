import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const OWNER_ID = parseInt(process.env.TELEGRAM_OWNER_ID || '0');
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Helper para enviar mensajes
async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });
}

// Helpers de BD
async function getActiveWeek(userId: number) {
  const { data } = await supabase
    .from('semanas')
    .select('*')
    .eq('user_id', userId)
    .eq('estado', 'abierta')
    .single();
  return data;
}

async function getTotalExpenses(semanaId: string) {
  const { data } = await supabase
    .from('gastos')
    .select('monto')
    .eq('semana_id', semanaId);
  return (data || []).reduce((acc, curr) => acc + Number(curr.monto), 0);
}

// Manejar Callback Queries (Botones de Categoría o Cierre)
async function handleCallbackQuery(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  // Verify owner
  if (userId !== OWNER_ID && OWNER_ID !== 0) return;

  if (data.startsWith('cat_')) {
    // cat_Categoria_Monto_Concepto
    const [_, categoria, monto, ...conceptoParts] = data.split('_');
    const concepto = conceptoParts.join('_');
    
    // 1. Aprender palabra clave
    const palabraClave = concepto.split(' ')[0].toLowerCase();
    await supabase.from('diccionario_categorias').insert({
      user_id: userId,
      palabra_clave: palabraClave,
      categoria: categoria
    });

    // 2. Registrar Gasto
    const semana = await getActiveWeek(userId);
    if (semana) {
      await supabase.from('gastos').insert({
        semana_id: semana.id,
        concepto: concepto,
        monto: Number(monto),
        categoria: categoria
      });
      await sendMessage(chatId, `✅ <b>Finvia:</b> Gasto de $${monto} registrado en ${categoria}. ¡He aprendido que "${palabraClave}" pertenece a ${categoria}!`);
    }
  } else if (data === 'cierre_ahorrar') {
    const semana = await getActiveWeek(userId);
    if (!semana) return;
    
    const sobrante = Number(semana.saldo_sobrante);
    // Añadir a ahorros
    const { data: ahorro } = await supabase.from('ahorros').select('*').eq('user_id', userId).single();
    if (ahorro) {
      await supabase.from('ahorros').update({ monto_total_acumulado: Number(ahorro.monto_total_acumulado) + sobrante }).eq('user_id', userId);
    } else {
      await supabase.from('ahorros').insert({ user_id: userId, monto_total_acumulado: sobrante });
    }
    
    // Cerrar semana actual
    await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id);
    
    // Abrir nueva semana con presupuesto fijo
    const { data: perfil } = await supabase.from('perfiles').select('presupuesto_semanal_fijo').eq('user_id', userId).single();
    if (perfil) {
      await supabase.from('semanas').insert({
        user_id: userId,
        presupuesto_actual: perfil.presupuesto_semanal_fijo,
        estado: 'abierta'
      });
      await sendMessage(chatId, `💰 <b>Finvia:</b> $${sobrante} guardados en tus ahorros. ¡Nueva semana iniciada con $${perfil.presupuesto_semanal_fijo}!`);
    }

  } else if (data === 'cierre_acumular') {
    const semana = await getActiveWeek(userId);
    if (!semana) return;
    
    const sobrante = Number(semana.saldo_sobrante);
    
    // Cerrar semana actual
    await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id);
    
    // Abrir nueva semana con presupuesto fijo + sobrante
    const { data: perfil } = await supabase.from('perfiles').select('presupuesto_semanal_fijo').eq('user_id', userId).single();
    if (perfil) {
      const nuevoPpto = Number(perfil.presupuesto_semanal_fijo) + sobrante;
      await supabase.from('semanas').insert({
        user_id: userId,
        presupuesto_actual: nuevoPpto,
        estado: 'abierta'
      });
      await sendMessage(chatId, `📈 <b>Finvia:</b> Sobrante acumulado. ¡Nueva semana iniciada con un súper presupuesto de $${nuevoPpto}!`);
    }
  }

  // Answer callback query to remove loading state
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    if (!body.message || !body.message.text) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const userId = body.message.from.id;
    const text = body.message.text.trim();

    if (OWNER_ID !== 0 && userId !== OWNER_ID) {
      await sendMessage(chatId, "⛔ <b>Finvia:</b> Acceso denegado. No eres el dueño autorizado.");
      return NextResponse.json({ ok: true });
    }

    const { data: perfil } = await supabase.from('perfiles').select('*').eq('user_id', userId).single();

    if (text.startsWith('/start')) {
      if (!perfil) {
        // Init profile with a default or ask them
        await supabase.from('perfiles').insert({ user_id: userId, presupuesto_semanal_fijo: 1000 });
        await supabase.from('semanas').insert({ user_id: userId, presupuesto_actual: 1000 });
        await sendMessage(chatId, "👋 <b>Finvia:</b> ¡Bienvenido! He creado tu perfil con un presupuesto inicial de $1000. Puedes cambiarlo luego. Registra tus gastos o ingresos enviando mensajes.");
      } else {
        await sendMessage(chatId, "⚡ <b>Finvia:</b> Ya estás registrado. ¡Sigamos gestionando tus finanzas!");
      }
      return NextResponse.json({ ok: true });
    }

    if (!perfil) {
      await sendMessage(chatId, "⚠️ <b>Finvia:</b> Por favor envía /start primero.");
      return NextResponse.json({ ok: true });
    }

    const textLower = text.toLowerCase();

    // ---------------------------------------------------------
    // B. INGRESOS EXTRAS
    // ---------------------------------------------------------
    if (textLower.startsWith('/ingreso') || textLower.startsWith('recibí') || textLower.startsWith('recibi')) {
      const match = text.match(/(\d+(\.\d+)?)/);
      if (match) {
        const monto = Number(match[0]);
        const semana = await getActiveWeek(userId);
        if (semana) {
          const nuevoPresupuesto = Number(semana.presupuesto_actual) + monto;
          await supabase.from('semanas').update({ presupuesto_actual: nuevoPresupuesto }).eq('id', semana.id);
          
          const totalGastos = await getTotalExpenses(semana.id);
          const disponible = nuevoPresupuesto - totalGastos;
          
          await sendMessage(chatId, `💵 <b>Finvia:</b> Ingreso extra de $${monto} registrado. \nTu nuevo total disponible es: $${disponible}.`);
        } else {
          await sendMessage(chatId, "⚠️ <b>Finvia:</b> No tienes una semana abierta.");
        }
      } else {
        await sendMessage(chatId, "⚠️ <b>Finvia:</b> No entendí el monto del ingreso. Ejemplo: '/ingreso 200'");
      }
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------
    // COMANDOS DE INFORMACIÓN
    // ---------------------------------------------------------
    if (textLower.startsWith('/saldo')) {
      const semana = await getActiveWeek(userId);
      if (semana) {
        const gastos = await getTotalExpenses(semana.id);
        const sobrante = Number(semana.presupuesto_actual) - gastos;
        await sendMessage(chatId, `📊 <b>Finvia - Estado de la Semana:</b>\nPresupuesto: $${semana.presupuesto_actual}\nGastos Totales: $${gastos}\n-------------------\n<b>Sobrante Disponible: $${sobrante}</b>`);
      } else {
        await sendMessage(chatId, "⚠️ <b>Finvia:</b> No tienes una semana activa.");
      }
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith('/ahorros')) {
      const { data: ahorro } = await supabase.from('ahorros').select('*').eq('user_id', userId).single();
      const acumulado = ahorro ? ahorro.monto_total_acumulado : 0;
      await sendMessage(chatId, `🏦 <b>Finvia:</b> Tus ahorros totales acumulados son: <b>$${acumulado}</b>`);
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith('/cerrar_semana')) {
      const semana = await getActiveWeek(userId);
      if (!semana) {
        await sendMessage(chatId, "⚠️ <b>Finvia:</b> No hay semana activa para cerrar.");
        return NextResponse.json({ ok: true });
      }

      const gastos = await getTotalExpenses(semana.id);
      const sobrante = Number(semana.presupuesto_actual) - gastos;
      
      // Update sobrante in DB
      await supabase.from('semanas').update({ saldo_sobrante: sobrante }).eq('id', semana.id);

      if (sobrante > 0) {
        await sendMessage(chatId, `🎉 <b>Finvia - Cierre Semanal:</b>\n¡Felicidades! Te sobraron <b>$${sobrante}</b>. ¿Qué deseas hacer con ellos?`, {
          inline_keyboard: [
            [{ text: "🏦 Ahorrar", callback_data: "cierre_ahorrar" }],
            [{ text: "📈 Acumular para sig. semana", callback_data: "cierre_acumular" }]
          ]
        });
      } else if (sobrante < 0) {
        // Castigo
        const deficit = Math.abs(sobrante);
        await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id);
        
        const nuevoPresupuesto = Number(perfil.presupuesto_semanal_fijo) - deficit;
        await supabase.from('semanas').insert({
          user_id: userId,
          presupuesto_actual: nuevoPresupuesto,
          estado: 'abierta'
        });
        await sendMessage(chatId, `📉 <b>Finvia - Cierre Semanal:</b>\nTe excediste por $${deficit}. \n⚠️ <b>Castigo:</b> Empezamos esta nueva semana con menos dinero para compensar el exceso anterior. \nNuevo presupuesto inicial: $${nuevoPresupuesto}.`);
      } else {
        await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id);
        await supabase.from('semanas').insert({ user_id: userId, presupuesto_actual: perfil.presupuesto_semanal_fijo, estado: 'abierta' });
        await sendMessage(chatId, `⚖️ <b>Finvia - Cierre Semanal:</b>\nQuedaste en $0 exactos. \nSe ha iniciado una nueva semana con tu presupuesto base de $${perfil.presupuesto_semanal_fijo}.`);
      }
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------------
    // A. GASTOS DIARIOS
    // ---------------------------------------------------------
    const match = text.match(/(\d+(\.\d+)?)/);
    if (match) {
      const monto = Number(match[0]);
      const concepto = text.replace(match[0], '').trim();
      const palabraClave = concepto.split(' ')[0].toLowerCase() || "indefinido";

      const semana = await getActiveWeek(userId);
      if (!semana) {
         await sendMessage(chatId, "⚠️ <b>Finvia:</b> Crea una semana activa primero.");
         return NextResponse.json({ ok: true });
      }

      const totalGastos = await getTotalExpenses(semana.id);
      const disponible = Number(semana.presupuesto_actual) - totalGastos;

      // Alerta de Saldo Negativo
      if (disponible < monto) {
         await sendMessage(chatId, `🚨 <b>ALERTA FINVIA:</b> Este gasto de $${monto} excede tu saldo disponible ($${disponible}).`);
      }

      // Buscar categoría
      const { data: dicc } = await supabase.from('diccionario_categorias').select('categoria').eq('user_id', userId).eq('palabra_clave', palabraClave).single();

      if (dicc) {
        // Registrar directo
        await supabase.from('gastos').insert({
          semana_id: semana.id,
          concepto: concepto,
          monto: monto,
          categoria: dicc.categoria
        });
        await sendMessage(chatId, `💸 <b>Finvia:</b> Gasto de $${monto} registrado en ${dicc.categoria}. \nQuedan: $${disponible - monto}.`);
      } else {
        // Preguntar
        const categorias = ["Comida", "Transporte", "Ocio", "Hogar", "Otros"];
        const botones = categorias.map(c => ({ text: c, callback_data: `cat_${c}_${monto}_${concepto.substring(0,20)}` }));
        // Agrupar en filas de 2
        const keyboard = [];
        for (let i = 0; i < botones.length; i += 2) {
           keyboard.push(botones.slice(i, i + 2));
        }

        await sendMessage(chatId, `🤔 <b>Finvia:</b> No conozco la categoría para "${concepto}". ¿Dónde lo clasifico?`, {
          inline_keyboard: keyboard
        });
      }
    } else {
      await sendMessage(chatId, "❓ <b>Finvia:</b> No entendí el mensaje. Asegúrate de incluir un número para los montos.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
