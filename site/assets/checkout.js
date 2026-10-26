import { sendOrderToTelegram } from "./telegram-order.js";
const base = "/macromill-landing-page/";
const plans = {
  affordable: {
    label: "На каждый день",
    goals: { "Похудение": [1300, 990], "Рекомпозиция": [1700, 1090], "Поддержание": [2100, 1190], "Набор массы": [2600, 1390] },
  },
  premium: {
    label: "Премиум",
    goals: { "Похудение": [1400, 1690], "Поддержание / рекомпозиция": [1800, 1890], "Набор массы": [2200, 2090], "Интенсивный набор": [2600, 2290] },
  },
};
const allowedDays = [1, 3, 5, 7, 14, 30];
const qs = (selector) => document.querySelector(selector);
const money = (amount) => `${Number(amount).toLocaleString("ru-RU")} ₽`;
const dayWord = (value) => value === 1 ? "день" : value >= 2 && value <= 4 ? "дня" : "дней";
const params = new URLSearchParams(location.search);
const saved = (() => { try { return JSON.parse(sessionStorage.getItem("mm-order-draft") || "{}"); } catch { return {}; } })();
const tier = plans[params.get("tier")] ? params.get("tier") : plans[saved.tier] ? saved.tier : "affordable";
const goal = plans[tier].goals[params.get("goal")] ? params.get("goal") : plans[tier].goals[saved.goal] ? saved.goal : Object.keys(plans[tier].goals)[0];
const days = allowedDays.includes(Number(params.get("days"))) ? Number(params.get("days")) : allowedDays.includes(Number(saved.days)) ? Number(saved.days) : 3;
const [kcal, baseDaily] = plans[tier].goals[goal];
const pct = days < 3 ? 0 : days < 5 ? .04 : days < 8 ? .07 : days < 12 ? .10 : .15;
const subtotal = days * baseDaily;
const discount = Math.round(subtotal * pct);
const total = subtotal - discount;
const daily = Math.round(total / days);
const state = { method: saved.method === "pickup" ? "pickup" : "delivery" };

function text(id, value) { qs(`#${id}`).textContent = value; }
text("fact-tier", plans[tier].label);
text("fact-goal", `${goal} · ${kcal} ккал`);
const meals = /^([3-8]|[3-8]–[3-8])$/.test(params.get("meals") || "") ? params.get("meals") : tier === "affordable" ? "4–5" : "5–6";
text("fact-meals", meals);
text("fact-days", String(days));
text("fact-daily", money(daily));
text("fact-total", money(total));
const menuHref = `${base}?${new URLSearchParams({ tier, goal, days: String(days) })}#menu`;
qs("#back-to-menu").href = menuHref;
qs("#change-plan").href = menuHref;

for (const slot of document.querySelectorAll(".totals-slot")) {
  slot.innerHTML = `<div class="total-row"><span>Питание на ${days} ${dayWord(days)}</span><strong>${money(subtotal)}</strong></div>
    ${discount ? `<div class="total-row"><span>Скидка ${Math.round(pct * 100)} %</span><strong>−${money(discount)}</strong></div>` : ""}
    <div class="total-row"><span>Доставка</span><strong>Бесплатно</strong></div>
    <div class="total-row total-final"><span>Стоимость питания</span><strong>${money(total)}</strong></div>
    <details class="promo-box"><summary>Есть промокод?</summary><input class="promo-input" aria-label="Промокод" placeholder="Сообщим менеджеру"><p>Промокод проверит менеджер; сумма выше пока его не учитывает.</p></details>`;
}

function moscowNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) };
}
const now = moscowNow();
const earliest = new Date(Date.UTC(now.year, now.month - 1, now.day + (now.hour < 14 ? 1 : 2)));
const iso = (date) => date.toISOString().slice(0, 10);
const readable = (date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
qs("#first-date").min = iso(earliest);

function getValues() {
  const ids = ["street", "unit", "entrance", "floor", "intercom", "courier-comment", "first-date", "time-slot", "customer-name", "customer-phone"];
  return Object.fromEntries(ids.map((id) => [id, qs(`#${id}`).value.trim()]));
}
function persist() {
  try { sessionStorage.setItem("mm-order-draft", JSON.stringify({ ...saved, tier, goal, days, method: state.method, fields: getValues(), promo: qs(".promo-input")?.value || "" })); } catch { /* storage optional */ }
}
for (const [id, value] of Object.entries(saved.fields || {})) {
  const field = qs(`#${id}`);
  if (field) field.value = value;
}
if (!saved.fields?.["time-slot"]) qs("#time-slot").value = state.method === "pickup" ? "12:00 – 15:00" : "18:00 – 20:00";
for (const promo of document.querySelectorAll(".promo-input")) promo.value = saved.promo || "";

function setMethod(method) {
  state.method = method;
  for (const button of document.querySelectorAll("[data-method]")) button.setAttribute("aria-pressed", String(button.dataset.method === method));
  qs("#delivery-fields").hidden = method !== "delivery";
  qs("#pickup-point").hidden = method !== "pickup";
  persist();
}
for (const button of document.querySelectorAll("[data-method]")) button.addEventListener("click", () => setMethod(button.dataset.method));
setMethod(state.method);

function updateDateNote() {
  const value = qs("#first-date").value;
  if (!value) { text("date-note", `Самая ранняя дата по правилу заказа до 14:00 — ${readable(earliest)}. Точную доступность подтвердит менеджер.`); return; }
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return;
  const finalDay = new Date(date);
  finalDay.setUTCDate(finalDay.getUTCDate() + Math.min(days, 3) - 1);
  const firstEvent = state.method === "pickup" ? "Первое получение" : "Первая доставка";
  text("date-note", `${firstEvent} — ${readable(date)}, ${qs("#time-slot").value}. Привезём питание на ${readable(date)}${finalDay.getTime() === date.getTime() ? "" : ` — ${readable(finalDay)}`}. Дату подтвердит менеджер.`);
}
qs("#first-date").addEventListener("change", updateDateNote);
qs("#time-slot").addEventListener("change", () => { persist(); updateDateNote(); });
for (const button of document.querySelectorAll("[data-method]")) button.addEventListener("click", updateDateNote);
updateDateNote();
qs("#checkout-form").addEventListener("input", persist);
for (const promo of document.querySelectorAll(".promo-input")) promo.addEventListener("input", (event) => {
  for (const other of document.querySelectorAll(".promo-input")) if (other !== event.target) other.value = event.target.value;
  persist();
});

function error(id, message) {
  const field = qs(`#${id}`);
  field.setAttribute("aria-invalid", String(Boolean(message)));
  text(`${id}-error`, message);
  return Boolean(message);
}
qs("#checkout-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = getValues();
  const normalizedPhone = values["customer-phone"].replace(/\D/g, "");
  const badStreet = error("street", state.method === "delivery" && values.street.length < 5 ? "Укажите улицу и дом." : "");
  const badDate = error("first-date", !values["first-date"] ? "Выберите дату." : values["first-date"] < iso(earliest) ? "Выберите более позднюю дату." : "");
  const badName = error("customer-name", !values["customer-name"] ? "Укажите имя." : "");
  const badPhone = error("customer-phone", !/^(7|8)\d{10}$/.test(normalizedPhone) ? "Введите номер в формате +7 999 123-45-67." : "");
  if (badStreet || badDate || badName || badPhone) { qs('[aria-invalid="true"]')?.focus(); return; }
  persist();
  const destination = state.method === "delivery"
    ? [
        values.street,
        values.unit ? `кв./офис: ${values.unit}` : null,
        values.entrance ? `подъезд: ${values.entrance}` : null,
        values.floor ? `этаж: ${values.floor}` : null,
        values.intercom ? `домофон: ${values.intercom}` : null
      ].filter(Boolean).join(", ")
    : "Самовывоз: Севастополь, пр. Октябрьской Революции, 61";
  const lines = ["Заявка на рацион МакроМилл", "", `Линейка: ${plans[tier].label}`, `Рацион: ${goal}, ${kcal} ккал`, `Срок: ${days} ${dayWord(days)}`, `Стоимость питания: ${money(total)}`, `Получение: ${state.method === "delivery" ? "доставка" : "самовывоз"}`, `Адрес: ${destination}`, `Предпочтительная дата: ${values["first-date"]}`, `Предпочтительный интервал: ${values["time-slot"]}`, `Имя: ${values["customer-name"]}`, `Телефон: ${values["customer-phone"]}`];
  if (values["courier-comment"]) lines.push(`Комментарий курьеру: ${values["courier-comment"]}`);
  if (qs(".promo-input")?.value.trim()) lines.push(`Промокод для проверки: ${qs(".promo-input").value.trim()}`);
  lines.push("", "Пожалуйста, подтвердите дату и детали заказа.");
  
  const submitBtn = qs("#submit-btn") || qs(".submit-button");
  const errorBox = qs("#submit-error");
  if (errorBox) errorBox.hidden = true;
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Отправка заявки...";

  const orderData = {
    orderType: "ration",
    title: "🍱 Новая заявка: Готовый рацион питания",
    name: values["customer-name"],
    phone: values["customer-phone"],
    total: money(total),
    method: state.method === "delivery" ? "Доставка курьером" : "Самовывоз",
    destination,
    firstDate: values["first-date"],
    timeSlot: values["time-slot"] || "",
    comment: values["courier-comment"] || "",
    promo: qs(".promo-input")?.value.trim() || "",
    facts: [
      ["Тип заказа", "Готовый рацион питания"],
      ["Линейка", plans[tier].label],
      ["Рацион", `${goal} · ${kcal} ккал`],
      ["Блюд в день", meals],
      ["Срок питания", `${days} ${dayWord(days)}`],
      ["Тариф в день", money(daily)],
      discount ? ["Скидка", `${Math.round(pct * 100)} % (−${money(discount)})`] : null,
    ].filter(Boolean),
    menuDays: saved.menuDays || null,
  };

  sendOrderToTelegram(orderData).then((res) => {
    if (res.ok) {
      try { sessionStorage.removeItem("mm-order-draft"); } catch(e) {}
      const phoneSpan = qs("#success-phone");
      if (phoneSpan) phoneSpan.textContent = values["customer-phone"];
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
