"""Where this install keeps its data.

`sqlite:///./sqlite.db` and `./.local/` are resolved against the working
directory, so starting the backend from `backend/` instead of the repository
root opened a *different*, empty database and a different definitions tree —
silently. The app came up fine and simply had no artifacts, models or
connections in it, and a second sqlite.db appeared next to the first.

So the data root is resolved once, here, by looking for the database that
already exists rather than by trusting the working directory:

  1. CHESTER_DATA_DIR, if set — the explicit answer wins.
  2. The first candidate directory that already contains sqlite.db:
     the working directory, then this file's package root (/app in the
     container, backend/ in a checkout), then its parent (the repo root).
  3. Failing all that, the working directory — a first run, where creating
     the database is the right thing to do.

Docker is unaffected: WORKDIR and the package root are both /app, and the
compose volume mounts .local/cube_data underneath it.
"""
import os
import sqlite3

# .../backend/utils/paths.py -> .../backend
PACKAGE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILENAME = "sqlite.db"


def _resolve_data_root() -> str:
    explicit = os.getenv("CHESTER_DATA_DIR")
    if explicit:
        return os.path.abspath(explicit)

    candidates = [os.getcwd(), PACKAGE_ROOT, os.path.dirname(PACKAGE_ROOT)]
    for candidate in candidates:
        if _has_data(os.path.join(candidate, DB_FILENAME)):
            return candidate
    return os.getcwd()


def _has_data(path: str) -> bool:
    """Whether this file is a real database rather than an empty shell.

    File size is not the test: a run from the wrong directory leaves a
    fully-created, entirely empty schema that is hundreds of kilobytes. An
    install is only usable if it has a user, so that is what is checked.
    """
    if not os.path.isfile(path):
        return False
    try:
        # Read-only, and never create the file by opening it.
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=2)
    except sqlite3.Error:
        return False
    try:
        return bool(conn.execute("SELECT 1 FROM users LIMIT 1").fetchone())
    except sqlite3.Error:
        return False  # no users table yet: not this one
    finally:
        conn.close()


DATA_ROOT = _resolve_data_root()


def data_path(*parts) -> str:
    """A path inside this install's data root."""
    return os.path.join(DATA_ROOT, *parts)


def sqlite_url() -> str:
    return f"sqlite:///{data_path(DB_FILENAME)}"


def local_dir() -> str:
    """Uploads and Cube definition files. LOCAL_DIR still overrides, but a
    relative one is resolved against the data root rather than the working
    directory, so it means the same thing wherever the app was started."""
    configured = os.getenv("LOCAL_DIR")
    if configured:
        return configured if os.path.isabs(configured) else data_path(configured)
    return data_path(".local")
