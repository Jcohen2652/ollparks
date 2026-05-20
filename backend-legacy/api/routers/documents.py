from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from api.services.documents import TEMPLATES, DocumentGenerator

router = APIRouter(prefix="/documents", tags=["documents"])

generator = DocumentGenerator()


class TemplateInfo(BaseModel):
    key: str
    label: str
    required_fields: list[str]
    output: str


class GenerateRequest(BaseModel):
    template: str
    data: dict[str, Any]
    format: str = "pdf"  # 'pdf' | 'docx' | 'html'


@router.get("/templates", response_model=list[TemplateInfo])
def list_templates() -> list[TemplateInfo]:
    return [
        TemplateInfo(
            key=t.key, label=t.label, required_fields=t.required_fields, output=t.output
        )
        for t in TEMPLATES.values()
    ]


@router.post("/generate")
def generate(payload: GenerateRequest) -> Response:
    """Génère un document à partir d'un template et de données. Renvoie le binaire."""
    if payload.template not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template inconnu : {payload.template}")
    try:
        if payload.format == "html":
            content = generator.render_html(payload.template, payload.data)
            return Response(content=content, media_type="text/html")
        if payload.format == "docx":
            content = generator.render_docx(payload.template, payload.data)
            return Response(
                content=content,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{payload.template}.docx"'},
            )
        # default pdf
        content = generator.render_pdf(payload.template, payload.data)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{payload.template}.pdf"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Dépendance manquante côté serveur ({e}). Installer weasyprint pour PDF.",
        ) from e
