"""Public-facing site routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.deps import get_db, get_site_settings
from app.models import Education, Experience, Project, SkillCategory

router = APIRouter(tags=["public"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
def home(request: Request, db: Session = Depends(get_db), site=Depends(get_site_settings)):
    featured = (
        db.query(Project)
        .filter(Project.featured.is_(True))
        .order_by(Project.order_index)
        .all()
    )
    categories = db.query(SkillCategory).order_by(SkillCategory.order_index).all()
    return templates.TemplateResponse(
        "public/index.html",
        {"request": request, "site": site, "featured": featured, "categories": categories},
    )


@router.get("/projects")
def projects_list(request: Request, db: Session = Depends(get_db), site=Depends(get_site_settings)):
    projects = db.query(Project).order_by(Project.order_index).all()
    return templates.TemplateResponse(
        "public/projects.html", {"request": request, "site": site, "projects": projects}
    )


@router.get("/projects/{slug}")
def project_detail(
    slug: str, request: Request, db: Session = Depends(get_db), site=Depends(get_site_settings)
):
    project = db.query(Project).filter(Project.slug == slug).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return templates.TemplateResponse(
        "public/project_detail.html", {"request": request, "site": site, "project": project}
    )


@router.get("/experience")
def experience(request: Request, db: Session = Depends(get_db), site=Depends(get_site_settings)):
    experiences = db.query(Experience).order_by(Experience.order_index).all()
    education = db.query(Education).order_by(Education.order_index).all()
    return templates.TemplateResponse(
        "public/experience.html",
        {"request": request, "site": site, "experiences": experiences, "education": education},
    )
