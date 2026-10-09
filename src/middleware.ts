import { defineMiddleware } from 'astro:middleware';
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  if (!context.url.pathname.startsWith('/media/')) response.headers.set('Cache-Control', 'no-store');
  if (context.url.pathname.startsWith('/admin') || context.url.pathname.startsWith('/api/admin')) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
