/**
 * Local `|image| { src: … }` paths, resolved against the Markdown file's own
 * directory.
 *
 * The compiler reads a local asset itself when it is a binary on your disk. In
 * WebAssembly it has no disk to read — every path comes back "operation not
 * supported on this platform" — so the host has to hand it the bytes. It takes
 * them in the one form it already accepts untouched: a `data:` URI [SPEC 7].
 *
 * So this is not a second asset pipeline; it is the file lookup the compiler
 * cannot perform here, and it stops the moment the bytes are in hand. Anything
 * the compiler already passes through — an HTTP(S) URL, an authored `data:`
 * URI — is left exactly as written.
 */

import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

/** A `src:` declaration and its double-quoted value. Lini has no other string form. */
const SRC = /\bsrc\s*:\s*"([^"\n]*)"/g;

/** A local path we could not read, at the `src:` it was written on. */
export interface AssetFailure {
	message: string;
	line: number;
	col: number;
}

export interface Resolved {
	source: string;
	failures: AssetFailure[];
}

/**
 * Fold every readable local `src:` into a `data:` URI, in place.
 *
 * `source` is the padded source — the fence's text with the Markdown above it
 * standing as blank lines — so a failure's line is already the line in the
 * `.md` file, the same one the compiler's own diagnostics carry.
 */
export function embedLocalImages(source: string, baseDir: string | undefined): Resolved {
	const failures: AssetFailure[] = [];
	const out = source.replace(SRC, (whole, src: string, at: number) => {
		if (isPassThrough(src)) return whole;
		const full = baseDir ? resolvePath(baseDir, src) : src;
		let bytes: Buffer;
		try {
			bytes = readFileSync(full);
		} catch (e) {
			failures.push({ ...position(source, at), message: `cannot read image '${src}' — ${why(e)}` });
			return whole;
		}
		const type = mime(bytes);
		if (!type) {
			failures.push({
				...position(source, at),
				message: `cannot read image '${src}' — not an SVG or raster (PNG/JPEG/GIF/WebP)`,
			});
			return whole;
		}
		return `src: "data:${type};base64,${bytes.toString('base64')}"`;
	});
	return { source: out, failures };
}

/** The forms the compiler emits unchanged [SPEC 7]: HTTP(S) URLs and `data:` URIs. */
function isPassThrough(src: string): boolean {
	return /^(https?:\/\/|data:)/i.test(src);
}

/**
 * The asset's MIME by magic number, matching what the compiler sniffs [SPEC 7]
 * — content, not the extension, so a `.png` that is really a JPEG still lands
 * as one.
 */
function mime(b: Buffer): string | undefined {
	if (b.length >= 8 && b.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
	if (/^GIF8[79]a/.test(b.toString('latin1', 0, 6))) return 'image/gif';
	if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP')
		return 'image/webp';
	if (isSvg(b)) return 'image/svg+xml';
	return undefined;
}

/** UTF-8 text whose first element, past a BOM, prolog and comments, is `<svg>`. */
function isSvg(b: Buffer): boolean {
	const text = b.toString('utf8').replace(/^﻿/, '');
	const bare = text.replace(/^\s*(<\?[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)\s*/gi, '');
	return /^\s*<svg[\s>]/i.test(bare);
}

function why(e: unknown): string {
	const code = (e as NodeJS.ErrnoException)?.code;
	if (code === 'ENOENT') return 'no such file';
	if (code === 'EACCES') return 'permission denied';
	return e instanceof Error ? e.message : String(e);
}

/** The 1-based line and column of an offset. */
function position(source: string, at: number): { line: number; col: number } {
	const before = source.slice(0, at);
	const nl = before.lastIndexOf('\n');
	return { line: before.split('\n').length, col: at - nl };
}
