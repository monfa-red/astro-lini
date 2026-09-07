# A page with a bad block

Plain Markdown, on Astro's own processor, so the default `.md` route is built
too and not only the MDX one.

A block that draws.

```lini
{ gap: 90 }

|box#one| "one" { fill: --amber-wash; stroke: --amber-deep }
|box#two| "two" { fill: --lime-wash; stroke: --lime-deep }
one -> two "and then"
```

A block that does not compile. It must cost us the figure and nothing else: an
error box on the page, a message on stderr, and a build that still finishes.

```lini
|box| { fill:
```

This page survived its bad block.
