"""Admin panel: login + CRUD for all site content."""
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from slugify import slugify
from sqlalchemy.orm import Session

from app.deps import get_db, get_site_settings, require_admin
from app.uploads import save_document, save_image
from app.models import (
    AdminUser,
    Education,
    Experience,
    Project,
    Skill,
    SkillCategory,
    SiteSettings,
)
from app.security import hash_password, verify_password

router = APIRouter(prefix="/admin", tags=["admin"])
templates = Jinja2Templates(directory="app/templates")


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@router.get("/login")
def login_form(request: Request):
    if request.session.get("admin_username"):
        return RedirectResponse("/admin", status_code=303)
    return templates.TemplateResponse("admin/login.html", {"request": request, "error": None})


@router.post("/login")
def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        return templates.TemplateResponse(
            "admin/login.html",
            {"request": request, "error": "Invalid username or password."},
            status_code=401,
        )
    request.session["admin_username"] = user.username
    return RedirectResponse("/admin", status_code=303)


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/admin/login", status_code=303)


@router.get("/change-password")
def change_password_form(request: Request, admin_username: str = Depends(require_admin)):
    return templates.TemplateResponse(
        "admin/change_password.html", {"request": request, "error": None, "saved": False}
    )


@router.post("/change-password")
def change_password_submit(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    user = db.query(AdminUser).filter(AdminUser.username == admin_username).first()

    error = None
    if user is None or not verify_password(current_password, user.password_hash):
        error = "Current password is incorrect."
    elif len(new_password) < 8:
        error = "New password must be at least 8 characters."
    elif new_password != confirm_password:
        error = "New password and confirmation do not match."

    if error:
        return templates.TemplateResponse(
            "admin/change_password.html",
            {"request": request, "error": error, "saved": False},
            status_code=400,
        )

    user.password_hash = hash_password(new_password)
    db.add(user)
    db.commit()
    return templates.TemplateResponse(
        "admin/change_password.html", {"request": request, "error": None, "saved": True}
    )


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("")
def dashboard(
    request: Request,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    counts = {
        "projects": db.query(Project).count(),
        "skills": db.query(Skill).count(),
        "experiences": db.query(Experience).count(),
        "education": db.query(Education).count(),
    }
    return templates.TemplateResponse(
        "admin/dashboard.html",
        {"request": request, "admin_username": admin_username, "counts": counts},
    )


# ---------------------------------------------------------------------------
# Site settings
# ---------------------------------------------------------------------------

@router.get("/settings")
def settings_form(
    request: Request,
    site: SiteSettings = Depends(get_site_settings),
    admin_username: str = Depends(require_admin),
):
    return templates.TemplateResponse(
        "admin/site_settings.html", {"request": request, "site": site, "saved": False}
    )


@router.post("/settings")
def settings_submit(
    request: Request,
    site_title: str = Form(...),
    tagline: str = Form(""),
    bio: str = Form(""),
    avatar_url: str = Form(""),
    resume_url: str = Form(""),
    footer_text: str = Form(""),
    email: str = Form(""),
    location: str = Form(""),
    github_url: str = Form(""),
    linkedin_url: str = Form(""),
    twitter_url: str = Form(""),
    background_color: str = Form("#F7F0E6"),
    text_color: str = Form("#1D2B1F"),
    accent_color: str = Form("#BFEA4B"),
    avatar_file: UploadFile | None = File(None),
    resume_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    site: SiteSettings = Depends(get_site_settings),
    admin_username: str = Depends(require_admin),
):
    uploaded_avatar = save_image(avatar_file)
    uploaded_resume = save_document(resume_file)

    site.site_title = site_title
    site.tagline = tagline
    site.bio = bio
    site.avatar_url = uploaded_avatar or avatar_url
    site.resume_url = uploaded_resume or resume_url
    site.footer_text = footer_text
    site.email = email
    site.location = location
    site.github_url = github_url
    site.linkedin_url = linkedin_url
    site.twitter_url = twitter_url
    site.background_color = background_color
    site.text_color = text_color
    site.accent_color = accent_color
    db.add(site)
    db.commit()
    return templates.TemplateResponse(
        "admin/site_settings.html", {"request": request, "site": site, "saved": True}
    )


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@router.get("/projects")
def projects_admin(
    request: Request, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    projects = db.query(Project).order_by(Project.order_index).all()
    return templates.TemplateResponse(
        "admin/projects_list.html", {"request": request, "projects": projects}
    )


@router.get("/projects/new")
def project_new_form(request: Request, admin_username: str = Depends(require_admin)):
    return templates.TemplateResponse(
        "admin/project_form.html", {"request": request, "project": None}
    )


@router.get("/projects/{project_id}/edit")
def project_edit_form(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    project = db.get(Project, project_id)
    return templates.TemplateResponse(
        "admin/project_form.html", {"request": request, "project": project}
    )


@router.post("/projects/new")
def project_create(
    title: str = Form(...),
    summary: str = Form(""),
    description: str = Form(""),
    tech_stack: str = Form(""),
    repo_url: str = Form(""),
    live_url: str = Form(""),
    image_url: str = Form(""),
    featured: bool = Form(False),
    order_index: int = Form(0),
    image_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    image_url = save_image(image_file) or image_url
    base_slug = slugify(title)
    slug = base_slug
    counter = 2
    while db.query(Project).filter(Project.slug == slug).first() is not None:
        slug = f"{base_slug}-{counter}"
        counter += 1

    project = Project(
        title=title,
        slug=slug,
        summary=summary,
        description=description,
        tech_stack=tech_stack,
        repo_url=repo_url,
        live_url=live_url,
        image_url=image_url,
        featured=featured,
        order_index=order_index,
    )
    db.add(project)
    db.commit()
    return RedirectResponse("/admin/projects", status_code=303)


@router.post("/projects/{project_id}/edit")
def project_update(
    project_id: int,
    title: str = Form(...),
    summary: str = Form(""),
    description: str = Form(""),
    tech_stack: str = Form(""),
    repo_url: str = Form(""),
    live_url: str = Form(""),
    image_url: str = Form(""),
    featured: bool = Form(False),
    order_index: int = Form(0),
    image_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    uploaded_image = save_image(image_file)
    project = db.get(Project, project_id)
    if project is not None:
        project.title = title
        project.summary = summary
        project.description = description
        project.tech_stack = tech_stack
        project.repo_url = repo_url
        project.live_url = live_url
        project.image_url = uploaded_image or image_url
        project.featured = featured
        project.order_index = order_index
        db.add(project)
        db.commit()
    return RedirectResponse("/admin/projects", status_code=303)


@router.post("/projects/{project_id}/delete")
def project_delete(
    project_id: int, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    project = db.get(Project, project_id)
    if project is not None:
        db.delete(project)
        db.commit()
    return RedirectResponse("/admin/projects", status_code=303)


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------

@router.get("/skills")
def skills_admin(
    request: Request, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    categories = db.query(SkillCategory).order_by(SkillCategory.order_index).all()
    return templates.TemplateResponse(
        "admin/skills.html", {"request": request, "categories": categories}
    )


@router.post("/skills/categories/new")
def skill_category_create(
    name: str = Form(...),
    order_index: int = Form(0),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    db.add(SkillCategory(name=name, order_index=order_index))
    db.commit()
    return RedirectResponse("/admin/skills", status_code=303)


@router.post("/skills/categories/{category_id}/delete")
def skill_category_delete(
    category_id: int, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    category = db.get(SkillCategory, category_id)
    if category is not None:
        db.delete(category)
        db.commit()
    return RedirectResponse("/admin/skills", status_code=303)


@router.post("/skills/new")
def skill_create(
    category_id: int = Form(...),
    name: str = Form(...),
    level: int = Form(80),
    order_index: int = Form(0),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    db.add(Skill(category_id=category_id, name=name, level=level, order_index=order_index))
    db.commit()
    return RedirectResponse("/admin/skills", status_code=303)


@router.post("/skills/{skill_id}/delete")
def skill_delete(
    skill_id: int, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    skill = db.get(Skill, skill_id)
    if skill is not None:
        db.delete(skill)
        db.commit()
    return RedirectResponse("/admin/skills", status_code=303)


# ---------------------------------------------------------------------------
# Experience
# ---------------------------------------------------------------------------

@router.get("/experience")
def experience_admin(
    request: Request, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    experiences = db.query(Experience).order_by(Experience.order_index).all()
    education = db.query(Education).order_by(Education.order_index).all()
    return templates.TemplateResponse(
        "admin/experience_list.html",
        {"request": request, "experiences": experiences, "education": education},
    )


@router.get("/experience/new")
def experience_new_form(request: Request, admin_username: str = Depends(require_admin)):
    return templates.TemplateResponse(
        "admin/experience_form.html", {"request": request, "experience": None}
    )


@router.get("/experience/{experience_id}/edit")
def experience_edit_form(
    experience_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    experience = db.get(Experience, experience_id)
    return templates.TemplateResponse(
        "admin/experience_form.html", {"request": request, "experience": experience}
    )


@router.post("/experience/new")
def experience_create(
    role: str = Form(...),
    company: str = Form(...),
    location: str = Form(""),
    start_date: str = Form(...),
    end_date: str = Form(""),
    description: str = Form(""),
    order_index: int = Form(0),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    db.add(
        Experience(
            role=role,
            company=company,
            location=location,
            start_date=_parse_date(start_date),
            end_date=_parse_date(end_date),
            description=description,
            order_index=order_index,
        )
    )
    db.commit()
    return RedirectResponse("/admin/experience", status_code=303)


@router.post("/experience/{experience_id}/edit")
def experience_update(
    experience_id: int,
    role: str = Form(...),
    company: str = Form(...),
    location: str = Form(""),
    start_date: str = Form(...),
    end_date: str = Form(""),
    description: str = Form(""),
    order_index: int = Form(0),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    experience = db.get(Experience, experience_id)
    if experience is not None:
        experience.role = role
        experience.company = company
        experience.location = location
        experience.start_date = _parse_date(start_date)
        experience.end_date = _parse_date(end_date)
        experience.description = description
        experience.order_index = order_index
        db.add(experience)
        db.commit()
    return RedirectResponse("/admin/experience", status_code=303)


@router.post("/experience/{experience_id}/delete")
def experience_delete(
    experience_id: int, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    experience = db.get(Experience, experience_id)
    if experience is not None:
        db.delete(experience)
        db.commit()
    return RedirectResponse("/admin/experience", status_code=303)


@router.post("/education/new")
def education_create(
    institution: str = Form(...),
    degree: str = Form(""),
    field: str = Form(""),
    start_date: str = Form(""),
    end_date: str = Form(""),
    order_index: int = Form(0),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    db.add(
        Education(
            institution=institution,
            degree=degree,
            field=field,
            start_date=_parse_date(start_date),
            end_date=_parse_date(end_date),
            order_index=order_index,
        )
    )
    db.commit()
    return RedirectResponse("/admin/experience", status_code=303)


@router.post("/education/{education_id}/delete")
def education_delete(
    education_id: int, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    education = db.get(Education, education_id)
    if education is not None:
        db.delete(education)
        db.commit()
    return RedirectResponse("/admin/experience", status_code=303)
