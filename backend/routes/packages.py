from fastapi import APIRouter, Depends, HTTPException, status , Form
from schema.packages import PackageCreate, PackageResponse , PackageUpdate
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User
from models.packages import Package
from security import check_permissions
from utils.config_files import storage
from io import BytesIO
import json
from typing import List
from uuid import UUID
from models.semantic_models import SemanticModel


router = APIRouter(prefix="/api/v1/packages")



# router = APIRouter()

@router.post("/create", status_code=status.HTTP_201_CREATED )
async def create_package(
    # 1. FIX: Changed to Form fields so it cleanly accepts 'multipart/form-data'
    name: str = Form(...),
    description: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 2. Permission Check
    permissions = ["*", "packages:*", "packages:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # 3. Multi-Tenant Uniqueness Check
    existing_package = (
        db.query(Package)
        .filter(
            Package.name == name, 
            Package.account_id == current_user.account_id
        )
        .first()
    )
    if existing_package:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Package with this name already exists",
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

    model_folder = f"publisher_data/{account_public_key}/{name}"
    package_content = {
        "name": name,
        "description": description,
        "version": "1.0.0",
    }

    # 5. Storage Upload
    try:
        location = await storage.upload_file(
            file=BytesIO(json.dumps(package_content).encode("utf-8")),
            file_name="publisher.json",
            path=model_folder,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload package: {str(e)}",
        )

    # 6. Database Commit wrapped in a try/except for transactional safety
    try:
        new_package = Package(
            name=name,
            location=location,
            description=description,
            account_id=current_user.account_id,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(new_package)
        db.commit()
    except Exception as db_err:
        db.rollback()
        # Edge case: If DB fails, you'd ideally trigger a background task to delete the orphan storage file
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Package storage succeeded, but database tracking failed. , {db_err}"
        )

    return {"message": "Package created successfully"}


@router.get("/list", response_model=List[PackageResponse])
def list_packages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "packages:*", "packages:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    packages = db.query(Package).filter(Package.account_id == current_user.account_id).all()
    return packages

@router.get("/get", response_model=PackageResponse)
def get_package(
    package_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "packages:*", "packages:get"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    package = db.query(Package).filter(Package.public_key == package_id, Package.account_id == current_user.account_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found",
        )
    return package

# @router.put("/update", status_code=status.HTTP_204_NO_CONTENT)
# def update_package(
#     package_id: UUID,
#     package: PackageUpdate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     permissions = ["*", "packages:*", "packages:update"]
#     if not check_permissions(current_user, *permissions):
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Unauthorized : Insufficient permissions",
#         )
#     package = db.query(Package).filter(Package.public_key == package_id, Package.account_id == current_user.account_id).first()
#     if not package:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Package not found",
#         )
#     package.name = package.name
#     package.description = package.description
#     package.updated_by = current_user.id
#     db.commit()
#     db.refresh(package)
#     return {"message": "Package updated successfully"}


@router.get("/list-files")
def list_files(
    package_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "packages:*", "packages:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    package = db.query(Package).filter(Package.public_key == package_id, Package.account_id == current_user.account_id).first()

    output = [{"file": "publisher.json", "location": package.location, "model_id": None}]

    models = db.query(SemanticModel).filter(SemanticModel.package_id == package.id).all()
    for model in models:
        output.append({
            "file": model.file_name,
            "location": model.file_path,
            "model_id": str(model.public_key),
        })

    return output