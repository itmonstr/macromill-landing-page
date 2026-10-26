import { sendOrderToTelegram } from "./telegram-order.js";
import { affordableDishes, premiumDishes } from './dish-catalog-v1.js';

const base = '/macromill-landing-page/';
const qs = (selector) => document.querySelector(selector);
const rub = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
const plural = (n) => n % 10 === 1 && n % 100 !== 11 ? 'порция' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'порции' : 'порций';
const catalog = { premium: premiumDishes, affordable: affordableDishes };
let order;
let saved;
try { order = JSON.parse(sessionStorage.getItem('mm-dish-order-v1') || 'null'); } catch { order = null; }
try { saved = JSON.parse(sessionStorage.getItem('mm-dish-checkout-draft-v1') || '{}'); } catch { saved = {}; }
const tier = order?.tier === 'affordable' ? 'affordable' : 'premium';
const dishes = catalog[tier];
const quantities = new Map();
for (const row of Array.isArray(order?.items) ? order.items : []) {
  const dish = dishes.find((item) => String(item.id) === String(row.id));
  const qty = Number(row.qty);
  if (dish && Number.isInteger(qty) && qty > 0 && qty <= 99) quantities.set(dish.id, Math.min(99, (quantities.get(dish.id) || 0) + qty));
}
const selected = dishes.filter((dish) => quantities.has(dish.id)).map((dish) => ({ ...dish, qty: quantities.get(dish.id) }));
const count = selected.reduce((sum, dish) => sum + dish.qty, 0);
const total = selected.reduce((sum, dish) => sum + dish.qty * dish.price, 0);
const totalKcal = selected.reduce((sum, dish) => sum + dish.qty * dish.kcal, 0);
const backUrl = `${base}?dishTier=${tier}#dishes`;
qs('#back-to-dishes').href = backUrl;
qs('#change-dishes').href = backUrl;
qs('#dish-order-unavailable a').href = backUrl;

if (count < 3) {
  qs('#dish-checkout-grid').hidden = true;
  qs('#dish-order-unavailable').hidden = false;
} else {
  qs('#fact-tier').textContent = tier === 'premium' ? 'Премиум' : 'Доступная';
  qs('#fact-count').textContent = `${count} ${plural(count)}`;
  qs('#fact-total').textContent = rub(total);

  const list = qs('#selected-dishes');
  for (const dish of selected) {
    const row = document.createElement('article');
    row.className = 'dish-review-item';
    const photo = document.createElement('img');
    photo.src = `${base}${dish.image.replace(/^\//, '')}`;
    photo.alt = dish.name;
    photo.loading = 'lazy';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = dish.name;
    const subtitle = document.createElement('small');
    subtitle.textContent = `${dish.qty} × ${dish.weight} г · ${dish.kcal} ккал/порция`;
    details.append(title, subtitle);
    const price = document.createElement('b');
    price.textContent = rub(dish.price * dish.qty);
    row.append(photo, details, price);
    list.append(row);
  }
  for (const slot of document.querySelectorAll('.dish-totals-slot')) {
    slot.innerHTML = `<div class="total-row"><span>${count} ${plural(count)}</span><strong>${rub(total)}</strong></div>
      <div class="total-row"><span>Калорийность набора</span><strong>${totalKcal} ккал</strong></div>
      <div class="total-row"><span>Доставка</span><strong>Бесплатно</strong></div>
      <div class="total-row total-final"><span>Стоимость набора</span><strong>${rub(total)}</strong></div>
      <details class="promo-box"><summary>Есть промокод?</summary><input class="promo-input" aria-label="Промокод" placeholder="Сообщим менеджеру"><p>Промокод проверит менеджер. Указанная стоимость пока его не учитывает.</p></details>`;
  }
  for (const input of document.querySelectorAll('.promo-input')) input.value = saved.promo || '';

  function moscowNow() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) };
  }
  const now = moscowNow();
  const earliest = new Date(Date.UTC(now.year, now.month - 1, now.day + (now.hour < 14 ? 1 : 2)));
  const iso = (date) => date.toISOString().slice(0, 10);
  const readable = (date) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
  qs('#first-date').min = iso(earliest);
  const state = { method: saved.method === 'pickup' ? 'pickup' : 'delivery' };
  const fieldIds = ['street', 'unit', 'entrance', 'floor', 'intercom', 'courier-comment', 'first-date', 'time-slot', 'customer-name', 'customer-phone'];
  const values = () => Object.fromEntries(fieldIds.map((id) => [id, qs(`#${id}`).value.trim()]));
  const persist = () => {
    try { sessionStorage.setItem('mm-dish-checkout-draft-v1', JSON.stringify({ method: state.method, fields: values(), promo: qs('.promo-input')?.value || '' })); } catch { /* optional */ }
  };
  for (const [id, value] of Object.entries(saved.fields || {})) {
    const field = qs(`#${id}`);
    if (field) field.value = value;
  }
  if (!saved.fields?.['time-slot']) qs('#time-slot').value = state.method === 'pickup' ? '12:00 – 15:00' : '18:00 – 20:00';

  function updateDateNote() {
    const input = qs('#first-date').value;
    if (!input) {
      qs('#date-note').textContent = `Самая ранняя дата по правилу заказа до 14:00 — ${readable(earliest)}. Точную доступность подтвердит менеджер.`;
      return;
    }
    const date = new Date(`${input}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return;
    qs('#date-note').textContent = `${state.method === 'pickup' ? 'Самовывоз' : 'Доставка'} — ${readable(date)}, ${qs('#time-slot').value}. Дату подтвердит менеджер.`;
  }
  function setMethod(method) {
    state.method = method;
    for (const button of document.querySelectorAll('[data-method]')) button.setAttribute('aria-pressed', String(button.dataset.method === method));
    qs('#delivery-fields').hidden = method !== 'delivery';
    qs('#pickup-point').hidden = method !== 'pickup';
    if (!saved.fields?.['time-slot']) qs('#time-slot').value = method === 'pickup' ? '12:00 – 15:00' : '18:00 – 20:00';
    updateDateNote();
    persist();
  }
  for (const button of document.querySelectorAll('[data-method]')) button.addEventListener('click', () => setMethod(button.dataset.method));
  setMethod(state.method);
  qs('#first-date').addEventListener('change', updateDateNote);
  qs('#time-slot').addEventListener('change', updateDateNote);
  qs('#checkout-form').addEventListener('input', persist);
  for (const input of document.querySelectorAll('.promo-input')) input.addEventListener('input', (event) => {
    for (const other of document.querySelectorAll('.promo-input')) if (other !== event.target) other.value = event.target.value;
    persist();
  });

  function error(id, message) {
    qs(`#${id}`).setAttribute('aria-invalid', String(Boolean(message)));
    qs(`#${id}-error`).textContent = message;
    return Boolean(message);
  }
  qs('#checkout-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = values();
    const phone = fields['customer-phone'].replace(/\D/g, '');
    const badStreet = error('street', state.method === 'delivery' && fields.street.length < 5 ? 'Укажите улицу и дом.' : '');
    const badDate = error('first-date', !fields['first-date'] ? 'Выберите дату.' : fields['first-date'] < iso(earliest) ? 'Выберите более позднюю дату.' : '');
    const badName = error('customer-name', !fields['customer-name'] ? 'Укажите имя.' : '');
    const badPhone = error('customer-phone', !/^(7|8)\d{10}$/.test(phone) ? 'Введите номер в формате +7 999 123-45-67.' : '');
    if (badStreet || badDate || badName || badPhone) { qs('[aria-invalid="true"]')?.focus(); return; }
    persist();
    const destination = state.method === 'delivery'
      ? [
          fields.street,
          fields.unit ? `кв./офис: ${fields.unit}` : null,
          fields.entrance ? `подъезд: ${fields.entrance}` : null,
          fields.floor ? `этаж: ${fields.floor}` : null,
          fields.intercom ? `домофон: ${fields.intercom}` : null
        ].filter(Boolean).join(', ')
      : 'Самовывоз: Севастополь, пр. Октябрьской Революции, 61';
    const lines = ['Заявка на выбор блюд МакроМилл', '', `Линейка: ${tier === 'premium' ? 'Премиум' : 'Доступная'}`, `Количество: ${count} ${plural(count)}`, 'Блюда:'];
    for (const dish of selected) lines.push(`• ${dish.name} — ${dish.qty} × ${rub(dish.price)} = ${rub(dish.qty * dish.price)}`);
    lines.push('', `Стоимость набора: ${rub(total)}`, `Получение: ${state.method === 'delivery' ? 'доставка' : 'самовывоз'}`, `Адрес: ${destination}`, `Предпочтительная дата: ${fields['first-date']}`, `Предпочтительный интервал: ${fields['time-slot']}`, `Имя: ${fields['customer-name']}`, `Телефон: ${fields['customer-phone']}`);
    if (fields['courier-comment']) lines.push(`Комментарий курьеру: ${fields['courier-comment']}`);
    if (qs('.promo-input')?.value.trim()) lines.push(`Промокод для проверки: ${qs('.promo-input').value.trim()}`);
    lines.push('', 'Пожалуйста, подтвердите дату и детали заказа.');
    
    const submitBtn = qs("#submit-btn") || qs(".submit-button");
    const errorBox = qs("#submit-error");
    if (errorBox) errorBox.hidden = true;
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Отправка заявки...";

    const dishList = selected.map(dish => `${dish.name} — ${dish.qty} × ${rub(dish.price)} = ${rub(dish.qty * dish.price)}`);

    const orderData = {
      orderType: "custom_dishes",
      title: "📦 Новая заявка: Выбор отдельных блюд",
      name: fields["customer-name"],
      phone: fields["customer-phone"],
      total: rub(total),
      method: state.method === "delivery" ? "Доставка курьером" : "Самовывоз",
      destination,
      firstDate: fields["first-date"],
      timeSlot: fields["time-slot"] || "",
      comment: fields["courier-comment"] || "",
      promo: qs(".promo-input")?.value.trim() || "",
      facts: [
        ["Тип заказа", "Выбор отдельных блюд"],
        ["Линейка", tier === "premium" ? "Премиум" : "Доступная"],
        ["Количество порций", `${count} ${plural(count)}`],
      ],
      dishes: dishList,
    };

    sendOrderToTelegram(orderData).then((res) => {
      if (res.ok) {
      // Отправка целей в Яндекс.Метрику
      try {
        if (typeof window.ym === "function") {
          window.ym(113757113, 'reachGoal', 'order_lead');
          window.ym(113757113, 'reachGoal', 'order_submit');
          window.ym(113757113, 'reachGoal', 'order_sumbit');
          window.ym(113757113, 'reachGoal', 'lead');
          window.ym(113757113, 'reachGoal', 'order_success');
          window.ym(113757113, 'reachGoal', 'zakaz');
        }
      } catch(e) {}
        try { sessionStorage.removeItem("mm-dish-selection-draft"); } catch(e) {}
        const phoneSpan = qs("#success-phone");
        if (phoneSpan) phoneSpan.textContent = fields["customer-phone"];
        const modal = qs("#success-modal");
        if (modal) modal.hidden = false;
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        if (errorBox) {
          errorBox.textContent = "Не удалось отправить заявку автоматически. Пожалуйста, попробуйте ещё раз или позвоните нам: +7 979 859 87 11";
          errorBox.hidden = false;
        }
      }
    }).catch((err) => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      if (errorBox) {
        errorBox.textContent = "Ошибка соединения. Пожалуйста, позвоните нам: +7 979 859 87 11";
        errorBox.hidden = false;
      }
    });
  });
}
