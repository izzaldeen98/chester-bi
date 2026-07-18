from fastapi import APIRouter, Depends, HTTPException, status, Query as FastAPIQuery
from schema.queries import QueryCreateRequest, QueryUpdateRequest, QueryPublicResponse, QueryDetailedResponse
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session, joinedload
from models.user import User
from models.queries import Query
from security import check_permissions
from typing import List
from uuid import UUID
from models.semantic_models import SemanticModel
from models.packages import Package



router = APIRouter(prefix="/api/v1/queries", tags=["queries"])


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_query(
    query: QueryCreateRequest,
    semantic_model_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "queries:*", "queries:create"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    
    existing_query = db.query(Query).filter(Query.name == query.name).first()
    if existing_query:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query with this name already exists")

    target_semantic_model = db.query(SemanticModel).filter(SemanticModel.public_key == semantic_model_id).first()
    if not target_semantic_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found")
    
    new_query = Query(
        name=query.name,
        description=query.description,
        source=query.source,
        aggregation_fields=query.aggregation_fields,
        group_by_fields=query.group_by_fields,
        filters=query.filters,
        havings=query.havings,
        calculated_fields=query.calculated_fields,
        order_by_fields=query.order_by_fields,
        limit=query.limit,
        malloy_query=query.malloy_query,
        sql_query=query.sql_query,
        created_by=current_user.id,
        updated_by=current_user.id,
        semantic_model_id=target_semantic_model.id,
    )
    db.add(new_query)
    db.commit()
    db.refresh(new_query)
    return {"message": "Query created successfully"}

@router.get("/get", response_model=QueryDetailedResponse , status_code=status.HTTP_200_OK , response_model_exclude_none=True)
async def get_query(
    id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "queries:*", "queries:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    
    target_query = db.query(Query).filter(Query.public_key == id).first()
    if not target_query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")
    return target_query

@router.put("/update", response_model=QueryDetailedResponse)
async def update_query(
    query: QueryUpdateRequest,
    query_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "queries:*", "queries:update"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    
    target_query = db.query(Query).filter(Query.public_key == query_id).first()
    if not target_query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")
    account_id = target_query.semantic_model.package.account_id
    if account_id != current_user.account_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    semantic_model = db.query(SemanticModel).filter(SemanticModel.public_key == query.semantic_model_id).first()
    if not semantic_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found")
    target_query.name = query.name if query.name else target_query.name
    target_query.description = query.description if query.description else target_query.description
    target_query.aggregation_fields = query.aggregation_fields if query.aggregation_fields else target_query.aggregation_fields
    target_query.group_by_fields = query.group_by_fields if query.group_by_fields else target_query.group_by_fields
    target_query.filters = query.filters if query.filters else target_query.filters
    target_query.havings = query.havings if query.havings else target_query.havings
    target_query.calculated_fields = query.calculated_fields if query.calculated_fields else target_query.calculated_fields
    target_query.order_by_fields = query.order_by_fields if query.order_by_fields else target_query.order_by_fields
    target_query.limit = query.limit if query.limit else target_query.limit
    target_query.malloy_query = query.malloy_query if query.malloy_query else target_query.malloy_query
    target_query.sql_query = query.sql_query if query.sql_query else target_query.sql_query
    target_query.semantic_model_id = semantic_model.id
    target_query.updated_by = current_user.id
    db.commit()
    db.refresh(target_query)
    return target_query

@router.delete("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_query(
    query_id: UUID = FastAPIQuery(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "queries:*", "queries:delete"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")
    target_query = db.query(Query).filter(Query.public_key == query_id).first()
    if not target_query:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")
    db.delete(target_query)
    db.commit()
    return {"message": "Query deleted successfully"}

from sqlalchemy.orm import Session, joinedload
from fastapi import APIRouter, Depends, HTTPException, status

@router.get("/list" , response_model=List[QueryPublicResponse] , status_code=status.HTTP_200_OK , response_model_exclude_none=True)
async def list_queries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    permissions = ["*", "queries:*", "queries:list"]
    if not check_permissions(current_user, *permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Unauthorized: Insufficient permissions"
        )
    
    # --- FIXED: Added explicit joins for filtering ---
    queries = (
        db.query(Query)
        .join(Query.semantic_model)
        .join(SemanticModel.package)
        .filter(Package.account_id == current_user.account_id)  # Assumes your package model is named Package
        .options(
            joinedload(Query.semantic_model)
            .joinedload(SemanticModel.package)
        )
        .all()
    )
    # ------------------------------------------------
    
    if not queries:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="No queries found for this account"
        )
        
    return queries
