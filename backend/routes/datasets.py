from fastapi import APIRouter, Depends, HTTPException, status, Query as FastAPIQuery
from schema.datasets import DatasetCreateRequest, DatasetUpdateRequest, DatasetPublicResponse, DatasetDetailedResponse
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session, joinedload
from models.user import User
from models.datasets import Dataset
from security import check_permissions
from typing import List
from uuid import UUID
from models.definitions import Definition
from models.models import Model



router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    dataset: DatasetCreateRequest,
    definition_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "datasets:*", "datasets:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")

    existing_dataset = db.query(Dataset).filter(Dataset.name == dataset.name).first()
    if existing_dataset:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset with this name already exists")

    target_definition = db.query(Definition).filter(Definition.public_key == definition_id).first()
    if not target_definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Definition not found")

    new_dataset = Dataset(
        name=dataset.name,
        description=dataset.description,
        source=dataset.source,
        aggregation_fields=dataset.aggregation_fields,
        group_by_fields=dataset.group_by_fields,
        filters=dataset.filters,
        havings=dataset.havings,
        calculated_fields=dataset.calculated_fields,
        order_by_fields=dataset.order_by_fields,
        limit=dataset.limit,
        cube_query=dataset.cube_query,
        sql_query=dataset.sql_query,
        created_by=current_user.id,
        updated_by=current_user.id,
        definition_id=target_definition.id,
    )
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    return {"message": "Dataset created successfully"}

@router.get("/get", response_model=DatasetDetailedResponse , status_code=status.HTTP_200_OK , response_model_exclude_none=True)
async def get_dataset(
    id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "datasets:*", "datasets:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")

    target_dataset = db.query(Dataset).filter(Dataset.public_key == id).first()
    if not target_dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return target_dataset

@router.put("/update", response_model=DatasetDetailedResponse)
async def update_dataset(
    dataset: DatasetUpdateRequest,
    dataset_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "datasets:*", "datasets:update"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")

    target_dataset = db.query(Dataset).filter(Dataset.public_key == dataset_id).first()
    if not target_dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    account_id = target_dataset.definition.model.account_id
    if account_id != current_user.account_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    definition = db.query(Definition).filter(Definition.public_key == dataset.definition_id).first()
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Definition not found")
    target_dataset.name = dataset.name if dataset.name else target_dataset.name
    target_dataset.description = dataset.description if dataset.description else target_dataset.description
    target_dataset.aggregation_fields = dataset.aggregation_fields if dataset.aggregation_fields else target_dataset.aggregation_fields
    target_dataset.group_by_fields = dataset.group_by_fields if dataset.group_by_fields else target_dataset.group_by_fields
    target_dataset.filters = dataset.filters if dataset.filters else target_dataset.filters
    target_dataset.havings = dataset.havings if dataset.havings else target_dataset.havings
    target_dataset.calculated_fields = dataset.calculated_fields if dataset.calculated_fields else target_dataset.calculated_fields
    target_dataset.order_by_fields = dataset.order_by_fields if dataset.order_by_fields else target_dataset.order_by_fields
    target_dataset.limit = dataset.limit if dataset.limit else target_dataset.limit
    target_dataset.cube_query = dataset.cube_query if dataset.cube_query else target_dataset.cube_query
    target_dataset.sql_query = dataset.sql_query if dataset.sql_query else target_dataset.sql_query
    target_dataset.definition_id = definition.id
    target_dataset.updated_by = current_user.id
    db.commit()
    db.refresh(target_dataset)
    return target_dataset

@router.delete("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "datasets:*", "datasets:delete"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    target_dataset = db.query(Dataset).filter(Dataset.public_key == dataset_id).first()
    if not target_dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    db.delete(target_dataset)
    db.commit()
    return {"message": "Dataset deleted successfully"}

@router.get("/list" , response_model=List[DatasetPublicResponse] , status_code=status.HTTP_200_OK , response_model_exclude_none=True)
async def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "datasets:*", "datasets:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions"
        )

    # --- FIXED: Added explicit joins for filtering ---
    datasets = (
        db.query(Dataset)
        .join(Dataset.definition)
        .join(Definition.model)
        .filter(Model.account_id == current_user.account_id)
        .options(
            joinedload(Dataset.definition)
            .joinedload(Definition.model)
        )
        .all()
    )
    # ------------------------------------------------

    if not datasets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No datasets found for this account"
        )

    return datasets
