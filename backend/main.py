import fastapi as fa
import uvicorn
from routes.auth import router as auth_router
from routes.users import router as users_router
from utils.init_database import Base , engine
from routes.dashboards import router as dashboards_router
app = fa.FastAPI(title="API", description="API for the application" , version="1.0.0" , openapi_url="/api/v1/openapi.json" , docs_url="/api/v1/docs" , redoc_url="/api/v1/redoc" )
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(dashboards_router)

Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8989 , reload=True)