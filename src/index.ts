/**
 * astro-lini — ```` ```lini ```` fences to inline SVG, at build time.
 *
 * [Lini](https://lini.rs) is one engine for every figure family: flowcharts,
 * charts, sequences, mindmaps, trees, schematics and technical drawings all come
 * out of the same fence. The compiler is linked as a WebAssembly module here,
 * not shelled out to — installing this package is the whole toolchain.
 *
 * The default export is the Astro integration. `remarkLini` is the same work as
 * a plain remark plugin, for a unified pipeline that is not Astro.
 */

export { astroLini as default, astroLini } from './integration.js';
export type { AstroIntegration } from './integration.js';
export { remarkLini } from './remark.js';
export { satteriLini } from './satteri.js';
export type { SatteriPlugin } from './satteri.js';
export { liniCss } from './css.js';
export type { LiniOptions } from './options.js';
