from fastapi import APIRouter, Depends, HTTPException, status, Form
from schema.files import FileCreateRequest, FilePublicResponse
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User
from security import check_permissions
from uuid import UUID
from models.files import File
from utils.config_files import storage
from utils.files_schema_handler import get_file_schema
from io import BytesIO
from typing import List
from sqlalchemy import and_


router = APIRouter(prefix="/api/v1/files" , tags=["files"])

MAX_FILE_SIZE = 1000000000

from fastapi import FastAPI, Depends, HTTPException, status, File as FastAPIFile, Form, UploadFile
from io import BytesIO
from sqlalchemy.orm import Session

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_file(
    name: str = Form(...),                        # Extracted from Form data
    description: str = Form(None),                # Optional description from Form data
    file: UploadFile = FastAPIFile(...),         # Raw file object
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "files:*", "files:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Unauthorized : Insufficient permissions"
        )
        
    # Check uniqueness using the user-provided "name" field
    existing_file = db.query(File).filter(File.name == name).first()
    if existing_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="File with this name already exists"
        )
    
    # Calculate file size accurately using the UploadFile object
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    # Get the original system filename from the uploaded file metadata
    uploaded_filename = file.filename
 
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="File size cannot be greater than 1GB"
        )

    # Extract extension and paths
    extension = uploaded_filename.split(".")[-1] if "." in uploaded_filename else ""
    file_path = f"publisher_data/{current_user.account.public_key}/files"
    
    try:
        location = await storage.upload_file(
            file=BytesIO(await file.read()),
            path=file_path,
            file_name=uploaded_filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to upload file: {str(e)}"
        )

    # Instantiate your database model
    new_file = File(
        name=name,
        description=description,
        extension=extension,
        file_size=file_size,
        path=f"{file_path}",
        file_name=uploaded_filename,
        account_id=current_user.account_id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    
    try:
        db.add(new_file)
        db.flush()
    except Exception as e:
        await storage.delete_file(file_path, uploaded_filename)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to create file: {str(e)}"
        )
        
    db.commit()
    db.refresh(new_file)
    return {"message": "File created successfully"}

@router.get("/list", response_model=List[FilePublicResponse] , response_model_exclude_none=True)
async def list_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "files:*", "files:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    files = db.query(File).filter(File.account_id == current_user.account_id).all()
    return files

@router.get("/schema")
async def get_file_schema_route(
    file_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Infers a file's column schema from a small snippet, without reading it in full."""
    permissions = ["*", "files:*", "files:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    file = db.query(File).filter(and_(File.public_key == file_id, File.account_id == current_user.account_id)).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    try:
        schema = await get_file_schema(file.path, file.file_name, file.extension)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get file schema: {str(e)}")
    return schema.to_dict()


@router.delete("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "files:*", "files:delete"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    file = db.query(File).filter(and_(File.public_key == file_id, File.account_id == current_user.account_id)).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    try:
        await storage.delete_file(file.path, file.file_name)
        db.delete(file)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete file: {str(e)}")
    return {"message": "File deleted successfully"}