"""What a connection adapter must get right.

The failure these guard against is not loud: a dialect whose Cube options are
misnamed is accepted at setup, passes its connect-test (which uses a Python
driver, not Cube), and only breaks when someone opens an artifact. So the
option names are asserted against the keys Cube's own drivers read.

Run: python3 utils/test_adapters.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.db_drivers import (  # noqa: E402
    ADAPTERS,
    SUPPORTED_TYPES,
    adapter_for,
    cube_driver_config,
    decrypt_secret_values,
    describe_types,
)
from security import encrypt_password  # noqa: E402

SAMPLE = {
    "postgres": {"host": "db", "port": 5432, "database": "warehouse",
                 "username": "bi", "password": "s3cret"},
    "mysql": {"host": "db", "port": 3306, "database": "warehouse",
              "username": "bi", "password": "s3cret"},
    "mssql": {"host": "db", "port": 1433, "database": "warehouse",
              "username": "bi", "password": "s3cret"},
    "clickhouse": {"host": "db", "port": 8123, "database": "warehouse",
                   "username": "bi", "password": "s3cret"},
    "bigquery": {"project_id": "proj",
                 "service_account_json": '{"type":"service_account","project_id":"proj"}'},
    "snowflake": {"account": "ab12345.eu-west-1", "warehouse": "WH",
                  "database": "WAREHOUSE", "username": "BI", "password": "s3cret"},
}


def check_every_dialect_is_covered():
    """The six the product claims to support, each fully declared."""
    assert set(SUPPORTED_TYPES) == {
        "postgres", "mysql", "mssql", "clickhouse", "bigquery", "snowflake"
    }, SUPPORTED_TYPES

    for name, adapter in ADAPTERS.items():
        assert adapter.type == name
        assert adapter.label and adapter.cube_type, name
        assert adapter.FIELDS, f"{name} declares no fields"
        assert adapter.secret_keys(), f"{name} declares no secret — nothing would be encrypted"
        # Every dialect must be reachable from Python for the connect-test
        # and the model wizard's field tree — an adapter that inherited the
        # abstract stubs would raise NotImplementedError at runtime.
        for method in ("cube_config", "schemas", "tables"):
            owner = getattr(adapter, method).__qualname__.split(".")[0]
            assert owner != "Adapter", f"{name} never overrode {method}()"


def check_cube_option_names():
    """The option keys are the ones Cube's drivers actually read.

    Taken from the driver constructors in the pinned cubejs/cube image. They
    disagree between dialects, and every disagreement here was a real bug in
    the single Postgres-shaped claim this replaced."""
    pg = cube_driver_config("postgres", SAMPLE["postgres"])
    assert pg == {"type": "postgres", "host": "db", "port": 5432,
                  "database": "warehouse", "user": "bi", "password": "s3cret"}, pg

    my = cube_driver_config("mysql", SAMPLE["mysql"])
    assert my["type"] == "mysql" and my["user"] == "bi" and my["port"] == 3306

    # MS SQL: the host is `server`, and TLS is nested under options.
    ms = cube_driver_config("mssql", SAMPLE["mssql"])
    assert "host" not in ms, "Cube's MSSqlDriver reads `server`, not `host`"
    assert ms["server"] == "db" and ms["user"] == "bi"
    assert ms["options"] == {"encrypt": True, "trustServerCertificate": False,
                             "useUTC": True}, ms["options"]
    assert cube_driver_config("mssql", dict(SAMPLE["mssql"], encrypt=False))["options"]["encrypt"] is False
    # Self-signed certificates are the norm on-premise, so this must reach
    # node-mssql under `options`, not as a top-level key it would ignore.
    trusting = cube_driver_config("mssql", dict(SAMPLE["mssql"], trust_server_certificate=True))
    assert trusting["options"]["trustServerCertificate"] is True
    assert "trust_server_certificate" not in trusting

    # ClickHouse: `username`, and a protocol rather than an ssl flag.
    ch = cube_driver_config("clickhouse", SAMPLE["clickhouse"])
    assert "user" not in ch, "Cube's ClickHouseDriver reads `username`"
    assert ch["username"] == "bi" and ch["protocol"] == "http:"
    assert cube_driver_config("clickhouse", dict(SAMPLE["clickhouse"], ssl=True))["protocol"] == "https:"

    # BigQuery: camelCase, and the key parsed into an object.
    bq = cube_driver_config("bigquery", SAMPLE["bigquery"])
    assert bq["projectId"] == "proj", bq
    assert isinstance(bq["credentials"], dict) and bq["credentials"]["type"] == "service_account"
    assert "service_account_json" not in bq

    # Snowflake: `username`, and camelCase key-pair fields.
    sf = cube_driver_config("snowflake", SAMPLE["snowflake"])
    assert "user" not in sf and sf["username"] == "BI"
    assert sf["account"] == "ab12345.eu-west-1" and "host" not in sf
    keyed = cube_driver_config("snowflake", {
        "host": "sf.internal", "port": 443, "warehouse": "WH", "database": "D",
        "username": "BI", "private_key": "-----BEGIN PRIVATE KEY-----",
        "private_key_passphrase": "pw",
    })
    assert keyed["privateKey"].startswith("-----BEGIN"), keyed
    assert keyed["privateKeyPass"] == "pw"
    assert keyed["host"] == "sf.internal" and "account" not in keyed


def check_no_empty_options_reach_cube():
    """An explicit null overrides Cube's own default; an absent key does not."""
    for name, attrs in SAMPLE.items():
        config = cube_driver_config(name, attrs)
        assert None not in config.values(), f"{name} sends a null option: {config}"
        assert config["type"] == adapter_for(name).cube_type


def check_secrets_are_encrypted_and_recovered():
    """Every secret field round-trips, and nothing else is touched."""
    for name, attrs in SAMPLE.items():
        adapter = adapter_for(name)
        stored = dict(attrs)
        for key in adapter.secret_keys():
            if stored.get(key):
                stored[key] = encrypt_password(stored[key])

        for key in adapter.secret_keys():
            if attrs.get(key):
                assert stored[key] != attrs[key], f"{name}.{key} was not encrypted"

        back = decrypt_secret_values(name, stored)
        assert back == attrs, f"{name} did not round-trip: {back}"


def check_validation_names_what_is_missing():
    for name, attrs in SAMPLE.items():
        adapter = adapter_for(name)
        assert adapter.validate(dict(attrs))

        required = [f for f in adapter.FIELDS if f.required]
        if not required:
            continue
        short = {k: v for k, v in attrs.items() if k != required[0].name}
        try:
            adapter.validate(short)
        except ValueError as exc:
            assert required[0].label in str(exc), (name, str(exc))
        else:
            raise AssertionError(f"{name} accepted attributes missing {required[0].name}")

    # Unknown keys are dropped rather than stored and later handed to a driver.
    cleaned = adapter_for("postgres").validate(dict(SAMPLE["postgres"], nonsense="x"))
    assert "nonsense" not in cleaned

    # Snowflake's either/or rules are real rules, not just field presence.
    sf = adapter_for("snowflake")
    for broken, expect in (
        ({"warehouse": "W", "database": "D", "username": "U", "password": "p"}, "routing"),
        ({"account": "a", "warehouse": "W", "database": "D", "username": "U"}, "credential"),
    ):
        try:
            sf.validate(broken)
        except ValueError as exc:
            assert expect in str(exc).lower(), str(exc)
        else:
            raise AssertionError(f"snowflake accepted {broken}")

    try:
        adapter_for("oracle")
    except Exception as exc:
        assert "oracle" in str(exc) and "postgres" in str(exc), str(exc)
    else:
        raise AssertionError("an unknown dialect was accepted")


def check_form_description_is_complete():
    """The connection form is built from this, so a missing piece is a field
    the user cannot fill in."""
    described = {d["type"]: d for d in describe_types()}
    assert set(described) == set(SUPPORTED_TYPES)

    for name, spec in described.items():
        assert spec["label"], name
        for field in spec["fields"]:
            assert field["name"] and field["label"], (name, field)
            assert field["kind"] in {"text", "number", "password", "textarea", "boolean"}, field
            # A secret must never be rendered as a readable field.
            if field["secret"]:
                assert field["kind"] in {"password", "textarea"}, (name, field)

        # Whatever the sample fills in must be a field the form offers.
        offered = {f["name"] for f in spec["fields"]}
        assert set(SAMPLE[name]) <= offered, (name, set(SAMPLE[name]) - offered)


if __name__ == "__main__":
    for check in (
        check_every_dialect_is_covered,
        check_cube_option_names,
        check_no_empty_options_reach_cube,
        check_secrets_are_encrypted_and_recovered,
        check_validation_names_what_is_missing,
        check_form_description_is_complete,
    ):
        check()
    print("adapters: all checks passed")
