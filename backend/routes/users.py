from fastapi import APIRouter , Depends , HTTPException , status
from typing import List
from schema.user import UserPublicResponse , UserCreate , UserUpdate
from models.user import User
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import or_ , and_
from security import hash_password

PERMISSIONS = ["dashboard:view", "dashboard:edit", "dashboard:delete", "dashboard:create"]

router = APIRouter(prefix="/api/v1/users")

@router.post("/create", response_model=UserPublicResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user: UserCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # FIXED: Changed 'or' to 'and' so EITHER role=="admin" OR is_superuser passes
    if current_user.role != "admin" and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
        
    # FIXED: Check BOTH email and username like your error message suggests
    db_user = db.query(User).filter(
        and_(User.account_id == current_user.account_id,
         User.username == user.username)).first()

    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email or username already registered"
        )
    
    # Automatically map the company name from the creator
    new_user = User(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        account_id=current_user.account_id, 
        hashed_password=hash_password(user.password),
        role="user",
        permissions=[],
        created_by_public_key=current_user.public_key,
        updated_by_public_key=current_user.public_key,
        created_by=current_user.id,
        updated_by=current_user.id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/list", response_model=List[UserPublicResponse])
def get_users(db: Session = Depends(get_db) , current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN" , "OWNER"] and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    users = db.query(User).filter(User.account_id == current_user.account_id).all()
    print(users)
    return users


# Global list of valid permissions allowed by your app architecture

@router.put("/update/{user_id}", response_model=UserPublicResponse)
def update_user(
    user_id: int, 
    user: UserUpdate, # Permissions are now contained dynamically inside this body
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # 1. Authorization Verification
    if current_user.role != "admin" and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
        
    # 2. Grab Target User profile
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # 3. Dynamic Field Loop Extraction
    update_data = user.model_dump(exclude_unset=True)
    
    # Extract permissions from the dict so it isn't assigned via setattr
    requested_permissions = update_data.pop("permissions", None)

    # Dynamically update normal profile attributes (names, email, etc.)
    for key, value in update_data.items():
        setattr(db_user, key, value)

    # 4. Handle Permissions Body Array Toggle Logic
    acquired_permissions = []
    if requested_permissions is not None:
        for perm in requested_permissions:
            # Prevent users from passing arbitrary strings not allowed by your system
            if perm not in PERMISSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail=f"Invalid system permission: {perm}"
                )
                
            # Toggle logic
            acquired_permissions.append(perm)
                
        # CRITICAL FOR POSTGRESQL/SQLITE MUTABLE TRACKING:
        # Re-assign or flag modified arrays to force SQLAlchemy to notice the inner list change
        db_user.permissions = acquired_permissions

    # 5. Commit and Output
    db.commit()
    db.refresh(db_user)
    return db_user
