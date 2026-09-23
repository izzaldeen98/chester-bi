"""Saved queries must stay out of the AI's reach.

The rule is easy to state and easy to break by accident: a saved query is the
author's own working material, so nothing the LLM sees may be derived from
it. This asserts that structurally — by what the AI code is allowed to
import and by what actually reaches a provider — rather than trusting that
nobody will one day add "and here are the queries you already have" to the
grounding because it seems helpful.

Run: python3 utils/test_queries.py
"""
import ast
import os
import pathlib
import sys

ROOT = pathlib.Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, str(ROOT))

# Everything that builds or sends a prompt, plus the routes that drive them.
AI_SURFACE = sorted(ROOT.glob("ai/*.py")) + [ROOT / "routes/ai.py", ROOT / "routes/artifacts.py"]

# How a saved query could be referred to.
QUERY_NAMES = {"SavedQuery", "models.query"}
QUERY_TABLE = "queries"


def _imports(path: pathlib.Path) -> set:
    """Every module and name this file imports."""
    tree = ast.parse(path.read_text())
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            found.add(module)
            found.update(f"{module}.{a.name}" for a in node.names)
            found.update(a.name for a in node.names)
    return found


def check_ai_never_imports_saved_queries():
    """The structural guarantee: the AI code cannot reach the table."""
    assert AI_SURFACE, "found no AI modules to check — the glob is wrong"

    for path in AI_SURFACE:
        assert path.exists(), path
        imported = _imports(path)
        leaked = {name for name in imported
                  if name in QUERY_NAMES or name.startswith("models.query")}
        assert not leaked, (
            f"{path.relative_to(ROOT)} imports {sorted(leaked)} — saved queries "
            f"must not be reachable from the AI path"
        )

        # Also catch a string reference, e.g. a raw SQL read of the table.
        source = path.read_text()
        assert "SavedQuery" not in source, f"{path.relative_to(ROOT)} names SavedQuery"
        assert 'FROM queries' not in source and 'from queries' not in source.lower().replace(
            "from queries import", ""), f"{path.relative_to(ROOT)} reads the queries table"


def check_grounding_comes_only_from_cube():
    """What the model is actually given is the compiled semantic model.

    If grounding ever gained another source, this is where it would show up:
    the prompt is built from Cube's /meta and the palettes, nothing else.
    """
    from ai import grounding

    source = pathlib.Path(grounding.__file__).read_text()
    imported = _imports(pathlib.Path(grounding.__file__))
    # It may read Cube and the cache. It may not read the app's own tables.
    model_imports = {name for name in imported if name.startswith("models")}
    assert not model_imports, f"grounding reads app tables: {sorted(model_imports)}"
    assert "meta_raw" in source, "grounding no longer reads Cube's compiled meta"


def check_prompt_payload_carries_no_saved_query():
    """End to end on the real prompt: build one and read what it contains.

    The import check would miss a query reaching the model by being handed in
    as an argument, so this drives the actual grounding function with a stub
    Cube and asserts on the finished text."""
    from ai import grounding

    meta = {"cubes": [{
        "name": "orders",
        "title": "Orders",
        "measures": [{"name": "orders.total", "title": "Total revenue", "type": "number"}],
        "dimensions": [{"name": "orders.region", "title": "Region", "type": "string"}],
        "segments": [],
    }]}
    original_meta, original_token = grounding.meta_raw, grounding.mint_token
    grounding.meta_raw = lambda _token: meta
    grounding.mint_token = lambda *a, **k: "stub"
    try:
        # A key that cannot collide with a cached real one.
        text, members = grounding.cube_grounding(None, "test-account-isolation", 0)
    finally:
        grounding.meta_raw, grounding.mint_token = original_meta, original_token

    assert "orders.total" in text, "the semantic model must reach the prompt"
    assert members["measures"] == {"orders.total"}, members

    # Nothing a person saved is in there, because nothing put it there.
    for trace in ("SavedQuery", "saved quer", "aggregation_fields", "limit_enabled"):
        assert trace.lower() not in text.lower(), f"prompt mentions {trace}"


def check_every_lookup_is_account_scoped():
    """A query belongs to an account, and is only ever found through it.

    The datasets this replaces resolved by public_key alone, so one account
    could read or delete another's rows by id."""
    source = (ROOT / "routes/queries.py").read_text()
    tree = ast.parse(source)

    handlers = [n for n in ast.walk(tree)
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                and not n.name.startswith("_")]
    assert len(handlers) == 5, [h.name for h in handlers]

    for handler in handlers:
        body = ast.get_source_segment(source, handler)
        if handler.name == "list_queries":
            assert "Model.account_id == current_user.account_id" in body, handler.name
        else:
            # Every other handler resolves its row through the scoped helper.
            assert "_owned_query" in body or "_owned_definition" in body, handler.name
        assert "_require(" in body, f"{handler.name} checks no permission"

    # The helper is what makes that safe, so it must carry the account join.
    helper = source[source.index("def _owned_query"):source.index("def _owned_definition")]
    assert "Model.account_id == current_user.account_id" in helper


if __name__ == "__main__":
    for check in (
        check_ai_never_imports_saved_queries,
        check_grounding_comes_only_from_cube,
        check_prompt_payload_carries_no_saved_query,
        check_every_lookup_is_account_scoped,
    ):
        check()
    print("queries: all checks passed")
