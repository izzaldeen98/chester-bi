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
from schema.semantic_models import SemanticModelBase
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.user import User
from models.packages import Package
from models.semantic_models import SemanticModel
from security import check_permissions
from uuid import UUID
from utils.config_files import storage
from io import BytesIO
from utils.malloy import Malloy
from schema.semantic_models import SemanticModelSchema
import time
from utils.redis_handler import cache_query, get_cached_query
import hashlib


router = APIRouter(prefix="/api/v1/semantic-models", tags=["semantic-models"])
# router = APIRouter()


@router.post("/add", status_code=status.HTTP_201_CREATED)
async def add_semantic_model(
    # 1. FIX: Expanded the Pydantic model into explicit Form fields to support file uploading
    name: str = Form(...),
    package_id: UUID = Form(...),  # Adjust type (e.g., str/int) based on your DB schema
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 2. Enforce Permissions
    permissions = ["*", "semantic-models:*", "semantic-models:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # 3. MAXIMUM SECURITY: Look up the package and ensure it belongs to this logged-in tenant account
    target_package = (
        db.query(Package)
        .filter(
            and_(
                Package.public_key == package_id,
                Package.account_id == current_user.account_id,
            )
        )
        .first()
    )

    if not target_package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target package not found or access denied for this tenant account.",
        )

    # Extract structural values cleanly out of the verified database records
    account_public_key = str(current_user.account.public_key)
    package_name = str(target_package.name)

    # Secure storage target path generation
    file_path = f"publisher_data/{account_public_key}/{package_name}"

    # 5. File Upload Execution
    try:
        file_bytes = await file.read()

        # Pass file.file directly along with the safe generated paths
        await storage.upload_file(BytesIO(file_bytes), file_path, f"{name}.malloy")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )

    # 6. Database Persistance (Using distinct variable name 'new_model' to avoid collision)
    try:
        new_model = SemanticModel(
            name=name,
            description=description,
            file_name=f"{name}.malloy",
            file_path=file_path,
            package_id=target_package.id,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(new_model)
        db.commit()
        db.refresh(new_model)
    except Exception as db_err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage upload complete, but tracking record failed to save to database.",
        )

    return new_model


@router.put("/save", status_code=status.HTTP_200_OK)
async def save_semantic_model(
    model_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "semantic-models:*", "semantic-models:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # Look up the model and verify it belongs to this tenant via the package relationship
    target_model = (
        db.query(SemanticModel)
        .join(Package, SemanticModel.package_id == Package.id)
        .filter(
            SemanticModel.public_key == model_id,
            Package.account_id == current_user.account_id,
        )
        .first()
    )

    if not target_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semantic model not found or access denied.",
        )

    # Overwrite the file in storage at the same path
    try:
        file_bytes = await file.read()
        await storage.upload_file(
            BytesIO(file_bytes), target_model.file_path, target_model.file_name
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}",
        )

    # Update the DB record timestamps
    try:
        target_model.updated_by = current_user.id
        db.commit()
        db.refresh(target_model)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File saved to storage but failed to update the database record.",
        )

    return {"message": "Model saved successfully"}


@router.get("/file-content")
async def get_file_content(
    model_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "semantic-models:*", "semantic-models:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    target_model = (
        db.query(SemanticModel)
        .join(Package, SemanticModel.package_id == Package.id)
        .filter(
            SemanticModel.public_key == model_id,
            Package.account_id == current_user.account_id,
        )
        .first()
    )
    if not target_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semantic model not found or access denied.",
        )

    file_bytes = await storage.get_file(target_model.file_path, target_model.file_name)
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found in storage.",
        )

    return {"content": file_bytes.read().decode("utf-8")}


@router.get("/query")
async def query_semantic_model(
    model_id: UUID = Query(...),
    query: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "semantic-models:*", "semantic-models:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )
    target_model = (
        db.query(SemanticModel).filter(SemanticModel.public_key == model_id).first()
    )
    if not target_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semantic model not found",
        )
    start_time = time.time()
    redis_key = f"{current_user.account.public_key}:{model_id}:{hashlib.sha256(query.encode()).hexdigest()}"
    redis_result = get_cached_query(redis_key)
    if redis_result:
        end_time = time.time()
        return {**redis_result  , "time": end_time - start_time}


    malloy = Malloy(envid=current_user.account.public_key)
    package = malloy.get_package_by_name(target_model.package.name)
    model = package.get_model_by_path(target_model.file_name)
    
    result = model.query(query)
    end_time = time.time()
    if result.get("result") != []:
        cache_query(redis_key, result)
    return {**result, "time": end_time - start_time}


@router.get("/get-compiled-model" , response_model=SemanticModelSchema)
async def get_compiled_model(
    model_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "semantic-models:*", "semantic-models:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )
    target_model = (
        db.query(SemanticModel).filter(SemanticModel.public_key == model_id , Package.account_id == current_user.account_id).first()
    )
    if not target_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semantic model not found",
        )
    malloy = Malloy(envid=current_user.account.public_key)
    package = malloy.get_package_by_name(target_model.package.name)
    model = package.get_model_by_path(target_model.file_name)
    compiled_model = model.get_compiled_model()
    return compiled_model


@router.delete("/delete", status_code=status.HTTP_200_OK)
async def delete_semantic_model(
    model_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "semantic-models:*", "semantic-models:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )
    target_model = (
        db.query(SemanticModel).filter(SemanticModel.public_key == model_id).first()
    )
    if not target_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semantic model not found",
        )
    await storage.delete_file(target_model.file_path, target_model.file_name)
    db.delete(target_model)
    db.commit()
    return {"message": "Semantic model deleted successfully"}


