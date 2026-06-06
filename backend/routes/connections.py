from fastapi import APIRouter , Depends
from schema.connections import ConnectionTestResponse , ConnectionTestRequest
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User

from security import encrypt_password , decrypt_password




router = APIRouter(prefix="/api/v1/connections")

@router.post("/test", response_model=ConnectionTestResponse)
async def test_connection(
    connection: ConnectionTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return {"message": "Connection test successful"}