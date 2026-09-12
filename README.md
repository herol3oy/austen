# Austen

A static library of literary relationship maps, with an on-demand Mermaid generator on the homepage. Astro serves the site at `https://herol3oy.github.io/austen/`. Published maps cover whole books and include spoilers.

The checked-in catalog contains **1,504 Sudalyph entries**. One local command generates and automatically publishes character maps across the catalog. Maps pass Mermaid and SVG checks before publication; manual review is optional. Builds do not fetch catalog data, contact DeepSeek, or download ebooks.

## Development

Use Node 24 and the pinned pnpm version in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm exec astro dev --background
pnpm exec astro dev status
pnpm exec astro dev logs
pnpm exec astro dev stop
```

The development site is at `http://localhost:4321/austen/`. Fonts, Mermaid, Panzoom, and LZ-String are bundled locally. One vanilla JavaScript workspace is used on the homepage, generator, and published-book pages.

| Route | Content |
| --- | --- |
| `/austen/` | Generator hero, eight featured classic maps, and a link to all published maps |
| `/austen/maps/` | Complete searchable cover grid of published maps |
| `/austen/catalog/` | Full catalog cover grid and availability |
| `/austen/books/<slug>/` | Book cover, published SVG, metadata, attribution, spoilers, and editable workspace |
| `/austen/generate/` | OpenLibrary discovery, manual entry, generation, shares, local history |
| `/austen/catalog-index.json` | Metadata and availability, without graph bodies |

## Book covers

Homepage, maps, and catalog cards use local copies of the official Standard Ebooks cover art, with larger artwork on published-book pages. Astro transforms those JPEG sources into sized WebP images with JPEG fallback markup. Grid images load lazily. Missing covers show a title-and-author bookplate. Titles, navigation, and available cover images work without JavaScript.

Populate or update the separate cover metadata cache explicitly:

```sh
GITHUB_TOKEN=github_pat_... pnpm covers:sync          # Import covers for published maps
pnpm covers:sync --id jane-austen/pride-and-prejudice # Limit import to one published edition
pnpm covers:sync --refresh                            # Check source revisions and refresh changed covers
pnpm covers:sync --refresh --id jane-austen/pride-and-prejudice
```

The command authenticates every GitHub API request with `GITHUB_TOKEN` (or `GH_TOKEN`; a token from `gh auth login` is also accepted). It lists public repositories in [the Standard Ebooks GitHub organization](https://github.com/standardebooks), intersects them with `data/published.json`, and downloads `images/cover.jpg` only for those published catalog editions. Source JPEGs are saved under `src/assets/covers/`, where Astro processes them during the build. Existing version-2 manifests are migrated from the former `data/covers/` and `public/covers/` copies on the next non-dry sync. Missing repositories and cover files are recorded without stopping the import. `--dry-run` reports results without writing files.

`data/catalog/covers.json` stores outcome, repository, source revision, local asset paths, hashes, and timestamps keyed by stable catalog edition IDs. Successful entries are validated and reused without downloading again; `--refresh` asks GitHub whether the source revision changed. The importer retries temporary GitHub failures and checkpoints after each entry. It never hotlinks GitHub images in the application.

Commit the manifest and downloaded assets with the frontend changes. Ingestion and map generation do not fetch cover data. Builds read local assets without network access. The importer does not change published map hashes.

## Catalog and map maintenance

Set `DEEPSEEK_API_KEY` in your local `.env` (use `.env.example` as a template if you do not have one). Install the browser once with `pnpm exec puppeteer browsers install chrome`, or set `PUPPETEER_EXECUTABLE_PATH` in `.env` to an existing Chrome executable. Then run:

```sh
pnpm maps:sync --run
```

This processes **every catalog entry**, makes up to five passes over unfinished books, renders valid Mermaid to SVG, and publishes successful maps automatically. There are no per-book review commands or selection requirements. Existing published maps are reused. Saved valid candidates are published, and saved graphs with renderer failures are retried locally before any new provider request.

Optional commands:

```sh
pnpm maps:sync --dry-run                 # List actions and maximum request/token exposure
pnpm maps:sync --run --passes 1          # One pass; rerun later to continue
pnpm maps:sync --run --max-requests 100  # Stop after 100 new provider requests
pnpm maps:sync --run --id jane-austen/pride-and-prejudice
pnpm catalog:ingest                     # Explicitly refresh metadata, independently of generation
```

The sync command defaults to a dry run unless `--run` is supplied. `--passes` accepts 1–5. Books receive at most **five provider attempts total**, including previously recorded attempts; rerunning does not reset this allowance. Each pass visits pending books once. Successful maps and `UNKNOWN` results are skipped. UNKNOWN means no reliable character map is available, including works without a suitable cast. Exhausted failures stay unavailable; changing the prompt does not automatically reset or regenerate saved work.

The provider runs sequentially with the default model `deepseek-flash` (overridable with `DEEPSEEK_MODEL` in `.env`), thinking disabled, temperature 0.2, and a 1,200-token output cap. Each request sends the fixed prompt and title/authors/year, never ebook text. Progress and final totals distinguish newly published maps, previously published maps reused, unknown works, failures, exhausted books, and pending work. Received usage is reported for the current run and across saved attempts. Never put provider secrets in a `PUBLIC_` variable.

Ingestion requests only `https://sudalyph.org/seci/`, with a 30-second timeout, 3 MB limit, and redirects disabled. It extracts definition-term metadata, discards descriptions, preserves full Standard Ebooks edition IDs and persisted slugs, prints a diff, and atomically replaces the snapshot only after validation. Ebook links are attribution links, never ingestion inputs. Years retain the source's wording; their exact semantics are unspecified.

`data/maps/<slug>/vN.json` records metadata, versions, hashes, attempt outcomes, usage and Mermaid source. SVGs are derived locally. `data/published.json` pins revisions and artifact hashes, and distinguishes automatic publication from optional manual review. Existing manual approvals remain supported. Invalid or modified published artifacts fail the static build. The old `selection.json` is used only by the legacy pilot command `maps:generate` when no ID is specified; it does not restrict sync, publication, or browsing.

The browser preflight runs before paid requests. Browser failures stop the command with diagnostics; fix the configuration and rerun the same command. Source/syntax failures receive fresh metadata-only attempts on subsequent passes. Network failures, timeouts, 429 and 5xx responses use bounded backoff and honor `Retry-After` across books and restarts. Credentials, credit, and model configuration errors stop the batch. A maintenance lock prevents overlapping writes and automatically recovers a dead local process's lock. Interrupted requests remain recorded and count toward the allowance because the provider may have processed them.

After the command finishes, refresh `/austen/maps/` or `/austen/catalog/` to open published book pages. `/austen/generate/?book=…` preselects a book in the standalone generator and offers a link to its published map. Commit revisions, SVGs, and publication pointers together to deploy them; sync does not commit or deploy. Read [the map maintenance guide](docs/editorial-review.md) for optional corrections, review, and deliberate retries beyond the automatic allowance. On-demand generation and browser edits remain local.

## Verification

```sh
pnpm check
pnpm test
pnpm exec puppeteer browsers install chrome
pnpm test:browser
pnpm build
pnpm worker:check
```

Puppeteer downloads are explicit and are unnecessary for ordinary static builds. To use an existing browser, set `PUPPETEER_EXECUTABLE_PATH=/path/to/chrome`. `PUPPETEER_CONFIG=/path/to/launch-options.json` optionally supplies Mermaid CLI launch settings. Browser tests need an environment capable of starting Chromium and listening on a local port.

GitHub Actions uses [Chrome supplied by the Ubuntu runner image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md#browsers-and-drivers). The workflow checks its executable, logs its version, and exports `PUPPETEER_EXECUTABLE_PATH` for both Mermaid CLI and the browser tests. CI does not require a `.env` file or a separate Puppeteer browser download. The build job and offline test preload [disable Astro telemetry](https://astro.build/telemetry/#how-do-i-opt-out) with `ASTRO_TELEMETRY_DISABLED=1`, so telemetry cannot trigger the network blocker. The test uses fresh configuration and clears inherited telemetry preferences to verify this behavior on a clean machine.

The CLI and frontend both resolve Mermaid **11.16.0**, enforced by `pnpm-workspace.yaml`. They use `shared/mermaid.config.json` with strict security and HTML labels disabled. A restricted graph grammar and SVG element/reference checks precede embedding. `valid` means these automated checks passed; it does not certify factual accuracy. Automatic maps are labeled AI-generated.

The browser suite builds more than 50 automatically published fixture maps with `fetch` disabled. It verifies static SVGs and covers without JavaScript, responsive cover grids, failed-image bookplates, publication labels, catalog states, unpublished route exclusion, canonical sharing, the old homepage share, malformed history, Undo, stale discovery/generation, invalid drafts, revert/cancel/save, pan/zoom, and full PNG/SVG downloads. Provider calls and cover images are mocked; fixture maps never enter the public data.

## Worker and deployment

The Worker keeps the `austen-api` identity and existing endpoint `https://austen-api.potato0.workers.dev`. Shared provider code accepts both `year` and legacy `publishYear`. Successful HTTP responses retain `{ mermaid, generatedAt }`; unknown works return the distinct `UNKNOWN` code. Inputs and provider output are bounded, provider calls time out, and upstream error bodies are not returned to browsers.

The Worker uses an anonymous IP-based limiter of three requests per minute per Cloudflare location and a `GENERATION_ENABLED` switch. IP sharing can affect unrelated users. CORS is not authentication, and the [Cloudflare limiter is local and eventually consistent](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/); these controls are not a global spending cap. Keep `GENERATION_ENABLED=false` when generation should be unavailable.

Deployment order:

1. Verify `pnpm worker:check` and the tests, then run `pnpm worker:deploy`. If necessary, set the Worker secret with `pnpm exec wrangler secret put DEEPSEEK_API_KEY --config worker/wrangler.jsonc`. This does not make the secret available to local batch scripts.
2. Smoke-test the compatible Worker before the frontend rollout. Set `PUBLIC_API_BASE_URL` only if overriding its public URL.
3. Keep repository **Settings → Pages → Source** set to **GitHub Actions**. This repository is configured for workflow deployment. Branch publication would also start the legacy Jekyll workflow, which cannot build Astro source files.
4. Commit published revisions, SVGs and pointers with the code, then push to `main` (or dispatch `.github/workflows/deploy.yml`). The workflow checks, tests, builds from committed data, and uploads `dist`; it never ingests or generates library data. No provider credentials are needed in GitHub Actions.
5. Verify homepage/catalog, book deep-link refresh, 404, the old encoded share, local history, editor controls and downloads at `/austen/`.

For rollback, restore the previous publication pointers **and their referenced revision files** from Git and rebuild. Restore code with a reviewed revert and redeploy Pages. Use `pnpm exec wrangler rollback --config worker/wrangler.jsonc` for a previous Worker deployment, checking the intended deployment ID first; set the generation switch off if stopping requests is required. Keep historical map revisions so pointer rollback remains possible.

The Astro frontend is deployed through the **Verify and deploy Austen** workflow. Worker deployment is managed separately. The legacy source, CSS, logo, favicon, 404 and MIT license have been transferred. The legacy README example is retained as a compatibility fixture.

## Credits

Code: [MIT](LICENSE).

Jane Austen Inspired Illustrations, CC-BY 4.0, from [Colorconfetti](https://colorconfetti.com/culture-history-environment/jane-austen/jane-austen-inspired-illustrations/). The transferred portrait/logo retains this attribution.

Catalog metadata: [Sudalyph Standard Ebooks index](https://sudalyph.org/seci/), fetched explicitly; linked editions and cover art: [Standard Ebooks](https://standardebooks.org/). [Open Library](https://openlibrary.org/) powers optional generator discovery.

Inter and Cormorant Garamond are distributed through Fontsource under their bundled SIL Open Font License. Mermaid, Panzoom and LZ-String retain their dependency licenses. Shared links use the LZ-String URI bitstream format with a bounded decoder.

Implementation references: [Astro routing](https://docs.astro.build/en/guides/routing/), [browser scripts](https://docs.astro.build/en/guides/client-side-scripts/), [GitHub Pages deployment](https://docs.astro.build/en/guides/deploy/github/), [DeepSeek thinking settings](https://api-docs.deepseek.com/guides/thinking_mode/), and [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli).
