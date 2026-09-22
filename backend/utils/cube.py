"""
Thin client for Cube Core's REST API — replaces utils/malloy.py.

Cube has no admin API for "create a connection"/"create a model" the way
Malloy Publisher did; those become pure filesystem/DB operations here
(writing .yml definition files, tracking rows in Postgres). The only two
things this module actually calls over HTTP are Cube's query-execution
endpoints (/load, /meta), authenticated with a short-lived JWT this module
mints per request. See backend/cube_conf/cube.js for how Cube resolves that
token's claims into a per-account DB connection (driverFactory) and
definition directory (repositoryFactory).
"""
import hashlib
import os
import re
import time

import jwt
import requests
import yaml
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from models.connections import Connection
from utils.db_drivers import decrypt_secret_values

load_dotenv()

CUBE_URL = os.getenv("CUBE_URL", "http://localhost:4000")
CUBEJS_API_SECRET = os.getenv("CUBEJS_API_SECRET")
CUBEJS_ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 300

DEFINITION_ROOT = os.path.join(os.getenv("LOCAL_DIR", "./.local/"), "cube_data")


def definition_dir_for_account(account_public_key) -> str:
    """Filesystem path the backend writes .yml definition files to for one
    account — mirrors what backend/cube_conf/cube.js's repositoryFactory
    resolves for that same account on the Cube-container side of the shared
    volume (see the `cube_data` volume in docker-compose.yml)."""
    return os.path.join(DEFINITION_ROOT, str(account_public_key), "definitions")


def ensure_account_definition_dir(account_public_key) -> str:
    path = definition_dir_for_account(account_public_key)
    os.makedirs(path, exist_ok=True)
    return path


def _definition_version(account_public_key) -> str:
    """A value that changes whenever this account's definition directory
    changes, so contextToAppId (see cube.js) busts Cube's per-tenant schema
    cache after the wizard saves/deletes a definition — without this, Cube
    would keep serving a stale compiled schema for the account's cached appId."""
    path = definition_dir_for_account(account_public_key)
    if not os.path.isdir(path):
        return "0"
    stamp = "|".join(
        f"{name}:{os.path.getmtime(os.path.join(path, name))}"
        for name in sorted(os.listdir(path))
    )
    return hashlib.sha256(stamp.encode()).hexdigest()[:16]


def _connections_claim(db: Session, account_id: int) -> dict:
    """Builds the {connection_name: {type, host, ...}} claim driverFactory
    looks up by Cube's `dataSource` (a cube's `data_source:` property) —
    secrets are decrypted here since Cube itself never touches the DB where
    they're stored encrypted."""
    claim = {}
    connections = (
        db.query(Connection)
        .filter(Connection.account_id == account_id, Connection.is_active == True)
        .all()
    )
    for conn in connections:
        attrs = decrypt_secret_values(conn.type, conn.connection_attributes)
        claim[conn.name] = {
            "type": conn.type,
            "host": attrs.get("host"),
            "port": attrs.get("port"),
            "database": attrs.get("database"),
            "user": attrs.get("username"),
            "password": attrs.get("password"),
        }
    return claim


def mint_token(db: Session, account_public_key, account_id: int) -> str:
    if not CUBEJS_API_SECRET:
        raise Exception(
            "CUBEJS_API_SECRET is not set — add it to your .env (must match the "
            "cube service's CUBEJS_API_SECRET in docker-compose.yml)."
        )
    claims = {
        "accountId": str(account_public_key),
        "definitionVersion": _definition_version(account_public_key),
        "connections": _connections_claim(db, account_id),
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    return jwt.encode(claims, CUBEJS_API_SECRET, algorithm=CUBEJS_ALGORITHM)


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _request(method: str, path: str, token: str, **kwargs):
    """Every call to Cube goes through here so a stopped/unreachable engine reads
    as one clear sentence instead of a requests connection stack — the failure
    mode every caller (definitions, artifacts) hits first
    when the cube service isn't up."""
    try:
        return requests.request(method, f"{CUBE_URL}{path}", headers=_headers(token), **kwargs)
    except requests.exceptions.RequestException as exc:
        raise Exception(
            f"Cube Core is not reachable at {CUBE_URL} — start the `cube` service "
            f"(docker compose up cube) or fix CUBE_URL in your .env. ({type(exc).__name__})"
        ) from exc


def load(token: str, query: dict) -> dict:
    """POST /cubejs-api/v1/load — runs a Cube query, returns its result rows."""
    response = _request("POST", "/cubejs-api/v1/load", token, json={"query": query})
    if response.status_code != 200:
        raise Exception(f"Cube query failed: {response.text}")
    return response.json()


# Cube's own dimension "type" strings -> the field-type "kind" naming the
# frontend's field tree/filter builder already understands (matches Malloy's
# convention, which the UI was originally built against).
_DIMENSION_TYPE_MAP = {
    "string": "string_type",
    "number": "number_type",
    "boolean": "boolean_type",
    "time": "timestamp_type",
}


def _unqualify(cube_name: str, member_name: str) -> str:
    """Cube's /meta reports every member pre-qualified as "CubeName.field" —
    strip that prefix so the UI can display/store a plain field name scoped
    to its source, the same way it did for Malloy fields. CubeQueryBuilder.ts
    re-qualifies with the cube name when it actually builds a query."""
    prefix = f"{cube_name}."
    return member_name[len(prefix):] if member_name.startswith(prefix) else member_name


def normalize_meta(raw: dict) -> dict:
    """Cube's GET /meta returns {"cubes": [{"name", "dimensions": [...],
    "measures": [...]}]} — flattens that into {"sources": [{"name",
    "schema": {"fields": [{"name", "kind", "type"}]}}]}, the shape the
    query-builder UI already expects (see schema/definitions.py)."""
    sources = []
    for cube in raw.get("cubes", []):
        name = cube["name"]
        fields = []
        for dim in cube.get("dimensions", []):
            type_kind = _DIMENSION_TYPE_MAP.get(dim.get("type"), "text")
            fields.append({"name": _unqualify(name, dim["name"]), "kind": "dimension", "type": {"kind": type_kind}})
        for measure in cube.get("measures", []):
            fields.append({"name": _unqualify(name, measure["name"]), "kind": "measure", "type": {"kind": "number_type"}})
        sources.append({"name": name, "schema": {"fields": fields}})
    return {"sources": sources}


def meta(token: str) -> dict:
    """GET /cubejs-api/v1/meta — the compiled cube/dimension/measure metadata
    that powers the query-builder field tree, replacing Malloy's
    get_compiled_model(). Returns the normalize_meta() shape, not Cube's raw
    response."""
    response = _request("GET", "/cubejs-api/v1/meta", token)
    if response.status_code != 200:
        raise Exception(f"Failed to get compiled definition: {response.text}")
    return normalize_meta(response.json())


# Fallback only. The real parse is YAML; this catches a file YAML cannot
# load (a half-saved edit, a Jinja-templated model) so scoping degrades to
# "best effort" instead of "this model has no cubes".
_CUBE_NAME_RE = re.compile(r"^\s*-\s*name:\s*[\"']?([A-Za-z_][\w]*)[\"']?\s*$", re.MULTILINE)


def _names_from_yaml(text: str) -> set:
    """Cube names from a properly parsed definition.

    Cube accepts `cubes:` and `views:` at the document root, in either block
    or flow style, at any indentation, with anchors and comments. Parsing it
    as YAML is the only way to read every model an author might write; the
    previous regex only recognised what this app's own wizard emitted."""
    doc = yaml.safe_load(text)
    if not isinstance(doc, dict):
        return set()
    names = set()
    for key in ("cubes", "views"):
        for entry in doc.get(key) or []:
            if isinstance(entry, dict) and isinstance(entry.get("name"), str):
                names.add(entry["name"])
    return names


def extract_cube_names(source: str) -> set:
    """Cube names one definition declares.

    Cube's repositoryFactory (see cube_conf/cube.js) compiles every definition
    under an account into one shared namespace, so GET /meta always returns
    every cube from every model. This is what lets a caller narrow that
    account-wide result to the cubes a single model owns — which is how an
    artifact is confined to its own semantic model."""
    if not source or not source.strip():
        return set()

    # A JavaScript/TypeScript model defines cubes through cube() calls.
    if "cube(" in source or "view(" in source:
        return set(re.findall(r"""(?:cube|view)\(\s*[\"'`]([A-Za-z_][\w]*)[\"'`]""", source))

    try:
        names = _names_from_yaml(source)
        if names:
            return names
    except yaml.YAMLError:
        pass

    # Unparseable or an unfamiliar shape: recover what we can rather than
    # reporting a model with no cubes, which would lock its artifacts out.
    return set(_CUBE_NAME_RE.findall(source))


def meta_raw(token: str) -> dict:
    """Cube's /meta exactly as Cube returns it — titles, descriptions, types,
    segments and joins included. normalize_meta() throws all of that away to
    match the query-builder's field-tree shape; the LLM grounding needs it,
    so it reads this instead (see ai/grounding.py)."""
    response = _request("GET", "/cubejs-api/v1/meta", token)
    if response.status_code != 200:
        raise Exception(f"Failed to get compiled definition: {response.text}")
    return response.json()
