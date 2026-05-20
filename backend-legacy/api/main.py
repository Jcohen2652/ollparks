from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import get_settings
from api.routers import (
    agenda,
    auth,
    besoins,
    biens,
    contacts,
    crm,
    documents,
    entreprises,
    matching,
    opportunites,
    outlook,
    pappers,
    visial,
    visites,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API REST pour la plateforme OLL PARKS",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}


app.include_router(entreprises.router)
app.include_router(contacts.router)
app.include_router(biens.router)
app.include_router(besoins.router)
app.include_router(opportunites.router)
app.include_router(matching.router)
app.include_router(outlook.router)
app.include_router(pappers.router)
app.include_router(visites.router)
app.include_router(documents.router)
app.include_router(agenda.router)
app.include_router(visial.router)
app.include_router(auth.router)
app.include_router(crm.router)
