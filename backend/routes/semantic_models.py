from fastapi import APIRouter, Depends, HTTPException, status
from schema.semantic_models import SemanticModelBase, SemanticModelPublicResponse
from models.semantic_models import SemanticModel
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User
from models.connections import Connection
from typing import List
from sqlalchemy import and_
from utils.config_files import storage, S3Storage, LocalStorage
from security import decrypt_password
from io import BytesIO
from fastapi import File
from uuid import UUID
from fastapi import Query, Form, UploadFile
from fastapi.responses import StreamingResponse
from models.account import Account
from utils.malloy import Malloy
import hashlib
from utils.redis_handler import cache_query, get_cached_query
import json

router = APIRouter(prefix="/api/v1/semantic_models")


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_cube_model(
    # 1. Use Form fields to accept data along with the file in a multipart request
    name: str = Form(...),
    description: str | None = Form(None),
    connection_id: UUID = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # 2. Use UploadFile instead of BytesIO
    file_payload: UploadFile = File(...),
):
    # Check for duplicate record first before handling any file streams
    existing_semantic_model = (
        db.query(SemanticModel)
        .filter(
            and_(
                SemanticModel.name == name,
                SemanticModel.connection_public_key == connection_id,
                Connection.account_id == current_user.account_id,
                Account.id == current_user.account_id,
            )
        )
        .first()
    )

    if existing_semantic_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Semantic model with {name} already exists",
        )
    account = db.query(Account).filter(Account.id == current_user.account_id).first()
    connection = (
        db.query(Connection)
        .filter(
            and_(
                Connection.public_key == connection_id,
                Connection.account_id == current_user.account_id,
            )
        )
        .first()
    )

    malloy = Malloy()
    malloy.create_environment(
        name=str(account.public_key), description=account.description
    )

    try:
        malloy.create_connection(
            name=connection.name,
            type=connection.type,
            host=connection.host,
            port=connection.port,
            databaseName=connection.database,
            userName=connection.username,
            password=decrypt_password(connection.password),
        )
    except Exception as e:
        print(e)

    try:
        # Read incoming YAML bytes
        content = await file_payload.read()

        # Parse YAML text into a native Python dictionary
        file_payload_bytes = BytesIO(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid YAML file structure: {str(e)}",
        )

    # 3. Upload the file FIRST to generate the file_path
    try:
        publisher_data = {
            "name": name,
            "version": "1.0.0",
            "description": description if description else "No description",
        }
        publisher_file = await storage.upload_file(
            file=BytesIO(json.dumps(publisher_data).encode("utf-8")),
            file_name="publisher.json",
            path="publisher_data/" + str(account.public_key) + "/" + connection.name,
        )
        malloy_file = await storage.upload_file(
            file=file_payload_bytes,
            file_name=f"{name}.malloy",
            path="publisher_data/" + str(account.public_key) + "/" + connection.name,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload cube model storage: {str(e)}",
        )

    # 4. Instantiate model AFTER file_path is successfully generated
    new_semantic_model = SemanticModel(
        name=name,
        file_path=malloy_file,
        connection_id=connection.id,
        created_by=current_user.id,
        updated_by=current_user.id,
        created_by_public_key=current_user.public_key,
        updated_by_public_key=current_user.public_key,
        connection_public_key=connection.public_key,
    )

    model_folder = (
        f"/publisher/publisher_data/{str(account.public_key)}/{connection.name}"
    )

    malloy.create_package(
        name=name,
        description=description if description else "No description",
        location=model_folder,
    )

    try:
        db.add(new_semantic_model)
        db.commit()
        db.refresh(new_semantic_model)
    except Exception as e:
        # Cleanup storage file if Database fails
        await storage.delete_file(
            path="publisher_data/" + str(account.public_key) + "/" + connection.name,
            file_name=f"{name}.malloy",
        )
        await storage.delete_file(
            path="publisher_data/" + str(account.public_key) + "/" + connection.name,
            file_name="publisher.json",
        )

        malloy.delete_environment()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save record to database: {str(e)}",
        )

    return {"message": "Semantic model created successfully"}


@router.get("/list", response_model=List[SemanticModelPublicResponse])
async def list_semantic_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    connection_id: UUID = Form(...),
):
    semantic_models = (
        db.query(SemanticModel)
        .filter(and_(SemanticModel.connection_public_key == connection_id))
        .all()
    )
    if not semantic_models:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No semantic models found"
        )
    return semantic_models


@router.get("/content/{name}")  # 1. Removed response_model to allow raw file download
async def get_semantic_model_file(
    id: UUID = Form(...),
    
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # 2. Removed "min_length=3" because it is a UUID type, not a string
    connection_id: UUID = Form(...),
):
    # Fetch record from database
    semantic_model = (
        db.query(SemanticModel)
        .filter(
            and_(
                SemanticModel.public_key == id,
                SemanticModel.connection_public_key == connection_id,
                Connection.account_id == current_user.account_id,
                Account.id == current_user.account_id,
            )
        )
        .first()
    )

    if not semantic_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found"
        )

    try:
        # 3. Fetch the file stream from your storage layer
        file_stream = await storage.get_file(
            current_user.account_id,
            f"{connection_id}/cube_models",
            f"{semantic_model.name}.yaml",
        )

        # 4. Wrap the stream in a StreamingResponse with explicit file headers
        return StreamingResponse(
            file_stream,
            media_type="application/yaml",
            headers={
                "Content-Disposition": f'attachment; filename="{semantic_model.name}.yaml"'
            },
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve file from storage: {str(e)}",
        )


@router.delete("/delete/{public_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_semantic_model(
    public_key: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    connection_public_key: UUID = Query(..., min_length=3),
):
    semantic_model = (
        db.query(SemanticModel)
        .filter(
            and_(
                SemanticModel.public_key == public_key,
                SemanticModel.connection_public_key == connection_public_key,
                Account.id == current_user.account_id,
            )
        )
        .first()
    )
    if not semantic_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found"
        )
    await storage.delete_file(
        current_user.account_id,
        f"{connection_public_key}/cube_models",
        f"{semantic_model.name}.yaml",
    )
    db.delete(semantic_model)
    db.commit()
    return {"message": "Semantic model deleted successfully"}

@router.get("/query")
async def query_semantic_model(
    semantic_model_id : UUID = Form(...),
    query: str = Form(...),
    package: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    semantic_model = db.query(SemanticModel).filter(and_(SemanticModel.public_key == semantic_model_id, Account.id == current_user.account_id)).first()

    if not semantic_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found"
        )
    
    account = db.query(Account).filter(Account.id == current_user.account_id).first()

    query_hash = hashlib.sha256(query.encode()).hexdigest()
    cached_query = get_cached_query(account.id, query_hash)
    if cached_query:
        return cached_query
    malloy = Malloy(envid=str(account.public_key))
    package = malloy.get_package_by_name(package)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )
    model = package.get_model_by_name(semantic_model.name)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model not found"
        )
    result = model.query(query)
    cache_query(account.id, query_hash, result)
    return result




