from fastapi import APIRouter, Depends, status, HTTPException, Form
from schema.connections import (
    ConnectionUpdate,
    ConnectionCreate,
    ConnectionPublicResponse,
    ConnectionDetailedResponse,
)
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User
from models.connections import Connection
from typing import List
from security import encrypt_password
from sqlalchemy import and_
from security import check_permissions
from uuid import UUID
from utils.malloy import Malloy


class ConnectionHandler:

    def __init__(self, db_type : str , **kwargs):
        assert db_type in ["postgres", "mysql", "snowflake", "bigquery"], "Invalid database type"
        self.db_type = db_type
        self.kwargs = kwargs
        self.connection_config = self._postgres_mysql_connection() if self.db_type in ["postgres", "mysql"] else self._snowflake_connection() if self.db_type == "snowflake" else self._bigquery_connection()
    
    def _postgres_mysql_connection(self):
        if not all(key in self.kwargs for key in ["host", "port", "database", "username", "password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required connection parameters",
            )
        return {
            "host": self.kwargs["host"],
            "port": self.kwargs["port"],
            "database": self.kwargs["database"],
            "username": self.kwargs["username"],
            "password": self.kwargs["password"],
        }
    


    def _snowflake_connection(self):
        # 1. Validate routing identifiers (Must have either account OR host)
        has_account = "account" in self.kwargs
        has_host = "host" in self.kwargs and "port" in self.kwargs
        
        if not (has_account or has_host):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing routing parameters. Must provide 'account' or both 'host' and 'port'.",
            )

        # 2. Validate credential types (Must have either password OR private_key)
        has_password = "username" in self.kwargs and "password" in self.kwargs
        has_pkey = "username" in self.kwargs and "private_key" in self.kwargs
        
        if not (has_password or has_pkey):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing credentials. Must provide 'username' with either 'password' or 'private_key'.",
            )

        # 3. Dynamically build the connection dictionary
        connection_config = {
            "warehouse": self.kwargs.get("warehouse"),
            "database": self.kwargs.get("database"),  # Optional but recommended
            "schema": self.kwargs.get("schema"),      # Optional but recommended
        }

        # Populate routing
        if has_account:
            connection_config["account"] = self.kwargs["account"]
        else:
            connection_config["host"] = self.kwargs["host"]
            connection_config["port"] = self.kwargs["port"]

        # Populate credentials
        connection_config["username"] = self.kwargs["username"]
        if "password" in self.kwargs:
            connection_config["password"] = self.kwargs["password"]
        else:
            connection_config["private_key"] = self.kwargs["private_key"]
            connection_config["private_key_passphrase"] = self.kwargs.get("private_key_passphrase")

        # Remove None values from optional parameters
        return {k: v for k, v in connection_config.items() if v is not None}

    def _bigquery_connection(self):
        if not all(key in self.kwargs for key in ["project_id", "service_account_json"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required connection parameters",
            )
        return {
            "project_id": self.kwargs["project_id"],
            "service_account_json": self.kwargs["service_account_json"],
        }
    
    def encrypt_secret_values(self):
        if self.db_type == "postgres" or self.db_type == "mysql":
            self.kwargs["password"] = encrypt_password(self.kwargs["password"])
            self.connection_config["password"] = self.kwargs["password"]
        elif self.db_type == "snowflake":
            if "password" in self.kwargs:
                self.kwargs["password"] = encrypt_password(self.kwargs["password"])
            if "private_key" in self.kwargs:
                self.kwargs["private_key"] = encrypt_password(self.kwargs["private_key"])
            self.connection_config["password"] = self.kwargs["password"]
            self.connection_config["private_key"] = self.kwargs["private_key"]
            self.connection_config["private_key_passphrase"] = self.kwargs.get("private_key_passphrase")
        elif self.db_type == "bigquery":
            if "service_account_json" in self.kwargs:
                self.kwargs["service_account_json"] = encrypt_password(self.kwargs["service_account_json"])
            self.connection_config["service_account_json"] = self.kwargs["service_account_json"]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid database type",
            )
        return self




router = APIRouter(prefix="/api/v1/connections" , tags=["connections"])


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_connection(
    connection: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    permissions = ["*", "connections:*", "connections:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )

    existing_connection = (
        db.query(Connection)
        .filter(
            and_(
                Connection.account_id == current_user.account_id,
                Connection.is_active == True,
                Connection.name == connection.name,
            )
        )
        .first()
    )
    if existing_connection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection with this name already exists",
        )
    
    connection_handler = ConnectionHandler(db_type=connection.type, **connection.connection_attributes)
    malloy_client = Malloy(envid=current_user.account.public_key)
    try:
        malloy_client.create_connection(
            name=connection.name,
            type=connection.type,
            **connection_handler.connection_config,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create connection: {str(e)}",
        )
    raw_password = connection.connection_attributes.get("password")
    encrypted_password = encrypt_password(raw_password)
    connection.connection_attributes["password"] = encrypted_password
    new_connection = Connection(
        type=connection.type,
        name=connection.name,
        description=connection.description,
        connection_attributes=connection_handler.encrypt_secret_values().connection_config,
        account_id=current_user.account_id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(new_connection)
    db.commit()
    db.refresh(new_connection)
    return {"message": "Connection created successfully"}


@router.get(
    "/list",
    response_model=List[ConnectionPublicResponse],
    response_model_exclude_none=True,
)
async def list_connections(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    permissions = ["*", "connections:*", "connections:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    connections = (
        db.query(Connection)
        .filter(
            and_(
                Connection.account_id == current_user.account_id,
                Connection.is_active == True,
                User.id == current_user.id,
            )
        )
        .order_by(Connection.created_at.desc())
        .all()
    )
    return connections


@router.get(
    "/get",
    response_model=ConnectionDetailedResponse,
    response_model_exclude_none=True,
)
async def get_connection(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    permissions = ["*", "connections:*", "connections:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    connection = db.query(Connection).filter(and_(Connection.account_id == current_user.account_id, Connection.is_active == True, Connection.public_key == connection_id)).first()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found",
        )
    connection_attributes = connection.connection_attributes

    return {
        "id": connection.public_key,
        "type": connection.type,
        "name": connection.name,
        "host": connection_attributes.get("host"),
        "port": connection_attributes.get("port"),
        "database": connection_attributes.get("database"),
        "username": connection_attributes.get("username"),
        "description": connection.description,
        "created_at": connection.created_at,
        "updated_at": connection.updated_at,
        "created_by": connection.creator.username,
        "updated_by": connection.updater.username,
    }

@router.put(
    "/update", response_model=ConnectionPublicResponse, response_model_exclude_none=True
)
async def update_connection(
    connection_id: UUID,  # Sent as a query parameter or inside the JSON body
    payload: ConnectionUpdate,  # Sent as a standard JSON body
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "connections:*", "connections:update"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Insufficient permissions",
        )

    # Fetch existing DB record
    db_connection = (
        db.query(Connection)
        .filter(
            and_(
                Connection.account_id == current_user.account_id,
                Connection.is_active == True,
                Connection.public_key == connection_id,
            )
        )
        .first()
    )

    if not db_connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )

    # Clean update logic: apply incoming payload data if provided
    update_data = payload.model_dump(
        exclude_unset=True
    )  # or .dict(exclude_unset=True) in v1
    for key, value in update_data.items():
        setattr(db_connection, key, value)

    db_connection.updated_by = current_user.id

    db.commit()
    db.refresh(db_connection)
    return db_connection


@router.delete("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "connections:*", "connections:delete"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    db_connection = (
        db.query(Connection)
        .filter(
            and_(
                Connection.account_id == current_user.account_id,
                Connection.public_key == connection_id,
            )
        )
        .first()
    )
    if not db_connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    malloy = Malloy(envid=current_user.account.public_key)
    malloy.get_connection_by_name(db_connection.name).delete()
    db_connection.is_active = False
    db_connection.updated_by = current_user.id
    db.commit()
    return {"message": "Connection deleted successfully"}


@router.get("/test-connection")
async def test_connection(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "connections:*", "connections:update", "connections:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    connection = (
        db.query(Connection)
        .filter(
            and_(
                Connection.account_id == current_user.account_id,
                Connection.is_active == True,
                Connection.public_key == connection_id,
            )
        )
        .first()
    )
    if Malloy.test_connection(
        connection.type,
        connection.connection_attributes["host"],
        connection.connection_attributes["port"],
        connection.connection_attributes["database"],
        connection.connection_attributes["username"],
        connection.connection_attributes["password"],
    ):
        return {"message": "Connection tested successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to test connection"
        )
