<div align="center">

# Chester BI

<img src="assets/logo.svg" alt="Chester BI logo" width="88" />

**Self-hosted, open-source BI — describe the analysis, and the AI writes the page**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)

[Report a Bug](https://github.com/izzaldeen98/chester-bi/issues) · [Request a Feature](https://github.com/izzaldeen98/chester-bi/issues)

</div>

---

## Table of Contents

- [What is Chester BI?](#what-is-chester-bi)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Quick Start (Docker — recommended)](#quick-start-docker--recommended)
- [Local Development (without Docker)](#local-development-without-docker)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## What is Chester BI?

Chester BI is a fully self-hosted business intelligence platform you run on your **own
infrastructure**. Connect your databases, model them as [Cube](https://cube.dev/) semantic
cubes, and then **describe the analysis you want in plain language**. An AI agent reads
your semantic model, writes the queries, and generates a complete page — charts, written
analysis, and working filters — that re-queries live data every time you open it.

> No dashboard canvas. No chart configuration. A semantic model and a sentence.

**The semantic layer is the guardrail.** The LLM is handed your compiled Cube schema and
nothing else — no rows, no connection string, no SQL. Every query it writes is validated
against that live schema before it is allowed to run, so a hallucinated field or a measure
used as a dimension is rejected and sent back rather than executed.

Bring your own LLM key (OpenAI, Anthropic, Gemini, DeepSeek, or Qwen). Nothing leaves your
servers except the prompt and your schema.

---

## Features

- **AI Artifacts** — describe an analysis; the agent writes a self-contained page with
  charts, computed narrative and working filter controls
- **Validated queries** — every Cube query the model writes is checked against the live
  schema (real measures, real dimensions, real operators) before execution
- **Always live** — the saved page stores no data; its queries run again on every open
- **Versioned by prompt** — each change request creates a new version you can view,
  compare and restore, with token usage recorded per version
- **Bring your own model** — OpenAI, Anthropic Claude, Google Gemini, DeepSeek and Qwen,
  with API keys encrypted at rest and never returned to the browser
- **Connections** — PostgreSQL, MySQL, BigQuery, Snowflake, or uploaded CSV/Parquet files
- **Model Editor** — define Cube semantic models in a visual, form-based builder or edit
  the underlying YAML directly, side by side
- **Sandboxed by design** — generated pages run in an isolated iframe with no access to
  your session, storage or API
- **Access Control** — per-user permissions across connections, models and artifacts

---

## Screenshots

<div align="center">

<img src="assets/artifact-workspace.png" alt="An AI-generated artifact page showing a written summary, eleven filter controls, five KPI tiles and bar charts by segment, gender and age group, with the prompt history panel floating over it showing versions v1 and v2" width="900" />

_An artifact — narrative, filters, KPIs and charts the agent chose, with the prompt history floating over it. Every prompt saves a version._

<br/>

<img src="assets/artifact-new.png" alt="The new artifact composer: a large prompt field with model, data model and theme pickers beneath it" width="900" />

_Creating one — describe the analysis, pick the semantic model to read and the LLM to use._

<br/>

<img src="assets/artifacts-index.png" alt="The artifacts index listing saved artifacts with their current version and last-updated date" width="900" />

_Saved artifacts, each at its current version._

</div>

---

## Tech Stack

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** + **Uvicorn** — async Python API
- **SQLAlchemy 2** + **PostgreSQL 16** — relational data store
- **[Cube Core](https://github.com/cube-js/cube)** — semantic query engine
- **Redis 7** — query result and schema-context caching
- **OpenAI · Anthropic · Gemini · DeepSeek · Qwen** — pluggable LLM providers over plain
  REST, one adapter each
- **JWT + Bcrypt** — authentication & password hashing
- **Fernet** — encryption for stored connection credentials
- **boto3** — optional AWS S3 file storage

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **ECharts** — charting, both in the app and inside generated artifact pages
- **Tailwind CSS** — utility-first styling
- **React Router v6** — client-side routing
- **Nginx** — production static file server + reverse proxy

---

## Quick Start (Docker — recommended)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- Git

### 1. Clone the repository
```bash
git clone https://github.com/izzaldeen98/chester-bi.git
cd chester-bi
```

### 2. Configure environment variables
```bash
cp .example.env .env
```

Open `.env` and fill in the two **required** secrets:

```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# Generate FERNET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste the output into `.env`. All other values have sensible defaults for local development. See [Environment Variables](#environment-variables) for the full reference.

### 3. Start all services
```bash
docker compose up --build
```

This spins up five containers:

| Container | Role | Host Port |
|---|---|---|
| `chester_frontend` | React SPA (Nginx) | **3000** |
| `chester_backend` | FastAPI API | internal |
| `chester_postgres` | PostgreSQL 16 | 5432 |
| `chester_redis` | Redis 7 cache | internal |
| `chester_cube` | Cube Core | internal (4000) |

### 4. Create your account
Open [http://localhost:3000](http://localhost:3000) and click **Get Started** to register your organisation owner account.

### 5. Add an LLM provider
Go to **AI Providers**, add a provider with your own API key, and pick the model to use.
Then: **Connections** → **Models** → **Artifacts**, and describe what you want to know.

---

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# Make sure PostgreSQL, Redis, and Cube Core are running, then:
uvicorn main:app --reload --port 8989
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts Vite dev server on http://localhost:5173
```

> In dev mode the Vite proxy forwards `/api/*` to `http://localhost:8989`.

---

## Environment Variables

Copy `.example.env` → `.env`. The full annotated reference is in that file. Key variables:

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | **Yes** | JWT signing secret (min 32 chars) |
| `FERNET_KEY` | **Yes** | Fernet key for encrypting DB passwords |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Session lifetime (default: `180`) |
| `LOCAL_DIR` | No | Local file storage path (default: `./.local/`) |
| `AWS_STORAGE_BUCKET_NAME` | No | S3 bucket — enables S3 storage when set |
| `AWS_REGION` | No | AWS region for S3 |
| `AWS_ACCESS_KEY_ID` | No | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | No | AWS secret key |
| `CUBE_URL` | No | Cube Core base URL (default: `http://localhost:4000`) |
| `CUBEJS_API_SECRET` | **Yes** | Shared secret for signing/verifying the JWT sent to Cube |
| `REDIS_HOST` | No | Redis host (default: `host.docker.internal`) |
| `REDIS_PORT` | No | Redis port (default: `6379`) |
| `REDIS_CACHE_TTL` | No | Cache TTL in seconds (default: `1800`) |
| `LLM_TIMEOUT` | No | Seconds to wait for an LLM response (default: `600`). Writing a whole page on a reasoning model takes minutes |
| `LLM_LIST_TIMEOUT` | No | Seconds to wait when listing a provider's models (default: `30`) |
| `ARTIFACT_CHART_CDN` | No | Chart library URL generated pages load; point at a self-hosted copy for air-gapped installs |
| `POSTGRES_USER` | No | DB username (default: `bi_admin`) |
| `POSTGRES_PASSWORD` | No | DB password (default: `changeme`) |
| `POSTGRES_DB` | No | DB name (default: `bi_db`) |

---

## Project Structure

```
chester-bi/
├── backend/                  # FastAPI application
│   ├── ai/                    # LLM adapters, artifact agent, query validation
│   ├── models/               # SQLAlchemy ORM models
│   ├── routes/                # API route handlers
│   ├── schema/                # Pydantic request/response schemas
│   ├── utils/                 # Storage, config, Redis, Cube helpers
│   ├── security/              # JWT, hashing, encryption
│   ├── main.py                # Application entry point
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile
├── frontend/                 # React + TypeScript application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/             # Route-level page components
│   │   └── lib/               # API client, auth, theme utilities
│   ├── nginx.conf            # Production Nginx config
│   ├── package.json
│   └── Dockerfile
├── .example.env              # Annotated environment template
├── docker-compose.yml         # Full-stack orchestration
└── LICENSES/                  # Third-party license attributions
```

---

## API Reference

The FastAPI backend ships with interactive API documentation:

| URL | Tool |
|---|---|
| `http://localhost:8989/docs` | Swagger UI |
| `http://localhost:8989/redoc` | ReDoc |

---

## Contributing

Contributions are welcome and appreciated!

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/my-feature`
3. **Commit** your changes: `git commit -m "feat: add my feature"`
4. **Push** to your branch: `git push origin feat/my-feature`
5. **Open a Pull Request** — describe what you changed and why

Please open an issue first for large changes so we can discuss the approach.

### Code Style
- **Backend**: follow [PEP 8](https://pep8.org/); type-annotate all function signatures
- **Frontend**: ESLint + TypeScript strict mode; Tailwind for styling

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Chester BI uses **Cube Core** under its own license. See [`LICENSES/LICENSE-THIRD-PARTY`](LICENSES/LICENSE-THIRD-PARTY) for third-party attributions.

---

## Acknowledgements

- [Cube](https://cube.dev/) — the semantic query engine powering Chester BI's query layer
- [FastAPI](https://fastapi.tiangolo.com/) — the backend framework
- [ECharts](https://echarts.apache.org/) — charting library

---

<div align="center">

Made with ❤️ by the Chester BI contributors · [⭐ Star this repo](https://github.com/izzaldeen98/chester-bi)

</div>
