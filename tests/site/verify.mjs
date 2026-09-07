#!/usr/bin/env node
/**
 * Check that Astro's build accepted the markup the plugin emitted.
 *
 * `tsc` checks the types and nothing else — this package has no other test, and
 * the whole of what it does happens between a fence and a built page. So this
 * is the half a green `npm run build` cannot see: whether the SVG reached the
 * HTML, whether each fence word arranged the block the way it says it does, and
 * whether Astro's own pipeline kept any of it in one piece.
 *
 * Two failures it exists for, both silent and both total:
 *
 * A blank line ends an HTML block in CommonMark, and idiomatic Lini is full of
 * them — a stylesheet, a gap, then the drawn statements. A listing carrying one
 * literally would spill the rest of the page out of the figure and strand the
 * closing tags at the foot of it, with no error from anything and a site that
 * still builds.
 *
 * And Sätteri's raw escape hatch re-parses the string it is handed as whatever
 * the page is, which under MDX means as MDX: smart punctuation turns the
 * `--lini-*` custom properties inside each SVG's own stylesheet into en dashes
 * and its font names into curly quotes, and the figure lands on the page as
 * unstyled text. That is why the fixture's main page is `.mdx`, and why the
 * check below is paired with a control — the page's prose must show the smart
 * punctuation the figures must not, or the check passes on a page where nothing
 * was transformed at all.
 *
 * Usage: node verify.mjs <the site's build directory>
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];

/** Collect rather than throw, so one run reports every failure it found. */
function want(condition, what) {
	if (!condition) failures.push(what);
}

function count(haystack, needle) {
	return haystack.split(needle).length - 1;
}

/**
 * The page, twice.
 *
 * `counted` has the `<style>` blocks taken out: the stylesheet rides along on
 * every page with a figure and names every class the counts below look for, so
 * left in it poisons all of them. `html` keeps them, because one of those
 * blocks is each SVG's own — the very thing the smart-punctuation check reads.
 */
function page(dist, route) {
	const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
	return { html, counted: html.replace(/<style>[\s\S]*?<\/style>/g, '') };
}

/** Every figure on the page, from its wrapper to the end of the SVG inside it. */
function figures(html) {
	return html.match(/<div class="lini-figure"[^>]*>[\s\S]*?<\/svg>/g) ?? [];
}

/**
 * Each `lini-figure-block`, bounded at its own closing tag rather than at the
 * next block's opening one — so an assertion about what a block contains cannot
 * quietly read the rest of the page, and reordering the fixture stays harmless.
 * Nothing inside a block is a `div` but the block's own parts, so counting them
 * is enough.
 */
function blocks(counted) {
	const found = [];
	const open = /<div class="lini-figure-block([^"]*)">/g;
	for (let m = open.exec(counted); m; m = open.exec(counted)) {
		let depth = 0;
		const tag = /<div\b|<\/div>/g;
		tag.lastIndex = m.index;
		let end = counted.length;
		for (let t = tag.exec(counted); t; t = tag.exec(counted)) {
			depth += t[0] === '</div>' ? -1 : 1;
			if (depth === 0) {
				end = tag.lastIndex;
				break;
			}
		}
		found.push({ open: m[1], html: counted.slice(m.index, end) });
	}
	return found;
}

/** The prose is smart-punctuated; nothing inside a figure may be. */
const SMART = ['–', '—', '‘', '’', '“', '”'];

/** Each fence's arrangement, and what it puts on the page. */
function checkFigures({ html, counted }) {
	// figure-block  figure  source  toggle  alt-view
	//   `lini`            1       1       1       1        1
	//   `figure`          1       1       1       1        1
	//   `code`            1       1       1       1        1
	//   `figure-code`     1 open  1       1       0        1
	//   `code-figure`     1 open  1       1       0        1
	//   `figure-only`     0       1       0       0        0
	//   `code-only`       0       0       1       0        0
	want(count(counted, '<div class="lini-figure-block">') === 3, 'expected 3 toggled blocks');
	want(
		count(counted, '<div class="lini-figure-block lini-open">') === 2,
		'expected 2 compound blocks',
	);
	want(count(counted, '<div class="lini-figure"') === 6, 'expected 6 figures');
	want(count(counted, '<div class="lini-source">') === 6, 'expected 6 listings');
	want(count(counted, 'class="lini-view-toggle"') === 3, 'expected 3 toggles');
	want(count(counted, '<div class="lini-alt-view">') === 5, 'expected 5 folded halves');

	// The compiler ran on every block that draws and none of them failed. Paired
	// with the error box on `broken`, which proves the box is still emitted at
	// all — without that, this passes on a build that lost the ability to say so.
	want(count(counted, '<pre class="lini-error">') === 0, 'an error box on the good page');

	// The SVG is *in* the HTML — not an <img>, not a placeholder, and carrying
	// real geometry — and the wrapper has the natural width the stylesheet floors
	// the scaling against.
	const drawn = figures(counted);
	want(drawn.length === 6, `expected 6 inline SVGs, found ${drawn.length}`);
	for (const figure of drawn) {
		want(/^<div class="lini-figure"[^>]*><svg /.test(figure), 'a figure does not open on its SVG');
		want(
			/<svg [^>]*viewBox="[-\d. ]+"[^>]*width="[\d.]+"/.test(figure),
			'an SVG has no geometry',
		);
		want(!figure.includes('<img'), 'a figure carries an <img> rather than the SVG itself');
	}
	// The literal `--lini-w:` is also the cheapest tripwire for the smart
	// punctuation below: an en dash where the two hyphens should be fails here
	// before anything has to look inside an SVG.
	const sized = counted.match(/<div class="lini-figure" style="--lini-w: ?[\d.]+px"/g) ?? [];
	want(sized.length === 6, `expected 6 sized figure wrappers, found ${sized.length}`);

	// The listing is already highlighted, so it must not present itself as a code
	// block awaiting one — Astro's Shiki pass claims every <pre><code> it finds
	// and would re-tokenize this as plaintext, wiping the spans the palette is
	// written against.
	want(!/<div class="lini-source"><pre><code/.test(counted), 'a <code> crept into a listing');
	want(counted.includes('class="lini-tok-'), 'the listings are not highlighted');

	checkOrder(counted);
	checkToggles(counted);
	checkPunctuation(html, counted);
	checkPassthrough(counted);
	checkBlankLines(counted);
	checkProse(counted);
}

/** Each arrangement puts its two views on the page in the order its word names. */
function checkOrder(counted) {
	const all = blocks(counted);
	want(all.length === 5, `expected 5 blocks, found ${all.length}`);

	// `code` leads with the listing and folds the figure away. Found by the
	// control's own label rather than by position, so reordering the fixture is
	// harmless.
	const toggled = all.filter((block) => block.open === '');
	const leadsWithSource = toggled.filter((block) => block.html.includes('title="Show figure"'));
	want(leadsWithSource.length === 1, `expected 1 \`code\` block, found ${leadsWithSource.length}`);
	for (const { html } of leadsWithSource) {
		want(
			html.indexOf('lini-source') < html.indexOf('<div class="lini-figure"'),
			'the `code` block still leads with its figure',
		);
		want(
			html.indexOf('lini-alt-view') < html.indexOf('<div class="lini-figure"'),
			'the figure is not the folded half in `code` mode',
		);
	}

	// The two compound blocks differ only in that order, and `lini-alt-view`
	// always wraps whichever view came second — so one of each is the whole
	// assertion, and neither needs naming.
	const compound = all.filter((block) => block.open === ' lini-open');
	const figureFirst = compound.filter(
		({ html }) => html.indexOf('<div class="lini-figure"') < html.indexOf('lini-source'),
	);
	want(figureFirst.length === 1, '`figure-code` and `code-figure` came out in the same order');
	for (const { html } of compound) {
		const second = Math.max(html.indexOf('<div class="lini-figure"'), html.indexOf('lini-source'));
		want(html.indexOf('lini-alt-view') < second, 'the second view is not the wrapped one');
		want(!html.includes('lini-view-toggle'), 'a compound block kept its toggle');
	}

	// `figure-only` has no second view to position against, so it emits the bare
	// figure and no wrapper at all: five blocks hold five of the six figures.
	const wrapped = all.reduce((n, { html }) => n + count(html, '<div class="lini-figure"'), 0);
	want(wrapped === 5, `expected 5 figures inside blocks, found ${wrapped}`);
	// `code-only` is the same, from the other side: a listing on its own, outside
	// every block, with no figure drawn beside it.
	const listed = all.reduce((n, { html }) => n + count(html, '<div class="lini-source">'), 0);
	want(listed === 5, `expected 5 listings inside blocks, found ${listed}`);
}

/** Every toggle id is unique, and every one of them has a label pointing at it. */
function checkToggles(counted) {
	const ids = [...counted.matchAll(/class="lini-view-toggle" type="checkbox" id="([^"]+)"/g)].map(
		(m) => m[1],
	);
	want(new Set(ids).size === ids.length, `duplicate toggle ids: ${ids.join(', ')}`);
	for (const id of ids) want(counted.includes(`for="${id}"`), `no label points at ${id}`);
}

/**
 * The hazard `satteri.ts` parses to hast to avoid, and its control.
 *
 * The prose on this page *is* smart-punctuated — that is the processor working
 * as it should. The figures must have come through the same page untouched.
 */
function checkPunctuation(html, counted) {
	const drawn = figures(html);
	for (const figure of drawn) {
		for (const mark of SMART) {
			want(!figure.includes(mark), `smart punctuation inside a figure: ${mark}`);
		}
		want(figure.includes('--lini-'), 'a figure lost its custom properties');
		want(figure.includes('--lini-font-family: "'), 'a figure lost its straight-quoted font stack');
	}
	let prose = counted;
	for (const figure of figures(counted)) prose = prose.replace(figure, '');
	want(
		SMART.some((mark) => prose.includes(mark)),
		'the page was never smart-punctuated, so the figures prove nothing',
	);
}

/** A fence that is not ours, and one of ours quoted inside a wider one. */
function checkPassthrough(counted) {
	want(
		count(counted, 'a plain javascript fence') === 1,
		'the javascript fence did not pass through',
	);
	want(counted.includes('data-language="js"'), 'the javascript fence lost its language');
	// The quoted block is that fence's text, never a block of its own — so it is
	// still on the page as the three backticks and the source somebody wrote.
	want(counted.includes('```lini'), 'the quoted lini fence was eaten');
	want(count(counted, 'never compiled') === 1, 'the quoted lini source did not pass through');
}

/**
 * The blank lines came back.
 *
 * The listing leaves the plugin with its newlines folded into `&#10;`, because a
 * blank line ends an HTML block in CommonMark and idiomatic Lini is full of
 * them. Something then has to unfold them again before the page is written —
 * here Sätteri's own HTML parser does it on the way into hast — or the reader
 * loses the layout the author wrote. Both halves have to hold: the listing shows
 * its blank lines, and the page around it stayed whole. `checkProse` has the
 * second.
 */
function checkBlankLines(counted) {
	const listings = [...counted.matchAll(/<div class="lini-source"><pre>([\s\S]*?)<\/pre>/g)].map(
		(m) => m[1].replace(/<[^>]*>/g, ''),
	);
	want(listings.length === 6, `expected 6 listings, found ${listings.length}`);
	const spaced = listings.filter((text) => text.includes('\n\n'));
	want(spaced.length === 2, `expected 2 listings with blank lines, found ${spaced.length}`);
}

/** Every paragraph survived, in order, and nothing was stranded behind them. */
function checkProse(counted) {
	const prose = [
		'A chart, whose source is one click away.',
		'Prose after the chart, which must not be swallowed.',
		'Source first, with the figure behind the toggle.',
		// `code-only` never reaches the compiler, so this fragment — which does
		// not compile — is a listing rather than an error box. The error count
		// above is what says so.
		'a fragment, not a whole file',
		'The end.',
	];
	let at = -1;
	for (const text of prose) {
		const found = counted.indexOf(text, at + 1);
		want(found > at, `prose out of order or missing: ${text}`);
		at = found;
	}
	untailed(counted, 'The end.');
}

/** The signature of a shattered HTML block: closing tags after the last prose. */
function untailed(counted, last) {
	const tail = counted.slice(counted.lastIndexOf(last));
	for (const tag of ['</pre>', '</svg>', '</label>', '</div>']) {
		want(!tail.includes(tag), `orphaned ${tag} after the last prose: ${tail.slice(0, 200)}`);
	}
}

/**
 * The negative control: one block that does not compile, on a plain `.md` page.
 *
 * It has to cost the figure and nothing else — otherwise "no error box on the
 * good page" passes on a build that stopped emitting error boxes at all. The
 * page is `.md` so Astro's own default route is built too, not only the MDX one.
 */
function checkBroken({ counted }) {
	want(count(counted, '<pre class="lini-error">') === 1, 'expected exactly 1 error box');
	// The diagnostic names the Markdown file and the real line inside it, not the
	// line within the fence.
	want(
		/<pre class="lini-error">src\/pages\/broken\.md:\d+:\d+: error: /.test(counted),
		'the error box does not carry the file and line it came from',
	);
	// The block above it still drew.
	want(count(counted, '<div class="lini-figure-block">') === 1, 'the good block lost its wrapper');
	want(count(counted, '<div class="lini-figure"') === 1, 'the good block lost its figure');
	want(count(counted, '<div class="lini-source">') === 1, 'the good block lost its listing');
	want(count(counted, 'class="lini-view-toggle"') === 1, 'the good block lost its toggle');
	want(figures(counted).length === 1, 'the good block has no inline SVG');

	const sentinel = 'This page survived its bad block.';
	want(counted.includes(sentinel), 'the bad block took the rest of the page with it');
	untailed(counted, sentinel);
}

const dist = process.argv[2];
if (!dist) {
	console.error('usage: verify.mjs <the site build directory>');
	process.exit(2);
}

checkFigures(page(dist, 'figures'));
checkBroken(page(dist, 'broken'));

if (failures.length) {
	for (const failure of failures) console.error(`FAIL: ${failure}`);
	process.exit(1);
}
console.log(`${dist}: every fence drew, and both pages came out whole`);
