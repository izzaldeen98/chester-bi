from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from models.user import User
from security import (
    hash_password,
    verify_password,
    create_access_token,
)
from utils.init_database import get_db
from models.account import Account
from schema.account import OwnerCreate
from utils.malloy import Malloy

router = APIRouter(prefix="/api/v1/auth" , tags=["auth"])


@router.post("/login")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(
            or_(User.email == form_data.username, User.username == form_data.username)
        )
        .first()
    )


    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token = create_access_token(data={"sub": f"{user.username}:{user.account.public_key}"})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.public_key),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "account_name": user.account.name,
            "role": user.role,
            "permissions": user.permissions or [],
        },
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(payload: OwnerCreate, db: Session = Depends(get_db)):

    user = (
        db.query(User)
        .filter(or_(User.email == payload.email, User.username == payload.username))
        .first()
    )
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered",
        )

    new_account = Account(name=payload.name, description=payload.description)

    db.add(new_account)
    db.flush()

    superuser = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        auth_method="email",
        role= "OWNER",
        permissions=["*"],
        is_active=True,
        account_id=new_account.id,
        is_superuser=True,
        first_name=payload.first_name,
        last_name=payload.last_name,
        created_by = None,
        updated_by = None
    )
    Malloy().create_environment(name=str(new_account.public_key), description=f"Environment for {new_account.name}")

    db.add(superuser)
    db.commit()
    db.refresh(superuser)

    return {"message": "Account created successfully"}


@router.put("/set-password", status_code=status.HTTP_200_OK) # Changed to 200 to allow the JSON message
def set_password(
    username: str,
    account_name: str,
    password: str,
    db: Session = Depends(get_db),
):
    # 1. Look up the account first
    db_account = db.query(Account).filter(Account.name == account_name).first()
    if not db_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # 2. Now safely use db_account.id to look up the user
    db_user = db.query(User).filter(
        and_(
            User.username == username, 
            User.is_password_set == False, 
            User.account_id == db_account.id  # Use the foreign key column, not the relationship object
        )
    ).first()
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found or password already set"
        )

    # 3. Perform the updates
    db_user.hashed_password = hash_password(password)
    db_user.is_password_set = True
    
    # 4. Commit to the database
    db.commit()

    return {"message": "Password set successfully"}