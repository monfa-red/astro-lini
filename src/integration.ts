/**
 * The Astro integration: one line in `astro.config.mjs`, and every
 * ```` ```lini ```` fence in the site draws.
 *
 * It is a wrapper and nothing more. Astro 7 parses Markdown with Sätteri and can
 * be put back on unified, so the one thing this decides is which of the two
 * plugins to hand the configured processor — both of which render through the
 * same core. There is no third path here, and none may appear: a figure must
 * look the same whichever processor a site runs.
 */

import { remarkLini } from 'remark-lini';
import type { LiniOptions } from 'remark-lini';

import { satteriLini } from './satteri.js';

/**
 * The shape of `markdown.processor` this reads. Astro's own schema fills it in
 * — `satteri()` by default — so it is set by the time an integration runs.
 */
interface Processor {
	name: string;
	options: {
		mdastPlugins?: unknown[];
		remarkPlugins?: unknown[];
	};
}

/** The slice of the `astro:config:setup` hook this uses. */
interface SetupContext {
	config: { markdown?: { processor?: Processor } };
	updateConfig: (config: Record<string, unknown>) => void;
	logger: { warn: (message: string) => void };
}

export interface AstroIntegration {
	name: string;
	hooks: { 'astro:config:setup': (context: SetupContext) => void };
}

/**
 * Compile every ```` ```lini ```` block in the site's Markdown and MDX to inline
 * SVG, and ship the styling with it.
 *
 * ```js
 * import lini from 'astro-lini';
 * export default defineConfig({ integrations: [lini()] });
 * ```
 */
export function astroLini(options: LiniOptions = {}): AstroIntegration {
	return {
		name: 'astro-lini',
		hooks: {
			'astro:config:setup'({ config, updateConfig, logger }) {
				const processor = config.markdown?.processor;
				if (processor?.name === 'satteri' && processor.options.mdastPlugins) {
					processor.options.mdastPlugins.push(satteriLini(options));
				} else if (processor?.options.remarkPlugins) {
					// A site that has put Markdown back on unified — `@astrojs/markdown-remark`.
					processor.options.remarkPlugins.push([remarkLini, options]);
				} else if (processor) {
					logger.warn(
						`no lini fences will be compiled: the \`${processor.name}\` Markdown processor takes ` +
							'neither mdast nor remark plugins. Register `remarkLini` with it yourself.',
					);
				} else {
					// Astro before the processor option: the legacy plugin list.
					updateConfig({ markdown: { remarkPlugins: [[remarkLini, options]] } });
				}
			},
		},
	};
}
