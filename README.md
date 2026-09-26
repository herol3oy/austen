# Austen

A static library of literary relationship maps, with an on-demand Mermaid
generator. Astro serves the site at `https://austen.page`; committed catalog,
cover, and map data are the complete library input.

The catalog contains 1,504 books and 596 published maps. The site only exposes
published maps as book pages. Other catalog entries link to the workspace, where
visitors can generate a private, browser-local map.

## Development

Use Node 24 and the pinned pnpm version in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm exec astro dev --background
pnpm exec astro dev status
pnpm exec astro dev logs
pnpm exec astro dev stop
```

The development site is available at `http://localhost:4321/austen/`. Fonts,
Mermaid, Panzoom, and LZ-String are bundled locally.

## Data

`data/catalog/books.json` is a static catalog snapshot. Each entry contains the
metadata required to browse the library and link readers to its Standard Ebooks
edition. `data/catalog/covers.json` maps editions to committed cover assets in
`src/assets/covers/`.

`data/published.json` selects the revision used for each published map.
Published revision JSON and SVG files are stored under `data/maps/`. The build
checks publication pointers, hashes, Mermaid content, and SVG safety before
rendering pages, so a missing or changed published artifact fails the build.
Unpublished and historical map records are retained as data but do not create
routes or affect catalog availability.

## Verification

```sh
pnpm lint
pnpm format:check
pnpm check
pnpm test
pnpm test:browser
pnpm build
pnpm worker:check
```

Browser tests require Chromium. Set `PUPPETEER_EXECUTABLE_PATH` if the browser
is not discovered automatically. GitHub Actions uses the Chrome supplied by its
Ubuntu runner image.

## Generator and deployment

The Worker keeps the `austen-api` identity and accepts the existing generation
endpoint. It validates bounded title, author, and year metadata, rate-limits
requests, and returns Mermaid only; generated visitor maps are never committed
to this repository. Configure `DEEPSEEK_API_KEY` as a Worker secret and keep
`GENERATION_ENABLED=false` whenever public generation should be unavailable.

Deploy the Worker separately with `pnpm worker:deploy`. The Astro frontend is
deployed through the **Verify and deploy Austen** GitHub workflow. It checks,
tests, and builds only the committed application and data.

## Credits

Code: [MIT](LICENSE).

Jane Austen Inspired Illustrations, CC-BY 4.0, from
[Colorconfetti](https://colorconfetti.com/culture-history-environment/jane-austen/jane-austen-inspired-illustrations/).
Inter and Cormorant Garamond are distributed through Fontsource under their
bundled SIL Open Font License. Mermaid, Panzoom, and LZ-String retain their
dependency licenses.
