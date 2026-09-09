/**
 * The Sätteri plugin: the same fences, for Astro's default Markdown processor.
 *
 * Astro 7 parses Markdown with Sätteri rather than with unified, so a remark
 * plugin alone would reach only a site that had opted back into the older
 * pipeline. This is the second adapter onto the same core: it reads the same
 * fence, calls the same `renderFence`, and shows the same markup. Nothing about
 * a figure is decided here.
 *
 * What is decided here is *how* that markup enters the tree. Sätteri's raw
 * escape hatch re-parses the string as Markdown — and under MDX that means as
 * MDX, whose smart punctuation turns the `--lini-*` custom properties inside
 * each SVG's own `<style>` into en dashes and its font names into curly quotes.
 * The figure arrives on the page as unstyled text. So the HTML is parsed to hast
 * here instead, with Sätteri's own HTML parser, and handed over as elements: a
 * tree nothing re-parses, identical under Markdown and MDX.
 */

import { fileURLToPath } from 'node:url';

import { bundledCss, fenceWords, locate, renderFence, report } from 'remark-lini/core';
import type { CodeNode, LiniOptions } from 'remark-lini/core';

/** The slice of hast this adapter handles: elements, and the text inside them. */
interface HastNode {
	type: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
}

/** Sätteri's HTML parser, loaded from the processor the site already runs. */
type HtmlToHast = (html: string, options?: { fragment?: boolean }) => HastNode;

/**
 * The slice of Sätteri's visitor context this plugin reads and writes. Declared
 * structurally so the package needs no compile-time dependency on the processor
 * it plugs into.
 */
interface SatteriContext {
	readonly fileURL: URL | undefined;
	readonly data: Record<string, unknown>;
	insertBefore(node: CodeNode, newNode: unknown): void;
	setProperty(node: CodeNode, key: 'data', value: Record<string, unknown>): void;
}

/** A Sätteri mdast plugin, as `satteri({ mdastPlugins: [...] })` takes one. */
export interface SatteriPlugin {
	name: string;
	options: { position: true };
	before(): Promise<void>;
	code(node: CodeNode, context: SatteriContext): void;
}

/** The key the per-document style flag hangs off Sätteri's shared data bag. */
const EMITTED = 'astro-lini:style-emitted';

let htmlToHast: HtmlToHast | undefined;

/**
 * A Sätteri mdast plugin that compiles every ```` ```lini ```` block to inline
 * SVG.
 *
 * ```js
 * import { satteri } from '@astrojs/markdown-satteri';
 * import { satteriLini } from 'astro-lini';
 * markdown: { processor: satteri({ mdastPlugins: [satteriLini()] }) }
 * ```
 */
export function satteriLini(options: LiniOptions = {}): SatteriPlugin {
	return {
		name: 'astro-lini',
		// The fence's line in the `.md` file is the whole point of the diagnostics,
		// and positions are off unless a plugin asks for them.
		options: { position: true },

		// Sätteri is the processor running this plugin, so it is present by
		// definition — but only then, which is why it is reached for here rather
		// than imported at the top of a package the remark half also ships in.
		async before() {
			htmlToHast ??= ((await import('satteri')) as unknown as { htmlToHast: HtmlToHast })
				.htmlToHast;
		},

		code(node, context) {
			const words = fenceWords(node.lang, node.meta);
			if (!words) return;
			const { file, baseDir } = locate(
				context.fileURL ? fileURLToPath(context.fileURL) : undefined,
			);
			const html = renderFence({
				source: node.value,
				file,
				// `position.start.line` is the opening fence; the source starts under it.
				firstLine: (node.position?.start.line ?? 0) + 1,
				baseDir,
				words,
				report,
			});

			// Only a page that drew something needs the stylesheet, so it rides the
			// first figure. The flag lives on the document's own data bag, not on
			// this plugin — one plugin object serves every page in the build.
			if (options.bundledCss !== false && !context.data[EMITTED]) {
				context.data[EMITTED] = true;
				context.insertBefore(node, {
					type: 'paragraph',
					children: [],
					data: { hName: 'style', hChildren: [{ type: 'text', value: bundledCss() }] },
				});
			}

			// `renderFence` always returns exactly one element, so the fence becomes
			// that element: its tag and attributes on the node, its contents beneath.
			const root = element(html);
			context.setProperty(node, 'data', {
				hName: root.tagName,
				hProperties: root.properties ?? {},
				hChildren: root.children ?? [],
			});
		},
	};
}

/** Parse the figure's HTML into the single element it always is. */
function element(html: string): HastNode {
	if (!htmlToHast) throw new Error('astro-lini: the Sätteri plugin ran before its `before` hook');
	const root = htmlToHast(html, { fragment: true }).children?.find((n) => n.type === 'element');
	if (!root) throw new Error(`astro-lini: the figure parsed to no element: ${html.slice(0, 80)}`);
	unmangleXmlns(root);
	return root;
}

/**
 * Give the root `<svg>` its `xmlns` back.
 *
 * Sätteri's HTML parser reads the namespace declaration into a property spelled
 * `:xmlns`, which is not an attribute name; renaming it drops the attribute
 * rather than emitting a broken one. Inline SVG in HTML takes its namespace from
 * the parser regardless, so nothing is lost today — and if the parser is fixed,
 * the attribute comes back on its own.
 */
function unmangleXmlns(node: HastNode): void {
	if (node.properties && ':xmlns' in node.properties) {
		node.properties['xmlns'] = node.properties[':xmlns'];
		delete node.properties[':xmlns'];
	}
	for (const child of node.children ?? []) unmangleXmlns(child);
}
