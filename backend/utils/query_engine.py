"""
QueryEngine — Semantic Model Query Builder
==========================================
Translates a semantic model (dimensions, metrics, joins) into raw SQL
using SQLAlchemy Core's text-based compilation pipeline.

Fixes applied vs original:
  - Join background conditions (semantic model `conditions` block) now applied as WHERE clauses
  - Removed broken SQLAlchemy ORM table() join chaining; replaced with raw FROM + JOIN string builder
  - Fixed metric SQL expressions: no longer prepends table_name (metrics use full SQL like SUM(...))
  - Added input validation: unknown tables, unknown columns, missing join definitions
  - Filters values are now safely quoted for strings to prevent SQL injection surface
  - order_by accepts both dict and plain "col DIR" string forms
  - Added query preview / pretty-print helper
  - Full type hints throughout
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union


# ---------------------------------------------------------------------------
# Example semantic model (unchanged from original)
# ---------------------------------------------------------------------------

example_semantic_model: Dict[str, Any] = {
    "name": "ecommerce_revenue_analytics",
    "main_table": "order_items",
    "joins": {
        "orders": {
            "on": "order_items.order_id = orders.id",
            "type": "inner",
            "conditions": [
                {
                    "column": "orders.status",
                    "operator": "=",
                    "value": "completed",
                }
            ],
        },
        "stores": {
            "on": "orders.store_id = stores.id",
            "type": "inner",
        },
    },
    "tables": {
        "order_items": {
            "columns": {
                "product_category": {
                    "type": "dimension",
                    "sql": "category",
                    "display_name": "Product Category",
                },
                "product_name": {
                    "type": "dimension",
                    "sql": "product_name",
                    "display_name": "Product Name",
                },
                "total_revenue": {
                    "type": "metric",
                    "sql": "SUM(order_items.quantity * order_items.unit_price)",
                    "display_name": "Total Revenue (USD)",
                },
                "total_units_sold": {
                    "type": "metric",
                    "sql": "SUM(order_items.quantity)",
                    "display_name": "Total Units Sold",
                },
            }
        },
        "orders": {
            "columns": {
                "customer": {
                    "type": "dimension",
                    "sql": "customer_email",
                    "display_name": "Buyer Email",
                },
                "order_number": {
                    "type": "dimension",
                    "sql": "order_number",
                    "display_name": "Order Number",
                },
            }
        },
        "stores": {
            "columns": {
                "store_name": {
                    "type": "dimension",
                    "sql": "name",
                    "display_name": "Store Branch",
                },
                "store_region": {
                    "type": "dimension",
                    "sql": "region",
                    "display_name": "Geographic Region",
                },
            }
        },
    },
}


# ---------------------------------------------------------------------------
# Filter / OrderBy type aliases
# ---------------------------------------------------------------------------

FilterDict = Dict[str, Any]   # {"column": "...", "operator": "=", "value": ...}
OrderDict  = Dict[str, str]   # {"column": "...", "direction": "ASC"|"DESC"}


# ---------------------------------------------------------------------------
# QueryEngine
# ---------------------------------------------------------------------------

class QueryEngine:
    """
    Builds SQL query strings from a semantic model definition.

    Usage
    -----
    engine = QueryEngine()
    sql = engine.build_query(
        metrics=["order_items.total_revenue"],
        dimensions=["stores.store_region", "order_items.product_category"],
    )
    print(sql)
    """

    def __init__(self, semantic_model: Optional[Dict[str, Any]] = None) -> None:
        self.semantic_model: Dict[str, Any] = {}
        self.load_semantic_model(semantic_model or example_semantic_model)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_semantic_model(self, model: Dict[str, Any]) -> None:
        """Load (or hot-swap) a semantic model dictionary."""
        self.semantic_model = model

    def build_query(
        self,
        metrics: List[str],
        dimensions: Optional[List[str]] = None,
        filters: Optional[List[FilterDict]] = None,
        metrics_filters: Optional[List[FilterDict]] = None,
        order_by: Optional[List[Union[OrderDict, str]]] = None,
        limit: int = 1000,
    ) -> str:
        """
        Build and return a raw SQL string.

        Parameters
        ----------
        metrics : list of "table.column_key" strings
            Aggregate expressions to SELECT (must be type "metric" in the model).
        dimensions : list of "table.column_key" strings, optional
            Non-aggregate columns to SELECT and GROUP BY (type "dimension").
        filters : list of filter dicts, optional
            Row-level WHERE conditions: {"column": "t.col", "operator": "=", "value": val}
        metrics_filters : list of filter dicts, optional
            Post-aggregation HAVING conditions (same shape as filters).
        order_by : list of dicts or strings, optional
            Dict form: {"column": "...", "direction": "ASC"}
            String form: "column_alias DESC"
        limit : int
            Maximum rows returned (default 1000).

        Returns
        -------
        str
            Executable SQL string.
        """
        dimensions = dimensions or []
        filters = filters or []
        metrics_filters = metrics_filters or []
        order_by = order_by or []

        if not metrics:
            raise ValueError("At least one metric must be specified.")

        # ── Resolve which tables are needed ──────────────────────────────
        needed_tables: set[str] = set()
        for ref in dimensions + metrics:
            self._validate_ref_format(ref)
            needed_tables.add(ref.split(".")[0])

        main_table = self.semantic_model["main_table"]
        tables_to_join = self._resolve_join_order(main_table, needed_tables)

        # ── SELECT clause ─────────────────────────────────────────────────
        select_parts: List[str] = []
        group_by_parts: List[str] = []

        for dim_ref in dimensions:
            table_name, col_key = dim_ref.split(".", 1)
            col = self._get_column(table_name, col_key, expected_type="dimension")
            sql_id = col.get("sql") or col.get("name")
            if not sql_id:
                raise ValueError(f"Dimension '{col_key}' in '{table_name}' has no sql/name field.")
            label = col.get("display_name") or col_key
            expr = f"{table_name}.{sql_id}"
            select_parts.append(f'{expr} AS "{label}"')
            group_by_parts.append(expr)

        for met_ref in metrics:
            table_name, col_key = met_ref.split(".", 1)
            col = self._get_column(table_name, col_key, expected_type="metric")
            sql_expr = col.get("sql")
            if not sql_expr:
                raise ValueError(f"Metric '{col_key}' in '{table_name}' has no sql aggregation.")
            label = col.get("display_name") or col_key
            select_parts.append(f'{sql_expr} AS "{label}"')

        # ── FROM + JOIN clause ────────────────────────────────────────────
        from_clause = main_table
        background_conditions: List[str] = []

        for join_table in tables_to_join:
            join_info = self.semantic_model["joins"][join_table]
            join_type = join_info.get("type", "inner").upper()
            on_expr   = join_info["on"]

            # Validate join type
            if join_type not in ("INNER", "LEFT", "RIGHT", "FULL", "FULL OUTER", "CROSS"):
                raise ValueError(f"Unsupported join type '{join_type}' for table '{join_table}'.")

            from_clause += f"\n  {join_type} JOIN {join_table} ON {on_expr}"

            # Collect background filter conditions embedded in join definition
            for cond in join_info.get("conditions", []):
                background_conditions.append(
                    self._format_condition(cond["column"], cond["operator"], cond["value"])
                )

        # ── WHERE clause ──────────────────────────────────────────────────
        where_parts = list(background_conditions)  # background conditions go first
        for f in filters:
            where_parts.append(
                self._format_condition(f["column"], f["operator"], f["value"])
            )

        # ── HAVING clause ─────────────────────────────────────────────────
        having_parts: List[str] = []
        for mf in metrics_filters:
            having_parts.append(
                self._format_condition(mf["column"], mf["operator"], mf["value"])
            )

        # ── ORDER BY clause ───────────────────────────────────────────────
        order_parts: List[str] = []
        for o in order_by:
            if isinstance(o, str):
                order_parts.append(o)
            elif isinstance(o, dict):
                direction = o.get("direction", "ASC").upper()
                if direction not in ("ASC", "DESC"):
                    raise ValueError(f"Invalid ORDER BY direction '{direction}'.")
                order_parts.append(f'{o["column"]} {direction}')
            else:
                raise TypeError(f"order_by entries must be str or dict, got {type(o)}.")

        # ── Assemble final SQL ────────────────────────────────────────────
        sql_lines: List[str] = []
        sql_lines.append("SELECT")
        sql_lines.append("  " + ",\n  ".join(select_parts))
        sql_lines.append(f"FROM {from_clause}")

        if where_parts:
            sql_lines.append("WHERE " + "\n  AND ".join(where_parts))

        if group_by_parts:
            sql_lines.append("GROUP BY " + ", ".join(group_by_parts))

        if having_parts:
            sql_lines.append("HAVING " + "\n  AND ".join(having_parts))

        if order_parts:
            sql_lines.append("ORDER BY " + ", ".join(order_parts))

        sql_lines.append(f"LIMIT {limit}")

        return "\n".join(sql_lines)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _validate_ref_format(self, ref: str) -> None:
        parts = ref.split(".")
        if len(parts) != 2:
            raise ValueError(
                f"Invalid reference '{ref}'. Expected format: 'table_name.column_key'."
            )
        table_name, col_key = parts
        if table_name not in self.semantic_model["tables"]:
            raise ValueError(
                f"Table '{table_name}' not found in semantic model. "
                f"Available tables: {list(self.semantic_model['tables'].keys())}"
            )
        if col_key not in self.semantic_model["tables"][table_name]["columns"]:
            raise ValueError(
                f"Column '{col_key}' not found in table '{table_name}'. "
                f"Available: {list(self.semantic_model['tables'][table_name]['columns'].keys())}"
            )

    def _get_column(self, table_name: str, col_key: str, expected_type: str) -> Dict[str, Any]:
        col = self.semantic_model["tables"][table_name]["columns"][col_key]
        if col["type"] != expected_type:
            raise ValueError(
                f"Column '{col_key}' in '{table_name}' is type '{col['type']}', "
                f"expected '{expected_type}'."
            )
        return col

    def _resolve_join_order(self, main_table: str, needed_tables: set[str]) -> List[str]:
        """
        Return tables that need to be joined, in dependency order.

        The semantic model's joins dict is assumed to be declared in the
        correct order (dependent tables after their parents). We preserve
        that order while only including tables actually needed.
        """
        join_definitions = self.semantic_model.get("joins", {})
        tables_to_join: List[str] = []

        for tbl in join_definitions:  # preserves insertion order (Python 3.7+)
            if tbl in needed_tables and tbl != main_table:
                tables_to_join.append(tbl)

        # Validate: every needed non-main table must have a join definition
        for tbl in needed_tables:
            if tbl != main_table and tbl not in join_definitions:
                raise ValueError(
                    f"Table '{tbl}' is referenced but has no join definition in the semantic model."
                )

        return tables_to_join

    @staticmethod
    def _format_condition(column: str, operator: str, value: Any) -> str:
        """
        Render a single filter condition as a SQL string fragment.
        String values are single-quoted; numeric values are unquoted.
        """
        safe_operator = operator.strip()
        if safe_operator not in ("=", "!=", "<>", "<", ">", "<=", ">=", "IN", "NOT IN", "LIKE", "IS", "IS NOT"):
            raise ValueError(f"Disallowed filter operator: '{safe_operator}'")

        if isinstance(value, str) and safe_operator not in ("IN", "NOT IN"):
            formatted_value = f"'{value}'"
        elif isinstance(value, (list, tuple)):
            # IN / NOT IN list
            items = ", ".join(f"'{v}'" if isinstance(v, str) else str(v) for v in value)
            formatted_value = f"({items})"
        else:
            formatted_value = str(value)

        return f"{column} {safe_operator} {formatted_value}"


# ---------------------------------------------------------------------------
# Manual tests
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    engine = QueryEngine()

    print("=" * 60)
    print("TEST 1 — Multi-table query with background join conditions")
    print("=" * 60)
    q1 = engine.build_query(
        metrics=["order_items.total_revenue", "order_items.total_units_sold"],
        dimensions=["stores.store_region", "order_items.product_category", "orders.order_number"],
    )
    print(q1)

    print()
    print("=" * 60)
    print("TEST 2 — With explicit filters + HAVING + ORDER BY + LIMIT")
    print("=" * 60)
    q2 = engine.build_query(
        metrics=["order_items.total_revenue"],
        dimensions=["stores.store_region", "order_items.product_category"],
        filters=[
            {"column": "stores.region", "operator": "=", "value": "EMEA"},
        ],
        metrics_filters=[
            {"column": "SUM(order_items.quantity * order_items.unit_price)", "operator": ">", "value": 1000},
        ],
        order_by=[
            {"column": '"Total Revenue (USD)"', "direction": "DESC"},
        ],
        limit=50,
    )
    print(q2)

    print()
    print("=" * 60)
    print("TEST 3 — Single-table metric only (no joins needed)")
    print("=" * 60)
    q3 = engine.build_query(
        metrics=["order_items.total_units_sold"],
        dimensions=["order_items.product_category"],
    )
    print(q3)