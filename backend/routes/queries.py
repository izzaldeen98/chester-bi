"""Saved queries — a person's own working material.

This is the hand-built counterpart to artifacts: someone picks measures and
dimensions against one semantic model, runs it, and saves it.

Nothing here is reachable by the AI. The artifact agent is grounded on Cube's
compiled /meta and nothing else; no module under backend/ai/ and neither AI
route imports this model. utils/test_queries.py asserts that structurally so
it cannot be undone by accident.

Execution is not duplicated here — the builder previews through the existing
GET /api/v1/definitions/query, which already mints the Cube token and
validates the query for the account.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query as FastAPIQuery
from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from models.definitions import Definition
from models.models import Model
from models.query import SavedQuery
from models.user import User
from schema.queries import (
    QueryCreateRequest,
    QueryDetailedResponse,
    QueryPublicResponse,
    QueryUpdateRequest,
)
from security import check_permissions, get_current_user
from utils.init_database import get_db

router = APIRouter(prefix="/api/v1/queries", tags=["queries"])

READ = ["*", "queries:*", "queries:list"]
CREATE = ["*", "queries:*", "queries:create"]
UPDATE = ["*", "queries:*", "queries:update"]
DELETE = ["*", "queries:*", "queries:delete"]


def _require(current_user: User, *permissions):
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized : Insufficient permissions",
        )


def _owned_query(db: Session, current_user: User, query_id: UUID) -> SavedQuery:
    """A query of this account, or 404.

    Every lookup goes through here. The datasets this replaces resolved by
    public_key alone, so one account could read and delete another's rows by
    id — the account join is the point of this function, not a detail of it.
    """
    row = (
        db.query(SavedQuery)
        .join(SavedQuery.definition)
        .join(Definition.model)
        .filter(and_(SavedQuery.public_key == query_id,
                     Model.account_id == current_user.account_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")
    return row


def _owned_definition(db: Session, current_user: User, definition_id: UUID) -> Definition:
    definition = (
        db.query(Definition)
        .join(Definition.model)
        .filter(and_(Definition.public_key == definition_id,
                     Model.account_id == current_user.account_id))
        .first()
    )
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found")
    return definition


@router.post("/create", status_code=status.HTTP_201_CREATED, response_model=QueryDetailedResponse)
async def create_query(
    payload: QueryCreateRequest,
    definition_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *CREATE)
    definition = _owned_definition(db, current_user, definition_id)

    # Scoped to the account: a name taken in someone else's account is not
    # taken here.
    clash = (
        db.query(SavedQuery)
        .join(SavedQuery.definition)
        .join(Definition.model)
        .filter(and_(SavedQuery.name == payload.name,
                     Model.account_id == current_user.account_id))
        .first()
    )
    if clash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="A query with this name already exists")

    row = SavedQuery(
        **payload.model_dump(),
        definition_id=definition.id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/list", response_model=List[QueryPublicResponse])
async def list_queries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *READ)
    # An account with no queries yet is an empty list, not a 404 — the page
    # shows its empty state rather than an error.
    return (
        db.query(SavedQuery)
        .join(SavedQuery.definition)
        .join(Definition.model)
        .filter(Model.account_id == current_user.account_id)
        .options(joinedload(SavedQuery.definition).joinedload(Definition.model))
        .order_by(SavedQuery.updated_at.desc())
        .all()
    )


@router.get("/get", response_model=QueryDetailedResponse)
async def get_query(
    query_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *READ)
    return _owned_query(db, current_user, query_id)


@router.put("/update", response_model=QueryDetailedResponse)
async def update_query(
    payload: QueryUpdateRequest,
    query_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *UPDATE)
    row = _owned_query(db, current_user, query_id)

    fields = payload.model_dump(exclude_unset=True)
    definition_id = fields.pop("definition_id", None)
    if definition_id:
        row.definition_id = _owned_definition(db, current_user, definition_id).id

    # exclude_unset, not truthiness: clearing a description or dropping every
    # filter is an edit the user made, not a field they left alone.
    for key, value in fields.items():
        setattr(row, key, value)

    row.updated_by = current_user.id
    db.commit()
    db.refresh(row)
    return row


@router.delete("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_query(
    query_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *DELETE)
    db.delete(_owned_query(db, current_user, query_id))
    db.commit()
