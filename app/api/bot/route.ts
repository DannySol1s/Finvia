import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const OWNER_ID = parseInt(process.env.MY_TELEGRAM_ID || '0');
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

function getFechaFin() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

// Helpers de BD
async function getActiveWeek(userId: string) {
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
async function handleCallbackQuery(callbackQuery: any, perfil: any) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const userId = perfil.user_id;

  if (data.startsWith('cat_')) {
    const [_, categoria, monto, ...conceptoParts] = data.split('_');
    const concepto = conceptoParts.join('_');
    const palabraClave = concepto.split(' ')[0].toLowerCase();

    // 1. Aprender palabra clave
    await supabase.from('diccionario_categorias').insert({
      user_id: userId,
      palabra_clave: palabraClave,
      categoria: categoria
    });

    // 2. Registrar Gasto
    const semana = await getActiveWeek(userId);
    if (semana) {
      await supabase.from('gastos').insert({
        user_id: userId,
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

    const sobrante = Number(semana.saldo_sobrante_final);
    // Añadir a ahorros
    const { data: ahorro } = await supabase.from('ahorros').select('*').eq('user_id', userId).single();
    if (ahorro) {
      await supabase.from('ahorros').update({
        monto_total_acumulado: Number(ahorro.monto_total_acumulado) + sobrante,
        ultima_actualizacion: new Date().toISOString()
      }).eq('user_id', userId);
    } else {
      await supabase.from('ahorros').insert({ user_id: userId, monto_total_acumulado: sobrante });
    }

    // Cerrar semana actual
    await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id);

    // Abrir nueva semana con presupuesto fijo
    await supabase.from('semanas').insert({
      user_id: userId,
      fecha_fin: getFechaFin(),
      presupuesto_actual: perfil.presupuesto_semanal_fijo,
      estado: 'abierta'
    });
    await sendMessage(chatId, `💰 <b>Finvia:</b> $${sobrante} guardados en tus ahorros. ¡Nueva semana iniciada con $${perfil.presupuesto_semanal_fijo}!`);

  } else if (data === 'cierre_acumular') {
    const semana = await getActiveWeek(userId);
    if (!semana) return;

    const sobrante = Number(semana.saldo_sobrante_final);

    // Cerrar semana actual
    await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id);

    // Abrir nueva semana con presupuesto fijo + sobrante
    const nuevoPpto = Number(perfil.presupuesto_semanal_fijo) + sobrante;
    await supabase.from('semanas').insert({
      user_id: userId,
      fecha_fin: getFechaFin(),
      presupuesto_actual: nuevoPpto,
      estado: 'abierta'
    });
    await sendMessage(chatId, `📈 <b>Finvia:</b> Sobrante acumulado. ¡Nueva semana iniciada con un súper presupuesto de $${nuevoPpto}!`);
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

    const messageObj = body.callback_query ? body.callback_query.message : body.message;
    const fromObj = body.callback_query ? body.callback_query.from : body.message?.from;

    if (!messageObj || !fromObj) return NextResponse.json({ ok: true });

    const chatId = messageObj.chat.id;
    const telegramId = fromObj.id;

    // Verificar si es el dueño
    if (OWNER_ID !== 0 && telegramId !== OWNER_ID) {
      await sendMessage(chatId, "⛔ <b>Finvia:</b> Acceso denegado. No eres el dueño autorizado.");
      return NextResponse.json({ ok: true });
    }

    // Buscar el perfil asociado a este telegram_id
    const { data: perfil } = await supabase.from('perfiles').select('*').eq('telegram_id', telegramId).single();

    if (!perfil) {
      await sendMessage(chatId, "⚠️ <b>Finvia:</b> No encontré tu perfil. Asegúrate de haberte registrado en la web y vinculado tu Telegram ID.");
      return NextResponse.json({ ok: true });
    }

    const userId = perfil.user_id;

    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query, perfil);
      return NextResponse.json({ ok: true });
    }

    const text = body.message.text?.trim() || "";
    if (!text) return NextResponse.json({ ok: true });
    const textLower = text.toLowerCase();

    // ---------------------------------------------------------
    // COMANDOS
    // ---------------------------------------------------------
    if (textLower.startsWith('/start')) {
      const bienvenida = `👋 <b>Finvia:</b> ¡Bienvenido de nuevo, ${perfil.nombre_completo || 'Usuario'}!\n\n` +
        `Soy tu asistente financiero personal. Aquí tienes un recordatorio rápido de cómo interactuar conmigo:\n\n` +
        `📉 <b>Para registrar gastos:</b>\nSolo dime en qué gastaste y la cantidad. Si es una palabra nueva, te preguntaré a qué categoría pertenece.\n<i>Ejemplo: "Tacos 150" o "Gasolina 400"</i>\n\n` +
        `📈 <b>Para sumar ingresos:</b>\nSi conseguiste dinero extra o es tu día de pago, dímelo para sumarlo a tu presupuesto de esta semana.\n<i>Ejemplo: "Recibí 500" o "/ingreso 500"</i>\n\n` +
        `📊 <b>Revisa tus números:</b>\nUsa /saldo para ver cuánto te queda disponible hoy, y usa /cerrar_semana al final de tu ciclo para hacer el corte y acumular tus ahorros.\n\n` +
        `¡Estoy listo para registrar tus movimientos! 🚀`;

      await sendMessage(chatId, bienvenida);
      // Crear semana si no tiene una activa
      const semana = await getActiveWeek(userId);
      if (!semana) {
        await supabase.from('semanas').insert({
          user_id: userId,
          fecha_fin: getFechaFin(),
          presupuesto_actual: perfil.presupuesto_semanal_fijo,
          estado: 'abierta'
        });
        await sendMessage(chatId, `📅 <b>Finvia:</b> He creado tu primera semana con presupuesto de $${perfil.presupuesto_semanal_fijo}.`);
      }
      return NextResponse.json({ ok: true });
    }

    // B. INGRESOS EXTRAS
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

    // ESTADO
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

    // CIERRE SEMANAL
    if (textLower.startsWith('/cerrar_semana')) {
      const semana = await getActiveWeek(userId);
      if (!semana) {
        await sendMessage(chatId, "⚠️ <b>Finvia:</b> No hay semana activa para cerrar.");
        return NextResponse.json({ ok: true });
      }

      const gastos = await getTotalExpenses(semana.id);
      const sobrante = Number(semana.presupuesto_actual) - gastos;

      await supabase.from('semanas').update({ saldo_sobrante_final: sobrante }).eq('id', semana.id);

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
          fecha_fin: getFechaFin(),
          presupuesto_actual: nuevoPresupuesto,
          estado: 'abierta'
        });
        await sendMessage(chatId, `📉 <b>Finvia - Cierre Semanal:</b>\nTe excediste por $${deficit}. \n⚠️ <b>Castigo:</b> Empezamos esta nueva semana con menos dinero para compensar el exceso anterior. \nNuevo presupuesto inicial: $${nuevoPresupuesto}.`);
      } else {
        await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id);
        await supabase.from('semanas').insert({
          user_id: userId,
          fecha_fin: getFechaFin(),
          presupuesto_actual: perfil.presupuesto_semanal_fijo,
          estado: 'abierta'
        });
        await sendMessage(chatId, `⚖️ <b>Finvia - Cierre Semanal:</b>\nQuedaste en $0 exactos. \nSe ha iniciado una nueva semana con tu presupuesto base de $${perfil.presupuesto_semanal_fijo}.`);
      }
      return NextResponse.json({ ok: true });
    }

    // A. GASTOS DIARIOS
    const match = text.match(/(\d+(\.\d+)?)/);
    if (match) {
      const monto = Number(match[0]);
      const concepto = text.replace(match[0], '').trim();
      const palabraClave = concepto.split(' ')[0].toLowerCase() || "indefinido";

      const semana = await getActiveWeek(userId);
      if (!semana) {
        await sendMessage(chatId, "⚠️ <b>Finvia:</b> No tienes una semana activa.");
        return NextResponse.json({ ok: true });
      }

      const totalGastos = await getTotalExpenses(semana.id);
      const disponible = Number(semana.presupuesto_actual) - totalGastos;

      if (disponible < monto) {
        await sendMessage(chatId, `🚨 <b>ALERTA FINVIA:</b> Este gasto de $${monto} excede tu saldo disponible ($${disponible}).`);
      }

      const { data: dicc } = await supabase.from('diccionario_categorias').select('categoria').eq('user_id', userId).eq('palabra_clave', palabraClave).single();

      if (dicc) {
        await supabase.from('gastos').insert({
          user_id: userId,
          semana_id: semana.id,
          concepto: concepto,
          monto: monto,
          categoria: dicc.categoria
        });
        await sendMessage(chatId, `💸 <b>Finvia:</b> Gasto de $${monto} registrado en ${dicc.categoria}. \nQuedan: $${disponible - monto}.`);
      } else {
        const categorias = ["Comida", "Transporte", "Ocio", "Hogar", "Otros"];
        const botones = categorias.map(c => ({ text: c, callback_data: `cat_${c}_${monto}_${concepto.substring(0, 20)}` }));
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
