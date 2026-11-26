const clean = value => (typeof value === 'string' ? value.trim() : '');

export function summarizeAdminData({ products = [], messages = [], subscribers = [] } = {}) {
  const variants = products.flatMap(product => Array.isArray(product.product_variants) ? product.product_variants : []);
  const stock = variants.map(variant => Math.max(0, Number(variant.stock_quantity) || 0));
  return {
    totalProducts: products.length,
    activeProducts: products.filter(product => product.is_active === true).length,
    draftProducts: products.filter(product => product.is_active !== true).length,
    totalVariants: variants.length,
    totalUnits: stock.reduce((sum, quantity) => sum + quantity, 0),
    lowStockVariants: stock.filter(quantity => quantity > 0 && quantity <= 5).length,
    demoProducts: products.filter(product => /\bDEMO\b/i.test(clean(product.badge))).length,
    outOfStockVariants: stock.filter(quantity => quantity === 0).length,
    messageCount: messages.length,
    subscriberCount: subscribers.length,
  };
}

function toImageUrls(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/);
  const urls = [...new Set(values.map(item => clean(item)).filter(Boolean))];
  for (const url of urls) {
    if (url.startsWith('/')) continue;
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Each image URL must be a valid HTTPS or local path.'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Image URL must use HTTPS or a local path.');
  }
  if (urls.length > 8) throw new Error('A product can have at most 8 gallery images.');
  return urls;
}

export function normalizeProductDraft(input = {}) {
  const name = clean(input.name);
  if (name.length < 2 || name.length > 120) throw new Error('Product name must contain 2 to 120 characters.');
  const slugInput = clean(input.slug).toLowerCase();
  const slug = (slugInput || name.toLowerCase())
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  if (!slug) throw new Error('A valid product slug is required.');
  const audience = clean(input.audience).toLowerCase();
  if (!['men', 'women', 'kids', 'unisex'].includes(audience)) throw new Error('Choose a valid product audience.');
  const category = clean(input.category);
  if (!category || category.length > 60) throw new Error('Product category is required and must be 60 characters or fewer.');
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 10000000) throw new Error('Enter a valid BDT price between 0 and 10,000,000.');
  const sizesSource = Array.isArray(input.sizes) ? input.sizes : String(input.sizes ?? '').split(',');
  const sizes = [...new Set(sizesSource.map(item => clean(String(item))).filter(Boolean))];
  if (sizes.some(size => size.length > 12 || !/^[A-Za-z0-9][A-Za-z0-9 .-]*$/.test(size))) throw new Error('Check the size list; use simple size labels separated by commas.');
  if (sizes.length > 40) throw new Error('A product can have at most 40 size variants.');
  return {
    name,
    slug,
    audience,
    category,
    price,
    currency: 'BDT',
    description: clean(input.description).slice(0, 3000),
    colorway: clean(input.colorway).slice(0, 120),
    badge: clean(input.badge).slice(0, 40),
    imageUrls: toImageUrls(input.imageUrls),
    sizes,
    is_active: Boolean(input.is_active),
    is_featured: Boolean(input.is_featured),
  };
}

export function parseStockQuantity(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error('Stock must be a whole number from 0 to 100,000.');
  const quantity = Number(text);
  if (!Number.isSafeInteger(quantity) || quantity > 100000) throw new Error('Stock must be a whole number from 0 to 100,000.');
  return quantity;
}
