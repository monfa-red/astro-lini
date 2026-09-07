/**
 * The compiler, and the one rendering of what it says.
 *
 * Everything here forwards to `lini-wasm` — the same engine as the `lini`
 * binary, byte for byte. No compiling happens in this package and none may: a
 * second highlighter or a copied palette is exactly the drift that leaves a
 * listing monochrome the day the scanner names a class we do not paint.
 */

import { compile, diagnostics, highlight, highlight_css } from 'lini-wasm';

export { compile, highlight, highlight_css };

/** One span of a diagnostic, as `lini --json` reports it. */
interface Span {
	line: number;
	col: number;
}

/** One diagnostic, as `lini --json` reports it. */
export interface LiniDiagnostic {
	code: string;
	family: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	span: Span;
	related?: Span;
}

/**
 * Every diagnostic a compile of `source` would report — the validation pass,
 * then layout and routing when validation is clean.
 *
 * This is the gate a figure passes through, so it runs before the compile
 * proper: an error-level diagnostic costs the figure exactly as it would on the
 * command line, and a warning — an unroutable link, say — is reported while the
 * figure still draws.
 */
export function diagnose(source: string): LiniDiagnostic[] {
	const doc = JSON.parse(diagnostics(source)) as { diagnostics: LiniDiagnostic[] };
	return doc.diagnostics;
}

/**
 * The one human-readable rendering of a diagnostic — `file:line:col: level:
 * message`, a duplicate's prior definition trailing as `(previously at L:C)`.
 * The shape is the compiler's own [SPEC 21], so a message from a fence reads
 * like a message from the CLI.
 */
export function located(diag: LiniDiagnostic, file: string): string {
	const where = `${file}:${diag.span.line}:${diag.span.col}`;
	const prior = diag.related ? ` (previously at ${diag.related.line}:${diag.related.col})` : '';
	return `${where}: ${diag.severity}: ${diag.message}${prior}`;
}
