// Both the static preview and the Node version use the same storefront.
// Optional access also lets the existing Node tests import these modules.
export const isPagesDemo = import.meta.env?.PUBLIC_FLOWER_DEMO === '1';
const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');

export function sitePath(path: string): string {
  if (!base || !path.startsWith('/') || path.startsWith('//')) return path;
  if (path === base || path.startsWith(base + '/')) return path;
  return base + path;
}
