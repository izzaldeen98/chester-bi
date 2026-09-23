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
from utils.db_drivers import (
    adapter_for,
    describe_types,
    test_connection as db_test_connection,
    get_schemas as db_get_schemas,
    get_tables as db_get_tables,
    decrypt_secret_values,
)


def _prepare(db_type: str, attrs: dict) -> tuple[dict, dict]:
    """Validate one connection's attributes against its adapter.

    Returns (plain, stored): `plain` still has real secrets, for the
    connect-test; `stored` has them Fernet-encrypted, for the database. The
    adapter owns which fields exist and which are secret, so adding a
    dialect never touches this function."""
    try:
        adapter = adapter_for(db_type)
        plain = adapter.validate(attrs)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    stored = dict(plain)
    for key in adapter.secret_keys():
        if stored.get(key):
            stored[key] = encrypt_password(stored[key])
    return plain, stored


router = APIRouter(prefix="/api/v1/connections" , tags=["connections"])


@router.get("/types")
async def list_connection_types(current_user: User = Depends(get_current_user)):
    """Every supported dialect and the fields it needs. The connection form
    renders from this, so a new adapter shows up in the UI on its own."""
    return describe_types()


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
    
    plain, stored = _prepare(connection.type, connection.connection_attributes)
    try:
        db_test_connection(connection.type, plain)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect: {str(e)}",
        )
    try:
        new_connection = Connection(
            type=connection.type,
            name=connection.name,
            description=connection.description,
            connection_attributes=stored,
            account_id=current_user.account_id,
            created_by=current_user.id,
            updated_by=current_user.id,
        )

        db.add(new_connection)
    except Exception as e:
        return HTTPException(500 , str(e))
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
    adapter = adapter_for(connection.type)
    secrets = set(adapter.secret_keys())
    # Secrets never leave the backend — not even masked. Everything else is
    # returned as stored, so each dialect shows its own fields.
    attributes = {k: v for k, v in (connection.connection_attributes or {}).items()
                  if k not in secrets}

    return {
        "id": connection.public_key,
        "type": connection.type,
        "name": connection.name,
        "attributes": attributes,
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
    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("connection_attributes") is not None:
        # Without this the new attributes were stored exactly as sent, so an
        # edited password went to the database in clear text.
        plain, stored = _prepare(db_connection.type, update_data["connection_attributes"])
        try:
            db_test_connection(db_connection.type, plain)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to connect: {str(e)}",
            )
        update_data["connection_attributes"] = stored
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
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    attrs = decrypt_secret_values(connection.type, connection.connection_attributes)
    try:
        db_test_connection(connection.type, attrs)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to test connection: {str(e)}"
        )
    return {"message": "Connection tested successfully"}


def _get_owned_connection(db: Session, current_user: User, connection_id: UUID) -> Connection:
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
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    return connection


@router.get("/schemas")
async def get_connection_schemas(
    connection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the schemas (namespaces) available on a connection's database."""
    permissions = ["*", "connections:*", "connections:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    connection = _get_owned_connection(db, current_user, connection_id)
    attrs = decrypt_secret_values(connection.type, connection.connection_attributes)
    try:
        return db_get_schemas(connection.type, attrs)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get connection schemas: {str(e)}",
        )


@router.get("/schemas/tables")
async def get_connection_schema_tables(
    connection_id: UUID,
    schema: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the tables within a single schema of a connection's database."""
    permissions = ["*", "connections:*", "connections:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )
    connection = _get_owned_connection(db, current_user, connection_id)
    attrs = decrypt_secret_values(connection.type, connection.connection_attributes)
    try:
        return db_get_tables(connection.type, schema, attrs)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schema tables: {str(e)}",
        )
