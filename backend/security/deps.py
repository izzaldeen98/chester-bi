from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import PyJWTError
from sqlalchemy.orm import Session
from utils.init_database import get_db
from models.user import User
from models.account import Account
from .security import SECRET_KEY, ALGORITHM
from sqlalchemy import or_, and_
import uuid
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def hash_password(password: str) -> str:
    # Your hashing logic here
    return f"hashed_{password}"


# 1. Changed to standard 'def' because standard SQLAlchemy Session is synchronous
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        # Decode token payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        composite_sub: str = payload.get("sub")

        if not composite_sub or ":" not in composite_sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid token structure"
            )
            
        username, account_public_key = composite_sub.split(":", 1)
        
    except PyJWTError:
        # ONLY catch token decoding/expiration issues here
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Database operations live OUTSIDE the try/except block.
    # We must explicitly JOIN the Account table to filter by Account.public_key!
    user = (
        db.query(User)
        .join(User.account)  # Tells SQLAlchemy to look at the linked Account table
        .filter(
            and_(
                User.username == username,
                Account.public_key == uuid.UUID(account_public_key)  # Use the Account model class directly here
            )
        )
        .first()
    )

    # Fixed the typo here (changed 'is e' to 'is None')
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="User not found"
        )
        
    return user