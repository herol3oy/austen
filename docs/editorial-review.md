# Generating and maintaining maps

Run `pnpm maps:sync --run` to process the full catalog with up to five passes and automatic publication. Configure `DEEPSEEK_API_KEY` and the local Chrome renderer first, as described in the [README](../README.md#catalog-and-map-maintenance). `pnpm maps:sync --dry-run` lists planned actions without provider calls or changes.

There is no required manual review. A revision becomes `valid` after the Mermaid source, rendered SVG, and artifact hashes pass automated checks. The publication pointer records `mode: "automatic"`, the publication date, and those checks. The site labels it AI-generated. These checks establish renderability and structural safety; they do not verify the book's relationships.

## Resume and failures

Rerun the same command after an interruption. Published maps are reused, saved candidates are rendered locally, and pending books continue. Every recorded provider attempt counts toward a limit of five per book across runs. Local corrections do not count as additional provider attempts. `--passes 1` makes one pass and `--max-requests 100` bounds new requests for that invocation.

UNKNOWN results remain unavailable. Invalid graphs and transient provider failures are retried on later passes. The command stops for provider credentials, credit or model configuration errors, and for local renderer failures. Fix the reported configuration and rerun; a renderer retry does not require another paid generation. A timed-out or interrupted provider request may already have been processed.

The legacy advanced command can deliberately retry UNKNOWN or exhausted generation when desired:

```sh
pnpm maps:generate --run --retry --id jane-austen/pride-and-prejudice
pnpm maps:sync --run --id jane-austen/pride-and-prejudice
```

This explicit retry can spend beyond the automatic five-attempt allowance. `--regenerate --id <id>` creates a replacement even when a valid map already exists. The legacy generation command does not publish replacements; use `maps:publish` with the new revision when you want to replace an existing publication. Ordinary sync keeps the existing published revision.

## Optional corrections and review

To correct a saved graph, write its Mermaid source to a `.mmd` file and create a new revision:

```sh
pnpm maps:revise --id jane-austen/pride-and-prejudice --from v1 --source /path/to/corrected.mmd --editor "Hamed" --notes "Corrected a relationship"
pnpm maps:publish --id jane-austen/pride-and-prejudice --revision v2
```

The original revision is retained. Publication checks the new artifact and records automatic publication without requiring notes or a review flag. Browser edits remain local and do not update these files.

If you choose to review a map, check work identity, characters, relationships, arrow directions, and readability. You can record that review using the existing optional flags:

```sh
pnpm maps:publish --id jane-austen/pride-and-prejudice --revision v2 --reviewed --reviewer "Hamed" --notes "Checked characters and relationship directions"
```

Manual review requires a reviewer and nonempty notes. Existing manual review records remain valid. Republishing the same revision automatically is idempotent and preserves any manual review.

Commit revision JSON, SVG, and publication pointers together. Local sync does not commit, push, or deploy. Static builds consume the saved artifacts without generating maps. To roll back, restore the previous publication pointer and its referenced artifacts from Git, then rebuild.
