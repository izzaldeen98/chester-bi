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
]


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

