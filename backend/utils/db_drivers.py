"""Connection adapters — one place that knows each database dialect.

A dialect used to be described in four places that had to agree: the field
validation in routes/connections.py, the secret-key list and introspection
here, the Cube JWT claim in utils/cube.py, and the driverFactory options in
cube_conf/cube.js. They drifted — the claim only ever carried
host/port/database/user/password, so Snowflake and BigQuery connections were
accepted, tested, and then failed the moment Cube tried to query them.

So each dialect is now one adapter that declares its fields, which of them
are secret, how to reach the database from Python (test + introspection),
and the exact options Cube's own driver takes. Nothing about a dialect is
written anywhere else: the API serves the field list from `FIELDS`, the Cube
claim is `cube_config()` verbatim, and cube.js passes it through untouched.

Cube option names are not guesses — they are the constructor keys of the
drivers in the pinned cubejs/cube image, and they disagree in exactly the
ways that bite: MS SQL wants `server`, not `host`; ClickHouse and Snowflake
want `username`, while Postgres and MySQL want `user`.
"""
import json
import os
from dataclasses import dataclass

from security import decrypt_password


@dataclass(frozen=True)
class Field:
    """One credential the user supplies. `secret` fields are encrypted at
    rest and never returned by the API."""
    name: str
    label: str
    kind: str = "text"        # text | number | password | textarea | boolean
    required: bool = True
    secret: bool = False
    default: object = None
    placeholder: str = ""
    help: str = ""


def _missing(attrs: dict, fields) -> list:
    return [f.label for f in fields if f.required and not attrs.get(f.name)]


class Adapter:
    """A database dialect. Subclasses fill in FIELDS and cube_config()."""
    type: str = ""
    label: str = ""
    cube_type: str = ""       # the driver name Cube knows it by
    FIELDS: list = []

    # ── Declaration ────────────────────────────────────────────────────
    @classmethod
    def secret_keys(cls) -> list:
        return [f.name for f in cls.FIELDS if f.secret]

    @classmethod
    def describe(cls) -> dict:
        """The field list the connection form renders itself from, so adding
        a dialect never means touching the frontend."""
        return {
            "type": cls.type,
            "label": cls.label,
            "fields": [
                {"name": f.name, "label": f.label, "kind": f.kind,
                 "required": f.required, "secret": f.secret,
                 "default": f.default, "placeholder": f.placeholder, "help": f.help}
                for f in cls.FIELDS
            ],
        }

    @classmethod
    def validate(cls, attrs: dict) -> dict:
        """Returns the attributes to store, or raises with what is missing."""
        missing = _missing(attrs, cls.FIELDS)
        if missing:
            raise ValueError(f"Missing required connection attribute(s): {', '.join(missing)}")
        known = {f.name for f in cls.FIELDS}
        return {k: v for k, v in attrs.items() if k in known and v not in (None, "")}

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        """The options Cube's driver for this dialect actually takes."""
        raise NotImplementedError

    # ── Reaching the database from Python ──────────────────────────────
    @classmethod
    def connect(cls, attrs: dict):
        raise NotImplementedError

    @classmethod
    def test(cls, attrs: dict) -> bool:
        conn = cls.connect(attrs)
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchall()
        finally:
            conn.close()
        return True

    @classmethod
    def schemas(cls, attrs: dict) -> list:
        raise NotImplementedError

    @classmethod
    def tables(cls, schema: str, attrs: dict) -> list:
        raise NotImplementedError


class SqlAdapter(Adapter):
    """Anything with a standards-shaped information_schema. Only the schema
    listing and the default schema differ between them."""
    SCHEMA_SQL = ("SELECT schema_name FROM information_schema.schemata "
                  "ORDER BY schema_name")
    COLUMN_SQL = ("SELECT table_name, column_name FROM information_schema.columns "
                  "WHERE table_schema = %s ORDER BY table_name, ordinal_position")
    default_schema_key = "schema"

    @classmethod
    def _query(cls, attrs: dict, sql: str, params=None) -> list:
        conn = cls.connect(attrs)
        try:
            cur = conn.cursor()
            # Passing an empty tuple is not the same as passing nothing: the
            # driver still runs parameter interpolation, and a literal % in
            # the SQL (LIKE 'pg_toast%') is then read as a placeholder.
            if params:
                cur.execute(sql, params)
            else:
                cur.execute(sql)
            return list(cur.fetchall())
        finally:
            conn.close()

    @classmethod
    def default_schema(cls, attrs: dict):
        """What the user chose, else what this dialect calls its default."""
        chosen = attrs.get(cls.default_schema_key)
        if chosen:
            return chosen
        for f in cls.FIELDS:
            if f.name == cls.default_schema_key:
                return f.default
        return None

    @classmethod
    def schemas(cls, attrs: dict) -> list:
        default = cls.default_schema(attrs)
        return [{"name": row[0], "isHidden": False, "isDefault": row[0] == default}
                for row in cls._query(attrs, cls.SCHEMA_SQL)]

    @classmethod
    def tables(cls, schema: str, attrs: dict) -> list:
        return _group_columns(cls._query(attrs, cls.COLUMN_SQL, (schema,)), schema)


def _group_columns(rows, prefix: str) -> list:
    """(table, column) pairs -> the {"resource", "columns"} shape the model
    wizard's field tree reads."""
    tables: dict = {}
    for table_name, column_name in rows:
        tables.setdefault(table_name, []).append(column_name)
    return [{"resource": f"{prefix}.{name}", "columns": [{"name": c} for c in cols]}
            for name, cols in tables.items()]


def _driver(module: str, package: str):
    """Import a dialect's driver on use, not at startup — one missing wheel
    should disable one dialect, with a message saying which, rather than
    stopping the app."""
    try:
        return __import__(module, fromlist=["*"])
    except ImportError as exc:
        raise Exception(
            f"The {package} driver is not installed on the backend "
            f"(pip install {package})."
        ) from exc


# ── PostgreSQL ─────────────────────────────────────────────────────────────

class PostgresAdapter(SqlAdapter):
    type, label, cube_type = "postgres", "PostgreSQL", "postgres"
    FIELDS = [
        Field("host", "Host", placeholder="db.example.com"),
        Field("port", "Port", kind="number", default=5432),
        Field("database", "Database"),
        Field("username", "Username"),
        Field("password", "Password", kind="password", secret=True),
        Field("schema", "Default schema", required=False, default="public"),
        Field("ssl", "Use SSL", kind="boolean", required=False, default=False),
    ]
    # Postgres' own catalogues are not the user's data.
    SCHEMA_SQL = ("SELECT schema_name FROM information_schema.schemata "
                  "WHERE schema_name NOT IN ('pg_catalog', 'information_schema') "
                  "AND schema_name NOT LIKE 'pg_toast%' AND schema_name NOT LIKE 'pg_temp%' "
                  "ORDER BY schema_name")

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        return _prune({
            "host": attrs.get("host"),
            "port": _int(attrs.get("port")),
            "database": attrs.get("database"),
            "user": attrs.get("username"),
            "password": attrs.get("password"),
            "ssl": attrs.get("ssl") or None,
        })

    @classmethod
    def connect(cls, attrs: dict):
        psycopg2 = _driver("psycopg2", "psycopg2-binary")
        return psycopg2.connect(
            host=attrs["host"], port=attrs["port"], dbname=attrs["database"],
            user=attrs["username"], password=attrs["password"],
            sslmode="require" if attrs.get("ssl") else "prefer",
            connect_timeout=10,
        )


# ── MySQL ──────────────────────────────────────────────────────────────────

class MySQLAdapter(SqlAdapter):
    type, label, cube_type = "mysql", "MySQL", "mysql"
    FIELDS = [
        Field("host", "Host"),
        Field("port", "Port", kind="number", default=3306),
        Field("database", "Database"),
        Field("username", "Username"),
        Field("password", "Password", kind="password", secret=True),
        Field("ssl", "Use SSL", kind="boolean", required=False, default=False),
    ]

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        return _prune({
            "host": attrs.get("host"),
            "port": _int(attrs.get("port")),
            "database": attrs.get("database"),
            "user": attrs.get("username"),
            "password": attrs.get("password"),
            "ssl": attrs.get("ssl") or None,
        })

    @classmethod
    def connect(cls, attrs: dict):
        pymysql = _driver("pymysql", "PyMySQL")
        kwargs = dict(host=attrs["host"], port=_int(attrs["port"]), db=attrs["database"],
                      user=attrs["username"], password=attrs["password"], connect_timeout=10)
        if attrs.get("ssl"):
            kwargs["ssl"] = {"ssl": {}}
        return pymysql.connect(**kwargs)

    @classmethod
    def schemas(cls, attrs: dict) -> list:
        # MySQL has no schema layer above "database" — the connection is
        # already scoped to one, so it is the only entry.
        return [{"name": attrs["database"], "isHidden": False, "isDefault": True}]


# ── Microsoft SQL Server ───────────────────────────────────────────────────

class MSSQLAdapter(SqlAdapter):
    type, label, cube_type = "mssql", "SQL Server", "mssql"
    FIELDS = [
        Field("host", "Host"),
        Field("port", "Port", kind="number", default=1433),
        Field("database", "Database"),
        Field("username", "Username"),
        Field("password", "Password", kind="password", secret=True),
        Field("domain", "Domain", required=False, help="For Windows authentication."),
        Field("schema", "Default schema", required=False, default="dbo"),
        Field("encrypt", "Encrypt connection", kind="boolean", required=False, default=True),
        Field("trust_server_certificate", "Trust the server certificate",
              kind="boolean", required=False, default=False,
              help="Needed for a self-signed certificate, which on-premise "
                   "SQL Server commonly has."),
    ]
    SCHEMA_SQL = ("SELECT schema_name FROM information_schema.schemata "
                  "WHERE schema_name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', "
                  "'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin', "
                  "'db_backupoperator', 'db_datareader', 'db_datawriter', "
                  "'db_denydatareader', 'db_denydatawriter') "
                  "ORDER BY schema_name")
    default_schema_key = "schema"

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        # Cube's MSSqlDriver calls the host `server` and nests TLS under
        # `options.encrypt` — the one dialect whose keys do not line up.
        return _prune({
            "server": attrs.get("host"),
            "port": _int(attrs.get("port")),
            "database": attrs.get("database"),
            "user": attrs.get("username"),
            "password": attrs.get("password"),
            "domain": attrs.get("domain"),
            "options": {
                "encrypt": bool(attrs.get("encrypt", True)),
                "trustServerCertificate": bool(attrs.get("trust_server_certificate")),
                "useUTC": True,
            },
        })

    @classmethod
    def connect(cls, attrs: dict):
        # python-tds rather than pymssql: it is pure Python, so a self-hoster
        # does not need FreeTDS present to add a SQL Server connection.
        pytds = _driver("pytds", "python-tds")
        return pytds.connect(
            server=attrs["host"], port=_int(attrs["port"]), database=attrs["database"],
            user=(f"{attrs['domain']}\\{attrs['username']}" if attrs.get("domain")
                  else attrs["username"]),
            password=attrs["password"], login_timeout=10, timeout=30,
        )


# ── ClickHouse ─────────────────────────────────────────────────────────────

class ClickHouseAdapter(Adapter):
    type, label, cube_type = "clickhouse", "ClickHouse", "clickhouse"
    FIELDS = [
        Field("host", "Host"),
        Field("port", "Port", kind="number", default=8123,
              help="The HTTP port — 8123, or 8443 with SSL."),
        Field("database", "Database", default="default"),
        Field("username", "Username", default="default"),
        Field("password", "Password", kind="password", secret=True, required=False),
        Field("ssl", "Use SSL", kind="boolean", required=False, default=False),
    ]

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        # Cube's ClickHouse driver builds its own URL from host/port/protocol
        # and wants `username`, not `user`.
        return _prune({
            "host": attrs.get("host"),
            "port": _int(attrs.get("port")),
            "protocol": "https:" if attrs.get("ssl") else "http:",
            "database": attrs.get("database") or "default",
            "username": attrs.get("username") or "default",
            "password": attrs.get("password") or "",
        })

    @classmethod
    def _client(cls, attrs: dict):
        cc = _driver("clickhouse_connect", "clickhouse-connect")
        return cc.get_client(
            host=attrs["host"], port=_int(attrs["port"]),
            username=attrs.get("username") or "default",
            password=attrs.get("password") or "",
            database=attrs.get("database") or "default",
            secure=bool(attrs.get("ssl")), connect_timeout=10,
        )

    @classmethod
    def test(cls, attrs: dict) -> bool:
        client = cls._client(attrs)
        try:
            client.query("SELECT 1")
        finally:
            client.close()
        return True

    @classmethod
    def schemas(cls, attrs: dict) -> list:
        # ClickHouse's "database" is the namespace a cube's table lives in,
        # so databases are what the wizard lists as schemas.
        client = cls._client(attrs)
        try:
            rows = client.query(
                "SELECT name FROM system.databases "
                "WHERE name NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') "
                "ORDER BY name"
            ).result_rows
        finally:
            client.close()
        default = attrs.get("database") or "default"
        return [{"name": r[0], "isHidden": False, "isDefault": r[0] == default} for r in rows]

    @classmethod
    def tables(cls, schema: str, attrs: dict) -> list:
        client = cls._client(attrs)
        try:
            rows = client.query(
                "SELECT table, name FROM system.columns WHERE database = {db:String} "
                "ORDER BY table, position",
                parameters={"db": schema},
            ).result_rows
        finally:
            client.close()
        return _group_columns(rows, schema)


# ── BigQuery ───────────────────────────────────────────────────────────────

class BigQueryAdapter(Adapter):
    type, label, cube_type = "bigquery", "BigQuery", "bigquery"
    FIELDS = [
        Field("project_id", "Project ID"),
        Field("service_account_json", "Service account key (JSON)",
              kind="textarea", secret=True,
              help="Paste the whole service-account key file."),
        Field("location", "Location", required=False, placeholder="US"),
    ]

    @classmethod
    def _credentials(cls, attrs: dict) -> dict:
        raw = attrs["service_account_json"]
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:
                raise Exception("The service account key is not valid JSON.") from exc
        return raw

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        return _prune({
            "projectId": attrs.get("project_id"),
            "credentials": cls._credentials(attrs),
            "location": attrs.get("location"),
        })

    @classmethod
    def _client(cls, attrs: dict):
        bigquery = _driver("google.cloud.bigquery", "google-cloud-bigquery")
        service_account = _driver("google.oauth2.service_account", "google-auth")
        return bigquery.Client(
            project=attrs["project_id"],
            credentials=service_account.Credentials.from_service_account_info(
                cls._credentials(attrs)),
            location=attrs.get("location") or None,
        )

    @classmethod
    def test(cls, attrs: dict) -> bool:
        list(cls._client(attrs).query("SELECT 1").result())
        return True

    @classmethod
    def schemas(cls, attrs: dict) -> list:
        client = cls._client(attrs)
        return [{"name": d.dataset_id, "isHidden": False, "isDefault": False}
                for d in client.list_datasets()]

    @classmethod
    def tables(cls, schema: str, attrs: dict) -> list:
        client = cls._client(attrs)
        return [
            {"resource": f"{schema}.{t.table_id}",
             "columns": [{"name": f.name} for f in client.get_table(t.reference).schema]}
            for t in client.list_tables(schema)
        ]


# ── Snowflake ──────────────────────────────────────────────────────────────

class SnowflakeAdapter(SqlAdapter):
    type, label, cube_type = "snowflake", "Snowflake", "snowflake"
    FIELDS = [
        Field("account", "Account", required=False, placeholder="ab12345.eu-west-1",
              help="Or give host and port instead."),
        Field("host", "Host", required=False),
        Field("port", "Port", kind="number", required=False),
        Field("warehouse", "Warehouse"),
        Field("database", "Database"),
        Field("schema", "Default schema", required=False),
        Field("role", "Role", required=False),
        Field("username", "Username"),
        Field("password", "Password", kind="password", secret=True, required=False),
        Field("private_key", "Private key (PEM)", kind="textarea", secret=True,
              required=False, help="Use instead of a password for key-pair auth."),
        Field("private_key_passphrase", "Private key passphrase", kind="password",
              secret=True, required=False),
    ]

    @classmethod
    def validate(cls, attrs: dict) -> dict:
        attrs = super().validate(attrs)
        if not attrs.get("account") and not (attrs.get("host") and attrs.get("port")):
            raise ValueError("Missing routing parameter(s): 'account', or both 'host' and 'port'")
        if not attrs.get("password") and not attrs.get("private_key"):
            raise ValueError("Missing credential(s): 'password' or 'private_key'")
        return attrs

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        # Cube's Snowflake driver wants `username`, and spells the key-pair
        # fields privateKey / privateKeyPass.
        return _prune({
            "account": attrs.get("account"),
            "host": attrs.get("host") if not attrs.get("account") else None,
            "port": _int(attrs.get("port")) if not attrs.get("account") else None,
            "warehouse": attrs.get("warehouse"),
            "database": attrs.get("database"),
            "role": attrs.get("role"),
            "username": attrs.get("username"),
            "password": attrs.get("password"),
            "privateKey": attrs.get("private_key"),
            "privateKeyPass": attrs.get("private_key_passphrase"),
        })

    @classmethod
    def connect(cls, attrs: dict):
        connector = _driver("snowflake.connector", "snowflake-connector-python")
        kwargs = {
            "user": attrs["username"],
            "warehouse": attrs.get("warehouse"),
            "database": attrs.get("database"),
            "schema": attrs.get("schema"),
            "role": attrs.get("role"),
        }
        if attrs.get("account"):
            kwargs["account"] = attrs["account"]
        else:
            kwargs["host"], kwargs["port"] = attrs["host"], attrs["port"]
        if attrs.get("password"):
            kwargs["password"] = attrs["password"]
        else:
            kwargs["private_key"] = attrs["private_key"]
            if attrs.get("private_key_passphrase"):
                kwargs["private_key_passphrase"] = attrs["private_key_passphrase"]
        return connector.connect(**{k: v for k, v in kwargs.items() if v is not None})


# ── SQLite ─────────────────────────────────────────────────────────────────

# Cube reads the database file from inside its own container, where the
# shared volume is mounted at a different path than the backend sees it (see
# docker-compose.yml and the same constant in CubeDefinitionWizard.tsx). The
# stored path is Cube's, because that is the one that has to be right at
# query time; the backend translates it back only to run its own connect-test.
CUBE_VOLUME_ROOT = "/cube/definitions_root"
LOCAL_CUBE_DATA = os.path.join(os.getenv("LOCAL_DIR", "./.local/"), "cube_data")


def local_path_for(path: str) -> str:
    """Where the backend can read a file that Cube knows by `path`."""
    if path.startswith(CUBE_VOLUME_ROOT + "/"):
        return os.path.join(LOCAL_CUBE_DATA, path[len(CUBE_VOLUME_ROOT) + 1:])
    # Not under the shared volume: backend and Cube are assumed to see the
    # same filesystem, which is true when neither is containerised.
    return path


class SQLiteAdapter(Adapter):
    type, label, cube_type = "sqlite", "SQLite", "sqlite"
    FIELDS = [
        Field("database", "Database file", placeholder=f"{CUBE_VOLUME_ROOT}/<account>/files/app.db",
              help="The path as the Cube engine sees it. Upload the file, or "
                   "mount it into the Cube container — a path only this "
                   "backend can reach will fail at query time."),
    ]

    @classmethod
    def cube_config(cls, attrs: dict) -> dict:
        return {"database": attrs["database"]}

    @classmethod
    def connect(cls, attrs: dict):
        import sqlite3
        path = local_path_for(attrs["database"])
        if not os.path.isfile(path):
            raise Exception(
                f"No database file at {attrs['database']}"
                + ("" if path == attrs["database"] else f" (looked in {path})")
            )
        # Read-only, and never create the file: a typo should be an error,
        # not a new empty database that then reports no tables.
        return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)

    @classmethod
    def test(cls, attrs: dict) -> bool:
        conn = cls.connect(attrs)
        try:
            conn.execute("SELECT 1").fetchall()
        finally:
            conn.close()
        return True

    @classmethod
    def schemas(cls, attrs: dict) -> list:
        # One file is one namespace, which SQLite itself calls "main".
        cls.test(attrs)
        return [{"name": "main", "isHidden": False, "isDefault": True}]

    @classmethod
    def tables(cls, schema: str, attrs: dict) -> list:
        conn = cls.connect(attrs)
        try:
            names = [r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') "
                "AND name NOT LIKE 'sqlite_%' ORDER BY name")]
            # SQLite has no information_schema; PRAGMA is the only way in.
            return [{"resource": f"{schema}.{name}",
                     "columns": [{"name": row[1]} for row in
                                 conn.execute(f'PRAGMA table_info("{name}")')]}
                    for name in names]
        finally:
            conn.close()


# ── Registry ───────────────────────────────────────────────────────────────

ADAPTERS = {a.type: a for a in (
    PostgresAdapter, MySQLAdapter, MSSQLAdapter, SQLiteAdapter,
    ClickHouseAdapter, BigQueryAdapter, SnowflakeAdapter,
)}

SUPPORTED_TYPES = list(ADAPTERS)


def adapter_for(db_type: str) -> type:
    adapter = ADAPTERS.get(db_type)
    if adapter is None:
        raise Exception(
            f"Unsupported database type '{db_type}'. Supported: {', '.join(SUPPORTED_TYPES)}."
        )
    return adapter


def describe_types() -> list:
    """Every dialect and its fields — what the connection form is built from."""
    return [a.describe() for a in ADAPTERS.values()]


def _int(value):
    return int(value) if value not in (None, "") else None


def _prune(config: dict) -> dict:
    """Drop unset options so Cube falls back to its own defaults rather than
    receiving an explicit null."""
    return {k: v for k, v in config.items() if v is not None}


# ── What the rest of the backend calls ─────────────────────────────────────

def decrypt_secret_values(db_type: str, attrs: dict) -> dict:
    """A copy of `attrs` with its encrypted-at-rest secrets decrypted, ready
    for a real driver or a Cube JWT claim."""
    decrypted = dict(attrs)
    for key in adapter_for(db_type).secret_keys():
        if decrypted.get(key):
            decrypted[key] = decrypt_password(decrypted[key])
    return decrypted


def cube_driver_config(db_type: str, attrs: dict) -> dict:
    """The `{type, ...options}` Cube's driverFactory hands straight to the
    driver. Takes decrypted attributes."""
    adapter = adapter_for(db_type)
    return {"type": adapter.cube_type, **adapter.cube_config(attrs)}


def test_connection(db_type: str, attrs: dict) -> bool:
    """Opens a real connection and runs a trivial query. Raises on failure."""
    return adapter_for(db_type).test(attrs)


def get_schemas(db_type: str, attrs: dict) -> list:
    return adapter_for(db_type).schemas(attrs)


def get_tables(db_type: str, schema: str, attrs: dict) -> list:
    return adapter_for(db_type).tables(schema, attrs)
