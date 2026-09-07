/**
 * The slice of mdast this package touches.
 *
 * Declared here rather than imported so the package carries no type dependency
 * of its own: the shapes below are the ones remark and Sätteri both build, and
 * a plugin only ever reads a fenced block's language, its text and its line.
 */

export interface Point {
	line: number;
	column: number;
}

export interface Position {
	start: Point;
	end: Point;
}

/** A fenced code block. */
export interface CodeNode {
	type: 'code';
	lang?: string | null | undefined;
	meta?: string | null | undefined;
	value: string;
	position?: Position | undefined;
}

/** A run of raw HTML spliced into the document. */
export interface HtmlNode {
	type: 'html';
	value: string;
}

export interface Node {
	type: string;
	children?: Node[] | undefined;
}

export interface Parent extends Node {
	children: Node[];
}
