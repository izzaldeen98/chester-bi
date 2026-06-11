import os 
from datetime import datetime , timedelta , timezone
from typing import Optional
import jwt
from pwdlib import PasswordHash
from dotenv import load_dotenv
from cryptography.fernet import Fernet
from models.user import User
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

FERNET_KEY = os.getenv("FERNET_KEY")
fernet = Fernet(FERNET_KEY)
password_hash = PasswordHash.recommended()

def encrypt_password(password: str) -> str:
    return fernet.encrypt(password.encode()).decode()
def decrypt_password(encrypted_password: str) -> str:
    return fernet.decrypt(encrypted_password.encode()).decode()

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    # Fix parameter order: pwdlib expects (secret, hash)
    return password_hash.verify(password, hashed_password)

def create_access_token(data: dict , expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def check_permissions( user: User , *permissions) -> bool:
    return any(permission in user.permissions for permission in permissions)

    