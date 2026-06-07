from fastapi import APIRouter , Depends , status , HTTPException
from schema.connections import ConnectionUpdate , ConnectionCreate , ConnectionPublicResponse
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User
from models.connections import Connection
from typing import List
from security import encrypt_password
from sqlalchemy import and_




router = APIRouter(prefix="/api/v1/connections")

# @router.post("/test", response_model=ConnectionTestResponse)
# async def test_connection(
#     connection: ConnectionTestRequest,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     return {"message": "Connection test successful"}


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_connection(
    connection: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing_connection = db.query(Connection).filter(and_(Connection.account_id == current_user.account_id, Connection.is_active == True , Connection.name == connection.name)).first()
    if existing_connection:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Connection with this name already exists")
    raw_password = connection.password
    encrypted_password = encrypt_password(raw_password)
    new_connection = Connection(
        type=connection.type,
        name=connection.name,
        description=connection.description,
        host=connection.host,
        port=connection.port,
        username=connection.username,
        password=encrypted_password,
        namespace=connection.namespace,
        schema=connection.schema,
        database=connection.database,
        account_id=current_user.account_id,
        created_by=current_user.id,
        updated_by=current_user.id,
        created_by_public_key=current_user.public_key,
        updated_by_public_key=current_user.public_key,
    )
    
    db.add(new_connection)
    db.commit()
    db.refresh(new_connection)
    return {"message": "Connection created successfully"}

@router.get("/list", response_model=List[ConnectionPublicResponse], response_model_exclude_none=True)
async def list_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    connections = db.query(Connection).filter(and_(Connection.account_id == current_user.account_id, Connection.is_active == True , User.id == current_user.id)).order_by(Connection.created_at.desc()).all()
    return connections

@router.put("/update/{connection_id}", response_model=ConnectionPublicResponse , response_model_exclude_none=True)
async def update_connection(
    connection_id: int,
    connection: ConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    connection = db.query(Connection).filter(and_(Connection.account_id == current_user.account_id, Connection.is_active == True , User.id == current_user.id)).first()
    return connection
