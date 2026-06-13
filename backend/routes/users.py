from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schema.user import UserPublicResponse, UserCreate, UserUpdate, UserPermissions
from models.user import User
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from security import hash_password
from security import check_permissions
from uuid import UUID


router = APIRouter(prefix="/api/v1/users" , tags=["users"])


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "users:*", "users:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )

    # FIXED: Check BOTH email and username like your error message suggests
    db_user = (
        db.query(User)
        .filter(
            and_(
                User.account_id == current_user.account_id,
                User.username == user.username,
            )
        )
        .first()
    )

    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered",
        )

    # Automatically map the company name from the creator
    new_user = User(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        account_id=current_user.account_id,
        auth_method="username",
        is_password_set=user.password is not None,
        hashed_password=hash_password(user.password) if user.password else None,
        role="user",
        permissions=user.permissions,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}


@router.get(
    "/list", response_model=List[UserPublicResponse], response_model_exclude_none=True
)
def get_users(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    permissions = ["*", "users:*", "users:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    users = (
        db.query(User)
        .filter(
            and_(User.account_id == current_user.account_id, current_user.id != User.id)
        )
        .all()
    )
    return users


# Global list of valid permissions allowed by your app architecture


@router.put("/update", status_code=status.HTTP_204_NO_CONTENT)
def update_user(
    user_id: UUID,
    user: UserUpdate,  # Permissions are now contained dynamically inside this body
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "users:*", "users:edit"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )

    # 2. Grab Target User profile
    db_user = (
        db.query(User)
        .filter(
            and_(User.public_key == user_id, User.account_id == current_user.account_id)
        )
        .first()
    )
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # 3. Dynamic Field Loop Extraction
    update_data = user.model_dump(exclude_unset=True)

    # Extract permissions from the dict so it isn't assigned via setattr
    requested_permissions = update_data.pop("permissions", None)

    # Apply normal profile attributes (names, email, role, is_active, etc.)
    for key, value in update_data.items():
        setattr(db_user, key, value)

    # Validate and apply permissions separately
    if requested_permissions is not None:
        valid_system_permissions = {permission.value for permission in UserPermissions}
        for perm in requested_permissions:
            if perm not in valid_system_permissions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid system permission: {perm}",
                )
        db_user.permissions = list(set(requested_permissions))

    db_user.updated_by = current_user.id

    # 5. Commit and Output
    db.commit()
    db.refresh(db_user)
    return {"message": "User updated successfully"}


@router.delete("/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "users:*", "users:delete"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    db_user = db.query(User).filter(and_(User.public_key == user_id, User.account_id == current_user.account_id)).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}
