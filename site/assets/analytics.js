(() => {
  const EVENT_URL = '/functions/v1/landing-event';
  const VISITOR_KEY = 'mm-visitor-id';
  const SESSION_KEY = 'mm-session-id';
  const ONCE_PREFIX = 'mm-event:';
  const ORDER_TYPE_KEY = 'mm-order-type';
  const uuid = () => crypto.randomUUID();

  function stored(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = uuid();
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return uuid();
    }
  }

  const visitorId = stored(localStorage, VISITOR_KEY);
  const sessionId = stored(sessionStorage, SESSION_KEY);
  const params = new URLSearchParams(location.search);
  const context = {
    referrer: document.referrer,
    source: params.get('utm_source') || (document.referrer ? 'referral' : 'direct'),
    params: {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
    },
    device_type: matchMedia('(max-width: 640px)').matches ? 'mobile' : matchMedia('(max-width: 1024px)').matches ? 'tablet' : 'desktop',
  };

  function safeConfiguration() {
    const value = {};
    let selectedType = '';
    try {
      selectedType = sessionStorage.getItem(ORDER_TYPE_KEY) || '';
    } catch {}
    try {
      const draft = JSON.parse(sessionStorage.getItem('mm-order-draft') || '{}');
      if (draft.tier) value.order_type = 'ration';
      if (draft.tier) value.tier = draft.tier;
      if (draft.goal) value.goal = draft.goal;
      if (draft.days) value.days = Number(draft.days);
      if (Array.isArray(draft.menuDays)) value.items_count = draft.menuDays.length;
    } catch {}
    try {
      const carts = JSON.parse(sessionStorage.getItem('mm-dish-carts-v1') || '{}');
      const all = Object.values(carts).flatMap((cart) => Object.values(cart || {}));
      const count = all.reduce((sum, qty) => sum + Number(qty || 0), 0);
      if (count > 0) {
        value.order_type = 'custom_dishes';
        value.items_count = count;
      }
    } catch {}
    if (selectedType === 'ration' || selectedType === 'custom_dishes') value.order_type = selectedType;
    return value;
  }

  function track(eventName, configuration = safeConfiguration()) {
    const payload = {
      event_id: uuid(),
      session_id: sessionId,
      visitor_id: visitorId,
      event_name: eventName,
      path: location.pathname,
      configuration,
      context,
    };
    return fetch(EVENT_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => null);
  }

  function once(eventName, configuration) {
    const key = `${ONCE_PREFIX}${eventName}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}
    track(eventName, configuration);
  }

  window.mmAnalytics = { track, once, sessionId, visitorId, safeConfiguration };
  function selectOrderType(orderType) {
    if (!['ration', 'custom_dishes'].includes(orderType)) return;
    let previous = '';
    try {
      previous = sessionStorage.getItem(ORDER_TYPE_KEY) || '';
      sessionStorage.setItem(ORDER_TYPE_KEY, orderType);
    } catch {}
    if (previous !== orderType) track('order_type_selected', { ...safeConfiguration(), order_type: orderType });
  }

  track('landing_view');
  if (/\/dish-checkout\.html$/.test(location.pathname)) selectOrderType('custom_dishes');
  else if (/\/checkout\.html$/.test(location.pathname)) selectOrderType('ration');

  const isCheckout = /\/(dish-)?checkout\.html$/.test(location.pathname);
  if (isCheckout) {
    once('checkout_viewed');
    document.addEventListener('input', (event) => {
      if (event.target?.matches?.('#customer-name, #customer-phone')) once('contact_started');
    }, true);
    document.addEventListener('submit', (event) => {
      if (event.target?.matches?.('#checkout-form')) track('submit_attempted');
    }, true);
  } else {
    document.addEventListener('click', (event) => {
      const target = event.target?.closest?.('a, button');
      if (!target) return;
      const href = target.getAttribute('href') || '';
      const inRationBuilder = Boolean(target.closest('.ml-order-builder'));
      const inDishBuilder = Boolean(target.closest('.mm-dish-section'));
      if (href === '#menu' || href.endsWith('#menu') || inRationBuilder) selectOrderType('ration');
      if (href === '#dishes' || href.endsWith('#dishes') || inDishBuilder) selectOrderType('custom_dishes');
      if (/checkout\.html/.test(href) || target.matches('.mm-dish-checkout')) {
        track('checkout_clicked');
      }
      if (target.closest('.ml-order-builder') || target.matches('.mm-dish-add, .mm-dish-checkout') || target.closest('.mm-dish-line-switch, .mm-dish-category-tabs')) {
        const orderType = inDishBuilder ? 'custom_dishes' : 'ration';
        once('builder_started', { ...safeConfiguration(), order_type: orderType });
      }
    }, true);
  }

  let lastConfiguration = '';
  setInterval(() => {
    let started = false;
    try { started = sessionStorage.getItem(`${ONCE_PREFIX}builder_started`) === '1'; } catch {}
    if (!started) return;
    const configuration = safeConfiguration();
    if (!configuration.order_type) return;
    if (configuration.order_type === 'custom_dishes' && Number(configuration.items_count || 0) < 3) return;
    const signature = JSON.stringify(configuration);
    if (signature && signature !== lastConfiguration) {
      lastConfiguration = signature;
      track('ration_configured', configuration);
    }
  }, 1500);
})();
