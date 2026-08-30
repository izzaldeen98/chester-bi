"""
Direct DB-driver connection testing and schema/table introspection.

Replaces the pieces of utils/malloy.py that used to proxy these operations
through Malloy Publisher's REST API — Cube Core has no equivalent admin
endpoints, so the backend now talks to each account's database directly with
the appropriate driver. Schema/table response shapes intentionally match what
Malloy Publisher used to return (`{"name", "isHidden", "isDefault"}` for
schemas, `{"resource", "columns": [{"name"}]}` for tables) so the frontend's
existing normalizers in MalloyModelWizard.tsx keep working unchanged.
"""
import psycopg2
from security import decrypt_password

SUPPORTED_TYPES = ["postgres", "mysql", "snowflake", "bigquery"]

# Which connection_attributes keys hold encrypted secrets, per dialect —
# mirrors ConnectionHandler.encrypt_secret_values in routes/connections.py.
_SECRET_KEYS = {
    "postgres": ["password"],
    "mysql": ["password"],
    "snowflake": ["password", "private_key"],
    "bigquery": ["service_account_json"],
}


def decrypt_secret_values(db_type: str, attrs: dict) -> dict:
    """Returns a copy of `attrs` with its encrypted-at-rest secrets decrypted,
    ready to hand to a real DB driver or embed in a Cube JWT claim."""
    decrypted = dict(attrs)
    for key in _SECRET_KEYS.get(db_type, []):
        if decrypted.get(key):
            decrypted[key] = decrypt_password(decrypted[key])
    return decrypted


def _require(attrs: dict, *keys):
    missing = [k for k in keys if not attrs.get(k)]
    if missing:
        raise Exception(f"Missing required connection attribute(s): {', '.join(missing)}")


def _postgres_connect(attrs: dict):
    _require(attrs, "host", "port", "database", "username", "password")
    return psycopg2.connect(
        host=attrs["host"],
        port=attrs["port"],
        dbname=attrs["database"],
        user=attrs["username"],
        password=attrs["password"],
        connect_timeout=10,
    )


def _mysql_connect(attrs: dict):
    import pymysql
    _require(attrs, "host", "port", "database", "username", "password")
    return pymysql.connect(
        host=attrs["host"],
        port=int(attrs["port"]),
        db=attrs["database"],
        user=attrs["username"],
        password=attrs["password"],
        connect_timeout=10,
    )


def _snowflake_connect(attrs: dict):
    import snowflake.connector
    _require(attrs, "username")
    if not attrs.get("account") and not (attrs.get("host") and attrs.get("port")):
        raise Exception("Missing routing parameter(s): 'account' or both 'host' and 'port'")
    if not attrs.get("password") and not attrs.get("private_key"):
        raise Exception("Missing credential(s): 'password' or 'private_key'")
    kwargs = {
        "user": attrs["username"],
        "warehouse": attrs.get("warehouse"),
        "database": attrs.get("database"),
        "schema": attrs.get("schema"),
    }
    if attrs.get("account"):
        kwargs["account"] = attrs["account"]
    else:
        kwargs["host"] = attrs["host"]
        kwargs["port"] = attrs["port"]
    if attrs.get("password"):
        kwargs["password"] = attrs["password"]
    else:
        kwargs["private_key"] = attrs["private_key"]
        if attrs.get("private_key_passphrase"):
            kwargs["private_key_passphrase"] = attrs["private_key_passphrase"]
    return snowflake.connector.connect(**{k: v for k, v in kwargs.items() if v is not None})


def _bigquery_client(attrs: dict):
    import json as _json
    from google.cloud import bigquery
    from google.oauth2 import service_account
    _require(attrs, "project_id", "service_account_json")
    sa_info = attrs["service_account_json"]
    if isinstance(sa_info, str):
        sa_info = _json.loads(sa_info)
    credentials = service_account.Credentials.from_service_account_info(sa_info)
    return bigquery.Client(project=attrs["project_id"], credentials=credentials)


def test_connection(db_type: str, attrs: dict) -> bool:
    """Opens a real connection and runs a trivial query. Raises on failure."""
    if db_type not in SUPPORTED_TYPES:
        raise Exception(f"Invalid database type: {db_type}")

    if db_type == "postgres":
        conn = _postgres_connect(attrs)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        finally:
            conn.close()
    elif db_type == "mysql":
        conn = _mysql_connect(attrs)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        finally:
            conn.close()
    elif db_type == "snowflake":
        conn = _snowflake_connect(attrs)
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
        finally:
            conn.close()
    elif db_type == "bigquery":
        client = _bigquery_client(attrs)
        list(client.query("SELECT 1").result())

    return True


def get_schemas(db_type: str, attrs: dict) -> list:
    """Lists queryable schemas/namespaces, shaped like Malloy Publisher's schema list."""
    if db_type == "postgres":
        conn = _postgres_connect(attrs)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT schema_name FROM information_schema.schemata "
                    "WHERE schema_name NOT IN ('pg_catalog', 'information_schema') "
                    "AND schema_name NOT LIKE 'pg_toast%' AND schema_name NOT LIKE 'pg_temp%' "
                    "ORDER BY schema_name"
                )
                names = [row[0] for row in cur.fetchall()]
        finally:
            conn.close()
        return [{"name": n, "isHidden": False, "isDefault": n == "public"} for n in names]

    if db_type == "mysql":
        # MySQL has no separate schema layer above "database" — the connection
        # is already scoped to one database, so it's the sole "schema" entry.
        return [{"name": attrs["database"], "isHidden": False, "isDefault": True}]

    if db_type == "snowflake":
        conn = _snowflake_connect(attrs)
        try:
            cur = conn.cursor()
            cur.execute("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name")
            names = [row[0] for row in cur.fetchall()]
        finally:
            conn.close()
        return [{"name": n, "isHidden": False, "isDefault": n == attrs.get("schema")} for n in names]

    if db_type == "bigquery":
        client = _bigquery_client(attrs)
        datasets = [d.dataset_id for d in client.list_datasets()]
        return [{"name": n, "isHidden": False, "isDefault": False} for n in datasets]

    raise Exception(f"Invalid database type: {db_type}")


def get_tables(db_type: str, schema: str, attrs: dict) -> list:
    """Lists tables + columns within one schema, shaped like Malloy Publisher's table list."""
    if db_type == "postgres":
        conn = _postgres_connect(attrs)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT table_name, column_name FROM information_schema.columns "
                    "WHERE table_schema = %s ORDER BY table_name, ordinal_position",
                    (schema,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        prefix = schema
    elif db_type == "mysql":
        conn = _mysql_connect(attrs)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT table_name, column_name FROM information_schema.columns "
                    "WHERE table_schema = %s ORDER BY table_name, ordinal_position",
                    (schema,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        prefix = schema
    elif db_type == "snowflake":
        conn = _snowflake_connect(attrs)
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT table_name, column_name FROM information_schema.columns "
                "WHERE table_schema = %s ORDER BY table_name, ordinal_position",
                (schema,),
            )
            rows = cur.fetchall()
        finally:
            conn.close()
        prefix = schema
    elif db_type == "bigquery":
        client = _bigquery_client(attrs)
        tables_by_name = {}
        for t in client.list_tables(schema):
            table_ref = client.get_table(t.reference)
            tables_by_name[t.table_id] = [f.name for f in table_ref.schema]
        return [
            {"resource": f"{schema}.{name}", "columns": [{"name": c} for c in cols]}
            for name, cols in tables_by_name.items()
        ]
    else:
        raise Exception(f"Invalid database type: {db_type}")

    tables: dict[str, list] = {}
    for table_name, column_name in rows:
        tables.setdefault(table_name, []).append(column_name)
    return [
        {"resource": f"{prefix}.{name}", "columns": [{"name": c} for c in cols]}
        for name, cols in tables.items()
    ]
