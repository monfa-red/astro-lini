/**
 * astro-lini — ```` ```lini ```` fences to inline SVG, at build time.
 *
 * [Lini](https://lini.rs) is one engine for every figure family: flowcharts,
 * charts, sequences, mindmaps, trees, schematics and technical drawings all come
 * out of the same fence. The compiler is linked as a WebAssembly module here,
 * not shelled out to — installing this package is the whole toolchain.
 *
 * The default export is the Astro integration. Everything a fence *becomes*
 * lives in [`remark-lini`](https://github.com/monfa-red/remark-lini); this
 * package is the Astro half — the integration that registers a plugin with
 * whichever Markdown processor the site runs, and the Sätteri front end for the
 * one Astro ships by default. A figure looks the same either way because both
 * call the same core.
 */

export { astroLini as default, astroLini } from './integration.js';
export type { AstroIntegration } from './integration.js';
export { satteriLini } from './satteri.js';
export type { SatteriPlugin } from './satteri.js';

/**
 * The portable plugin, re-exported so a site that reached for it here keeps
 * working. Outside Astro, depend on `remark-lini-lang` directly.
 */
export { remarkLini, liniCss } from 'remark-lini-lang';
export type { LiniOptions } from 'remark-lini-lang';
