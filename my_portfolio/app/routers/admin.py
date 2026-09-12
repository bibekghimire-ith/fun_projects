"""Admin panel: login + CRUD for all site content."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from slugify import slugify
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.deps import get_db, get_site_settings, require_admin
from app.markdown_utils import render_post_html
from app.models import (
    AdminUser,
    Education,
    Experience,
    Post,
    PostView,
    Project,
    Skill,
    SkillCategory,
    SiteSettings,
)
from app.security import (
    get_or_create_csrf_token,
    hash_password,
    require_csrf,
    verify_password,
)
from app.uploads import save_document, save_image

router = APIRouter(prefix="/admin", tags=["admin"])
templates = Jinja2Templates(directory="app/templates")

# Maximum size (characters) accepted for a post's Markdown source. Generous
# for any realistic blog post; exists to stop an accidental huge paste from
# bloating the database or the render step (see BLOG_PLAN.md section 2).
_MAX_MARKDOWN_CHARS = 200_000


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def render_admin(request: Request, template_name: str, context: dict | None = None, status_code: int = 200):
    """TemplateResponse wrapper for admin pages: always injects `request`
    and a CSRF token into the template context, so every admin form can
    embed `{{ csrf_token }}` as a hidden field without each route
    remembering to add it by hand."""
    ctx = dict(context or {})
    ctx["request"] = request
    ctx["csrf_token"] = get_or_create_csrf_token(request)
    return templates.TemplateResponse(template_name, ctx, status_code=status_code)


def _require_len(value: str, max_length: int, field_label: str) -> str:
    if len(value) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{field_label} must be {max_length} characters or fewer (got {len(value)}).",
        )
    return value


def _unique_project_slug(db: Session, title: str, ignore_id: int | None = None) -> str:
    base_slug = slugify(title)
    slug = base_slug or "project"
    counter = 2
    while True:
        existing = db.query(Project).filter(Project.slug == slug).first()
        if existing is None or existing.id == ignore_id:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def _unique_post_slug(db: Session, title: str, ignore_id: int | None = None) -> str:
    base_slug = slugify(title)
    slug = base_slug or "post"
    counter = 2
    while True:
        existing = db.query(Post).filter(Post.slug == slug).first()
        if existing is None or existing.id == ignore_id:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@router.get("/login")
def login_form(request: Request):
    if request.session.get("admin_username"):
        return RedirectResponse("/admin", status_code=303)
    return render_admin(request, "admin/login.html", {"error": None})


@router.post("/login")
def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    # Login intentionally does not require the CSRF token: it doesn't act on
    # behalf of an existing authenticated session (there isn't one yet), so
    # the worst a forged submission can do is log the *attacker's* browser
    # into an account it already knows the password for. Every route below
    # this one changes state for an already-authenticated admin and does
    # require the token.
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        return render_admin(
            request,
            "admin/login.html",
            {"error": "Invalid username or password."},
            status_code=401,
        )
    request.session["admin_username"] = user.username
    return RedirectResponse("/admin", status_code=303)


@router.post("/logout")
def logout(request: Request, _csrf: None = Depends(require_csrf)):
    request.session.clear()
    return RedirectResponse("/admin/login", status_code=303)


@router.get("/change-password")
def change_password_form(request: Request, admin_username: str = Depends(require_admin)):
    return render_admin(request, "admin/change_password.html", {"error": None, "saved": False})


@router.post("/change-password")
def change_password_submit(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
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
        return render_admin(
            request, "admin/change_password.html", {"error": error, "saved": False}, status_code=400
        )

    user.password_hash = hash_password(new_password)
    db.add(user)
    db.commit()
    return render_admin(request, "admin/change_password.html", {"error": None, "saved": True})


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
        "posts": db.query(Post).count(),
    }
    return render_admin(request, "admin/dashboard.html", {"admin_username": admin_username, "counts": counts})


# ---------------------------------------------------------------------------
# Site settings
# ---------------------------------------------------------------------------

@router.get("/settings")
def settings_form(
    request: Request,
    site: SiteSettings = Depends(get_site_settings),
    admin_username: str = Depends(require_admin),
):
    return render_admin(request, "admin/site_settings.html", {"site": site, "saved": False})


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
    _csrf: None = Depends(require_csrf),
):
    _require_len(site_title, 120, "Site title")
    _require_len(tagline, 200, "Tagline")
    _require_len(footer_text, 300, "Footer text")
    _require_len(email, 200, "Email")
    _require_len(location, 120, "Location")

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
    return render_admin(request, "admin/site_settings.html", {"site": site, "saved": True})


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@router.get("/projects")
def projects_admin(
    request: Request, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    projects = db.query(Project).order_by(Project.order_index).all()
    return render_admin(request, "admin/projects_list.html", {"projects": projects})


@router.get("/projects/new")
def project_new_form(request: Request, admin_username: str = Depends(require_admin)):
    return render_admin(request, "admin/project_form.html", {"project": None, "error": None})


@router.get("/projects/{project_id}/edit")
def project_edit_form(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    project = db.get(Project, project_id)
    return render_admin(request, "admin/project_form.html", {"project": project, "error": None})


@router.post("/projects/new")
def project_create(
    request: Request,
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
    _csrf: None = Depends(require_csrf),
):
    try:
        _require_len(title, 150, "Title")
        _require_len(summary, 300, "Summary")
        _require_len(tech_stack, 300, "Tech stack")
        _require_len(repo_url, 500, "Repo URL")
        _require_len(live_url, 500, "Live URL")
        _require_len(image_url, 500, "Image URL")
    except HTTPException as exc:
        fake_project = Project(
            title=title, summary=summary, description=description, tech_stack=tech_stack,
            repo_url=repo_url, live_url=live_url, image_url=image_url, featured=featured,
            order_index=order_index,
        )
        return render_admin(
            request, "admin/project_form.html", {"project": fake_project, "error": exc.detail}, status_code=400
        )

    image_url = save_image(image_file) or image_url
    project = Project(
        title=title,
        slug=_unique_project_slug(db, title),
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
    request: Request,
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
    _csrf: None = Depends(require_csrf),
):
    project = db.get(Project, project_id)
    if project is None:
        return RedirectResponse("/admin/projects", status_code=303)

    try:
        _require_len(title, 150, "Title")
        _require_len(summary, 300, "Summary")
        _require_len(tech_stack, 300, "Tech stack")
        _require_len(repo_url, 500, "Repo URL")
        _require_len(live_url, 500, "Live URL")
        _require_len(image_url, 500, "Image URL")
    except HTTPException as exc:
        preview = Project(
            id=project.id, title=title, summary=summary, description=description,
            tech_stack=tech_stack, repo_url=repo_url, live_url=live_url, image_url=image_url,
            featured=featured, order_index=order_index,
        )
        return render_admin(
            request, "admin/project_form.html", {"project": preview, "error": exc.detail}, status_code=400
        )

    uploaded_image = save_image(image_file)
    project.title = title
    project.slug = _unique_project_slug(db, title, ignore_id=project.id)
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
    project_id: int,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
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
    return render_admin(request, "admin/skills.html", {"categories": categories})


@router.post("/skills/categories/new")
def skill_category_create(
    name: str = Form(...),
    order_index: int = Form(0),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
):
    _require_len(name, 80, "Category name")
    db.add(SkillCategory(name=name, order_index=order_index))
    db.commit()
    return RedirectResponse("/admin/skills", status_code=303)


@router.post("/skills/categories/{category_id}/delete")
def skill_category_delete(
    category_id: int,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
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
    _csrf: None = Depends(require_csrf),
):
    _require_len(name, 80, "Skill name")
    level = max(0, min(100, level))
    db.add(Skill(category_id=category_id, name=name, level=level, order_index=order_index))
    db.commit()
    return RedirectResponse("/admin/skills", status_code=303)


@router.post("/skills/{skill_id}/delete")
def skill_delete(
    skill_id: int,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
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
    return render_admin(request, "admin/experience_list.html", {"experiences": experiences, "education": education})


@router.get("/experience/new")
def experience_new_form(request: Request, admin_username: str = Depends(require_admin)):
    return render_admin(request, "admin/experience_form.html", {"experience": None})


@router.get("/experience/{experience_id}/edit")
def experience_edit_form(
    experience_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    experience = db.get(Experience, experience_id)
    return render_admin(request, "admin/experience_form.html", {"experience": experience})


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
    _csrf: None = Depends(require_csrf),
):
    _require_len(role, 150, "Role")
    _require_len(company, 150, "Company")
    _require_len(location, 120, "Location")
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
    _csrf: None = Depends(require_csrf),
):
    _require_len(role, 150, "Role")
    _require_len(company, 150, "Company")
    _require_len(location, 120, "Location")
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
    experience_id: int,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
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
    _csrf: None = Depends(require_csrf),
):
    _require_len(institution, 150, "Institution")
    _require_len(degree, 150, "Degree")
    _require_len(field, 150, "Field")
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
    education_id: int,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
):
    education = db.get(Education, education_id)
    if education is not None:
        db.delete(education)
        db.commit()
    return RedirectResponse("/admin/experience", status_code=303)


# ---------------------------------------------------------------------------
# Blog posts
# ---------------------------------------------------------------------------

@router.get("/posts")
def posts_admin(
    request: Request, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    posts = db.query(Post).order_by(Post.order_index, Post.updated_at.desc()).all()
    return render_admin(request, "admin/posts_list.html", {"posts": posts})


@router.get("/posts/new")
def post_new_form(request: Request, admin_username: str = Depends(require_admin)):
    return render_admin(request, "admin/post_form.html", {"post": None, "error": None})


@router.get("/posts/{post_id}/edit")
def post_edit_form(
    post_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
):
    post = db.get(Post, post_id)
    return render_admin(request, "admin/post_form.html", {"post": post, "error": None})


def _post_form_context(post_id, title, summary, content_markdown, cover_image_url, tags, published, order_index):
    """Build a not-yet-saved Post-shaped object so a failed validation can
    re-render the form with exactly what the admin typed, instead of
    discarding it."""
    return Post(
        id=post_id,
        title=title,
        summary=summary,
        content_markdown=content_markdown,
        cover_image_url=cover_image_url,
        tags=tags,
        published=published,
        order_index=order_index,
    )


@router.post("/posts/new")
def post_create(
    request: Request,
    title: str = Form(...),
    summary: str = Form(""),
    content_markdown: str = Form(...),
    cover_image_url: str = Form(""),
    tags: str = Form(""),
    published: bool = Form(False),
    order_index: int = Form(0),
    cover_image_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
):
    error = None
    if not title.strip():
        error = "Title is required."
    elif len(title) > 200:
        error = "Title must be 200 characters or fewer."
    elif len(summary) > 300:
        error = "Summary must be 300 characters or fewer."
    elif len(tags) > 300:
        error = "Tags must be 300 characters or fewer."
    elif not content_markdown.strip():
        error = "Content is required."
    elif len(content_markdown) > _MAX_MARKDOWN_CHARS:
        error = f"Content is too long (max {_MAX_MARKDOWN_CHARS:,} characters)."
    elif len(cover_image_url) > 500:
        error = "Cover image URL must be 500 characters or fewer."

    if error:
        preview = _post_form_context(
            None, title, summary, content_markdown, cover_image_url, tags, published, order_index
        )
        return render_admin(request, "admin/post_form.html", {"post": preview, "error": error}, status_code=400)

    cover_image_url = save_image(cover_image_file) or cover_image_url
    now = datetime.utcnow()
    post = Post(
        title=title,
        slug=_unique_post_slug(db, title),
        summary=summary,
        content_markdown=content_markdown,
        content_html=render_post_html(content_markdown),
        cover_image_url=cover_image_url,
        tags=tags,
        published=published,
        published_at=now if published else None,
        order_index=order_index,
    )
    db.add(post)
    db.commit()
    return RedirectResponse("/admin/posts", status_code=303)


@router.post("/posts/{post_id}/edit")
def post_update(
    post_id: int,
    request: Request,
    title: str = Form(...),
    summary: str = Form(""),
    content_markdown: str = Form(...),
    cover_image_url: str = Form(""),
    tags: str = Form(""),
    published: bool = Form(False),
    order_index: int = Form(0),
    cover_image_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
):
    post = db.get(Post, post_id)
    if post is None:
        return RedirectResponse("/admin/posts", status_code=303)

    error = None
    if not title.strip():
        error = "Title is required."
    elif len(title) > 200:
        error = "Title must be 200 characters or fewer."
    elif len(summary) > 300:
        error = "Summary must be 300 characters or fewer."
    elif len(tags) > 300:
        error = "Tags must be 300 characters or fewer."
    elif not content_markdown.strip():
        error = "Content is required."
    elif len(content_markdown) > _MAX_MARKDOWN_CHARS:
        error = f"Content is too long (max {_MAX_MARKDOWN_CHARS:,} characters)."
    elif len(cover_image_url) > 500:
        error = "Cover image URL must be 500 characters or fewer."

    if error:
        preview = _post_form_context(
            post.id, title, summary, content_markdown, cover_image_url, tags, published, order_index
        )
        return render_admin(request, "admin/post_form.html", {"post": preview, "error": error}, status_code=400)

    uploaded_cover = save_image(cover_image_file)
    was_published = post.published

    post.title = title
    post.slug = _unique_post_slug(db, title, ignore_id=post.id)
    post.summary = summary
    post.content_markdown = content_markdown
    post.content_html = render_post_html(content_markdown)
    post.cover_image_url = uploaded_cover or cover_image_url
    post.tags = tags
    post.published = published
    post.order_index = order_index
    if published and not was_published:
        post.published_at = datetime.utcnow()  # first time this post goes live
    elif not published:
        post.published_at = None
    db.add(post)
    db.commit()
    return RedirectResponse("/admin/posts", status_code=303)


@router.post("/posts/{post_id}/delete")
def post_delete(
    post_id: int,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
):
    post = db.get(Post, post_id)
    if post is not None:
        db.query(PostView).filter(PostView.post_id == post_id).delete()
        db.delete(post)
        db.commit()
    return RedirectResponse("/admin/posts", status_code=303)


@router.post("/posts/{post_id}/toggle-published")
def post_toggle_published(
    post_id: int,
    db: Session = Depends(get_db),
    admin_username: str = Depends(require_admin),
    _csrf: None = Depends(require_csrf),
):
    post = db.get(Post, post_id)
    if post is not None:
        post.published = not post.published
        post.published_at = datetime.utcnow() if post.published else None
        db.add(post)
        db.commit()
    return RedirectResponse("/admin/posts", status_code=303)


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics")
def analytics_dashboard(
    request: Request, db: Session = Depends(get_db), admin_username: str = Depends(require_admin)
):
    posts = db.query(Post).order_by(Post.view_count.desc()).all()
    total_views = db.query(func.coalesce(func.sum(Post.view_count), 0)).scalar() or 0

    today = datetime.utcnow().date()
    per_post_recent = {}
    for post in posts:
        views_7 = (
            db.query(func.coalesce(func.sum(PostView.count), 0))
            .filter(PostView.post_id == post.id, PostView.day >= today - _timedelta(7))
            .scalar()
            or 0
        )
        views_30 = (
            db.query(func.coalesce(func.sum(PostView.count), 0))
            .filter(PostView.post_id == post.id, PostView.day >= today - _timedelta(30))
            .scalar()
            or 0
        )
        per_post_recent[post.id] = {"last_7_days": views_7, "last_30_days": views_30}

    return render_admin(
        request,
        "admin/analytics.html",
        {"posts": posts, "total_views": total_views, "per_post_recent": per_post_recent},
    )


def _timedelta(days: int):
    from datetime import timedelta

    return timedelta(days=days)
