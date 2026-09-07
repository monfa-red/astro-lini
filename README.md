<p align="center">
  <a href="https://lini.rs"><img src="https://raw.githubusercontent.com/monfa-red/astro-lini/main/assets/logo/lini_icon.svg" alt="Lini" width="128"></a>
</p>

<p align="center"><strong>From mindmap to blueprint, in your Astro site.</strong></p>

<p align="center">Every figure from plain text — <a href="https://lini.rs">lini.rs</a> has the language, the tour and a playground.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/astro-lini"><img src="https://img.shields.io/npm/v/astro-lini.svg" alt="npm"></a>
  <a href="https://github.com/monfa-red/astro-lini/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license: MIT"></a>
</p>

An [Astro](https://astro.build) integration that compiles ` ```lini ` blocks in your
Markdown and MDX to inline SVG at build time.

````markdown
```lini
|chart| "Signups by channel" { categories: "Jan", "Feb", "Mar", "Apr", "May", "Jun" } [
  |line| "organic"  { data: 14, 19, 26, 33, 44, 58; curve: smooth; marker: dot; stroke: --teal }
  |line| "referral" { data: 9, 13, 15, 22, 27, 36; curve: smooth; marker: dot; stroke: --purple }
]
```
````

That is a chart, but the fence is not a chart fence. [Lini](https://lini.rs) is one engine
for every figure family — flowcharts, charts, sequences, mindmaps, trees, schematics, and
technical drawings are all layouts of the same language. So one fence covers all of them,
and there is nothing else to install.

- **No runtime.** Figures are SVG in the HTML. No JavaScript, no CDN, no browser at build
  time — the pages work with scripts off.
- **No second toolchain.** The compiler is a WebAssembly module resolved from npm like any
  other dependency. `npm install` plus one line of config is the whole thing.
- **Dark mode for free.** Colours are live CSS variables, so figures follow your theme
  toggle without a re-render.
- **The source is one click away.** Each figure carries a small `</>` toggle that reveals
  the Lini that drew it, syntax-highlighted at build time — still no JavaScript. A fence
  word flips it, so a reference page can lead with the source instead.
- **Fast and deterministic.** A typical diagram compiles in about a millisecond,
  byte-identically each run.

## Install

```bash
npm install astro-lini
```

## Setup

One line in `astro.config.mjs`. The styling ships with the figures:

```js
import { defineConfig } from 'astro/config';
import lini from 'astro-lini';

export default defineConfig({
  integrations: [lini()],
});
```

That's it — no stylesheet to link, no files to copy. Markdown and MDX are both covered, on
Astro's own Markdown processor and on `unified()` alike.

## Writing a figure

Any Lini source works. The [tour](https://lini.rs/docs/) walks every family and the
[reference](https://lini.rs/docs/reference/00-at-a-glance.html) covers it in full; this is
the shape of it:

````markdown
```lini
{ layout: sequence; font-size: 13; }

|icon#reader| "user" { width: 60; stroke: --rose-deep; fill: --rose-wash }
|box#cdn| "CDN" { fill: --sky-wash; stroke: --sky-deep }
|box#origin| "Origin" { fill: --green-wash; stroke: --green-deep }

reader -> cdn "GET /guide"
cdn -> cdn "check edge cache"

|loop| "on miss" { fill: --amber-wash; stroke: --amber-ink } [
  cdn -> origin "fetch"
  origin --> cdn "200 + max-age"
]

cdn --> reader "HTML"
```
````

A block that references a local image with `|image| src:` resolves the path against the
Markdown file's own directory.

Blocks in other languages pass through untouched, as does a ` ```lini ` block quoted
inside a wider fence — so you can document Lini in a Lini-powered site.

## Showing the source

Every figure carries a small `</>` in its top-right corner. Clicking it reveals the Lini
that drew it, highlighted with the same vocabulary the VS Code and Zed grammars use — the
colouring comes from Lini's own ledger, so a property gets its colour here the moment the
language has it.

The toggle is a checkbox and its label — pure CSS, so it costs no JavaScript, takes
keyboard focus, and works with scripts off. The listing is your block's own text,
verbatim, not reformatted.

It is deliberately not a `<details>`. Your site's stylesheet is unlayered, so it outranks
ours: a `<details>` gives your theme a second element to frame — a box inside the code
block's box — and it carries a disclosure marker your theme can put back however we hide
it. With a label there is no marker, and the `<pre>` is the only element your theme
dresses. One frame, like every other code block on the page.

### Choosing what a block shows

A block has two views — the figure, and the source that drew it. One word on the fence
names them, in the order they appear:

| fence | shows |
| --- | --- |
| ` ```lini ` | the figure, its source folded behind the button |
| ` ```lini figure ` | the same, said out loud |
| ` ```lini code ` | the source, the figure folded behind the button |
| ` ```lini figure-code ` | the figure, then its source — both on the page |
| ` ```lini code-figure ` | the source, then the figure — both on the page |
| ` ```lini figure-only ` | the figure, nothing else |
| ` ```lini code-only ` | the source, nothing else |

A single word names the lead and leaves the other view folded — that is the default, and
` ```lini figure ` is simply the default spelled out. A compound names both, in order, and
drops the toggle: reach for it when the source *is* the lesson, since a reader meeting the
language for the first time should not have to discover a button to see what drew the
picture. `code-figure` is the one a tutorial usually wants — listing first, then the result.

`code-only` never reaches the compiler. It does not need a rule of its own: a block showing
the source and nothing else has no figure to draw, so a fragment, a counter-example or a
deliberately broken line stays a highlighted listing instead of becoming an error box.

````markdown
```lini code-only
|box#hero| "…"   // a shape, not a whole file
```
````

Whitespace or a comma both separate, so ` ```lini,figure ` reads the same. The words are
alternatives, each naming a whole arrangement — write two and the last wins. A word we
don't recognise is reported on stderr and ignored, never fatal.

## Theming

Each figure is a `<div class="lini-figure">` wrapping the SVG. Lini emits every colour as a
`light-dark()` pair keyed on `color-scheme`, and binding that property is the entire
light/dark integration.

`color-scheme` is inherited, so a site that sets it on `:root` — the modern way — needs
nothing at all:

```css
:root { color-scheme: light dark; }
```

The two conventions that don't set it are bound for you: a `.dark` class and a
`data-theme="dark"` attribute on `<html>`. Any other theme adds one line:

```css
html.my-dark-theme :is(.lini, .lini-source, .lini-error) { color-scheme: dark; }
```

To hand Lini your own palette, alias its role variables. Everything shipped sits in
`@layer`, so any unlayered rule of yours wins without `!important`:

```css
.lini {
    --lini-bg: transparent;
    --lini-fg: var(--fg);
    --lini-accent: #4a7fd4;
    --lini-font-family: var(--body-font);
}
```

Its eleven-hue palette (`--rose`, `--sky`, `--teal`, … each in five tiers) is emitted only
where a figure references it.

> [!NOTE]
> Alias `--lini-font-family` only to a proportional sans close in metrics to the one Lini
> measured against at compile time. Lini bakes each label's position and sizes its box to
> fit, so a wider face — a monospace one especially — pushes the text past its border.

## Sizing

The wrapper carries `--lini-w`, the diagram's natural width. A figure scales down to fit
the column but stops at 75% of that width — past there the labels stop reading, so the
wrapper scrolls horizontally instead.

The source listing is not bound by that floor: it fills the column and scrolls
horizontally on its own when a line is long.

## Owning the styling

astro-lini's own stylesheet — the wrapper above, the theme binding, the error box, and the
source listing's palette — rides along in a `<style>` block on each page that has a figure.
About 3 kB minified, and none on pages without one. It is not Lini's styling: that lives
inside each SVG and travels with it regardless.

To take it over instead, turn it off and ship the sheet yourself:

```js
integrations: [lini({ bundledCss: false })]
```

`liniCss()` returns exactly what the bundled block contains — this package's sheet, layered,
plus Lini's token palette straight from the compiler, so it cannot go stale:

```js
import { liniCss } from 'astro-lini';
```

[`astro-lini.css`](astro-lini.css) is the same sheet as a plain file, without the palette,
for forking.

## Errors

A block that fails to compile becomes a visible `<pre class="lini-error">` on the page and a
message on stderr; the rest of the build carries on, so one bad diagram never costs you the
site. Warnings — an unroutable link, say — only go to stderr. Diagnostics carry the file
path and the real line number in the Markdown, not the line within the fence:

```
astro-lini: src/pages/guide.md:41:1: warning: impossible (a -> b): no legal route
```

## Beyond Astro

The integration is a thin wrapper. The work is a remark plugin, and it composes into any
unified pipeline — Next, Docusaurus, a bare `unified()` — with no Astro anywhere:

```js
import { remarkLini } from 'astro-lini';

unified()
  .use(remarkParse)
  .use(remarkLini)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw);
```

`satteriLini()` is the same work as a plugin for Astro's own Markdown processor; the
integration picks whichever of the two your site's processor takes, and you should not need
to reach for either by hand.

## Links

Everything about the language itself lives with Lini, not here:

- [lini.rs](https://lini.rs) — language reference and gallery
- [github.com/monfa-red/lini](https://github.com/monfa-red/lini) — the compiler, its `SPEC.md`,
  and `samples/` for every figure family
- [mdbook-lini](https://github.com/monfa-red/mdbook-lini) — the same fences, for an mdBook

## License

MIT
