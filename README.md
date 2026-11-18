# PRISM Intelligence

PRISM is a local React dashboard for the Rajasthan Royals SupeRR Selector Season 2 Round 1 research. It presents the original D.1 Policy A batting and bowling rankings and connects them to the official numeric player registry, saved expectations, and original match and delivery records.

## Run locally

From this directory, use Node.js 24 or newer:

```sh
npm ci
npm run dev
```

Open the loopback URL printed by Vite. The first launch streams the research exports into an ignored local SQLite index. Rebuild the index with `npm run data` after any source change, then restart the server. Ingestion verifies the official input hashes and counts before serving the index.

For a production build served by the local Node application:

```sh
npm run build
npm start
```

The default address is `http://127.0.0.1:4173`. Set `PORT` to change it. The production server defaults to loopback because the evidence routes serve local organiser data. Keep the Node server available alongside the Vite build.

| Optional environment setting | Purpose |
| --- | --- |
| `PRISM_RESEARCH_ROOT` | Absolute path to a RoyalsIntelligence checkout containing `competition_round1`. Defaults to the app’s containing repository. |
| `PORT` | Production server port, default `4173`. |
| `HOST` | Production bind address, default `127.0.0.1`. |

## Protected Vercel deployment

Run `npm run data` from a checkout with the authorised research exports, then run `npm run stage:vercel` to build the frontend and assemble `.vercel/output`. The generated Node.js function serves the existing API using the compressed evidence index and report. The research exports and generated deployment output stay outside Git.

Link to the intended Vercel project and confirm that Vercel Authentication protects all its deployments. Then run `vercel deploy --prebuilt --prod` from this app directory.

## Verify

```sh
npm run lint
npm test
npm run build
```

The tests cover both-component eligibility, ordering tie-breaks, Frozen V2 classification, source-linked residuals, match queries, the exact final export order and experimental policy isolation. Ingestion also reproduces the full 103-player batting and 80-player bowling eligible orders for verification. The app displays the frozen exported orders and uses the comparator only for validation and explicitly marked eligibility sensitivities.

## Explore

Open the command palette with ⌘K or Ctrl+K to find a page or player. Use the arrow keys and Enter to navigate the results. Use the expand button on a plot to inspect it in a larger view.

- **Overview and rankings** show the twenty frozen selections, the complete eligible orders and the Kishan/Russell and Narine/Bumrah raw-to-shrunken reversals.
- **Player profiles and comparisons** keep the original numeric IDs. Player profiles include separate competition, season and component evidence. Add two to four players in the Comparison Lab and copy the URL to reproduce the view locally.
- **Pressure and matches** expose the exact Frozen V2 rules, actual earlier-date reference surfaces, reconstructed innings and scored delivery rows. Clicking a match or source row shows the archived observations, expected outcomes and residuals.
- **Methodology, reliability and candidate pool** document native units, conditional uncertainty, concentration, the single-match estimator failure and original admission gates. Threshold controls provide an exploratory view based on frozen statistics.
- **Policies & validation, data and findings** show the archived P0–P3 comparisons, the 2025/2026 retrospective outcomes, the source inventory and interpretation limits.

See the [data inventory](DATA_SOURCES.md) for exported metrics, joins, indexing and unavailable states.
