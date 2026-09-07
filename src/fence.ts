/**
 * Reading a ```` ```lini ```` fence's info string.
 *
 * Both Markdown pipelines hand us the fence already split: the language, and
 * whatever followed it. Where they split differs — ```` ```lini,figure ````
 * arrives as one `lang` under Sätteri and as `lang` + `meta` under remark — so
 * the two are rejoined here and split once, on the separator the fence actually
 * uses.
 */

/** The info string's language that marks a block as ours. */
const LANG = 'lini';

/**
 * The words a lini fence carries after its language, or `null` when the fence
 * is not ours.
 *
 * Whitespace and commas both separate, because Markdown's own fences take
 * commas — ```` ```rust,ignore ```` — so a reader who writes
 * ```` ```lini,figure ```` means what they appear to mean. The language must be
 * the whole first word: ```` ```linigraph ```` is somebody else's fence.
 */
export function fenceWords(
	lang: string | null | undefined,
	meta?: string | null | undefined,
): string[] | null {
	const words = `${lang ?? ''} ${meta ?? ''}`.split(/[\s,]+/).filter(Boolean);
	return words[0] === LANG ? words.slice(1) : null;
}
