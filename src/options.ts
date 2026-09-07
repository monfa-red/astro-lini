/** How a site tunes what the fences turn into. */
export interface LiniOptions {
	/**
	 * Ship the styling with the figures — a `<style>` block on each page that has
	 * one, and none on the pages that don't. On by default: it is what makes the
	 * install one line.
	 *
	 * This governs the figure wrapper, the theme binding, the error box and the
	 * listing's palette only; the styling *inside* each SVG is Lini's, and
	 * travels with it either way. Turn it off to own the styling yourself — see
	 * `liniCss()`.
	 *
	 * @default true
	 */
	bundledCss?: boolean;
}
