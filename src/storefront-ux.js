import { filterProducts } from './store-api.js';

const text = value => String(value ?? '').trim().toLowerCase();

export function filterCatalog(products, {
  audience = 'All',
  category = 'All',
  search = '',
  color = '',
  size = '',
  inStock = false,
  minPrice = '',
  maxPrice = '',
} = {}) {
  return filterProducts(products, { audience, category, search }).filter(product => {
    const price = Number(product.p) || 0;
    const min = minPrice === '' || minPrice == null ? null : Number(minPrice);
    const max = maxPrice === '' || maxPrice == null ? null : Number(maxPrice);
    if (min !== null && Number.isFinite(min) && price < min) return false;
    if (max !== null && Number.isFinite(max) && price > max) return false;
    if (color && !text(product.c).includes(text(color))) return false;
    if (size) {
      const matchingSize = (product.variants || []).some(variant =>
        String(variant.size) === String(size) && variant.available
      );
      if (!matchingSize) return false;
    }
    if (inStock && !(product.variants || []).some(variant => variant.available)) return false;
    return true;
  });
}

export function getRecentlyViewed(currentId, previousIds = [], limit = 4) {
  const ordered = [currentId, ...(Array.isArray(previousIds) ? previousIds : [])]
    .filter(id => id !== null && id !== undefined && String(id).trim() !== '')
    .map(String);
  return [...new Set(ordered)].slice(0, Math.max(0, Number(limit) || 0));
}
