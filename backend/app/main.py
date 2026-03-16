from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api import auth, recipes, menus, settings as settings_router, warehouse, members
from app.database import engine
from app import models

app = FastAPI(title="Family Recipes", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(recipes.router, prefix="/api/recipes", tags=["recipes"])
app.include_router(menus.router, prefix="/api/menus", tags=["menus"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])
app.include_router(warehouse.router, prefix="/api/warehouse", tags=["warehouse"])
app.include_router(members.router, prefix="/api/members", tags=["members"])

# Static files for uploaded images
os.makedirs("/app/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

@app.get("/api/health")
async def health():
    return {"status": "ok"}
