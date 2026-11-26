const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseError(payload, fallback) {
  const error = new Error(payload?.message || fallback);
  error.code = payload?.code || 'STORE_API_ERROR';
  return error;
}

function safeImageUrl(value) {
  const url = clean(value);
  if (!url) return '';
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? url : '';
  } catch {
    return '';
  }
}

export function normalizeProduct(row) {
  const images = [...(Array.isArray(row.product_images) ? row.product_images : [])]
    .filter(image => safeImageUrl(image.image_url))
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map(image => ({
      id: image.id,
      url: safeImageUrl(image.image_url),
      alt: clean(image.alt_text) || `${row.name} shoe`,
      position: Number(image.position || 0),
    }));

  const variants = [...(Array.isArray(row.product_variants) ? row.product_variants : [])]
    .sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }))
    .map(variant => ({
      id: variant.id,
      size: String(variant.size),
      sku: variant.sku || null,
      stock: Math.max(0, Number(variant.stock_quantity || 0)),
      available: Boolean(variant.is_available) && Number(variant.stock_quantity || 0) > 0,
    }));

  return {
    id: String(row.id),
    slug: row.slug,
    n: clean(row.name),
    t: clean(row.category) || 'Shoes',
    audience: ['men', 'women', 'kids', 'unisex'].includes(clean(row.audience).toLowerCase()) ? clean(row.audience).toLowerCase() : 'unisex',
    p: Number(row.price || 0),
    currency: /^[A-Z]{3}$/.test(clean(row.currency).toUpperCase()) ? clean(row.currency).toUpperCase() : 'BDT',
    c: clean(row.colorway),
    tag: clean(row.badge),
    d: clean(row.description),
    i: images[0]?.url || '',
    images,
    variants,
    featured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || null,
  };
}

export function filterProducts(products, { audience = 'All', category = 'All', search = '' } = {}) {
  const audienceFilter = clean(audience).toLowerCase();
  const categoryFilter = clean(category).toLowerCase();
  const searchFilter = clean(search).toLowerCase();

  return products.filter(product => {
    const productAudience = clean(product.audience).toLowerCase() || 'unisex';
    const audienceMatches =
      !audienceFilter || audienceFilter === 'all' ||
      productAudience === 'unisex' || productAudience === audienceFilter;
    const categoryMatches =
      !categoryFilter || categoryFilter === 'all' ||
      clean(product.t).toLowerCase() === categoryFilter;
    const searchMatches =
      !searchFilter ||
      [product.n, product.t, product.c, product.tag].some(value =>
        clean(value).toLowerCase().includes(searchFilter)
      );
    return audienceMatches && categoryMatches && searchMatches;
  });
}

export function createStoreApi({
  supabaseUrl = '',
  publishableKey = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const baseUrl = clean(supabaseUrl).replace(/\/$/, '');
  const key = clean(publishableKey);
  const configured = Boolean(baseUrl && key);

  async function request(table, { method = 'GET', query = '', body } = {}) {
    if (!configured) throw new Error('The Paris Shoes catalogue service is not configured.');
    if (typeof fetchImpl !== 'function') throw new Error('This browser does not support secure network requests.');

    const response = await fetchImpl(`${baseUrl}/rest/v1/${table}${query}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(body ? { Prefer: 'return=minimal' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      let payload = {};
      try { payload = await response.json(); } catch { /* keep a safe generic error */ }
      const error = parseError(payload, `The request could not be completed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    try { return await response.json(); } catch { return null; }
  }

  return {
    configured,

    async getProducts() {
      const query = `?select=id,slug,name,description,category,audience,price,currency,colorway,badge,is_featured,sort_order,created_at,product_images(id,image_url,alt_text,position),product_variants(id,size,sku,stock_quantity,is_available)&is_active=eq.true&order=is_featured.desc,sort_order.asc,created_at.desc&limit=200`;
      const rows = await request('products', { query });
      if (!Array.isArray(rows)) throw new Error('The catalogue returned an unexpected response.');
      return rows.map(normalizeProduct);
    },

    async subscribeNewsletter(email) {
      const normalizedEmail = clean(email).toLowerCase();
      if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
        throw new Error('Please enter a valid email address.');
      }
      try {
        await request('newsletter_subscribers', {
          method: 'POST',
          body: { email: normalizedEmail },
        });
        return { alreadySubscribed: false };
      } catch (error) {
        if (error.status === 409 || error.code === '23505') return { alreadySubscribed: true };
        throw error;
      }
    },

    async placeOrder(input = {}, options = {}) {
      const customerInput = input.customer || {};
      const customer = {
        name: clean(customerInput.name),
        email: clean(customerInput.email).toLowerCase(),
        phone: clean(customerInput.phone).replace(/[\\s-]/g, ''),
        address: clean(customerInput.address),
        district: clean(customerInput.district),
        city: clean(customerInput.city),
        postal_code: clean(customerInput.postal_code),
        notes: clean(customerInput.notes),
      };
      if (customer.name.length < 2 || customer.name.length > 120 ||
          !EMAIL_PATTERN.test(customer.email) || customer.email.length > 254) {
        throw new Error('Please enter a valid name and email address.');
      }
      if (!/^(?:\\+?88)?01[3-9]\\d{8}$/.test(customer.phone)) {
        throw new Error('Please enter a valid Bangladesh mobile number.');
      }
      if (customer.address.length < 8 || customer.address.length > 500 ||
          customer.district.length < 2 || customer.district.length > 100 ||
          customer.city.length < 2 || customer.city.length > 100 ||
          customer.postal_code.length > 20 || customer.notes.length > 1000) {
        throw new Error('Please check your delivery address and optional notes.');
      }
      if (input.payment_method !== 'cod') {
        throw new Error('Cash on Delivery is the only available payment method right now.');
      }
      if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
        throw new Error('Your order must contain between 1 and 20 items.');
      }
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const items = input.items.map(item => {
        const quantity = Number(item.quantity);
        if (!uuidPattern.test(String(item.product_id || '')) ||
            !uuidPattern.test(String(item.variant_id || '')) ||
            !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
          throw new Error('Each item must have a valid product, size and quantity between 1 and 5.');
        }
        return { product_id: item.product_id, variant_id: item.variant_id, quantity };
      });
      const idempotencyKey = clean(options.idempotencyKey);
      const accessToken = clean(options.accessToken);
      if (!uuidPattern.test(idempotencyKey) || !uuidPattern.test(accessToken)) {
        throw new Error('Secure checkout could not be initialized. Please refresh and try again.');
      }
      const payload = { customer, items, payment_method: 'cod' };
      const result = await request('rpc/place_order', {
        method: 'POST',
        body: {
          p_payload: payload,
          p_idempotency_key: idempotencyKey,
          p_access_token: accessToken,
        },
      });
      if (!result || typeof result.order_number !== 'string') {
        throw new Error('The order response was incomplete. Please contact Paris Shoes before retrying.');
      }
      return result;
    },

    async sendContactMessage(input = {}) {
      const name = clean(input.name);
      const email = clean(input.email).toLowerCase();
      const subject = clean(input.subject);
      const message = clean(input.message);
      if (name.length < 2 || name.length > 120 || !EMAIL_PATTERN.test(email) || email.length > 254) {
        throw new Error('Please enter a valid name and email address.');
      }
      if (subject.length > 180 || message.length < 3 || message.length > 5000) {
        throw new Error('Please check your subject and message, then try again.');
      }
      await request('contact_messages', {
        method: 'POST',
        body: { name, email, subject, message },
      });
      return { sent: true };
    },
  };
}
