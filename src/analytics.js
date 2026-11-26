const META_EVENTS = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
};

const ALLOWED_FIELDS = new Set(['currency', 'value', 'transaction_id', 'page_path', 'page_title']);

function safeEventPayload(payload = {}) {
  const safe = {};
  for (const key of ALLOWED_FIELDS) {
    const value = payload[key];
    if (typeof value === 'string' && value.length <= 160) safe[key] = value;
    else if (key === 'value' && Number.isFinite(Number(value)) && value !== undefined) safe[key] = Number(value);
  }
  if (Array.isArray(payload.items)) {
    safe.items = payload.items.slice(0, 20).map(item => ({
      ...(item.item_id != null ? { item_id: String(item.item_id).slice(0, 120) } : {}),
      ...(item.item_name ? { item_name: String(item.item_name).slice(0, 160) } : {}),
      ...(item.item_category ? { item_category: String(item.item_category).slice(0, 100) } : {}),
      ...(item.item_variant ? { item_variant: String(item.item_variant).slice(0, 80) } : {}),
      ...(Number.isFinite(Number(item.price)) && item.price !== undefined ? { price: Number(item.price) } : {}),
      ...(Number.isInteger(Number(item.quantity)) && item.quantity !== undefined ? { quantity: Number(item.quantity) } : {}),
    }));
  }
  return safe;
}

export function createAnalytics({ gtag, fbq } = {}) {
  return {
    track(eventName, payload = {}) {
      const metaEvent = META_EVENTS[eventName];
      if (!metaEvent) return false;
      const safe = safeEventPayload(payload);
      if (typeof gtag === 'function') gtag('event', eventName, safe);
      if (typeof fbq === 'function') {
        if (eventName === 'page_view') fbq('track', metaEvent);
        else {
          const contents = (safe.items || []).map(item => ({
            id: item.item_id,
            quantity: item.quantity || 1,
            item_price: item.price,
          }));
          const metaPayload = {
            ...(safe.currency ? { currency: safe.currency } : {}),
            ...(safe.value !== undefined ? { value: safe.value } : {}),
            ...(contents.length ? { content_ids: contents.map(item => item.id).filter(Boolean), contents, content_type: 'product' } : {}),
          };
          fbq('track', metaEvent, metaPayload);
        }
      }
      return true;
    },
  };
}

function loadScript(documentRef, id, src) {
  if (documentRef.getElementById(id)) return;
  const script = documentRef.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  documentRef.head.appendChild(script);
}

export function initializeAnalytics({ ga4Id = '', metaPixelId = '', windowRef = globalThis.window, documentRef = globalThis.document } = {}) {
  if (!windowRef || !documentRef) return createAnalytics();
  const validGa4Id = /^G-[A-Z0-9]+$/i.test(String(ga4Id));
  const validMetaPixelId = /^\d{5,20}$/.test(String(metaPixelId));

  if (validGa4Id) {
    windowRef.dataLayer = windowRef.dataLayer || [];
    windowRef.gtag = windowRef.gtag || function gtag(){ windowRef.dataLayer.push(arguments); };
    loadScript(documentRef, 'paris-ga4-script', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
    windowRef.gtag('js', new Date());
    windowRef.gtag('config', ga4Id, { send_page_view: false, anonymize_ip: true });
  }

  if (validMetaPixelId) {
    if (typeof windowRef.fbq !== 'function') {
      const fbq = function fbq(){ fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      windowRef.fbq = fbq;
    }
    loadScript(documentRef, 'paris-meta-pixel-script', 'https://connect.facebook.net/en_US/fbevents.js');
    windowRef.fbq('init', metaPixelId);
  }

  return createAnalytics({ gtag: validGa4Id ? windowRef.gtag : null, fbq: validMetaPixelId ? windowRef.fbq : null });
}
