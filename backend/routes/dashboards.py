from fastapi import APIRouter , Depends , HTTPException , status
from schema.dashboards import DashboardCreate , DashboardUpdate , DashboardPublicResponse
from models.dashboard import Dashboard
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User
from utils.config_files import storage
from uuid import uuid4
from json import dumps
from io import BytesIO
from uuid import UUID
from sqlalchemy import and_
from typing import List

router = APIRouter(prefix="/api/v1/dashboards")

@router.post("/create", response_model=DashboardPublicResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    dashboard: DashboardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["ADMIN" , "OWNER"] and not current_user.is_superuser :
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized : Insufficient permissions")

    file_payload = {
        "version": "1.0.0",
        "name": dashboard.name,
        "description": dashboard.description,
        "elements": [],
    }

    uuid_str = uuid4()

    try:
        file_payload_json = dumps(file_payload)
        file_payload_bytes = BytesIO(file_payload_json.encode('utf-8'))
        file_path = await storage.upload_file(file_payload_bytes, current_user.account_id, f"dashboards", f"{uuid4()}.json")
    except Exception as e:
        await storage.rollback_file(current_user.account_id, f"dashboards", f"{uuid_str}.json")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to upload config file: {str(e)}")

    try:
        new_dashboard = Dashboard(
            name=dashboard.name,
            description=dashboard.description,
            config_file=file_path,
            account_id=current_user.account_id,
            created_by=current_user.id,
            updated_by=current_user.id,
            created_by_public_key=current_user.public_key,
            updated_by_public_key=current_user.public_key,

        )

        db.add(new_dashboard)
        
        db.commit()
        db.refresh(new_dashboard)
    except Exception as e:
        await storage.delete_file(current_user.account_id, f"dashboards", f"{uuid_str}.json")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create dashboard: {str(e)}")

    return new_dashboard


@router.get("/get/{public_key}", response_model=DashboardPublicResponse)
async def get_dashboard(
    public_key: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dashboard = db.query(Dashboard).filter(and_(Dashboard.public_key == public_key, Dashboard.account_id == current_user.account_id)).first()
    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")

    return dashboard


@router.get("/list", response_model=List[DashboardPublicResponse])
async def list_dashboards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dashboards = db.query(Dashboard).filter(Dashboard.account_id == current_user.account_id).all()
    return dashboards


@router.get("/load/{public_key}", response_model=str)
async def load_dashboard(
    public_key: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dashboard = db.query(Dashboard).filter(and_(Dashboard.public_key == public_key, Dashboard.account_id == current_user.account_id)).first()
    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    return dashboard.config_file

@router.delete("/{public_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    public_key: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dashboard = db.query(Dashboard).filter(and_(Dashboard.public_key == public_key, Dashboard.account_id == current_user.account_id)).first()

    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
    is_deleted = await storage.delete_file(current_user.account_id, f"dashboards", f"{dashboard.config_file.split('/')[-1]}")
    if not is_deleted:

        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete dashboard")

    db.delete(dashboard)
    db.commit()
    return {"message": "Dashboard deleted successfully"}