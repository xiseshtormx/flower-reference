import { publicCatalog } from './database';
import { products, extras } from '../data/products';
import { defaultSettings, type CatalogSnapshot } from '../lib/catalog-types';
import { isPagesDemo } from '../lib/site-path';

// Pages uses only public example data checked into Git, never local orders or uploads.
export function storefrontCatalog(): CatalogSnapshot {
  if (!isPagesDemo) return publicCatalog();
  return {
    products: products.filter(product => product.published),
    extras: extras.filter(extra => extra.enabled),
    settings: { ...defaultSettings, demoMode: true },
    revision: 1,
    serverTime: new Date().toISOString(),
  };
}
