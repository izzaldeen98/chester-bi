# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **technically capable analyst who models and then prompts** — one
person who owns the whole path. They connect a database, define the Cube semantic model
(visually or in YAML), and then ask for analysis in plain language against the model they
just built. Modeling and asking are the same job, done by the same person in one sitting.

They are self-hosting: comfortable with Docker, a `.env` file, and their own LLM API key.
They are not waiting on a data team, and there is no separate "business user" persona to
hand off to — the person who writes the model is the person who reads the answer.

Secondary audience: engineers evaluating the project on GitHub, who judge it from the
README, the screenshots, and how fast they can get from clone to a working page.

## Product Purpose

Chester BI turns a database into analysis you can read, without building a dashboard.

The user connects a data source, models it as Cube semantic definitions, and then
describes what they want to know. An AI agent reads the live semantic model, writes its
own Cube queries, and generates a complete self-contained HTML page — charts, computed
narrative, and working filters — that re-queries live data every time it is opened.

Success is the distance from "I have a database" to "I have a page that answers my
question" collapsing to a model plus a sentence, with no canvas to assemble and no
chart to configure by hand.

## Positioning

**The semantic layer is the guardrail.** Other BI tools bolt a text-to-SQL box onto a
dashboard and hope. Chester's agent never writes SQL, never sees the data, and never
receives database credentials — it is given only the compiled Cube `/meta`. Every query
it writes is validated against that live model (measures must be measures, dimensions
must be dimensions, operators and granularities must be real, results are row-capped)
before it is executed or stored; invalid queries go back to the model with the errors
rather than reaching the engine.

That is the claim a neighboring product cannot truthfully copy without owning a semantic
layer: AI analytics where the model, not the prompt, defines what is answerable.

Supporting, not primary: self-hosted with a bring-your-own LLM key, so no data and no
credentials leave the user's infrastructure.

## Operating Context

The path through the product is linear and each step is a prerequisite for the next:

**Connections** (PostgreSQL, MySQL, BigQuery, Snowflake, or uploaded files) →
**Models** and their Cube definitions, authored in a visual builder or directly in YAML →
**Artifacts**, prompted in natural language against one chosen semantic model.

- **AI Providers** must be configured before any artifact can be created: the user adds a
  provider, pastes their own API key, and picks one model. That choice is made once at
  setup, not on every prompt.
- Artifacts are created in a chat workspace: an empty composer for the first brief, then
  the rendered page with a floating chat over it. Every prompt produces a new version;
  earlier versions stay viewable and restorable.
- Cube Core must be running for anything to work — the semantic model, query validation,
  and every page render all depend on it.
- Deployment is Docker Compose (frontend, backend, Postgres, Redis, Cube), or a local dev
  setup with Vite proxying to Uvicorn.

## Capabilities and Constraints

**Confirmed capabilities**
- Multi-provider LLM support: OpenAI, Anthropic, Google Gemini, DeepSeek, Qwen. Keys are
  Fernet-encrypted at rest and never returned to the browser — only a masked hint.
- Live model discovery per provider, because vendors retire model IDs.
- Two-phase generation: a plan turn writes and validates the Cube queries, a write turn
  emits the page against real column names and sample rows.
- Generated pages run in a `sandbox="allow-scripts"` iframe with no `allow-same-origin`,
  so LLM-authored JavaScript executes on an opaque origin and cannot reach the app's DOM,
  storage, session, or API.
- Per-version snapshots of both markup and query set, with restore.
- Token usage recorded per version and surfaced in the UI.

**Constraints that future work must respect**
- **Artifacts are the only BI surface.** Datasets and the drag-and-drop dashboard canvas
  were deliberately removed; do not reintroduce a chart-config UI or a widget grid.
- Data is fetched server-side and embedded in the page at render. Filters therefore
  operate on data already in the browser and are instant, but can only narrow what was
  fetched. Queries are capped at 5,000 rows.
- The agent composes queries only from the one semantic model the user selects.
- Generation takes minutes on a reasoning model; this is a slow, considered action, not
  an instant one, and the UI must say so.
- No Alembic: schema changes run through `create_all` plus an idempotent `ensure_columns`
  step in `utils/init_database.py`.
- Terminology: **artifact** (the generated page), **semantic model** (the Cube model),
  **definition** (one `.yml` file), **version** (one prompt's result). "Dashboard" and
  "dataset" are retired words and should not reappear in the UI.

**Explicitly undecided**
- Whether artifacts can ever be shared or embedded outside an authenticated session.
- Whether a non-modeling "reader" role is ever introduced.
- Row-level security and embedding are on the roadmap but unbuilt.

## Brand Commitments

- **Name:** Chester BI. Existing logo at `assets/logo.svg` and `assets/logo.png`.
- **Identity color:** an amber-to-gold gradient, currently `#d97706 → #eab308 → #facc15`,
  used on the landing page and as the app accent.
- **License:** MIT, © Izzaldeen Radaideh. Public repository at
  `github.com/izzaldeen98/chester-bi`.
- **Voice in existing copy:** plain, technical, second person, no marketing inflation
  ("Connect your databases", "No code required", "One command starts…").
- The app is themeable light/dark via CSS custom properties (`--bg`, `--text`, `--accent`
  and friends); any new surface must work in both.

## Evidence on Hand

- Real working product with a live local deployment and real data (a logistics semantic
  model: loads, customers, revenue, pieces).
- `README.md` — full setup, tech stack, and environment reference.
- `ROADMAP.md` — shipped and planned features, honestly marked.
- Screenshots in `assets/`: `Dashobards.png`, `Dataset Builder.png`, `Model builder.png`,
  `screenshot-dashboard-filter-browser.png`.

**Absences future work must not fabricate**
- **The README, landing page, and all four screenshots document the removed dashboard and
  dataset features.** They are now factually wrong about the product. No new surface may
  cite them as current, and no artifact screenshot exists yet to replace them.
- There are no users, testimonials, case studies, press mentions, benchmarks, adoption
  numbers, or GitHub star counts to cite. None may be invented.
- There is no pricing, no hosted offering, and no support commitment.

## Product Principles

1. **The model is the contract.** Anything the agent can answer is defined by the semantic
   model, not by the prompt. Features that let a user bypass the model are off-strategy.
2. **Never fake an answer.** A query that returns nothing, a brief the model cannot cover,
   a dropped component — all are reported to the user, never papered over with an empty
   chart or invented content.
3. **Treat generated code as untrusted.** Isolation, not sanitization, is what makes
   running LLM-authored JavaScript acceptable. No change may weaken the sandbox.
4. **One path, no parallel surfaces.** Connections → Models → Artifacts is the product.
   Resist re-adding a second way to build the same thing.
5. **Self-hosted means the user owns everything** — their data, their keys, their
   infrastructure. No telemetry, no phoning home, no vendor dependency beyond the LLM
   provider they chose.

## Accessibility & Inclusion

No product-specific standard has been established. Two structural facts any future work
must handle: the app ships light and dark themes via CSS custom properties, and artifact
pages are authored by an LLM inside an iframe — the generation prompt is the only place
their contrast, semantics, and keyboard behavior can be governed.
