from sqlalchemy.orm import Session

# The "ecommerce" example fixture (examples/ecommerce/*) was authored entirely
# in Malloy — a .malloy model and hand-written malloy_query strings — neither
# of which has a mechanical Cube equivalent. Per the Malloy-to-Cube migration
# decision to treat existing/example Malloy query text as dev fixture data
# (not migrated), the fixture is dropped rather than rewritten. `examples`
# stays an opt-in, empty-by-default list (see schema/account.py), so this is
# a no-op for the normal signup path.
EXAMPLES = {}


async def load_account(account_id: int, user_id: int, examples: list, db: Session) -> None:
    for example_name in examples or []:
        print(f"Skipping example \"{example_name}\" — Malloy example fixtures were removed in the Cube migration.")
