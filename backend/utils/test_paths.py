"""The app must open the same data wherever it was started from.

`sqlite:///./sqlite.db` and `./.local/` were resolved against the working
directory, so launching the backend from `backend/` instead of the repository
root opened an empty second database — and the app came up perfectly happily
with no artifacts, models or connections in it. Nothing failed; the data was
just somewhere else.

Run: python3 utils/test_paths.py
"""
import contextlib
import importlib
import os
import sqlite3
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


@contextlib.contextmanager
def started_in(cwd: str, env: dict | None = None):
    """utils.paths as if the app had just started in `cwd` with `env`.

    The environment stays applied for the body: DATA_ROOT is fixed at import,
    but local_dir() reads LOCAL_DIR when it is called.
    """
    old_cwd, old_env = os.getcwd(), dict(os.environ)
    try:
        os.chdir(cwd)
        for key in ("CHESTER_DATA_DIR", "LOCAL_DIR"):
            os.environ.pop(key, None)
        os.environ.update(env or {})
        sys.modules.pop("utils.paths", None)
        yield importlib.import_module("utils.paths")
    finally:
        os.chdir(old_cwd)
        os.environ.clear()
        os.environ.update(old_env)
        sys.modules.pop("utils.paths", None)


def _make_db(path: str, with_user: bool):
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)")
    # Padding, so the empty database is comfortably larger than the real one —
    # file size must not be what decides this.
    conn.execute("CREATE TABLE padding (blob TEXT)")
    conn.executemany("INSERT INTO padding VALUES (?)", [("x" * 4000,)] * 200)
    if with_user:
        conn.execute("INSERT INTO users (username) VALUES ('someone')")
    conn.commit()
    conn.close()


def check_the_populated_database_wins():
    """A schema-only database left by a run from the wrong directory must not
    shadow the real one, however large it is."""
    with tempfile.TemporaryDirectory() as tmp:
        repo = os.path.join(tmp, "repo")
        backend = os.path.join(repo, "backend")
        os.makedirs(backend)

        real = os.path.join(repo, "sqlite.db")
        decoy = os.path.join(backend, "sqlite.db")
        _make_db(real, with_user=True)
        _make_db(decoy, with_user=False)
        assert os.path.getsize(decoy) >= os.path.getsize(real), "decoy must be no smaller"

        with started_in(backend) as paths:
            assert paths._has_data(real) is True, "the populated database was not recognised"
            assert paths._has_data(decoy) is False, "an empty database was treated as real"
            # Resolution order must skip the decoy and land on the real one.
            # PACKAGE_ROOT points at this checkout, so it is aimed at the
            # sandbox to exercise the ordering rather than the real tree.
            paths.PACKAGE_ROOT = backend
            assert paths._resolve_data_root() == repo, paths._resolve_data_root()


def check_a_missing_or_broken_file_is_not_data():
    with tempfile.TemporaryDirectory() as tmp:
        with started_in(tmp) as paths:
            assert paths._has_data(os.path.join(tmp, "nope.db")) is False

            # A file that is not a database must not raise, just not match.
            junk = os.path.join(tmp, "sqlite.db")
            with open(junk, "w") as fh:
                fh.write("this is not a database")
            assert paths._has_data(junk) is False

            # Probing must never bring a database into existence.
            paths._has_data(os.path.join(tmp, "created.db"))
            assert not os.path.exists(os.path.join(tmp, "created.db"))


def check_explicit_data_dir_wins():
    with tempfile.TemporaryDirectory() as tmp:
        with started_in(ROOT, {"CHESTER_DATA_DIR": tmp}) as paths:
            assert paths.DATA_ROOT == os.path.abspath(tmp), paths.DATA_ROOT
            assert paths.sqlite_url() == f"sqlite:///{os.path.join(tmp, 'sqlite.db')}"


def check_this_install_resolves_the_same_from_any_directory():
    """The real check, against this checkout: three starting directories, one
    database."""
    resolved = set()
    for start in (ROOT, os.path.dirname(ROOT), tempfile.gettempdir()):
        with started_in(start) as paths:
            resolved.add(paths.sqlite_url())
    assert len(resolved) == 1, f"the working directory still decides: {resolved}"

    # And every data path is absolute, so nothing downstream re-resolves it.
    with started_in(ROOT) as paths:
        assert os.path.isabs(paths.DATA_ROOT)
        assert os.path.isabs(paths.local_dir())
        assert paths.sqlite_url().startswith("sqlite:////"), paths.sqlite_url()


def check_local_dir_follows_the_data_root():
    """Uploads and Cube definitions must land beside the database, not beside
    whatever directory the process happened to start in."""
    with tempfile.TemporaryDirectory() as tmp:
        with started_in(ROOT, {"CHESTER_DATA_DIR": tmp, "LOCAL_DIR": "./.local/"}) as paths:
            assert os.path.isabs(paths.local_dir())
            assert os.path.normpath(paths.local_dir()) == os.path.join(tmp, ".local"), \
                paths.local_dir()

        # An absolute LOCAL_DIR is still taken literally.
        with started_in(ROOT, {"CHESTER_DATA_DIR": tmp, "LOCAL_DIR": "/var/chester"}) as paths:
            assert paths.local_dir() == "/var/chester"


if __name__ == "__main__":
    for check in (
        check_the_populated_database_wins,
        check_a_missing_or_broken_file_is_not_data,
        check_explicit_data_dir_wins,
        check_this_install_resolves_the_same_from_any_directory,
        check_local_dir_follows_the_data_root,
    ):
        check()
    print("paths: all checks passed")
