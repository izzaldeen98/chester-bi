from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    File,
    UploadFile,
    Query,
    Form,
)
from schema.definitions import DefinitionBase
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.user import User
from models.models import Model
from models.definitions import Definition
from security import check_permissions
from uuid import UUID
from utils.config_files import storage
from io import BytesIO
from utils.cube import mint_token, load as cube_load, meta as cube_meta, extract_cube_names
from schema.definitions import DefinitionSchema
import time
import json
from utils.redis_handler import cache_query, get_cached_query
import hashlib


router = APIRouter(prefix="/api/v1/definitions", tags=["definitions"])


@router.post("/add", status_code=status.HTTP_201_CREATED)
async def add_definition(
    # 1. FIX: Expanded the Pydantic model into explicit Form fields to support file uploading
    name: str = Form(...),
    model_id: UUID = Form(...),  # Adjust type (e.g., str/int) based on your DB schema
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 2. Enforce Permissions
    permissions = ["*", "definitions:*", "definitions:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # 3. MAXIMUM SECURITY: Look up the model and ensure it belongs to this logged-in tenant account
    target_model = (
        db.query(Model)
        .filter(
            and_(
                Model.public_key == model_id,
                Model.account_id == current_user.account_id,
            )
        )
        .first()
    )

    if not target_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target model not found or access denied for this tenant account.",
        )

    # Extract structural values cleanly out of the verified database records
    account_public_key = str(current_user.account.public_key)
    model_name = str(target_model.name)

    # Cube's repositoryFactory (see backend/cube_conf/cube.js) compiles every
    # .yml under one flat per-account definition directory into a single shared
    # cube namespace — unlike Malloy, there's no per-model isolation, so the
    # model name is folded into the filename to keep cube names collision-free
    # across models.
    file_path = f"cube_data/{account_public_key}/definitions"
    file_name = f"{model_name}__{name}.yml"

    # 5. File Upload Execution
    try:
        file_bytes = await file.read()

        # Pass file.file directly along with the safe generated paths
        await storage.upload_file(BytesIO(file_bytes), file_path, file_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )

    # 6. Database Persistance
    try:
        new_definition = Definition(
            name=name,
            description=description,
            file_name=file_name,
            file_path=file_path,
            model_id=target_model.id,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(new_definition)
        db.commit()
        db.refresh(new_definition)
    except Exception as db_err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage upload complete, but tracking record failed to save to database.",
        )

    return new_definition


@router.put("/save", status_code=status.HTTP_200_OK)
async def save_definition(
    definition_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "definitions:*", "definitions:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # Look up the definition and verify it belongs to this tenant via the model relationship
    target_definition = (
        db.query(Definition)
        .join(Model, Definition.model_id == Model.id)
        .filter(
            Definition.public_key == definition_id,
            Model.account_id == current_user.account_id,
        )
        .first()
    )

    if not target_definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Definition not found or access denied.",
        )

    # Overwrite the file in storage at the same path
    try:
        file_bytes = await file.read()
        await storage.upload_file(
            BytesIO(file_bytes), target_definition.file_path, target_definition.file_name
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}",
        )

    # Update the DB record timestamps
    try:
        target_definition.updated_by = current_user.id
        db.commit()
        db.refresh(target_definition)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File saved to storage but failed to update the database record.",
        )

    return {"message": "Definition saved successfully"}


@router.get("/file-content")
async def get_definition_file_content(
    definition_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "definitions:*", "definitions:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    target_definition = (
        db.query(Definition)
        .join(Model, Definition.model_id == Model.id)
        .filter(
            Definition.public_key == definition_id,
            Model.account_id == current_user.account_id,
        )
        .first()
    )
    if not target_definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Definition not found or access denied.",
        )

    file_bytes = await storage.get_file(target_definition.file_path, target_definition.file_name)
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found in storage.",
        )

    return {"content": file_bytes.read().decode("utf-8")}


@router.get("/query")
async def query_definition(
    definition_id: UUID = Query(...),
    query: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "definitions:*", "definitions:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )
    target_definition = (
        db.query(Definition).filter(Definition.public_key == definition_id).first()
    )
    if not target_definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Definition not found",
        )
    start_time = time.time()
    redis_key = f"{current_user.account.public_key}:{definition_id}:{hashlib.sha256(query.encode()).hexdigest()}"
    redis_result = get_cached_query(redis_key)
    if redis_result:
        end_time = time.time()
        return {**redis_result  , "time": end_time - start_time}

    # `query` is a JSON-encoded Cube query object (see frontend/src/lib/CubeQueryBuilder.ts).
    token = mint_token(db, current_user.account.public_key, current_user.account_id)
    result = cube_load(token, json.loads(query))
    end_time = time.time()
    if result.get("data") != []:
        cache_query(redis_key, result)
    return {**result, "time": end_time - start_time}


@router.get("/get-compiled-definition" , response_model=DefinitionSchema)
async def get_compiled_definition(
    definition_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "definitions:*", "definitions:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )
    target_definition = (
        db.query(Definition)
        .join(Model, Definition.model_id == Model.id)
        .filter(Definition.public_key == definition_id, Model.account_id == current_user.account_id)
        .first()
    )
    if not target_definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Definition not found",
        )
    token = mint_token(db, current_user.account.public_key, current_user.account_id)
    full_meta = cube_meta(token)

    # Cube compiles every definition in the account into one shared namespace
    # (see extract_cube_names' docstring), so the account-wide /meta result
    # has to be filtered down to just this definition's own cubes — otherwise
    # every model's sources show up in every other model's dataset builder.
    file_bytes = await storage.get_file(target_definition.file_path, target_definition.file_name)
    if file_bytes:
        own_cubes = extract_cube_names(file_bytes.read().decode("utf-8"))
        if own_cubes:
            full_meta["sources"] = [s for s in full_meta["sources"] if s["name"] in own_cubes]

    return full_meta


@router.delete("/delete", status_code=status.HTTP_200_OK)
async def delete_definition(
    definition_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "definitions:*", "definitions:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )
    target_definition = (
        db.query(Definition).filter(Definition.public_key == definition_id).first()
    )
    if not target_definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Definition not found",
        )
    await storage.delete_file(target_definition.file_path, target_definition.file_name)
    db.delete(target_definition)
    db.commit()
    return {"message": "Definition deleted successfully"}
