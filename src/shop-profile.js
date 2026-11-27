const asText = value => typeof value === 'string' ? value : '';

/** Remove seeded/sample listings from the public catalogue without changing admin data. */
export function excludeDemoProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.filter(product => {
    const markers = `${asText(product?.tag)} ${asText(product?.badge)} ${asText(product?.d)} ${asText(product?.description)}`;
    return !/\bDEMO\b/i.test(markers);
  });
}
