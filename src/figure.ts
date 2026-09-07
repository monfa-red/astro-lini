/**
 * Compiling one lini block into the figure that replaces it.
 *
 * This is the whole of the package that knows what a figure looks like. Both
 * Markdown pipelines — the remark plugin and the Sätteri one — arrive here with
 * the same five facts and take the same string away, so a fence renders
 * identically whichever processor a site runs.
 */

import { embedLocalImages } from './assets.js';
import { compile, diagnose, highlight, located } from './compiler.js';

/**
 * The wrapper a figure and its listing share. It must stay outside Lini's own
 * `.lini-<type>` namespace — every node in a diagram wears `.lini-box`,
 * `.lini-block` and the like, so a wrapper named for a type would restyle the
 * insides of every SVG on the page.
 */
const BLOCK = 'lini-figure-block';

/**
 * Open a drawn icon of `width` — the two marks below share everything but their
 * strokes, and neither may carry a newline.
 */
const ICON_HEAD =
	'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
	'stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

/**
 * "Show the source": a pair of chevrons with air between them. A slash in the
 * middle only crowds it at this size.
 */
const ICON_SOURCE = '<path d="M9 6.5 3.5 12 9 17.5"/><path d="M15 6.5 20.5 12 15 17.5"/></svg>';

/**
 * "Show the figure": a framed picture. Deliberately not a play triangle —
 * nothing runs here, the figure is already drawn and merely hidden, and a play
 * glyph would promise otherwise.
 */
const ICON_FIGURE =
	'<rect x="3" y="4.75" width="18" height="14.5" rx="2.5"/>' +
	'<circle cx="8.75" cy="10" r="1.5"/>' +
	'<path d="M20.5 17.5 14.25 11.25 5 19.25"/></svg>';

/** One of the two things a block can show. The fence spells `Source` `code`. */
type View = 'figure' | 'source';

/** What follows the leading view. */
type Second =
	/** The default: folded behind the toggle, one view on the page at a time. */
	| 'folded'
	/** Named second in the fence — on the page under the lead, with no toggle. */
	| 'shown'
	/** `-only`: there is no second view. */
	| 'none';

/** What a block shows: which view leads, and what follows it. */
interface Mode {
	lead: View;
	second: Second;
}

/**
 * Six spellings of one grammar — the views a block shows, in the order it shows
 * them. Each names a whole arrangement, so they are alternatives and the last
 * one written wins.
 */
const MODES = {
	figure: { lead: 'figure', second: 'folded' },
	code: { lead: 'source', second: 'folded' },
	'figure-code': { lead: 'figure', second: 'shown' },
	'code-figure': { lead: 'source', second: 'shown' },
	'figure-only': { lead: 'figure', second: 'none' },
	'code-only': { lead: 'source', second: 'none' },
} satisfies Record<string, Mode>;

/** A bare ```` ```lini ```` fence: `figure` is the default, spelled out. */
const DEFAULT_MODE: Mode = MODES.figure;

/**
 * Whether the block needs the compiler.
 *
 * The source leading with nothing after it is the one arrangement that never
 * puts a figure on the page, so `code-only` is also the fence that never
 * compiles: a fragment, or a deliberate counter-example, stays a listing to read
 * instead of becoming an error box — a consequence of the grammar rather than a
 * word of its own.
 */
function draws(mode: Mode): boolean {
	return !(mode.lead === 'source' && mode.second === 'none');
}

export interface Fence {
	/** The block's source, verbatim — what the listing shows. */
	source: string;
	/** The file the fence lives in, as a diagnostic should name it. */
	file: string;
	/** The 1-based line the block's first source line sits on in `file`. */
	firstLine: number;
	/** Where a local `|image| src:` resolves — the Markdown file's own directory. */
	baseDir?: string | undefined;
	/** The words the fence carried after `lini`. */
	words: string[];
	/** Where a diagnostic goes. */
	report: (message: string) => void;
}

/**
 * Compile one block's source into its figure and — unless the fence says
 * `figure-only` — the listing of the source with it.
 *
 * A block that fails to compile becomes a visible error box and the message goes
 * to stderr: the build still finishes, so one bad diagram never costs you the
 * rest of the site.
 */
export function renderFence(fence: Fence): string {
	const { source, file, firstLine, baseDir, words, report } = fence;
	const mode = readMode(words, file, firstLine, report);

	// A block showing no figure never reaches the compiler, which is the whole
	// point of `code-only`: a fragment, a counter-example, or a deliberate
	// syntax error is a listing to read, not a figure that failed to draw.
	if (!draws(mode)) return listing(source);

	// Lini counts lines from the top of what it is handed, so pad the source with
	// the Markdown standing above it. Diagnostics then read `page.md:LINE:COL`
	// against the real file rather than against the fence.
	const padded = '\n'.repeat(firstLine - 1) + source;
	const assets = embedLocalImages(padded, baseDir);
	let fatal: string | undefined;
	for (const failure of assets.failures) {
		const text = `${file}:${failure.line}:${failure.col}: error: ${failure.message}`;
		report(text);
		fatal ??= text;
	}
	if (fatal) return errorBox(fatal);

	let svg: string;
	try {
		// Validation first: an unknown property or a malformed value costs us the
		// figure, exactly as it would on the command line. Warnings — an
		// unroutable link, say — are reported and the figure still draws.
		for (const diag of diagnose(assets.source)) {
			const text = located(diag, file);
			report(text);
			if (diag.severity === 'error') fatal ??= text;
		}
		if (fatal) return errorBox(fatal);
		svg = compile(assets.source);
	} catch (e) {
		// The compiler throws its own `file:line:col: error: …`, but naming
		// `play.lini`; the diagnostics above carry the real file, so a throw that
		// gets this far has no located form to keep.
		const text = `${file}: ${e instanceof Error ? e.message : String(e)}`;
		report(text);
		return errorBox(text);
	}

	const figure = wrap(svg);
	const code = listing(source);
	if (mode.second === 'none') {
		// `figure-only`: the figure alone, and no wrapper — there is no second view
		// to position against it.
		return figure;
	}

	const [first, second] = mode.lead === 'figure' ? [figure, code] : [code, figure];
	if (mode.second === 'shown') {
		// Both named: the two views stacked in the fence's order, with no checkbox
		// and no button. The second keeps the class the toggled one wears — it is
		// the same box in the same place — and the rule that hides it is written
		// against the checkbox, so a block that emits none has nothing to hide it.
		// The wrapper says `lini-open` so a theme can tell the two arrangements
		// apart.
		return `<div class="${BLOCK} lini-open">${first}<div class="lini-alt-view">${second}</div></div>`;
	}

	const id = toggleId(file, firstLine);
	const names = mode.lead === 'figure' ? 'source' : 'figure';
	const icon = mode.lead === 'figure' ? ICON_SOURCE : ICON_FIGURE;
	return (
		`<div class="${BLOCK}">${checkbox(names, id)}${button(icon, names, id)}` +
		`${first}<div class="lini-alt-view">${second}</div></div>`
	);
}

/**
 * Read the mode off the fence's words. A word we don't know is reported and
 * ignored, not fatal — the same bargain the rest of this module strikes: a typo
 * in an info string costs a line of build output, never the figure.
 */
function readMode(
	words: string[],
	file: string,
	line: number,
	report: (message: string) => void,
): Mode {
	const named = MODES as Record<string, Mode | undefined>;
	let mode = DEFAULT_MODE;
	for (const word of words) {
		const found = named[word];
		if (found) mode = found;
		else report(`${file}:${line}: unknown word \`${word}\` on a lini fence — ignoring`);
	}
	return mode;
}

/**
 * The toggle: a checkbox and its label, and no script — so it works with
 * JavaScript off, takes keyboard focus, and costs the page nothing, which is the
 * promise the figures themselves make.
 *
 * It is deliberately **not** a `<details>`. That element carries a disclosure
 * marker, and a site's own stylesheet is unlayered — so it outranks ours and can
 * put the caret back however we suppress it. It also gives a theme a second
 * element to frame, which is how a listing ends up in a box inside a box. A
 * label has no marker, and the `<pre>` is left as the one thing a theme will
 * dress: one frame, like every other code block on the page.
 */
function checkbox(names: string, id: string): string {
	return `<input class="lini-view-toggle" type="checkbox" id="${id}" aria-label="Show ${names}" />`;
}

function button(icon: string, names: string, id: string): string {
	return `<label class="lini-view-button" for="${id}" title="Show ${names}">${ICON_HEAD}${icon}</label>`;
}

/**
 * The source, highlighted, in the panel the token palette is keyed on.
 *
 * The `<pre>` inside is left bare so it is the one element a site's own
 * stylesheet frames — one box, like every other code block on the page. The
 * listing is the author's own text, verbatim: the highlighter is lexical and
 * reformats nothing.
 *
 * There is deliberately no `<code>` inside the `<pre>`. That pair is how a page
 * says "a code block, not yet highlighted", and Astro's Shiki pass claims every
 * one it finds: it would re-tokenize this listing as plaintext and wipe the
 * spans the palette is written against. The listing is already highlighted, by
 * the same scanner the editors use, so it does not present itself as awaiting
 * one — and the `<pre>` still takes whatever frame the site puts on a code
 * block.
 */
function listing(source: string): string {
	return `<div class="lini-source"><pre>${oneLine(highlight(source))}</pre></div>`;
}

/**
 * A DOM id for one block's toggle, unique within the page. Anything that is not
 * a letter or digit folds to `-`, so a nested path still yields a legal id and
 * the label can point at it.
 */
function toggleId(file: string, line: number): string {
	const slug = file
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `lini-src-${slug}-${line}`;
}

/**
 * Fold every newline into the entity that renders as one.
 *
 * A blank line **ends an HTML block** in CommonMark: the rest of the page would
 * be parsed as Markdown and spill out of the figure, orphaning the closing tags
 * at the foot of the page. Idiomatic Lini has blank lines — a stylesheet, a gap,
 * then the drawn statements — so the listing cannot carry them literally. Inside
 * `<pre>` the entity renders identically, and it can end nothing.
 *
 * The SVG is exempt: it is never blank-line separated, and its own `<style>` is
 * raw text where an entity would stay an entity.
 */
function oneLine(html: string): string {
	return html.replace(/\n/g, '&#10;');
}

/**
 * Wrap a compiled SVG in the figure div the stylesheet targets.
 *
 * The wrapper carries `--lini-w`, the diagram's natural pixel width — the one
 * hook the stylesheet needs to floor how far a wide figure may scale down before
 * the wrapper scrolls instead.
 */
function wrap(svg: string): string {
	const width = naturalWidth(svg);
	const style = width ? ` style="--lini-w: ${width}px"` : '';
	return `<div class="lini-figure"${style}>${svg}</div>`;
}

/** The `width` lini bakes onto the root `<svg>` tag, in pixels. */
function naturalWidth(svg: string): string | undefined {
	const tag = svg.slice(0, svg.indexOf('>'));
	return / width="([^"]*)"/.exec(tag)?.[1];
}

/**
 * A diagnostic, on the page as well as on stderr. It may carry a blank line, so
 * it goes through {@link oneLine} like the listing does.
 */
function errorBox(message: string): string {
	return `<pre class="lini-error">${oneLine(escapeHtml(message))}</pre>`;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
