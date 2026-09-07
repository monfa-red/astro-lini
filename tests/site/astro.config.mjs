// The fixture site: a real Astro build, against the package as it ships.
//
// `astro-lini` is deliberately not in this site's `package.json`. CI installs
// the tarball `npm pack` writes, so what gets exercised here is the published
// shape of the package — its `files` list, its `exports` map and its peer
// metadata — rather than a path into the repo it was built from.
//
// `satteri` is not listed either, and must not be: it is an *optional* peer,
// and the site only ever sees it because Astro's own Markdown processor brings
// it. A day when it stops arriving that way is a day this build fails.

import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';
import lini from 'astro-lini';

export default defineConfig({
	integrations: [lini(), mdx()],
});
