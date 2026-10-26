// Отправка заявок с лендинга в Telegram бота
const EDGE_URL = 'https://macromill.ru/functions/v1/landing-lead';
const DIRECT_BOT_TOKEN = '8952562730:AAFTzoeoAgDd9y_Ig-iF1wAXVyCjx_l4D5U';
const DIRECT_CHAT_ID = '1790844261';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildTelegramMessage(order) {
  const isRation = order.orderType === 'ration';
  const icon = isRation ? '🍱' : '📦';
  const typeLabel = isRation ? 'Готовый рацион питания' : 'Выбор отдельных блюд';

  const lines = [
    `${icon} <b>Новая заявка: ${typeLabel}</b>`,
    '',
    `👤 <b>Имя:</b> ${escapeHtml(order.name)}`,
    `📞 <b>Телефон:</b> <code>${escapeHtml(order.phone)}</code>`,
  ];

  if (order.facts && order.facts.length > 0) {
    lines.push('', '📋 <b>Параметры заказа:</b>');
    for (const [k, v] of order.facts) {
      if (v) lines.push(`• <b>${escapeHtml(k)}:</b> ${escapeHtml(v)}`);
    }
  }

  // Блюда в готовом рационе (по дням)
  if (order.menuDays && order.menuDays.length > 0) {
    lines.push('', '🥗 <b>Состав рациона по дням:</b>');
    for (const d of order.menuDays) {
      lines.push(`📅 <b>День ${d.day} (${escapeHtml(d.weekday || '')}):</b>`);
      for (const m of d.meals || []) {
        const qtyStr = m.qty > 1 ? ` (${m.qty} порц.)` : '';
        lines.push(`  • <i>${escapeHtml(m.meal)}:</i> ${escapeHtml(m.name)}${qtyStr}`);
      }
    }
  }

  // Выбор отдельных блюд
  if (order.dishes && order.dishes.length > 0) {
    lines.push('', '🥗 <b>Выбранные блюда:</b>');
    for (const d of order.dishes) {
      lines.push(`• ${escapeHtml(d)}`);
    }
  }

  lines.push('', `💰 <b>Итого к оплате:</b> <b>${escapeHtml(order.total)}</b>`);
  lines.push(`🚚 <b>Способ получения:</b> ${escapeHtml(order.method || 'доставка')}`);
  lines.push(`📍 <b>Адрес:</b> ${escapeHtml(order.destination)}`);
  lines.push(`🗓 <b>Дата первого получения:</b> ${escapeHtml(order.firstDate)}`);
  if (order.timeSlot) {
    lines.push(`⏰ <b>Удобное время:</b> ${escapeHtml(order.timeSlot)}`);
  }

  if (order.comment) {
    lines.push('', `💬 <b>Комментарий:</b> ${escapeHtml(order.comment)}`);
  }
  if (order.promo) {
    lines.push('', `🏷 <b>Промокод:</b> <code>${escapeHtml(order.promo)}</code>`);
  }

  return lines.join('\n');
}

export async function sendOrderToTelegram(order) {
  const text = buildTelegramMessage(order);

  // 1. Пробуем через надёжную серверную Edge Function
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) return { ok: true, via: 'edge' };
    }
  } catch (e) {
    console.warn('Edge function failed, falling back to direct TG API:', e);
  }

  // 2. Резервный канал — прямой вызов Telegram Bot API
  try {
    const directRes = await fetch(`https://api.telegram.org/bot${DIRECT_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: DIRECT_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const directData = await directRes.json();
    if (directData.ok) {
      return { ok: true, via: 'direct' };
    }
    throw new Error(directData.description || 'Ошибка Telegram API');
  } catch (err) {
    console.error('All Telegram send attempts failed:', err);
    return { ok: false, error: String(err) };
  }
}
