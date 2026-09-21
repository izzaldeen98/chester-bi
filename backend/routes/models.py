from fastapi import APIRouter, Depends, HTTPException, status , Form
from schema.models import ModelCreate, ModelResponse , ModelUpdate
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session, joinedload
from models.user import User
from models.models import Model
from security import check_permissions
from utils.config_files import storage
from io import BytesIO
import json
from typing import List
from uuid import UUID
from models.definitions import Definition
from utils.cube import ensure_account_definition_dir


router = APIRouter(prefix="/api/v1/models" , tags=["models"])



@router.post("/create", status_code=status.HTTP_201_CREATED )
async def create_model(
    # 1. FIX: Changed to Form fields so it cleanly accepts 'multipart/form-data'
    name: str = Form(...),
    description: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 2. Permission Check
    permissions = ["*", "models:*", "models:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # 3. Multi-Tenant Uniqueness Check
    existing_model = (
        db.query(Model)
        .filter(
            Model.name == name,
            Model.account_id == current_user.account_id
        )
        .first()
    )
    if existing_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model with this name already exists",
        )

    # 4. CRITICAL FIX: Safe Relationship Retrieval
    # Accessing current_user.account.public_key inside an active db session context
    try:
        account_public_key = str(current_user.account.public_key)
    except AttributeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account metadata configuration is missing."
        )

    # Model manifests live in their own "models" folder, deliberately
    # outside the account's Cube definition directory (cube_data/{account}/definitions/)
    # — Cube's repositoryFactory (see backend/cube_conf/cube.js) only expects
    # .yml/.js cube definitions there, so model metadata JSON stays separate.
    model_folder = f"cube_data/{account_public_key}/models"
    model_content = {
        "name": name,
        "description": description,
        "version": "1.0.0",
    }

    # 5. Storage Upload
    try:
        location = await storage.upload_file(
            file=BytesIO(json.dumps(model_content).encode("utf-8")),
            file_name=f"{name}.json",
            path=model_folder,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload model: {str(e)}",
        )

    # 6. Database Commit wrapped in a try/except for transactional safety
    try:
        new_model = Model(
            name=name,
            location=location,
            description=description,
            account_id=current_user.account_id,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(new_model)
        db.commit()
    except Exception as db_err:
        db.rollback()
        # Edge case: If DB fails, you'd ideally trigger a background task to delete the orphan storage file
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model storage succeeded, but database tracking failed. , {db_err}"
        )

    return {"message": "Model created successfully"}


@router.delete("/delete", status_code=status.HTTP_200_OK)
async def delete_model(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "models:*", "models:delete"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )
    model = db.query(Model).filter(Model.public_key == model_id, Model.account_id == current_user.account_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found",
        )

    # Every definition must go first — definitions.model_id has no ON DELETE
    # CASCADE, so deleting the model row first would fail (Postgres) or
    # leave orphaned rows behind (SQLite).
    definitions = db.query(Definition).filter(Definition.model_id == model.id).all()
    for definition in definitions:
        await storage.delete_file(definition.file_path, definition.file_name)
        db.delete(definition)

    try:
        account_public_key = str(current_user.account.public_key)
        model_folder = f"cube_data/{account_public_key}/models"
        await storage.delete_file(model_folder, f"{model.name}.json")
    except Exception:
        pass  # storage cleanup is best-effort — the DB row is the source of truth

    db.delete(model)
    db.commit()
    return {"message": "Model deleted successfully"}


@router.get("/list", response_model=List[ModelResponse])
def list_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "models:*", "models:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    models = db.query(Model).filter(Model.account_id == current_user.account_id).all()
    return models

@router.get("/list-with-definitions")
def list_models_with_definitions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "models:*", "models:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # 1. Fetch models and eagerly load their definitions in ONE query
    models = (
        db.query(Model)
        .options(joinedload(Model.definitions))  # Assumes a relationship named 'definitions' on Model
        .filter(Model.account_id == current_user.account_id)
        .all()
    )

    # 2. Build the tree structure
    output = []
    for model in models:
        output.append({
            "id": str(model.public_key),
            "name": model.name,
            "definitions": [
                {
                    "id": str(definition.public_key),
                    "name": definition.name,
                    "file_name": definition.file_name,
                }
                for definition in model.definitions
            ]
        })

    return output


@router.get("/get", response_model=ModelResponse)
def get_model(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "models:*", "models:get"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    model = db.query(Model).filter(Model.public_key == model_id, Model.account_id == current_user.account_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found",
        )
    return model


@router.get("/list-files")
def list_definition_files(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "models:*", "models:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    model = db.query(Model).filter(Model.public_key == model_id, Model.account_id == current_user.account_id).first()

    output = [{"file": f"{model.name}.json", "location": model.location, "definition_id": None}]

    definitions = db.query(Definition).filter(Definition.model_id == model.id).all()
    for definition in definitions:
        output.append({
            "file": definition.file_name,
            "location": definition.file_path,
            "definition_id": str(definition.public_key),
        })

    return output

@router.post("/load-model")
async def load_model(
    model_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "models:*", "models:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    model = db.query(Model).filter(Model.public_key == model_id, Model.account_id == current_user.account_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found",
        )

    # Cube has no "register a model" API — its repositoryFactory (see
    # backend/cube_conf/cube.js) reads the account's definition directory fresh
    # on every request, so there's nothing to register. Just make sure the
    # directory exists so add_definition has somewhere to write into.
    try:
        ensure_account_definition_dir(current_user.account.public_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load model: {str(e)}",
        )

    return {"message": "Model loaded successfully"}
