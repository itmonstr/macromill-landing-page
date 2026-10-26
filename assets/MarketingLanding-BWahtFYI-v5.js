import { a as interop, r as requireReact } from "./index-DnVk_jZq-v5.js";
import {
  _ as makeAffordableMenu,
  c as basePrice,
  h as affordableDishes,
  j as premiumGoals,
  p as premiumDishes,
  s as discountTier,
  t as makePremiumMenu,
  v as affordableGoals,
} from "./ration-Dutl8qkK-v5.js";

import DishPicker from './DishPicker-v2.js';

const React = interop(requireReact(), 1);
const h = React.createElement;
const base = "/macromill-landing-page/";
const phone = "+79798598711";
const days = [1, 3, 5, 7, 14, 30];
const weekdays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const rub = (value) => `${Number(value).toLocaleString("ru-RU")} ₽`;
const dayWord = (value) => value === 1 ? "день" : value >= 2 && value <= 4 ? "дня" : "дней";

function checkoutHref(tier, goal, duration, mealCount) {
  return `${base}checkout.html?${new URLSearchParams({ tier, goal, days: String(duration), meals: mealCount })}`;
}

function generateAffordableMenuLikeApp(goal, totalDays, customKcal, excludedDishIds = []) {
  const targets = { "Похудение": 1300, "Рекомпозиция": 1700, "Поддержание": 2100, "Набор массы": 2600 };
  const targetKcal = Math.round(Number(customKcal)) || targets[goal] || 1700;
  const slots = ["Завтрак", "Перекус", "Обед", "Полдник", "Ужин"];
  const excluded = new Set(excludedDishIds.map(Number));
  const pools = slots.map((slot) => affordableDishes.filter((dish) => dish.available !== false && !excluded.has(Number(dish.id)) && (dish.meal_slot || dish.category) === slot));
  const uses = new Map();
  const usedMenus = new Set();
  const recent = [];
  const required = new Set(["Завтрак", "Обед", "Ужин"]);
  const result = [];
  for (let day = 0; day < totalDays; day++) {
    const idealCount = targetKcal <= 1400 ? 3 : targetKcal <= 1900 ? 4 : 5;
    let states = new Map([["0:0", [{ kcal: 0, slotCount: 0, meals: [], score: 0 }]]]);
    for (const [slotIndex, pool] of pools.entries()) {
      const next = new Map();
      const keepBest = (state) => {
        const key = `${state.kcal}:${state.slotCount}`;
        const alternatives = next.get(key) || [];
        const menuKey = state.meals.map((meal) => `${meal.dishId}x${meal.qty}`).join("-");
        const duplicate = alternatives.findIndex((item) => item.meals.map((meal) => `${meal.dishId}x${meal.qty}`).join("-") === menuKey);
        if (duplicate >= 0 && alternatives[duplicate].score <= state.score) return;
        if (duplicate >= 0) alternatives.splice(duplicate, 1);
        alternatives.push(state);
        alternatives.sort((a, b) => a.score - b.score);
        if (alternatives.length > 20) alternatives.length = 20;
        next.set(key, alternatives);
      };
      const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
      for (const group of states.values()) for (const state of group) {
        if (!required.has(slots[slotIndex])) keepBest(state);
        for (const dish of shuffledPool) {
          const maxQty = Math.min(2, Math.floor((targetKcal + 80) / dish.base_kcal));
          for (let qty = 1; qty <= maxQty; qty++) {
            const kcal = state.kcal + dish.base_kcal * qty;
            if (kcal > targetKcal + 80) continue;
            const meal = { dishId: dish.id, meal: slots[slotIndex], name: dish.name, category: dish.category, image: dish.image || null, weight: dish.base_weight, kcal: dish.base_kcal, p: dish.base_p, f: dish.base_f, c: dish.base_c, qty, price: dish.price || 0 };
            keepBest({ kcal, slotCount: state.slotCount + 1, meals: [...state.meals, meal], score: state.score + (uses.get(dish.id) || 0) ** 2 * 100 + (recent.includes(dish.id) ? 40 : 0) + (qty - 1) * 30 + Math.random() * 20 });
          }
        }
      }
      states = next;
    }
    const all = [...states.values()].flat();
    const inRange = all.filter((state) => state.slotCount >= 3 && Math.abs(state.kcal - targetKcal) <= 70);
    const candidates = inRange.length ? inRange : all.filter((state) => state.slotCount >= 3);
    const selected = candidates.map((candidate) => {
      const kcalDiff = Math.abs(candidate.kcal - targetKcal);
      const slotDiff = Math.abs(candidate.slotCount - idealCount);
      const isUsed = usedMenus.has(candidate.meals.map((meal) => `${meal.dishId}x${meal.qty}`).join("-"));
      return {
        candidate,
        score: (isUsed ? 50000 : 0) + slotDiff * 500 + kcalDiff * 15 + candidate.score + Math.random() * 200
      };
    }).sort((a, b) => a.score - b.score)[0]?.candidate || { kcal: 0, meals: [] };
    const menuKey = selected.meals.map((meal) => `${meal.dishId}x${meal.qty}`).join("-");
    for (const meal of selected.meals) { uses.set(meal.dishId, (uses.get(meal.dishId) || 0) + meal.qty); recent.push(meal.dishId); }
    usedMenus.add(menuKey);
    while (recent.length > pools.length * 2) recent.shift();
    result.push({ day: day + 1, meals: selected.meals, targetKcal, portionScale: 1, kcalDeviation: selected.kcal - targetKcal });
  }
  return result;
}

function FoodCard({ entry, index }) {
  const { dish, meal, qty = 1 } = entry;
  if (!dish) return null;
  return h("article", { className: "ml-food-card", key: `${dish.id}-${index}` },
    h("div", { className: "ml-food-image-wrap" },
      h("img", { src: `${base}${dish.image?.replace(/^\//, "")}`, alt: dish.name, loading: "lazy", className: "ml-food-image" }),
      h("span", { className: "ml-meal-tag" }, meal)),
    h("div", { className: "ml-food-info" },
      h("h3", null, dish.name),
      h("p", null, `${dish.base_weight * qty} г · ${dish.base_kcal * qty} ккал`),
      h("div", { className: "ml-macros" },
        h("span", null, `Б ${Math.round((dish.base_p || 0) * qty)} г`),
        h("span", null, `Ж ${Math.round((dish.base_f || 0) * qty)} г`),
        h("span", null, `У ${Math.round((dish.base_c || 0) * qty)} г`))));
}

function Landing() {
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem("mm-order-draft") || "{}"); } catch { return {}; } })();
  const params = new URLSearchParams(location.search);
  const initialTier = params.get("tier") || saved.tier || "affordable";
  const [tier, setTier] = React.useState(initialTier === "premium" ? "premium" : "affordable");
  const [goal, setGoal] = React.useState(params.get("goal") || saved.goal || "Рекомпозиция");
  const [duration, setDuration] = React.useState(days.includes(Number(params.get("days") || saved.days)) ? Number(params.get("days") || saved.days) : 3);
  const [dayIndex, setDayIndex] = React.useState(0);
  const [menuRevision, setMenuRevision] = React.useState(0);
  const [menuEdits, setMenuEdits] = React.useState({});
  const [swapTarget, setSwapTarget] = React.useState(null);
  const [swapFilter, setSwapFilter] = React.useState(null);
  const goals = tier === "affordable" ? affordableGoals : premiumGoals;
  const selected = goals.find((item) => item[0] === goal) || goals[0];
  const selectedGoal = selected[0];
  const kcal = selected[3];
  const dailyBase = basePrice(kcal, selectedGoal, tier);
  const discount = discountTier(duration).pct || 0;
  const subtotal = dailyBase * duration;
  const discountAmount = Math.round(subtotal * discount);
  const total = subtotal - discountAmount;
  const daily = Math.round(total / duration);
  const menu = React.useMemo(() => tier === "affordable"
    ? generateAffordableMenuLikeApp(selectedGoal, 7, kcal, [127])
    : makePremiumMenu(selectedGoal, 7, kcal, true), [tier, selectedGoal, kcal, menuRevision]);
  const dishes = tier === "affordable" ? affordableDishes : premiumDishes;
  const day = menu[dayIndex % menu.length];
  const generatedEntries = (day?.meals || []).map((item) => ({
    meal: item.meal, dish: dishes.find((dish) => dish.id === item.dishId), qty: item.qty || 1,
  }));
  const entries = menuEdits[dayIndex] || generatedEntries;
  const mealCounts = menu.map((item) => item?.meals?.length || 0).filter(Boolean);
  const mealsPerDay = Math.min(...mealCounts) === Math.max(...mealCounts)
    ? String(mealCounts[0]) : `${Math.min(...mealCounts)}–${Math.max(...mealCounts)}`;
  const checkout = checkoutHref(tier, selectedGoal, duration, mealsPerDay);
  const swapEntry = swapTarget ? entries[swapTarget.index] : null;
  const swapTolerance = tier === "affordable" ? 150 : 100;
  const activeSwapFilter = swapFilter || swapEntry?.dish?.category;
  const previewKcal = entries.reduce((sum, entry) => sum + (entry.dish?.base_kcal || 0) * entry.qty, 0);
  const swapDayTarget = day?.targetKcal || kcal;
  const swapOtherKcal = previewKcal - (swapEntry?.dish?.base_kcal || 0) * (swapEntry?.qty || 1);
  const existingSwapOptions = swapEntry ? entries.map((entry, index) => ({ entry, index })).filter(({ entry, index }) => index !== swapTarget.index && entry.dish?.id !== swapEntry.dish?.id)
    .filter(({ entry }, index, list) => list.findIndex((item) => item.entry.dish?.id === entry.dish?.id) === index)
    .map(({ entry }) => ({ dish: entry.dish, resultKcal: swapOtherKcal + entry.dish.base_kcal, existing: true })).filter((item) => item.dish && Math.abs(item.resultKcal - swapDayTarget) <= swapTolerance)
    .sort((a, b) => Math.abs(a.resultKcal - swapDayTarget) - Math.abs(b.resultKcal - swapDayTarget)) : [];
  const replacementSwapOptions = swapEntry?.dish ? dishes.filter((dish) => dish.available !== false && dish.category === activeSwapFilter && dish.id !== swapEntry.dish.id && !entries.some((entry, index) => index !== swapTarget.index && entry.dish?.id === dish.id))
    .map((dish) => ({ dish, resultKcal: swapOtherKcal + dish.base_kcal, existing: false })).filter((item) => Math.abs(item.resultKcal - swapDayTarget) <= swapTolerance)
    .sort((a, b) => Math.abs(a.resultKcal - swapDayTarget) - Math.abs(b.resultKcal - swapDayTarget)) : [];

  React.useEffect(() => {
    document.title = "МакроМилл — готовые рационы с доставкой по Севастополю";
    try {
      const menuDaysSummary = Array.from({ length: duration }, (_, dIdx) => {
        const dObj = menu[dIdx % menu.length];
        const dayMeals = (menuEdits[dIdx] || dObj?.meals || []).map((m) => {
          const dishObj = m.dish || dishes.find((dish) => dish.id === m.dishId);
          return {
            meal: m.meal,
            name: dishObj?.name || m.name,
            qty: m.qty || 1,
            kcal: dishObj?.base_kcal || m.kcal || 0
          };
        });
        return {
          day: dIdx + 1,
          weekday: weekdays[dIdx % weekdays.length],
          meals: dayMeals
        };
      });
      sessionStorage.setItem("mm-order-draft", JSON.stringify({
        ...saved,
        tier,
        goal: selectedGoal,
        days: duration,
        menuDays: menuDaysSummary
      }));
    } catch { /* storage optional */ }
  }, [tier, selectedGoal, duration, menu, menuEdits]);

  function changeTier(next) {
    const nextGoals = next === "affordable" ? affordableGoals : premiumGoals;
    const equivalent = selectedGoal === "Рекомпозиция" ? "Поддержание / рекомпозиция"
      : selectedGoal === "Поддержание / рекомпозиция" ? "Рекомпозиция"
      : selectedGoal === "Интенсивный набор" ? "Набор массы" : selectedGoal;
    setTier(next);
    setGoal(nextGoals.some((item) => item[0] === equivalent) ? equivalent : nextGoals[0][0]);
    setDayIndex(0);
    setMenuEdits({});
  }

  function regenerateMenu() { setMenuEdits({}); setDayIndex(0); setMenuRevision((value) => value + 1); }

  function pickReplacement(alternative, mergeExisting = false) {
    if (!swapTarget) return;
    const targetEntry = entries[swapTarget.index];
    const pickedDish = alternative.dish || alternative;
    const targetKcal = day?.targetKcal || kcal;
    const targetPortionKcal = (targetEntry?.dish?.base_kcal || 0) * (targetEntry?.qty || 1);
    const dayKcal = entries.reduce((sum, entry) => sum + (entry.dish?.base_kcal || 0) * entry.qty, 0);
    const nextKcal = dayKcal - targetPortionKcal + pickedDish.base_kcal;
    const tolerance = tier === "affordable" ? 150 : 100;
    if (Math.abs(nextKcal - targetKcal) > tolerance) return;
    let nextEntries;
    if (mergeExisting) {
      nextEntries = entries.filter((_, index) => index !== swapTarget.index).map((entry) => entry.dish.id === pickedDish.id ? { ...entry, qty: entry.qty + 1 } : entry);
    } else {
      const dish = pickedDish;
      nextEntries = entries.map((entry, index) => index === swapTarget.index ? { ...entry, dish, qty: 1 } : entry);
    }
    setMenuEdits((previous) => ({ ...previous, [dayIndex]: nextEntries }));
    setSwapTarget(null);
    setSwapFilter(null);
  }

  const faq = [
    ["Можно заказать только один раз?", "Да. Выберите подходящий срок и оформите разовый заказ."],
    ["Нужно ли заполнять анкету?", "Нет. Для заявки нужны только имя и телефон. Рост, вес и другие параметры не спрашиваем."],
    ["Можно ли скорректировать блюда в рационе?", "Да. Если у вас есть пожелания или непереносимость продуктов, просто сообщите об этом менеджеру при подтверждении заказа."],
    ["Где посмотреть состав и аллергены?", "Блюда и КБЖУ показаны в меню. При аллергии уточните состав у менеджера до заказа."],
    ["Когда привезут заказ?", "При оформлении выберите дату. Заказы до 14:00 обычно доступны на следующий день, после — через день. Дату подтвердит менеджер."],
    ["Почему привозим питание частями?", "Длительные заказы доставляем несколькими партиями, чтобы не хранить еду на всю неделю. Например, питание на четыре дня привезём сначала на три дня, затем на четвёртый. Даты согласуем при оформлении."],
    ["Как хранить питание?", "После получения уберите блюда в холодильник. Перед едой рекомендуем разогреть."],
  ];

  return h("main", { className: "mm-landing mm-landing-v2" },
    h("header", { className: "ml-header" },
      h("a", { className: "ml-brand", href: "#top", "aria-label": "МакроМилл — на главную" }, h("img", { src: `${base}logo.png`, alt: "МакроМилл" })),
      h("nav", { className: "ml-nav", "aria-label": "Главное меню" },
        h("a", { href: "#menu" }, "Рационы"), h("a", { href: "#dishes" }, "Блюда"), h("a", { href: "#delivery" }, "Доставка"),
        h("a", { href: "#about" }, "О нас"), h("a", { href: "#faq" }, "Вопросы")),
      h("a", { className: "ml-header-phone", href: `tel:${phone}` }, "+7 979 859 87 11")),

    h("section", { className: "ml-hero", id: "top", style: { "--ml-hero-poster": `url('${base}video/macromill-hero-poster.jpg')` } },
      h("video", { className: "ml-hero-video", autoPlay: true, muted: true, loop: true, playsInline: true, preload: "metadata", poster: `${base}video/macromill-hero-poster.jpg`, "aria-hidden": "true" },
        h("source", { src: `${base}video/macromill-hero.mp4`, type: "video/mp4" })),
      h("div", { className: "ml-hero-copy" },
        h("h1", null, "Сбалансированное питание на каждый день", h("br"), h("em", null, "с доставкой по Севастополю")),
        h("p", { className: "ml-hero-lead" }, "Завтраки, обеды, ужины и перекусы — готовим за вас. Разнообразное меню с рассчитанными КБЖУ, чтобы вкусно питаться и не тратить время на покупки и готовку."),
        h("div", { className: "ml-hero-proof" },
          h("div", null, h("b", null, "от 990 ₽"), h("span", null, "за день")), h("i"),
          h("div", null, h("b", null, "4–6 блюд"), h("span", null, "в рационе")), h("i"),
          h("div", null, h("b", null, "Бесплатно"), h("span", null, "доставка по Севастополю"))),
        h("div", { className: "ml-hero-actions" },
          h("a", { className: "ml-button ml-button-primary", href: "#menu" }, "Посмотреть меню и цены →"),
          h("a", { className: "ml-text-link", href: "#faq" }, "Помогите выбрать")))),

    h("section", { className: "ml-section ml-menu-section", id: "menu" },
      h("div", { className: "ml-section-heading" }, h("span", { className: "ml-eyebrow" }, "Меню и цены"),
        h("h2", null, "Выберите свой рацион"), h("p", null, "Посмотрите блюда, выберите подходящий вариант и количество дней.")),
      h("div", { className: "ml-order-builder" },
        h("div", { className: "ml-builder-controls" },
          h("div", { className: "ml-control-block" },
            h("div", { className: "ml-control-label" }, h("span", null, "01"), " Линейка питания"),
            h("div", { className: "ml-line-switch", role: "group", "aria-label": "Линейка питания" },
              h("button", { type: "button", className: tier === "affordable" ? "selected" : "", "aria-pressed": tier === "affordable", onClick: () => changeTier("affordable") }, h("b", null, "На каждый день"), h("small", null, "Новая линейка блюд")),
              h("button", { type: "button", className: tier === "premium" ? "selected" : "", "aria-pressed": tier === "premium", onClick: () => changeTier("premium") }, h("b", null, "Премиум"), h("small", null, "Основное меню")))),
          h("div", { className: "ml-control-block" },
            h("div", { className: "ml-control-label" }, h("span", null, "02"), " Цель и калорийность"),
            h("div", { className: "ml-goal-grid" }, goals.map(([name, description, , calories]) =>
              h("button", { type: "button", key: name, className: `ml-goal-option ${selectedGoal === name ? "selected" : ""}`, "aria-pressed": selectedGoal === name, onClick: () => { setGoal(name); setDayIndex(0); setMenuEdits({}); } },
                h("span", { className: "ml-goal-radio" }), h("span", { className: "ml-goal-text" }, h("b", null, name), h("small", null, `${calories} ккал/день`)),
                h("span", { className: "ml-goal-price" }, rub(basePrice(calories, name, tier)), h("small", null, "/ день")),
                h("span", { className: "ml-goal-description" }, description))))),
          h("div", { className: "ml-control-block ml-duration-block" },
            h("div", { className: "ml-control-label" }, h("span", null, "03"), " На сколько дней?"),
            h("div", { className: "ml-duration-options" }, days.map((count) =>
              h("button", { type: "button", key: count, className: duration === count ? "selected" : "", "aria-pressed": duration === count, onClick: () => setDuration(count) }, `${count} ${dayWord(count)}`))),
            h("p", { className: "ml-payment-note" }, "При заказе от 4 дней питание выдаётся партиями до трёх дней."))),
        h("div", { className: "ml-menu-preview" },
          h("div", { className: "ml-preview-head" },
            h("div", null, h("h3", null, "Что будет в рационе")),
            h("div", { className: "ml-day-controls" },
              h("button", { type: "button", "aria-label": "Предыдущий день", onClick: () => setDayIndex((index) => (index + menu.length - 1) % menu.length) }, "‹"),
              h("span", null, weekdays[dayIndex % weekdays.length]),
              h("button", { type: "button", "aria-label": "Следующий день", onClick: () => setDayIndex((index) => (index + 1) % menu.length) }, "›"))),
          h("div", { className: "ml-menu-actions" },
            h("p", { className: "ml-example-caption" }, "Пример дня. Состав меняется в зависимости от выбранной линейки и дня программы."),
            h("button", { type: "button", className: "ml-regenerate-button", onClick: regenerateMenu }, "↻ Перегенерировать рацион")),
          h("div", { className: `ml-food-grid ${entries.length === 3 ? "ml-food-grid-three" : ""}` }, entries.map((entry, index) => h(FoodCard, { entry, index, key: `${dayIndex}-${index}-${entry.dish?.id}` }))),
          h("div", { className: "ml-menu-foot" }, h("span", null, "Итого за день"), h("b", null, `${previewKcal} ккал`))),
        h("div", { className: "ml-order-summary" },
          h("div", { className: "ml-summary-rate" }, h("span", null, "Тариф"), h("b", null, rub(daily), h("small", null, " / день"))),
          discount > 0 && h("div", { className: "ml-summary-discount" }, `Скидка за срок ${Math.round(discount * 100)} %`),
          h("div", { className: "ml-summary-batch" }, h("span", null, "Выбранный срок"), h("b", null, `${duration} ${dayWord(duration)}`)),
          h("p", null, `Питание на весь срок: ${rub(total)}${discountAmount ? `, экономия ${rub(discountAmount)}` : ""}.`),
          h("a", { className: "ml-button ml-button-primary ml-summary-button", href: checkout }, "Оформить заказ →")))),

    h(DishPicker),

    h("section", { className: "ml-section ml-delivery", id: "delivery" },
      h("div", { className: "ml-section-heading ml-delivery-heading" },
        h("span", { className: "ml-eyebrow" }, "От заказа до стола"),
        h("h2", null, "Доставка и самовывоз"),
        h("p", null, "Выберите удобный способ получить рацион.")),
      h("div", { className: "ml-delivery-options" },
        h("article", { className: "ml-delivery-card" },
          h("div", { className: "ml-delivery-card-heading" },
            h("span", { className: "ml-delivery-icon" }, h("svg", { viewBox: "0 0 24 24", "aria-hidden": true }, h("path", { d: "M3 7h11v11H3zM14 11h4l3 3v4h-7zM7 18a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M14 14h7" }))),
            h("div", null, h("h3", null, "Доставка"), h("b", { className: "ml-delivery-highlight" }, "Бесплатно по Севастополю"))),
          h("div", { className: "ml-delivery-details" },
            h("p", { className: "ml-delivery-description" }, "Когда привезём заказ"),
            h("div", { className: "ml-delivery-time-grid" },
              h("div", { className: "ml-delivery-time-item" }, h("span", null, "Заказ до 14:00"), h("strong", null, "Обычно на следующий день")),
              h("div", { className: "ml-delivery-time-item" }, h("span", null, "После 14:00"), h("strong", null, "Обычно через день")))),
          h("div", { className: "ml-route-map", "aria-label": "Доставка по Севастополю" },
            h("span", { className: "ml-map-label" }, "Севастополь"),
            h("svg", { viewBox: "0 0 600 170", role: "presentation", "aria-hidden": true },
              h("path", { className: "ml-map-road", d: "M-10 34 C80 78 112 20 203 52 S325 112 402 76 512 44 620 92" }),
              h("path", { className: "ml-map-road ml-map-road-secondary", d: "M32 174 C102 132 124 112 171 104 S256 90 300 28 408 3 460 37 534 128 595 151" }),
              h("path", { className: "ml-map-route", d: "M28 137 C96 110 131 122 190 98 S295 60 354 86 451 118 500 76 551 59 580 48" }),
              h("circle", { cx: 28, cy: 137, r: 8, className: "ml-map-dot" }), h("circle", { cx: 580, cy: 48, r: 10, className: "ml-map-pin-dot" })),
            h("span", { className: "ml-map-caption" }, "Готовим и привозим к вам")),
          h("div", { className: "ml-delivery-card-foot" }, "Точную дату и время согласуем после оформления")),
        h("article", { className: "ml-delivery-card" },
          h("div", { className: "ml-delivery-card-heading" },
            h("span", { className: "ml-delivery-icon" }, h("svg", { viewBox: "0 0 24 24", "aria-hidden": true }, h("path", { d: "M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" }), h("circle", { cx: 12, cy: 10, r: 2.5 }))),
            h("div", null, h("h3", null, "Самовывоз"), h("b", { className: "ml-pickup-address" }, "Севастополь, пр. Октябрьской Революции, 61"))),
          h("div", { className: "ml-delivery-details" },
            h("p", { className: "ml-delivery-description" }, "Выберите удобный интервал. Менеджер подтвердит время выдачи."),
            h("div", { className: "ml-pickup-slots", "aria-label": "Интервалы самовывоза" },
              ["09:00–12:00", "12:00–15:00", "15:00–18:00", "18:00–20:00", "20:00–22:00"].map((slot) => h("span", { key: slot }, slot)))),
          h("div", { className: "ml-pickup-map", "aria-label": "Схема расположения пункта самовывоза" },
            h("span", { className: "ml-pickup-road ml-pickup-road-one" }), h("span", { className: "ml-pickup-road ml-pickup-road-two" }),
            h("span", { className: "ml-pickup-road ml-pickup-road-three" }), h("span", { className: "ml-pickup-park" }),
            h("span", { className: "ml-pickup-map-label" }, "пр. Октябрьской Революции"),
            h("span", { className: "ml-pickup-pin" }, h("svg", { viewBox: "0 0 24 24", "aria-hidden": true }, h("path", { d: "M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" }), h("circle", { cx: 12, cy: 10, r: 2.5, fill: "white" })))),
          h("a", { className: "ml-map-button", href: "https://yandex.ru/maps/?text=Севастополь%2C%20проспект%20Октябрьской%20Революции%2C%2061", target: "_blank", rel: "noreferrer" }, "Открыть на карте →"))),
      h("div", { className: "ml-delivery-note" }, h("span", { "aria-hidden": true }, "◷"), h("span", null, "Точную дату и время подтвердим после оформления заказа"))),

    h("section", { className: "ml-about", id: "about" },
      h("div", { className: "ml-about-image" }, h("img", { src: `${base}img/8.jpg`, alt: "Готовое блюдо из рациона МакроМилл", loading: "lazy" }), h("span", null, "МакроМилл · Севастополь")),
      h("div", { className: "ml-about-copy" }, h("span", { className: "ml-eyebrow" }, "Знакомьтесь, МакроМилл"),
        h("h2", null, "Готовим для вас в Севастополе"),
        h("p", null, "Мы — команда, которая готовит и доставляет готовые рационы на каждый день. Продумываем меню, рассчитываем КБЖУ и берём готовку на себя — чтобы вы могли нормально питаться и заниматься своими делами."),
        h("a", { className: "ml-text-link", href: `tel:${phone}` }, "Задать вопрос менеджеру →"))),

    h("section", { className: "ml-section ml-faq", id: "faq" },
      h("div", { className: "ml-section-heading" }, h("span", { className: "ml-eyebrow" }, "Подскажем до заказа"), h("h2", null, "Частые вопросы")),
      h("div", { className: "ml-faq-layout" },
        h("div", { className: "ml-faq-list" }, faq.map(([question, answer], index) =>
          h("details", { className: "ml-faq-item", key: question, open: index === 0 || undefined }, h("summary", null, question), h("p", null, answer)))),
        h("aside", { className: "ml-help-card" }, h("h3", null, "Поможем выбрать"),
          h("p", null, "Расскажите, что важно для вас, — менеджер подскажет, с чего начать."),
          h("a", { className: "ml-button ml-button-dark", href: "https://t.me/macromillman" }, "Написать нам →"),
          h("a", { className: "ml-help-phone", href: `tel:${phone}` }, "+7 979 859 87 11")))),

    h("footer", { className: "ml-footer" },
      h("div", { className: "ml-footer-top" }, h("img", { src: `${base}logo.png`, alt: "МакроМилл" }),
        h("p", null, "Готовые рационы с доставкой по Севастополю"),
        h("div", { className: "ml-footer-contacts" }, h("a", { href: `tel:${phone}` }, "+7 979 859 87 11"), h("a", { href: "mailto:Kozhemyachenko.aleksej@mail.ru" }, "Kozhemyachenko.aleksej@mail.ru"))),
      h("div", { className: "ml-footer-bottom" }, h("span", null, `© ${new Date().getFullYear()} МакроМилл`),
        h("div", null, h("a", { href: `${base}oferta.html` }, "Публичная оферта"), h("a", { href: `${base}agreement.html` }, "Условия использования"), h("a", { href: `${base}about.html` }, "Реквизиты и контакты")))),
    h("div", { className: "ml-mobile-bar" }, h("div", null, h("small", null, "Тариф в день"), h("b", null, rub(daily))), h("a", { href: checkout }, "Оформить заказ →")));
}

export default Landing;
