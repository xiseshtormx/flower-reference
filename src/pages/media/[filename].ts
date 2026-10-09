import type { APIContext } from 'astro';
import { serveImage } from '../../server/media.ts';
export const prerender = false;
export const GET = (context: APIContext) => serveImage(context.params.filename);
