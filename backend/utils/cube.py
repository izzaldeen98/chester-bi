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


def load(token: str, query: dict) -> dict:
    """POST /cubejs-api/v1/load — runs a Cube query, returns its result rows."""
    response = requests.post(
        f"{CUBE_URL}/cubejs-api/v1/load",
        json={"query": query},
        headers=_headers(token),
    )
    if response.status_code != 200:
        raise Exception(f"Failed to query dataset: {response.text}")
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
    response = requests.get(f"{CUBE_URL}/cubejs-api/v1/meta", headers=_headers(token))
    if response.status_code != 200:
        raise Exception(f"Failed to get compiled definition: {response.text}")
    return normalize_meta(response.json())


# Matches only top-level `cubes:` list items (2-space indent) — the exact
# indentation CubeDefinitionWizard.tsx's generateCubeYaml() always emits for
# a cube name, as opposed to the 6-space indent used by nested dimensions/
# measures/joins list entries, which also start with "- name:".
_CUBE_NAME_RE = re.compile(r'^  - name:\s*(.+?)\s*$', re.MULTILINE)


def extract_cube_names(yaml_text: str) -> set:
    """Cube names one definition's .yml file declares. Cube's repositoryFactory
    (see cube_conf/cube.js) compiles every definition file under an account
    into one shared namespace, so GET /meta always returns every cube from
    every definition — this lets a caller filter that account-wide result
    back down to just the cubes a single definition actually owns."""
    return {name.strip('"').strip("'") for name in _CUBE_NAME_RE.findall(yaml_text)}
