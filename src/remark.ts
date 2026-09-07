/**
 * The remark plugin: ```` ```lini ```` fences to inline SVG, in any unified
 * pipeline.
 *
 * This is the portable half of the package. It walks the mdast for fenced blocks
 * whose language is ours and swaps each for the figure it draws, so it composes
 * into Next, Docusaurus, a plain `unified()` processor — anywhere remark runs —
 * and not only into Astro. The Astro integration registers this and adds
 * nothing to it.
 */

import { styleTag } from './css.js';
import { locate, report } from './document.js';
import { fenceWords } from './fence.js';
import { renderFence } from './figure.js';
import type { CodeNode, HtmlNode, Node, Parent } from './mdast.js';
import type { LiniOptions } from './options.js';

/** The file a unified processor is running over. Only its path is read. */
interface VFile {
	path?: string | undefined;
	history?: string[] | undefined;
}

/**
 * A remark plugin that compiles every ```` ```lini ```` block to inline SVG.
 *
 * ```js
 * import { remarkLini } from 'astro-lini';
 * unified().use(remarkParse).use(remarkLini).use(remarkRehype, { allowDangerousHtml: true });
 * ```
 */
export function remarkLini(options: LiniOptions = {}) {
	return function transform(tree: Node, file?: VFile): void {
		const { file: name, baseDir } = locate(file?.path ?? file?.history?.[0]);
		// Only a page that drew something needs the stylesheet, so it rides the
		// first figure rather than the document.
		let styled = options.bundledCss === false;

		visitCode(tree, (node) => {
			const words = fenceWords(node.lang, node.meta);
			if (!words) return undefined;
			const html = renderFence({
				source: node.value,
				file: name,
				// `position.start.line` is the opening fence; the source starts under it.
				firstLine: (node.position?.start.line ?? 0) + 1,
				baseDir,
				words,
				report,
			});
			const value = styled ? html : styleTag() + html;
			styled = true;
			return { type: 'html', value };
		});
	};
}

/**
 * Walk every fenced block, replacing the ones the visitor claims.
 *
 * A ```` ```lini ```` shown as an example inside a wider fence is that fence's
 * text, never a block of its own, so it passes through untouched — you can
 * document Lini in a Lini-powered site.
 */
function visitCode(node: Node, visit: (code: CodeNode) => HtmlNode | undefined): void {
	const children = (node as Parent).children;
	if (!children) return;
	for (let i = 0; i < children.length; i++) {
		const child = children[i] as Node;
		if (child.type === 'code') {
			const replacement = visit(child as unknown as CodeNode);
			if (replacement) children[i] = replacement as unknown as Node;
		} else {
			visitCode(child, visit);
		}
	}
}
