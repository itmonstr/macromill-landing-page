import { a as interop, r as requireReact } from "./index-DnVk_jZq.js";
import {
  _ as makeAffordableMenu,
  c as basePrice,
  h as affordableDishes,
  j as premiumGoals,
  p as premiumDishes,
  s as discountTier,
  t as makePremiumMenu,
  v as affordableGoals,
} from "./ration-Dutl8qkK.js";

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
    ? makeAffordableMenu(selectedGoal, 7, kcal, [127])
    : makePremiumMenu(selectedGoal, 7, kcal, true), [tier, selectedGoal, kcal]);
  const dishes = tier === "affordable" ? affordableDishes : premiumDishes;
  const day = menu[dayIndex % menu.length];
  const entries = (day?.meals || []).map((item) => ({
    meal: item.meal, dish: dishes.find((dish) => dish.id === item.dishId), qty: item.qty || 1,
  }));
  const mealCounts = menu.map((item) => item?.meals?.length || 0).filter(Boolean);
  const mealsPerDay = Math.min(...mealCounts) === Math.max(...mealCounts)
    ? String(mealCounts[0]) : `${Math.min(...mealCounts)}–${Math.max(...mealCounts)}`;
  const checkout = checkoutHref(tier, selectedGoal, duration, mealsPerDay);

  React.useEffect(() => {
    document.title = "МакроМилл — готовые рационы с доставкой по Севастополю";
    try { sessionStorage.setItem("mm-order-draft", JSON.stringify({ ...saved, tier, goal: selectedGoal, days: duration })); } catch { /* storage optional */ }
  }, [tier, selectedGoal, duration]);

  function changeTier(next) {
    const nextGoals = next === "affordable" ? affordableGoals : premiumGoals;
    const equivalent = selectedGoal === "Рекомпозиция" ? "Поддержание / рекомпозиция"
      : selectedGoal === "Поддержание / рекомпозиция" ? "Рекомпозиция"
      : selectedGoal === "Интенсивный набор" ? "Набор массы" : selectedGoal;
    setTier(next);
    setGoal(nextGoals.some((item) => item[0] === equivalent) ? equivalent : nextGoals[0][0]);
    setDayIndex(0);
  }

  const faq = [
    ["Можно заказать только один раз?", "Да. Выберите подходящий срок и оформите разовый заказ."],
    ["Нужно ли заполнять анкету?", "Нет. Для заявки нужны только имя и телефон. Рост, вес и другие параметры не спрашиваем."],
    ["Можно ли заменить блюдо?", "Доступные замены и состав уточните у менеджера до оформления заказа."],
    ["Где посмотреть состав и аллергены?", "Блюда и КБЖУ показаны в меню. При аллергии уточните состав у менеджера до заказа."],
    ["Когда привезут заказ?", "При оформлении выберите дату. Заказы до 14:00 обычно доступны на следующий день, после — через день. Дату подтвердит менеджер."],
    ["Почему привозим питание частями?", "Длительные заказы доставляем несколькими партиями, чтобы не хранить еду на всю неделю. Например, питание на четыре дня привезём сначала на три дня, затем на четвёртый. Даты согласуем при оформлении."],
    ["Как хранить питание?", "После получения уберите блюда в холодильник. Перед едой рекомендуем разогреть."],
  ];

  return h("main", { className: "mm-landing mm-landing-v2" },
    h("header", { className: "ml-header" },
      h("a", { className: "ml-brand", href: "#top", "aria-label": "МакроМилл — на главную" }, h("img", { src: `${base}logo.png`, alt: "МакроМилл" })),
      h("nav", { className: "ml-nav", "aria-label": "Главное меню" },
        h("a", { href: "#menu" }, "Рационы"), h("a", { href: "#delivery" }, "Доставка"),
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
              h("button", { type: "button", key: name, className: `ml-goal-option ${selectedGoal === name ? "selected" : ""}`, "aria-pressed": selectedGoal === name, onClick: () => { setGoal(name); setDayIndex(0); } },
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
            h("div", null, h("span", { className: "ml-eyebrow" }, "Пример меню"), h("h3", null, "Что будет в рационе")),
            h("div", { className: "ml-day-controls" },
              h("button", { type: "button", "aria-label": "Предыдущий день", onClick: () => setDayIndex((index) => (index + menu.length - 1) % menu.length) }, "‹"),
              h("span", null, weekdays[dayIndex % weekdays.length]),
              h("button", { type: "button", "aria-label": "Следующий день", onClick: () => setDayIndex((index) => (index + 1) % menu.length) }, "›"))),
          h("p", { className: "ml-example-caption" }, "Пример дня. Состав меняется в зависимости от выбранной линейки и дня программы."),
          h("div", { className: `ml-food-grid ${entries.length === 3 ? "ml-food-grid-three" : ""}` }, entries.map((entry, index) => h(FoodCard, { entry, index, key: `${dayIndex}-${index}` }))),
          h("div", { className: "ml-menu-foot" }, h("span", null, "Итого за день"), h("b", null, `${entries.reduce((sum, entry) => sum + (entry.dish?.base_kcal || 0) * entry.qty, 0)} ккал`))),
        h("div", { className: "ml-order-summary" },
          h("div", { className: "ml-summary-rate" }, h("span", null, "Тариф"), h("b", null, rub(daily), h("small", null, " / день"))),
          discount > 0 && h("div", { className: "ml-summary-discount" }, `Скидка за срок ${Math.round(discount * 100)} %`),
          h("div", { className: "ml-summary-batch" }, h("span", null, "Выбранный срок"), h("b", null, `${duration} ${dayWord(duration)}`)),
          h("p", null, `Питание на весь срок: ${rub(total)}${discountAmount ? `, экономия ${rub(discountAmount)}` : ""}.`),
          h("a", { className: "ml-button ml-button-primary ml-summary-button", href: checkout }, "Оформить заказ →")))),

    h("section", { className: "ml-section ml-delivery", id: "delivery" },
      h("div", { className: "ml-section-heading ml-left-heading" }, h("h2", null, "Доставка и самовывоз")),
      h("div", { className: "ml-delivery-grid" },
        h("article", null, h("h3", null, "Доставка"),
          h("p", null, "Бесплатно доставляем в любой район Севастополя."),
          h("p", null, "Заказы до 14:00 обычно привозим на следующий день, после — через день."),
          h("p", null, "Нам нужно время на приготовление и комплектацию вашего рациона. Точную дату согласуем при оформлении.")),
        h("article", null, h("h3", null, "Самовывоз"),
          h("p", null, "Севастополь, пр. Октябрьской Революции, 61."),
          h("p", null, "Дату и время получения подтвердит менеджер.")))),

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
