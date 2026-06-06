from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_
from models.user import User
from security import (
    hash_password,
    verify_password,
    create_access_token,
)
from utils.init_database import get_db
from schema.account import AccountWithSuperuserPayload
from models.account import Account

router = APIRouter(prefix="/api/v1/auth")


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
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "company_name": user.account.name,
        },
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(payload: AccountWithSuperuserPayload, db: Session = Depends(get_db)):

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
        role= "OWNER",
        permissions=["*"],
        is_active=True,
        account_id=new_account.id,
        is_superuser=True,
        created_by_public_key=None,
        updated_by_public_key=None,
        first_name=payload.first_name,
        last_name=payload.last_name,
        created_by = None,
        updated_by = None
    )

    db.add(superuser)
    db.commit()
    db.refresh(superuser)

    return {
        "user_id": superuser.id,
        "username": superuser.username,
        "email": superuser.email,
        "account_id" : new_account.public_key,
        "account_name" : new_account.name
    }
