import json
from io import BytesIO
from pathlib import Path

from sqlalchemy.orm import Session

from models import Account, Dashboard, File, Package, Query, SemanticModel
from utils.config_files import storage
from utils.malloy import Malloy

EXAMPLES_DIR = Path(__file__).resolve().parents[2] / "examples"

EXAMPLES = {
    "ecommerce": {
        "data": {
            "path": EXAMPLES_DIR / "ecommerce" / "ecommerce_orders_dataset.csv",
            "name": "ecommerce_orders_dataset",
            "extension": "csv",
            "file_name": "ecommerce_orders_dataset.csv",
            "description": "Ecommerce orders dataset",
        },
        "model": {
            "path": EXAMPLES_DIR / "ecommerce" / "ecommerce.malloy",
            "name": "ecommerce_model",
            "description": "Ecommerce model",
        },
        "publisher": EXAMPLES_DIR / "ecommerce" / "publisher.json",
        "queries": EXAMPLES_DIR / "ecommerce" / "queries.json",
        "dashboard": EXAMPLES_DIR / "ecommerce" / "dashboard.json",
    },
}


async def _load_data_file(account: Account, user_id: int, data: dict, db: Session) -> File:
    content = data["path"].read_bytes()
    folder = f"publisher_data/{account.public_key}/files"
    location = await storage.upload_file(BytesIO(content), folder, data["file_name"])
    file_row = File(
        name=data["name"],
        extension=data["extension"],
        file_name=data["file_name"],
        file_size=len(content),
        description=data["description"],
        path=location,
        account_id=account.id,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(file_row)
    db.flush()
    return file_row


def _rewrite_dashboard_refs(dashboard: dict, query_ids: dict, model: SemanticModel, package: Package) -> dict:
    for element in dashboard.get("elements", []):
        meta = element.get("meta", {})
        query_name = meta.get("query")
        if query_name in query_ids:
            meta["queryId"] = str(query_ids[query_name])
        for mapping in meta.get("filterRule", {}).get("mappings", []):
            mapping["modelId"] = str(model.public_key)
            mapping["modelName"] = model.name
            mapping["packageId"] = str(package.public_key)
            mapping["packageName"] = package.name
    return dashboard


async def _load_example(account: Account, user_id: int, example: dict, malloy: Malloy, db: Session) -> None:
    await _load_data_file(account, user_id, example["data"], db)

    publisher = json.loads(example["publisher"].read_text())
    package_name = publisher["name"]
    package_folder = f"publisher_data/{account.public_key}/{package_name}"
    location = await storage.upload_file(
        BytesIO(json.dumps(publisher).encode("utf-8")), package_folder, "publisher.json"
    )
    package_row = Package(
        name=package_name,
        location=location,
        description=publisher.get("description"),
        account_id=account.id,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(package_row)
    db.flush()
    malloy.create_package(
        name=package_name,
        description=package_row.description,
        location=f"/publisher/{package_folder}",
    )

    model_path = example["model"]["path"]
    await storage.upload_file(BytesIO(model_path.read_bytes()), package_folder, model_path.name)
    model_row = SemanticModel(
        name=example["model"]["name"],
        description=example["model"]["description"],
        file_name=model_path.name,
        file_path=package_folder,
        package_id=package_row.id,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(model_row)
    db.flush()

    queries = json.loads(example["queries"].read_text())
    query_ids = {}
    for query in queries:
        query_row = Query(
            name=query["name"],
            description=query["description"],
            source=query["source"],
            aggregation_fields=json.loads(query["aggregation_fields"]),
            group_by_fields=json.loads(query["group_by_fields"]),
            filters=json.loads(query["filters"]),
            havings=json.loads(query["havings"]),
            calculated_fields=json.loads(query["calculated_fields"]),
            order_by_fields=json.loads(query["order_by_fields"]),
            limit=query["limit"],
            malloy_query=query["malloy_query"],
            sql_query=query["sql_query"],
            semantic_model_id=model_row.id,
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(query_row)
        db.flush()
        query_ids[query["name"]] = query_row.public_key

    dashboard = json.loads(example["dashboard"].read_text())
    dashboard = _rewrite_dashboard_refs(dashboard, query_ids, model_row, package_row)
    dashboard_folder = f"publisher_data/{account.public_key}/dashboards"
    dashboard_row = Dashboard(
        name=dashboard["name"],
        description=dashboard.get("description"),
        config_file=dashboard_folder,
        account_id=account.id,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(dashboard_row)
    db.flush()
    await storage.upload_file(
        BytesIO(json.dumps(dashboard).encode("utf-8")),
        dashboard_folder,
        f"{dashboard_row.public_key}.json",
    )


async def load_account(account_id: int, user_id: int, examples: list, db: Session) -> None:
    if not examples:
        return
    account = db.query(Account).filter(Account.id == account_id).first()
    malloy = Malloy(envid=account.public_key)
    for example_name in examples:
        example = EXAMPLES.get(example_name)
        if not example:
            print(f"Skipping unknown example: {example_name}")
            continue
        await _load_example(account, user_id, example, malloy, db)


def _self_check() -> None:
    for name, example in EXAMPLES.items():
        assert example["data"]["path"].exists(), f"missing data file for {name}"
        assert example["model"]["path"].exists(), f"missing model file for {name}"
        assert example["publisher"].exists(), f"missing publisher.json for {name}"
        queries = json.loads(example["queries"].read_text())
        dashboard = json.loads(example["dashboard"].read_text())
        query_names = {query["name"] for query in queries}
        referenced = {
            element["meta"]["query"]
            for element in dashboard["elements"]
            if "query" in element.get("meta", {})
        }
        missing = referenced - query_names
        assert not missing, f"{name}: dashboard references unknown queries: {missing}"
    print("load_examples self-check passed")


if __name__ == "__main__":
    _self_check()
