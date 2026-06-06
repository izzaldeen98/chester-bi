from fastapi import Depends , HTTPException , status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session
from utils.init_database import get_db
from models.user import User
from .security import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")



def hash_password(password: str) -> str:
    # Your hashing logic here
    return f"hashed_{password}"

async def get_current_user(
    token: str = Depends(oauth2_scheme), # 2. CRITICAL: This link forces Swagger to display locks
    db: Session = Depends(get_db)
) -> User:
    try:
        # Example decoding logic (adjust based on your setup)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
            
        user = db.query(User).filter(User.email == username).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
