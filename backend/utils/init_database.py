import os 
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker , declarative_base

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")


DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine_url = ""

if DB_HOST and DB_PORT and DB_NAME and DB_USER and DB_PASSWORD:
    engine_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    connect_args = {}
else:
    engine_url = "sqlite:///./sqlite.db"
    connect_args = {"check_same_thread": False}


engine = create_engine(engine_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


# ponytail: Base.metadata.create_all() creates missing TABLES but never adds a
# column to a table that already exists, and this project has no Alembic — so a
# new column on an existing model silently breaks every SELECT ("no such column").
# This closes that one gap idempotently on both SQLite and Postgres. Replace it
# with Alembic the first time a change needs more than ADD COLUMN.
# (table, column, DDL type, value to backfill into existing rows or None)
_ADDED_COLUMNS = [
    ("ai_providers", "default_model", "VARCHAR", None),
    ("artifacts", "current_version", "INTEGER", "1"),
    ("artifacts", "queries", "JSON", "'[]'"),
    ("artifacts", "spec", "JSON", None),
]


def retire_legacy_queries_table():
    """Step aside from the pre-Cube `queries` table.

    An install from before the Cube migration may still carry a `queries`
    table keyed on `semantic_model_id`, a column — and a concept — that no
    longer exists. Saved queries reuse the name, and create_all will not
    reshape a table that is already there, so every read fails on a missing
    column until this runs.

    Nothing is deleted: an empty legacy table is dropped, and one with rows is
    renamed aside so its data is still there to look at. Must run before
    create_all, which then creates the current table.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "queries" not in set(inspector.get_table_names()):
        return

    columns = {c["name"] for c in inspector.get_columns("queries")}
    if "semantic_model_id" not in columns:
        return  # already the current table

    with engine.begin() as conn:
        rows = conn.execute(text("SELECT COUNT(*) FROM queries")).scalar() or 0
        if rows:
            conn.execute(text("ALTER TABLE queries RENAME TO queries_pre_cube"))
        else:
            conn.execute(text("DROP TABLE queries"))


def ensure_columns():
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl_type, backfill in _ADDED_COLUMNS:
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
            # Rows that predate the column keep NULL, which fails a non-optional
            # response field — backfill every time, it is idempotent and cheap.
            if backfill is not None:
                conn.execute(
                    text(f"UPDATE {table} SET {column} = {backfill} WHERE {column} IS NULL")
                )

