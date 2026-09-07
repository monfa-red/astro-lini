/**
 * The two facts a fence needs from the document it lives in, and where its
 * diagnostics go.
 */

import { dirname, isAbsolute, relative } from 'node:path';

export interface Location {
	/** The file as a diagnostic should name it — relative to the project when it can be. */
	file: string;
	/** Where a local `|image| src:` resolves: the Markdown file's own directory. */
	baseDir: string | undefined;
}

/**
 * A document's own path, as a diagnostic's file and as an asset's base
 * directory.
 *
 * The displayed path is relative to the project root, so a build log reads
 * `src/pages/guide.md:41:1` rather than a line of machine-specific noise. A file
 * outside the project keeps its absolute path, which is the only unambiguous
 * name it has.
 */
export function locate(path: string | undefined): Location {
	if (!path) return { file: '<markdown>', baseDir: undefined };
	const rel = relative(process.cwd(), path);
	const inside = rel && !rel.startsWith('..') && !isAbsolute(rel);
	return { file: inside ? rel : path, baseDir: dirname(path) };
}

/**
 * Where a diagnostic goes: stderr, named, so a build log says who spoke. The
 * page carries the error box; this is the copy you see while the build runs.
 */
export function report(message: string): void {
	console.error(`astro-lini: ${message}`);
}
