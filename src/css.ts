/**
 * The stylesheet the integration ships with the figures it emits.
 *
 * A remark or Sätteri plugin cannot add a file to the site's output, but it can
 * emit raw HTML — so the styling rides along in a `<style>` block on each page
 * that actually has a figure. That is the whole setup: one line in
 * `astro.config.mjs` and nothing else.
 *
 * It goes in `@layer astro-lini`, so any unlayered rule in the site's own CSS
 * wins without `!important`. Sites that would rather own the styling outright
 * pass `bundledCss: false` and ship {@link liniCss} themselves.
 */

import { readFileSync } from 'node:fs';

import { highlight_css } from './compiler.js';

/** The stylesheet, shared verbatim with the copy shipped in the package. */
const SOURCE = readFileSync(new URL('../astro-lini.css', import.meta.url), 'utf8');

/**
 * The complete stylesheet a page with a figure needs: this package's own sheet,
 * layered, and Lini's token palette below it.
 *
 * The palette is not copied here on purpose — it is the stylesheet the
 * highlighter's own markup is written against, so a colour it adds or renames
 * arrives with the compiler instead of drifting until someone notices a listing
 * has gone monochrome.
 *
 * Exported for a site that turns the bundled `<style>` off: write this to a file
 * and link it, or drop it in a `<style is:global>`, and the styling stays tied
 * to the compiler that draws the figures.
 */
export function liniCss(): string {
	// `@layer a, b` fixes the order up front: Lini's own defaults sit below ours,
	// whatever order the SVGs below happen to declare them in. Without this line
	// every figure's `@layer lini.defaults` — declared later, and so ranked
	// higher — would outrank the `color-scheme` binding and strand the page in
	// whatever the reader's OS prefers. Unlayered CSS still beats both, which is
	// the point.
	//
	// Lini's sheet declares its variables inside `@layer lini.defaults` itself,
	// so it goes outside our block — nesting it would rename that layer and
	// change what outranks what.
	return `@layer lini.defaults, astro-lini;\n@layer astro-lini {\n${SOURCE}}\n${highlight_css()}`;
}

let bundled: string | undefined;

/**
 * {@link liniCss} minified, built once — what actually ships on a page.
 *
 * The stylesheet is repeated once per page that has a figure, so the comments
 * and the slack whitespace are worth stripping.
 */
export function bundledCss(): string {
	bundled ??=
		minify(`@layer lini.defaults, astro-lini;@layer astro-lini {${SOURCE}}`) +
		minify(highlight_css());
	return bundled;
}

/**
 * The stylesheet as a `<style>` element, for a host that takes raw HTML.
 *
 * The trailing blank line keeps the page's own next line — a heading, usually —
 * out of the HTML block the tag opens.
 */
export function styleTag(): string {
	return `<style>${bundledCss()}</style>\n\n`;
}

/**
 * Strip comments and collapse whitespace. The stylesheet is repeated once per
 * page, so it is worth the few hundred bytes.
 */
function minify(css: string): string {
	return collapse(css.replace(/\/\*[\s\S]*?\*\//g, ''));
}

/**
 * Squeeze every run of whitespace to one space, then drop the spaces that sit
 * beside punctuation and carry no meaning.
 *
 * A space *before* a colon is left alone: `.a :is(.b)` is a descendant
 * selector, and closing it up would silently make it a compound one.
 */
function collapse(css: string): string {
	return css
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/ ([{},;])/g, '$1')
		.replace(/([{},;:]) /g, '$1')
		.replace(/;\}/g, '}');
}
