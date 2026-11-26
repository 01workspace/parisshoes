import './admin.css';
import { summarizeAdminData, normalizeProductDraft, parseStockQuantity } from './admin-logic.js';

const root = document.querySelector('#admin-root');
if (!root) throw new Error('The Paris Shoes admin root element is missing.');
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
const money = value => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(Number(value) || 0);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const time = value => value ? new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

let accessToken = '';
let owner = null;
let view = 'overview';
let data = { products: [], messages: [], subscribers: [], orders: [], messageTotal: 0, subscriberTotal: 0 };
let loading = false;
let editingId = '';
let noticeText = '';
let noticeTimer = null;

function notify(message, error = false) {
  noticeText = message;
  const el = root.querySelector('.ad-notice');
  if (el) {
    el.textContent = message;
    el.classList.toggle('is-error', error);
    el.classList.add('is-visible');
  }
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    const current = root.querySelector('.ad-notice');
    if (current) current.classList.remove('is-visible');
  }, 3200);
}

async function rawFetch(path, options = {}, authToken = accessToken) {
  if (!supabaseUrl || !publishableKey) throw new Error('The Paris Shoes backend is not configured.');
  const headers = { apikey: publishableKey, Authorization: 'Bearer ' + (authToken || publishableKey), Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(supabaseUrl + path, { ...options, headers });
  if (!response.ok) {
    let payload = {};
    try { payload = await response.json(); } catch {}
    const error = new Error(payload.message || payload.msg || ('Request failed (' + response.status + ').'));
    error.status = response.status;
    throw error;
  }
  return response;
}

async function api(path, options = {}) {
  const response = await rawFetch('/rest/v1/' + path, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { body, count: Number((response.headers.get('content-range') || '').split('/').pop()) || (Array.isArray(body) ? body.length : 0) };
}

async function signIn(email, password) {
  const response = await rawFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }) }, '');
  const session = await response.json();
  if (!session.access_token || !session.user) throw new Error('Sign-in did not return a valid session.');
  accessToken = session.access_token;
  try {
    const result = await api('rpc/admin_check', { method: 'POST', body: '{}' });
    if (result.body !== true) throw new Error('This account is not authorised for the Paris Shoes admin dashboard.');
  } catch (error) {
    accessToken = '';
    try { await rawFetch('/auth/v1/logout', { method: 'POST' }, session.access_token); } catch {}
    throw error;
  }
  owner = session.user;
  await loadData();
}

async function signOut() {
  const token = accessToken;
  accessToken = '';
  owner = null;
  data = { products: [], messages: [], subscribers: [], orders: [], messageTotal: 0, subscriberTotal: 0 };
  try { if (token) await rawFetch('/auth/v1/logout', { method: 'POST' }, token); } catch {}
  render();
}

async function loadData() {
  loading = true;
  render();
  try {
    const requests = await Promise.all([
      api('products?select=id,slug,name,description,category,audience,price,currency,colorway,badge,is_active,is_featured,sort_order,created_at,updated_at,product_images(id,image_url,alt_text,position),product_variants(id,size,sku,stock_quantity,is_available,updated_at)&order=updated_at.desc', { headers: { Range: '0-999', Prefer: 'count=exact' } }),
      api('contact_messages?select=id,name,email,subject,message,created_at&order=created_at.desc', { headers: { Range: '0-499', Prefer: 'count=exact' } }),
      api('newsletter_subscribers?select=id,email,created_at&order=created_at.desc', { headers: { Range: '0-999', Prefer: 'count=exact' } }),
      api('orders?select=id,order_number,customer_name,customer_email,customer_phone,shipping_address,shipping_district,shipping_city,shipping_postal_code,customer_note,subtotal,shipping_fee,total,payment_method,payment_status,order_status,created_at,order_items(id,product_name,size,sku,unit_price,quantity,line_total)&order=created_at.desc', { headers: { Range: '0-499', Prefer: 'count=exact' } }),
    ]);
    data = {
      products: Array.isArray(requests[0].body) ? requests[0].body : [],
      messages: Array.isArray(requests[1].body) ? requests[1].body : [],
      subscribers: Array.isArray(requests[2].body) ? requests[2].body : [],
      orders: Array.isArray(requests[3].body) ? requests[3].body : [],
      messageTotal: requests[1].count,
      subscriberTotal: requests[2].count,
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      accessToken = '';
      owner = null;
      render();
      notify('Your session expired or no longer has admin access. Please sign in again.', true);
    } else notify(error.message || 'Could not load dashboard data.', true);
  } finally {
    loading = false;
    render();
  }
}

function navItem(id, label, symbol) {
  return '<button type="button" class="ad-nav-item ' + (view === id ? 'is-active' : '') + '" data-view="' + id + '"><span>' + symbol + '</span>' + label + (id === 'messages' && data.messageTotal ? '<small>' + data.messageTotal + '</small>' : '') + '</button>';
}

function loginPage() {
  return '<main class="ad-login-wrap"><section class="ad-login-card"><a href="/" class="ad-logo"><img src="/resources/paris-shoes-logo.png" alt="Paris Shoes"></a><span class="ad-eyebrow">PRIVATE STORE MANAGEMENT</span><h1>Welcome back.</h1><p class="ad-muted">Sign in with the owner account authorised for Paris Shoes. There is no public registration.</p><form id="ad-login-form" class="ad-form"><label>Email address<input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="owner@example.com"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256" placeholder="Your password"></label><button class="ad-button ad-button-dark" type="submit">Sign in to dashboard <span>↗</span></button><p class="ad-form-status" aria-live="polite"></p></form><a class="ad-back-link" href="/">← Back to storefront</a></section><p class="ad-login-foot">PARIS SHOES · OWNER ACCESS ONLY</p></main>';
}

function shell(content) {
  return '<div class="ad-shell"><aside class="ad-sidebar"><a href="/" class="ad-brand"><img src="/resources/paris-shoes-logo.png" alt="Paris Shoes"><span>STORE MANAGEMENT</span></a><div class="ad-side-label">WORKSPACE</div><nav>' +
    navItem('overview', 'Overview', '⌂') + navItem('products', 'Products', '◇') + navItem('inventory', 'Inventory', '▦') + navItem('messages', 'Customer messages', '✉') + navItem('subscribers', 'Newsletter', '↗') +
    '<div class="ad-side-label ad-side-spaced">COMMERCE</div>' + navItem('orders', 'Orders', '□') +
    '</nav><div class="ad-sidebar-bottom"><span class="ad-live-dot"></span><span>Connected to Paris Shoes data</span><a href="/" target="_blank" rel="noreferrer">View storefront ↗</a></div></aside><main class="ad-main"><header class="ad-topbar"><div><span class="ad-mobile-kicker">PARIS SHOES</span><span class="ad-breadcrumb">Workspace <b>/</b> ' + esc(view[0].toUpperCase() + view.slice(1)) + '</span></div><div class="ad-user"><span class="ad-user-avatar">' + esc((owner.email || 'P').slice(0, 1).toUpperCase()) + '</span><span>' + esc(owner.email || 'Owner') + '</span><button type="button" id="ad-signout">Sign out</button></div></header><section class="ad-content">' + content + '</section><footer class="ad-footnote"><span>PARIS SHOES · OWNER DASHBOARD</span><span>Store data · BDT · Bangladesh</span></footer></main><div class="ad-notice" role="status" aria-live="polite"></div></div>';
}

function pageHeading(eyebrow, title, description, action = '') {
  return '<div class="ad-page-heading"><div><span class="ad-eyebrow">' + eyebrow + '</span><h1>' + title + '</h1><p>' + description + '</p></div>' + action + '</div>';
}

function overviewPage() {
  const s = summarizeAdminData({ products: data.products, messages: data.messages, subscribers: data.subscribers });
  const cards = [
    ['PRODUCTS', s.totalProducts, s.activeProducts + ' published · ' + s.draftProducts + ' drafts', '◇'],
    ['STOCK UNITS', s.totalUnits.toLocaleString('en-BD'), s.totalVariants + ' size variants', '▦'],
    ['LOW STOCK', s.lowStockVariants, s.outOfStockVariants + ' sizes out of stock', '△'],
    ['CUSTOMER MESSAGES', data.messageTotal, 'Saved contact enquiries', '✉'],
    ['NEWSLETTER', data.subscriberTotal, 'Subscriber records', '↗'],
  ];
  const audience = ['men', 'women', 'kids', 'unisex'].map(name => {
    const count = data.products.filter(p => p.audience === name).length;
    return '<div class="ad-audience-row"><span>' + name[0].toUpperCase() + name.slice(1) + '</span><div class="ad-bar"><i style="width:' + (s.totalProducts ? (count / s.totalProducts * 100) : 0) + '%"></i></div><b>' + count + '</b></div>';
  }).join('');
  const attention = data.products.flatMap(p => (p.product_variants || []).filter(v => Number(v.stock_quantity) <= 5).map(v => ({ product: p, variant: v }))).slice(0, 6);
  const attentionRows = attention.length ? attention.map(item => '<tr><td><b>' + esc(item.product.name) + '</b><small>' + esc(item.product.audience) + ' · ' + esc(item.product.category) + '</small></td><td>' + esc(item.variant.size) + '</td><td><span class="ad-pill ' + (Number(item.variant.stock_quantity) === 0 ? 'is-danger' : 'is-warn') + '">' + item.variant.stock_quantity + ' left</span></td></tr>').join('') : '<tr><td colspan="3" class="ad-empty-row">No low-stock variants in the current catalogue.</td></tr>';
  const latest = data.messages.slice(0, 4).map(m => '<div class="ad-message-row"><span class="ad-message-avatar">' + esc((m.name || 'C').slice(0, 1).toUpperCase()) + '</span><div><b>' + esc(m.name) + '</b><small>' + esc(m.subject || 'Customer enquiry') + '</small></div><time>' + esc(time(m.created_at)) + '</time></div>').join('') || '<p class="ad-empty">No customer messages have been received yet.</p>';
  return pageHeading('STORE SNAPSHOT', 'Good to see you.', 'A clear view of your product catalogue, inventory and customer communication.') +
    (s.demoProducts ? '<div class="ad-demo-alert"><b>DEMO CATALOGUE</b><span>' + s.demoProducts + ' products are marked as demo data. Replace sample product details and verify warehouse stock before accepting real sales.</span></div>' : '') +
    '<div class="ad-stat-grid">' + cards.map(c => '<article class="ad-stat-card"><div class="ad-stat-top"><span>' + c[0] + '</span><i>' + c[3] + '</i></div><strong>' + c[1] + '</strong><small>' + c[2] + '</small></article>').join('') + '</div>' +
    '<div class="ad-overview-grid"><section class="ad-panel"><div class="ad-panel-heading"><div><span class="ad-eyebrow">ATTENTION REQUIRED</span><h2>Restock watch</h2></div><button class="ad-text-button" data-view="inventory">Manage inventory ↗</button></div><div class="ad-table-wrap"><table><thead><tr><th>PRODUCT</th><th>SIZE</th><th>AVAILABLE</th></tr></thead><tbody>' + attentionRows + '</tbody></table></div></section>' +
    '<section class="ad-panel"><div class="ad-panel-heading"><div><span class="ad-eyebrow">COLLECTION MIX</span><h2>Products by audience</h2></div></div><div class="ad-audience-list">' + audience + '</div><p class="ad-panel-note">Counts reflect all products visible to the authorised owner account.</p></section>' +
    '<section class="ad-panel ad-panel-wide"><div class="ad-panel-heading"><div><span class="ad-eyebrow">CUSTOMER CARE</span><h2>Recent enquiries</h2></div><button class="ad-text-button" data-view="messages">View messages ↗</button></div><div class="ad-message-list">' + latest + '</div></section></div>' +
    '<div class="ad-commerce-note"><span>ORDERS & REVENUE ARE NOT CONNECTED</span><p>Checkout is still a demonstration flow. This dashboard does not report sales, paid orders or revenue until a real order and payment workflow is implemented.</p></div>';
}

function productRows() {
  if (!data.products.length) return '<tr><td colspan="6" class="ad-empty-row">No products found.</td></tr>';
  return data.products.map(p => {
    const image = (p.product_images || []).slice().sort((a, b) => a.position - b.position)[0]?.image_url || '';
    const variants = p.product_variants || [];
    const units = variants.reduce((sum, v) => sum + Number(v.stock_quantity || 0), 0);
    return '<tr><td><div class="ad-product-cell">' + (image ? '<img src="' + esc(image) + '" alt="">' : '<span class="ad-image-placeholder">PS</span>') + '<div><b>' + esc(p.name) + '</b><small>' + esc(p.slug) + '</small></div></div></td><td>' + esc(p.audience) + '<small>' + esc(p.category) + '</small></td><td><b>' + money(p.price) + '</b></td><td>' + variants.length + ' sizes<small>' + units + ' units</small></td><td><span class="ad-pill ' + (p.is_active ? 'is-live' : 'is-muted') + '">' + (p.is_active ? 'Published' : 'Draft') + '</span>' + (/\bDEMO\b/i.test(p.badge || '') ? '<small>Demo data</small>' : '') + '</td><td><button class="ad-row-action" data-edit="' + esc(p.id) + '">Edit ↗</button></td></tr>';
  }).join('');
}

function productsPage() {
  return pageHeading('CATALOGUE MANAGEMENT', 'Your products.', 'Create and maintain product details, images, audience, publishing status and size options.', '<button class="ad-button ad-button-dark" type="button" data-new-product>＋ Add product</button>') +
    '<div class="ad-panel"><div class="ad-toolbar"><input id="ad-product-search" type="search" placeholder="Search product name, category or slug"><select id="ad-product-status"><option value="all">All products</option><option value="live">Published</option><option value="draft">Drafts</option></select></div><div class="ad-table-wrap"><table><thead><tr><th>PRODUCT</th><th>AUDIENCE</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th></th></tr></thead><tbody id="ad-product-rows">' + productRows() + '</tbody></table></div></div>' +
    '<p class="ad-data-note">Product gallery supports up to 8 images. Newly added size variants start at 0 stock; update actual warehouse quantities in Inventory.</p>' + (data.products.some(p => /\bDEMO\b/i.test(p.badge || '')) ? '<div class="ad-demo-alert"><b>DEMO DATA</b><span>Seeded product information, prices, images and stock are examples. Please verify each field before publication.</span></div>' : '');
}

function editorPage(p = {}) {
  editingId = p.id || '';
  const images = (p.product_images || []).slice().sort((a, b) => a.position - b.position).map(i => i.image_url).join('\n');
  const sizes = (p.product_variants || []).map(v => v.size).join(', ');
  return '<div class="ad-editor-backdrop"><form id="ad-product-form" class="ad-editor"><div class="ad-editor-head"><div><span class="ad-eyebrow">' + (editingId ? 'EDIT PRODUCT' : 'NEW PRODUCT') + '</span><h2>' + (editingId ? 'Product details.' : 'Create a product.') + '</h2></div><button class="ad-close" type="button" data-close-editor aria-label="Close">×</button></div>' +
    '<div class="ad-form-grid"><label class="ad-span-two">Product name<input name="name" required maxlength="120" value="' + esc(p.name || '') + '"></label>' +
    '<label>Audience<select name="audience" required>' + ['men','women','kids','unisex'].map(x => '<option value="' + x + '"' + ((p.audience || 'unisex') === x ? ' selected' : '') + '>' + x[0].toUpperCase() + x.slice(1) + '</option>').join('') + '</select></label>' +
    '<label>Category<input name="category" required maxlength="60" value="' + esc(p.category || 'Sneakers') + '"></label>' +
    '<label>Price (BDT)<input name="price" type="number" min="0" max="10000000" step="1" required value="' + esc(p.price ?? '') + '"></label>' +
    '<label>Colourway<input name="colorway" maxlength="120" value="' + esc(p.colorway || '') + '"></label>' +
    '<label class="ad-span-two">Description<textarea name="description" rows="3" maxlength="3000">' + esc(p.description || '') + '</textarea></label>' +
    '<label>Badge / label<input name="badge" maxlength="40" value="' + esc(p.badge || '') + '" placeholder="NEW, DEMO, BESTSELLER"></label>' +
    '<label>Size options<input name="sizes" value="' + esc(sizes) + '" placeholder="38, 39, 40, 41"></label>' +
    '<label class="ad-span-two">Image URLs <small>One URL per line. Existing gallery URLs are prefilled.</small><textarea name="imageUrls" rows="3" placeholder="https://...">' + esc(images) + '</textarea></label>' +
    '<label class="ad-span-two">Upload product images<input name="files" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple><small>JPEG, PNG, WebP or AVIF · max 8 MB each · up to 8 images total.</small></label>' +
    '<label class="ad-check"><input type="checkbox" name="is_active" ' + (p.is_active ? 'checked' : '') + '> Publish on storefront</label><label class="ad-check"><input type="checkbox" name="is_featured" ' + (p.is_featured ? 'checked' : '') + '> Feature on homepage</label></div>' +
    '<div class="ad-editor-actions"><button class="ad-button ad-button-light" type="button" data-close-editor>Cancel</button><button class="ad-button ad-button-dark" type="submit">' + (editingId ? 'Save changes' : 'Create draft') + ' ↗</button></div><p class="ad-form-status" aria-live="polite"></p></form></div>';
}

function inventoryPage() {
  const rows = data.products.flatMap(p => (p.product_variants || []).map(v => ({ p, v }))).sort((a, b) => Number(a.v.stock_quantity) - Number(b.v.stock_quantity));
  return pageHeading('STOCK CONTROL', 'Inventory.', 'Review quantity by product size. Set the exact available units for each variant; zero marks a size as unavailable.') +
    '<div class="ad-inventory-summary"><span><b>' + rows.reduce((n, r) => n + Number(r.v.stock_quantity || 0), 0).toLocaleString('en-BD') + '</b> total units</span><span><b>' + rows.filter(r => Number(r.v.stock_quantity) > 0 && Number(r.v.stock_quantity) <= 5).length + '</b> low stock (1–5)</span><span><b>' + rows.filter(r => Number(r.v.stock_quantity) === 0).length + '</b> out of stock</span></div>' +
    '<div class="ad-panel"><div class="ad-toolbar"><input id="ad-stock-search" type="search" placeholder="Search product, size or SKU"><select id="ad-stock-filter"><option value="all">All stock</option><option value="low">Low stock (1–5)</option><option value="zero">Out of stock</option></select></div><div class="ad-table-wrap"><table><thead><tr><th>PRODUCT</th><th>SIZE</th><th>SKU</th><th>ON HAND</th><th>UPDATE</th></tr></thead><tbody id="ad-stock-rows">' + inventoryRows(rows) + '</tbody></table></div></div><p class="ad-data-note">Stock updates save immediately to the live catalogue. Newly created size options remain unavailable until a quantity is entered.</p>';
}

function inventoryRows(rows) {
  return rows.map(({ p, v }) => '<tr data-stock-row data-search="' + esc((p.name + ' ' + p.slug + ' ' + v.size + ' ' + (v.sku || '')).toLowerCase()) + '" data-quantity="' + Number(v.stock_quantity || 0) + '"><td><b>' + esc(p.name) + '</b><small>' + esc(p.audience) + ' · ' + esc(p.category) + '</small></td><td><b>' + esc(v.size) + '</b></td><td>' + esc(v.sku || '—') + '</td><td><span class="ad-pill ' + (Number(v.stock_quantity) === 0 ? 'is-danger' : Number(v.stock_quantity) <= 5 ? 'is-warn' : 'is-live') + '">' + Number(v.stock_quantity || 0) + '</span></td><td><div class="ad-stock-input"><input type="number" min="0" max="100000" step="1" value="' + Number(v.stock_quantity || 0) + '" data-stock-value="' + esc(v.id) + '" aria-label="Stock for ' + esc(p.name + ' size ' + v.size) + '"><button type="button" data-save-stock="' + esc(v.id) + '">Save</button></div></td></tr>').join('') || '<tr><td colspan="5" class="ad-empty-row">No size variants found. Add size options from Products.</td></tr>';
}

function messagesPage() {
  const rows = data.messages.map(m => '<tr><td><b>' + esc(m.name) + '</b><small>' + esc(m.email) + '</small></td><td>' + esc(m.subject || 'Customer enquiry') + '</td><td class="ad-message-body">' + esc(m.message) + '</td><td>' + esc(time(m.created_at)) + '</td><td><a class="ad-row-action" href="mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent('Re: ' + (m.subject || 'Your Paris Shoes enquiry')) + '">Reply ↗</a></td></tr>').join('') || '<tr><td colspan="5" class="ad-empty-row">No customer messages yet.</td></tr>';
  return pageHeading('CUSTOMER CARE', 'Messages.', 'Customer enquiries submitted through the Paris Shoes contact form. Reply through your authorised email account.') +
    '<div class="ad-stat-inline"><b>' + data.messageTotal + '</b> saved enquiries</div><div class="ad-panel"><div class="ad-table-wrap"><table><thead><tr><th>CUSTOMER</th><th>SUBJECT</th><th>MESSAGE</th><th>RECEIVED</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

function subscribersPage() {
  const rows = data.subscribers.map(s => '<tr><td><b>' + esc(s.email) + '</b></td><td>' + esc(time(s.created_at)) + '</td><td><a class="ad-row-action" href="mailto:' + encodeURIComponent(s.email) + '">Email ↗</a></td></tr>').join('') || '<tr><td colspan="3" class="ad-empty-row">No newsletter subscribers yet.</td></tr>';
  return pageHeading('AUDIENCE', 'Newsletter.', 'People who opted in to receive updates from Paris Shoes. Use these records responsibly and respect unsubscribe requests.') +
    '<div class="ad-stat-inline"><b>' + data.subscriberTotal + '</b> subscriber records</div><div class="ad-panel"><div class="ad-table-wrap"><table><thead><tr><th>EMAIL ADDRESS</th><th>SUBSCRIBED</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

function ordersPage() {
  const statuses = ['pending','confirmed','processing','shipped','delivered','cancelled','returned'];
  const rows = data.orders.map(order => {
    const items = (order.order_items || []).map(item => esc(item.product_name) + ' · ' + esc(item.size) + ' × ' + Number(item.quantity)).join('<br>');
    const selected = statuses.map(status => '<option value="' + status + '"' + (order.order_status === status ? ' selected' : '') + '>' + status[0].toUpperCase() + status.slice(1) + '</option>').join('');
    return '<tr><td><b>' + esc(order.order_number) + '</b><small>' + esc(time(order.created_at)) + '</small></td><td><b>' + esc(order.customer_name) + '</b><small>' + esc(order.customer_phone) + ' · ' + esc(order.customer_email) + '</small><small>' + esc(order.shipping_address) + ', ' + esc(order.shipping_city) + ', ' + esc(order.shipping_district) + '</small></td><td>' + (items || '—') + '</td><td><b>' + money(order.subtotal) + '</b><small>COD · ' + esc(order.payment_status) + '</small><small>Delivery fee: ' + money(order.shipping_fee) + '</small><small>COD total: ' + money(order.total) + '</small></td><td><input type="number" min="0" max="10000" step="1" inputmode="numeric" aria-label="Delivery fee" data-order-shipping-fee="' + esc(order.id) + '" value="' + Number(order.shipping_fee || 0) + '"><select data-order-status="' + esc(order.id) + '">' + selected + '</select><button type="button" class="ad-row-action" data-save-order="' + esc(order.id) + '">Save</button></td></tr>';
  }).join('') || '<tr><td colspan="5" class="ad-empty-row">No real customer orders have been received yet.</td></tr>';
  return pageHeading('COMMERCE', 'Orders.', 'Manage real Cash on Delivery orders, review customer details and update fulfilment status.') +
    '<div class="ad-demo-alert"><b>DELIVERY CHARGE</b><span>Courier charges are not configured yet. Orders currently store a zero delivery fee; confirm the courier charge with the customer before confirming the final COD amount or dispatching.</span></div>' +
    '<div class="ad-stat-inline"><b>' + data.orders.length + '</b> recent orders · newest first</div><div class="ad-panel"><div class="ad-table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER & DELIVERY</th><th>ITEMS</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

function pageContent() {
  if (view === 'products') return productsPage();
  if (view === 'inventory') return inventoryPage();
  if (view === 'messages') return messagesPage();
  if (view === 'subscribers') return subscribersPage();
  if (view === 'orders') return ordersPage();
  return overviewPage();
}

function render() {
  document.title = owner ? 'Admin · Paris Shoes' : 'Owner sign in · Paris Shoes';
  if (!owner) { root.innerHTML = loginPage() + '<div class="ad-notice" role="status"></div>'; return; }
  root.innerHTML = shell((loading ? '<div class="ad-loading"><span></span><p>Loading verified store data…</p></div>' : pageContent()) + (loading ? '' : '')) + (editingId && view === 'products' ? editorPage(data.products.find(p => String(p.id) === editingId) || {}) : '');
}

function goto(next) {
  view = ['overview','products','inventory','messages','subscribers','orders'].includes(next) ? next : 'overview';
  editingId = '';
  render();
}

async function uploadFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return [];
  if (list.length > 8) throw new Error('Choose no more than 8 images.');
  const allowed = ['image/jpeg','image/png','image/webp','image/avif'];
  const urls = [];
  for (const file of list) {
    if (!allowed.includes(file.type)) throw new Error('Unsupported image type: ' + file.name);
    if (file.size > 8 * 1024 * 1024) throw new Error(file.name + ' exceeds the 8 MB limit.');
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(-80) || 'product-image';
    const objectPath = 'products/' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '-' + safeName;
    const response = await rawFetch('/storage/v1/object/product-images/' + objectPath, { method: 'POST', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
    if (!response.ok) throw new Error('Could not upload ' + file.name + '.');
    urls.push(supabaseUrl + '/storage/v1/object/public/product-images/' + objectPath);
  }
  return urls;
}

async function saveProduct(form) {
  const fields = new FormData(form);
  const draft = normalizeProductDraft({
    name: fields.get('name'), audience: fields.get('audience'), category: fields.get('category'),
    price: fields.get('price'), colorway: fields.get('colorway'), description: fields.get('description'),
    badge: fields.get('badge'), sizes: fields.get('sizes'), imageUrls: fields.get('imageUrls'),
    is_active: fields.has('is_active'), is_featured: fields.has('is_featured'),
  });
  const imageUrls = [...draft.imageUrls, ...await uploadFiles(fields.getAll('files'))];
  if (imageUrls.length > 8) throw new Error('A product can have at most 8 gallery images.');
  const sizes = draft.sizes;
  delete draft.imageUrls;
  delete draft.sizes;
  let product;
  if (editingId) {
    const result = await api('products?id=eq.' + encodeURIComponent(editingId), { method: 'PATCH', body: JSON.stringify({ ...draft, updated_at: new Date().toISOString() }), headers: { Prefer: 'return=representation' } });
    product = Array.isArray(result.body) ? result.body[0] : null;
  } else {
    const result = await api('products', { method: 'POST', body: JSON.stringify({ ...draft, sort_order: 0 }), headers: { Prefer: 'return=representation' } });
    product = Array.isArray(result.body) ? result.body[0] : null;
  }
  if (!product?.id) throw new Error('The product was saved without a returned product ID. Please refresh and check the catalogue.');
  await api('product_images?product_id=eq.' + encodeURIComponent(product.id), { method: 'DELETE' });
  if (imageUrls.length) {
    await api('product_images', { method: 'POST', body: JSON.stringify(imageUrls.map((url, index) => ({ product_id: product.id, image_url: url, alt_text: draft.name + ' product view ' + (index + 1), position: index }))) });
  }
  const existing = await api('product_variants?select=size&product_id=eq.' + encodeURIComponent(product.id));
  const existingSizes = new Set((existing.body || []).map(row => String(row.size)));
  const additions = sizes.filter(size => !existingSizes.has(size)).map(size => ({ product_id: product.id, size, stock_quantity: 0, is_available: false }));
  if (additions.length) await api('product_variants', { method: 'POST', body: JSON.stringify(additions) });
  editingId = '';
  await loadData();
  notify('Product saved. New size variants were added with zero stock.');
}

async function updateStock(id) {
  const input = root.querySelector('[data-stock-value="' + CSS.escape(id) + '"]');
  if (!input) return;
  const quantity = parseStockQuantity(input.value);
  await api('product_variants?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ stock_quantity: quantity, is_available: quantity > 0, updated_at: new Date().toISOString() }) });
  await loadData();
  notify('Inventory updated.');
}

function filterTables() {
  const pSearch = root.querySelector('#ad-product-search');
  if (pSearch) {
    const query = pSearch.value.trim().toLowerCase();
    const status = root.querySelector('#ad-product-status')?.value || 'all';
    const rows = data.products.filter(p => [p.name,p.slug,p.category,p.audience].some(v => String(v || '').toLowerCase().includes(query)) && (status === 'all' || (status === 'live' ? p.is_active : !p.is_active)));
    const target = root.querySelector('#ad-product-rows');
    if (target) target.innerHTML = productRowsFiltered(rows);
  }
  const sSearch = root.querySelector('#ad-stock-search');
  if (sSearch) {
    const query = sSearch.value.trim().toLowerCase();
    const filter = root.querySelector('#ad-stock-filter')?.value || 'all';
    root.querySelectorAll('[data-stock-row]').forEach(row => {
      const quantity = Number(row.dataset.quantity);
      row.hidden = !(row.dataset.search.includes(query) && (filter === 'all' || (filter === 'low' ? quantity > 0 && quantity <= 5 : quantity === 0)));
    });
  }
}

function productRowsFiltered(rows) {
  const original = data.products;
  data.products = rows;
  const html = productRows();
  data.products = original;
  return html;
}

root.addEventListener('click', async event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { goto(viewButton.dataset.view); return; }
  if (event.target.closest('#ad-signout')) { await signOut(); return; }
  const orderSaveButton = event.target.closest('[data-save-order]');
  if (orderSaveButton) {
    const orderId = orderSaveButton.dataset.saveOrder;
    const select = root.querySelector('[data-order-status="' + CSS.escape(orderId) + '"]');
    const feeInput = root.querySelector('[data-order-shipping-fee="' + CSS.escape(orderId) + '"]');
    const order = data.orders.find(item => String(item.id) === String(orderId));
    const allowed = ['pending','confirmed','processing','shipped','delivered','cancelled','returned'];
    const fee = Number(feeInput?.value);
    if (!select || !feeInput || !order || !allowed.includes(select.value) || !Number.isFinite(fee) || fee < 0 || fee > 10000 || !Number.isInteger(fee)) {
      notify('Enter a valid whole-number delivery fee from 0 to 10,000 BDT.', true);
      return;
    }
    orderSaveButton.disabled = true;
    try {
      await api('orders?id=eq.' + encodeURIComponent(orderId), { method: 'PATCH', body: JSON.stringify({
        order_status: select.value, shipping_fee: fee, total: Number(order.subtotal) + fee, updated_at: new Date().toISOString()
      }) });
      await loadData();
      notify('Order status and COD delivery amount updated.');
    } catch (error) { notify(error.message || 'Could not update order.', true); }
    finally { orderSaveButton.disabled = false; }
    return;
  }

  if (event.target.closest('[data-new-product]')) { editingId = 'new'; render(); editingId = ''; root.innerHTML = shell(productsPage()) + editorPage({}); return; }
  const edit = event.target.closest('[data-edit]');
  if (edit) { editingId = edit.dataset.edit; render(); return; }
  if (event.target.closest('[data-close-editor]')) { editingId = ''; render(); return; }
  const stock = event.target.closest('[data-save-stock]');
  if (stock) {
    const button = stock;
    button.disabled = true;
    try { await updateStock(button.dataset.saveStock); } catch (error) { notify(error.message || 'Could not update stock.', true); }
    finally { button.disabled = false; }
  }
});

root.addEventListener('submit', async event => {
  if (event.target.id === 'ad-login-form') {
    event.preventDefault();
    const form = event.target, button = form.querySelector('button[type="submit"]'), status = form.querySelector('.ad-form-status');
    button.disabled = true; status.textContent = 'Checking owner access…';
    try {
      const fields = new FormData(form);
      await signIn(fields.get('email'), fields.get('password'));
      view = 'overview'; render();
    } catch (error) { status.textContent = error.message || 'Sign in failed.'; }
    finally { button.disabled = false; }
  }
  if (event.target.id === 'ad-product-form') {
    event.preventDefault();
    const form = event.target, button = form.querySelector('button[type="submit"]'), status = form.querySelector('.ad-form-status');
    button.disabled = true; status.textContent = 'Saving product and gallery…';
    try { await saveProduct(form); }
    catch (error) { status.textContent = error.message || 'Could not save product.'; button.disabled = false; }
  }
});

root.addEventListener('input', event => { if (event.target.id === 'ad-product-search' || event.target.id === 'ad-stock-search') filterTables(); });
root.addEventListener('change', event => { if (event.target.id === 'ad-product-status' || event.target.id === 'ad-stock-filter') filterTables(); });

render();
