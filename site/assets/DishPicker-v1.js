import { a as interop, r as requireReact } from './index-DnVk_jZq-v4.js';
import { affordableDishes, premiumDishes } from './dish-catalog-v1.js';

const React = interop(requireReact(), 1);
const h = React.createElement;
const base = '/macromill-landing-page/';
const categoriesOrder = ['Завтрак', 'Перекус', 'Обед', 'Полдник', 'Ужин', 'Напитки', 'Десерт'];
const labels = { Завтрак: 'Завтраки', Перекус: 'Перекусы', Обед: 'Обеды', Полдник: 'Полдники', Ужин: 'Ужины', Напитки: 'Напитки', Десерт: 'Десерты' };
const rub = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
const plural = (n) => n % 10 === 1 && n % 100 !== 11 ? 'порция' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'порции' : 'порций';
const all = { premium: premiumDishes, affordable: affordableDishes };

function loadCarts() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('mm-dish-carts-v1') || '{}');
    return { premium: saved.premium || {}, affordable: saved.affordable || {} };
  } catch { return { premium: {}, affordable: {} }; }
}

function DishPicker() {
  const [line, setLine] = React.useState(() => new URLSearchParams(location.search).get('dishTier') === 'affordable' ? 'affordable' : 'premium');
  const [category, setCategory] = React.useState('Завтрак');
  const [carts, setCarts] = React.useState(loadCarts);
  const [inView, setInView] = React.useState(false);
  const sectionRef = React.useRef(null);
  const items = all[line];
  const cart = carts[line];
  const categories = categoriesOrder.filter((name) => items.some((dish) => dish.category === name));
  const visible = items.filter((dish) => dish.category === category);
  const selected = items.filter((dish) => Number(cart[dish.id]) > 0).map((dish) => ({ ...dish, qty: Number(cart[dish.id]) }));
  const count = selected.reduce((sum, dish) => sum + dish.qty, 0);
  const total = selected.reduce((sum, dish) => sum + dish.qty * dish.price, 0);
  const kcal = selected.reduce((sum, dish) => sum + dish.qty * dish.kcal, 0);

  React.useEffect(() => {
    try { sessionStorage.setItem('mm-dish-carts-v1', JSON.stringify(carts)); } catch { /* browser storage is optional */ }
  }, [carts]);
  React.useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.04 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    document.documentElement.classList.toggle('mm-dish-visible', inView);
    return () => document.documentElement.classList.remove('mm-dish-visible');
  }, [inView]);

  function changeLine(next) {
    setLine(next);
    setCategory(categoriesOrder.find((name) => all[next].some((dish) => dish.category === name)) || 'Завтрак');
  }
  function setQty(dish, value) {
    setCarts((previous) => {
      const next = { ...(previous[line] || {}) };
      if (value <= 0) delete next[dish.id];
      else next[dish.id] = Math.min(99, value);
      return { ...previous, [line]: next };
    });
  }
  function proceed() {
    if (count < 3) return;
    try {
      sessionStorage.setItem('mm-dish-order-v1', JSON.stringify({ tier: line, items: selected.map(({ id, qty }) => ({ id, qty })) }));
    } catch { return; }
    location.assign(`${base}dish-checkout.html?tier=${line}`);
  }

  return h('section', { id: 'dishes', className: 'mm-dish-section', ref: sectionRef },
    h('div', { className: 'mm-dish-heading' },
      h('div', null, h('span', { className: 'ml-eyebrow' }, 'Соберите свой набор'), h('h2', null, 'Выберите блюда сами'),
        h('p', null, 'Без готовой программы: выбирайте любимые блюда, добавляйте порции и оформляйте разовый заказ.')),
      h('div', { className: 'mm-dish-heading-note' }, h('b', null, 'от 3 порций'), h('span', null, 'в одном заказе'))),
    h('div', { className: 'mm-dish-layout' },
      h('div', { className: 'mm-dish-main' },
        h('div', { className: 'mm-dish-line-switch', role: 'group', 'aria-label': 'Линейка блюд' },
          h('button', { type: 'button', className: line === 'premium' ? 'selected' : '', 'aria-pressed': line === 'premium', onClick: () => changeLine('premium') }, h('b', null, 'Премиум'), h('small', null, 'Привычное меню')),
          h('button', { type: 'button', className: line === 'affordable' ? 'selected' : '', 'aria-pressed': line === 'affordable', onClick: () => changeLine('affordable') }, h('b', null, 'Доступная'), h('small', null, 'Новая линейка'))),
        h('div', { className: 'mm-dish-category-tabs', role: 'group', 'aria-label': 'Приём пищи' }, categories.map((name) => {
          const selectedCount = items.filter((dish) => dish.category === name).reduce((sum, dish) => sum + Number(cart[dish.id] || 0), 0);
          return h('button', { type: 'button', key: name, className: category === name ? 'selected' : '', 'aria-pressed': category === name, onClick: () => setCategory(name) }, labels[name] || name,
            selectedCount > 0 && h('span', { className: 'mm-dish-tab-count' }, selectedCount));
        })),
        h('div', { className: 'mm-dish-grid' }, visible.map((dish) => {
          const qty = Number(cart[dish.id] || 0);
          return h('article', { className: `mm-dish-card ${qty ? 'in-cart' : ''}`, key: dish.id },
            h('div', { className: 'mm-dish-photo' }, dish.image
              ? h('img', { src: `${base}${dish.image.replace(/^\//, '')}`, alt: dish.name, loading: 'lazy' })
              : h('span', null, 'Фото скоро появится'),
              qty > 0 && h('span', { className: 'mm-dish-quantity-badge' }, `× ${qty}`)),
            h('div', { className: 'mm-dish-card-content' },
              h('h3', null, dish.name),
              h('p', { className: 'mm-dish-weight' }, `${dish.weight} г · ${dish.kcal} ккал`),
              h('div', { className: 'mm-dish-macros' }, h('span', null, `Б ${dish.p} г`), h('span', null, `Ж ${dish.f} г`), h('span', null, `У ${dish.c} г`)),
              h('div', { className: 'mm-dish-card-footer' },
                h('div', { className: 'mm-dish-price' }, line === 'affordable' && h('small', null, 'Отдельно'), h('strong', null, rub(dish.price))),
                qty === 0
                  ? h('button', { type: 'button', className: 'mm-dish-add', onClick: () => setQty(dish, 1), 'aria-label': `Добавить ${dish.name}` }, '+ Добавить')
                  : h('div', { className: 'mm-dish-stepper' },
                    h('button', { type: 'button', onClick: () => setQty(dish, qty - 1), 'aria-label': `Убрать порцию ${dish.name}` }, '−'),
                    h('span', { 'aria-live': 'polite' }, qty),
                    h('button', { type: 'button', onClick: () => setQty(dish, qty + 1), 'aria-label': `Добавить порцию ${dish.name}` }, '+')))));
        }))),
      h('aside', { className: 'mm-dish-cart' },
        h('span', { className: 'ml-eyebrow' }, 'Ваш выбор'),
        h('h3', null, 'Набор блюд'),
        h('div', { className: 'mm-dish-progress', 'aria-label': `${Math.min(count, 3)} из 3 порций для минимального заказа` }, [0, 1, 2].map((i) => h('span', { key: i, className: count > i ? 'filled' : '' }))),
        selected.length
          ? h('div', { className: 'mm-dish-selected-list' }, selected.map((dish) => h('div', { key: dish.id }, h('span', null, dish.name, h('small', null, `${dish.qty} × ${rub(dish.price)}`)), h('b', null, rub(dish.qty * dish.price)))))
          : h('p', { className: 'mm-dish-empty' }, 'Добавьте блюда — они появятся здесь.'),
        h('div', { className: 'mm-dish-cart-total' }, h('div', null, h('span', null, `${count} ${plural(count)}`), h('strong', null, rub(total))),
          h('small', null, `${kcal} ккал в выбранных порциях`)),
        h('button', { type: 'button', className: 'mm-dish-checkout', disabled: count < 3, onClick: proceed }, count >= 3 ? 'Перейти к оформлению →' : `Добавьте ещё ${3 - count}`),
        h('p', { className: 'mm-dish-cart-note' }, 'Минимальный заказ — 3 порции. Скидка за срок на отдельные блюда не действует.'))),
    inView && h('div', { className: 'mm-dish-mobile-dock' },
      h('div', null, h('small', null, `${count} ${plural(count)}`), h('b', null, rub(total))),
      h('button', { type: 'button', disabled: count < 3, onClick: proceed }, count >= 3 ? 'Оформить →' : `Ещё ${3 - count}`)));
}

export default DishPicker;
