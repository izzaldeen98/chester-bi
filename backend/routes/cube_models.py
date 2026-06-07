from fastapi import APIRouter , Depends , HTTPException , status
from schema.cube_models import CubeModelBase , CubeModelPublicResponse
from models.cube_models import CubeModel
from utils.init_database import get_db
from security import get_current_user
from sqlalchemy.orm import Session
from models.user import User
from models.connections import Connection
from typing import List
from sqlalchemy import and_
from utils.config_files import storage
from io import BytesIO
from fastapi import File
import yaml
from uuid import UUID
from fastapi import Query , Form , UploadFile
from fastapi.responses import StreamingResponse
from models.account import Account
from utils.cube_core import Cube
router = APIRouter(prefix="/api/v1/cube_models")


@router.post("/create", response_model=CubeModelBase, status_code=status.HTTP_201_CREATED)
async def create_cube_model(
    # 1. Use Form fields to accept data along with the file in a multipart request
    name: str = Form(...),
    connection_id: UUID = Form(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # 2. Use UploadFile instead of BytesIO
    file_payload: UploadFile = File(...)
):
    # Check for duplicate record first before handling any file streams
    existing_cube_model = db.query(CubeModel).filter(
        and_(CubeModel.name == name, CubeModel.connection_public_key == connection_id , Connection.account_id == current_user.account_id , Account.id == current_user.account_id)
    ).first()



    connection_db_id = db.query(Connection).filter(and_(Connection.public_key == connection_id, Connection.account_id == current_user.account_id)).first().id
    
    if existing_cube_model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Cube model with {name} already exists"
        )

    try:
        # Read incoming YAML bytes
        yaml_content = await file_payload.read()

        # Parse YAML text into a native Python dictionary
        parsed_yaml = yaml.safe_load(yaml_content.decode('utf-8'))
        
        string_yaml = yaml.safe_dump(parsed_yaml ,sort_keys=False , indent=2 , default_flow_style=False , allow_unicode=True)
        
        # Convert dictionary safely into a minified JSON bytes string
        file_payload_bytes = BytesIO(string_yaml.encode('utf-8'))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Invalid YAML file structure: {str(e)}"
        )

    # 3. Upload the file FIRST to generate the file_path
    try:
        file_path = await storage.upload_file(
            file_payload_bytes, 
            current_user.account_id, 
            f"{connection_id}/cube_models", 
            f"{name}.yaml"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to upload cube model storage: {str(e)}"
        )

    # 4. Instantiate model AFTER file_path is successfully generated
    new_cube_model = CubeModel(
        name=name,
        file_path=file_path,
        connection_id=connection_db_id,
        created_by=current_user.id,
        updated_by=current_user.id,
        created_by_public_key=current_user.public_key,
        updated_by_public_key=current_user.public_key,
        connection_public_key=connection_id
    )

    try:    
        db.add(new_cube_model)
        db.commit()
        db.refresh(new_cube_model)
    except Exception as e:
        # Cleanup storage file if Database fails
        await storage.delete_file(current_user.account_id, f"{connection_id}/cube_models", f"{name}.yaml")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to save record to database: {str(e)}"
        )

    return new_cube_model


@router.get("/list", response_model=List[CubeModelPublicResponse])
async def list_cube_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    connection_id: UUID = Form(... )
):
    cube_models = db.query(CubeModel).filter(and_(CubeModel.connection_public_key == connection_id)).all()
    if not cube_models:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No cube models found")
    return cube_models


@router.get("/get-file")  # 1. Removed response_model to allow raw file download
async def get_cube_model_file(
    id: UUID = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # 2. Removed "min_length=3" because it is a UUID type, not a string
    connection_id: UUID = Form(...) 
):
    # Fetch record from database
    cube_model = db.query(CubeModel).filter(
        and_(
            CubeModel.public_key == id, 
            CubeModel.connection_public_key == connection_id, 
            Connection.account_id == current_user.account_id,
            Account.id == current_user.account_id
        )
    ).first()
    
    if not cube_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Cube model not found"
        )
    
    try:
        # 3. Fetch the file stream from your storage layer
        file_stream = await storage.get_file(
            current_user.account_id, 
            f"{connection_id}/cube_models", 
            f"{cube_model.name}.yaml"
        )


        
        # 4. Wrap the stream in a StreamingResponse with explicit file headers
        return StreamingResponse(
            file_stream, 
            media_type="application/yaml",
            headers={
                "Content-Disposition": f'attachment; filename="{cube_model.name}.yaml"'
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve file from storage: {str(e)}"
        )


@router.delete("/delete/{public_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cube_model(
    public_key: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    connection_public_key: UUID = Query(..., min_length=3)
):
    cube_model = db.query(CubeModel).filter(and_(CubeModel.public_key == public_key, CubeModel.connection_public_key == connection_public_key, Account.id == current_user.account_id)).first()
    if not cube_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cube model not found")
    await storage.delete_file(current_user.account_id, f"{connection_public_key}/cube_models", f"{cube_model.name}.yaml")
    db.delete(cube_model)
    db.commit()
    return {"message": "Cube model deleted successfully"}


@router.post("/publish" , status_code=status.HTTP_204_NO_CONTENT)
async def publish_cube_model(

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    connection_id: UUID = Form(...)
):
    cube_models = db.query(CubeModel).filter(and_( CubeModel.connection_public_key == connection_id, Connection.id == CubeModel.connection_id , Account.id == current_user.account_id)).all()
    connection = db.query(Connection).filter(and_(Connection.public_key == connection_id, Account.id == current_user.account_id)).first()
    if not cube_models:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cube model not found")

    for cube_model in cube_models:
        print(cube_model.file_path)
        try:
            Cube.load_models(
                tenant_id=connection.account_id,
                model_path=cube_model.file_path
            )
            return {"message": "Cube model published successfully"}
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to publish cube model: {str(e)}")