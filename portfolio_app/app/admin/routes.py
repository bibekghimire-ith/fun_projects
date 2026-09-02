"""Admin blueprint: portfolio-content CRUD screens (Phase 2).

Every route below is behind `admin_required` (server-side authentication +
role check on every request - see app/auth/decorators.py). Object access is
always re-verified server-side against the current admin's own `Profile`
(via `pc.get_scoped(model, entity_id, profile_id=profile.id)` or the
category/project-scoped equivalents) rather than trusting a client-supplied
id to belong to the right owner - the IDOR guard CLAUDE.md/docs/SECURITY.md
require. A request for an id that exists but belongs to a different scope
(or doesn't exist at all) gets an identical 404, never a distinguishing
403/200 that would leak existence.

CSRF is enforced globally by the already-configured `CSRFProtect` extension
(Phase 0/1) for every state-changing (POST) request here, including the
delete/move actions that don't have a dedicated WTForms class - no extra
wiring needed, verified the same way Phase 1 verified it for logout.

Reordering is exposed to the admin as "move up"/"move down" buttons (see
app/services/portfolio_content.py's `move()`) rather than a drag-and-drop
widget, so it is fully keyboard-/screen-reader-operable without JavaScript;
`reorder_scoped()` (whole-list reorder from an explicit ordered-id list)
also exists in the service layer and is covered by tests, for a future
HTMX-driven drag-and-drop UI to call without any model/service changes.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

from flask import Blueprint, abort, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.admin.forms import (
    AchievementForm,
    BlogCategoryForm,
    BlogPostForm,
    BlogScheduleForm,
    BlogTagForm,
    CertificationForm,
    EducationForm,
    ExperienceForm,
    MediaUploadForm,
    NavigationItemForm,
    ProfileForm,
    ProjectForm,
    ResumeForm,
    SkillCategoryForm,
    SkillForm,
    SocialLinkForm,
)
from app.auth.decorators import admin_required
from app.common.storage import get_storage_adapter
from app.models.achievement import Achievement
from app.models.certification import Certification
from app.models.contact_message import ContactMessageStatus
from app.models.education import Education
from app.models.experience import Experience
from app.models.navigation import NavigationItem
from app.models.profile import SocialLink
from app.models.skill import Skill, SkillCategory
from app.services import (
    blog_category_service,
    blog_service,
    blog_tag_service,
    contact_service,
    media_service,
    nav_service,
    profile_service,
    project_service,
    resume_service,
    skill_service,
    template_service,
)
from app.services import portfolio_content as pc
from app.services.media_service import UploadValidationError
from app.templates_engine import registry

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.get("/")
@admin_required
def dashboard():
    return render_template("admin/dashboard.html", user=current_user)


def _form_fields(form) -> dict:
    """Plain {field_name: value} for a validated form, minus csrf_token.

    Field names in app/admin/forms.py are deliberately chosen to match the
    target model's column names exactly, so this dict can be passed
    straight into the service layer's create/update functions - nothing
    here trusts field *names* the client didn't already have to match a
    known WTForms field to submit in the first place (mass-assignment is
    bounded by the form's declared fields, not by arbitrary POST body keys).
    """

    data = dict(form.data)
    data.pop("csrf_token", None)
    return data


# --- Profile (singleton) -----------------------------------------------------


@admin_bp.route("/profile", methods=["GET", "POST"], endpoint="profile_edit")
@admin_required
def profile_edit():
    profile = profile_service.get_or_create_profile(current_user)
    form = ProfileForm(obj=profile)
    if form.validate_on_submit():
        profile_service.update_profile(profile, _form_fields(form))
        flash("Profile updated.", "success")
        return redirect(url_for("admin.profile_edit"))
    return render_template(
        "admin/entity_form.html",
        heading="Profile",
        form=form,
        cancel_url=url_for("admin.dashboard"),
    )


# --- Resume (singleton) ------------------------------------------------------


@admin_bp.route("/resume", methods=["GET", "POST"], endpoint="resume_edit")
@admin_required
def resume_edit():
    profile = profile_service.get_or_create_profile(current_user)
    resume = resume_service.get_resume(profile)
    form = ResumeForm(obj=resume)
    if form.validate_on_submit():
        resume_service.upsert_resume(profile, _form_fields(form))
        flash("Resume updated.", "success")
        return redirect(url_for("admin.resume_edit"))
    return render_template(
        "admin/entity_form.html",
        heading="Resume",
        form=form,
        cancel_url=url_for("admin.dashboard"),
    )


# --- Generic profile-scoped CRUD factory -------------------------------------


def _register_profile_scoped_crud(
    *,
    url_slug: str,
    endpoint_prefix: str,
    model: type,
    form_cls: type,
    heading_singular: str,
    heading_plural: str,
    columns_fn: Callable[[Any], list[str]],
    label_fn: Callable[[Any], str],
) -> None:
    """Register list/new/edit/delete/move-up/move-down routes for a simple,
    Profile-scoped, ordered/visible content type (SocialLink, Experience,
    Education, Certification, Achievement)."""

    def _profile():
        return profile_service.get_or_create_profile(current_user)

    def list_view():
        profile = _profile()
        items = pc.list_scoped(model, profile_id=profile.id)
        rows = [
            {
                "columns": columns_fn(item),
                "visible": item.visible,
                "label": label_fn(item),
                "edit_url": url_for(f"admin.{endpoint_prefix}_edit", entity_id=item.id),
                "move_up_url": url_for(f"admin.{endpoint_prefix}_move_up", entity_id=item.id),
                "move_down_url": url_for(f"admin.{endpoint_prefix}_move_down", entity_id=item.id),
                "delete_url": url_for(f"admin.{endpoint_prefix}_delete", entity_id=item.id),
            }
            for item in items
        ]
        return render_template(
            "admin/entity_list.html",
            heading=heading_plural,
            new_url=url_for(f"admin.{endpoint_prefix}_new"),
            column_labels=columns_fn.labels,
            rows=rows,
        )

    def new_view():
        profile = _profile()
        form = form_cls()
        if form.validate_on_submit():
            pc.create_scoped(model, _form_fields(form), profile_id=profile.id)
            flash(f"{heading_singular} created.", "success")
            return redirect(url_for(f"admin.{endpoint_prefix}_list"))
        return render_template(
            "admin/entity_form.html",
            heading=f"New {heading_singular}",
            form=form,
            cancel_url=url_for(f"admin.{endpoint_prefix}_list"),
        )

    def edit_view(entity_id: uuid.UUID):
        profile = _profile()
        entity = pc.get_scoped(model, entity_id, profile_id=profile.id)
        if entity is None:
            abort(404)
        form = form_cls(obj=entity)
        if form.validate_on_submit():
            pc.update_entity(entity, _form_fields(form))
            flash(f"{heading_singular} updated.", "success")
            return redirect(url_for(f"admin.{endpoint_prefix}_list"))
        return render_template(
            "admin/entity_form.html",
            heading=f"Edit {heading_singular}",
            form=form,
            cancel_url=url_for(f"admin.{endpoint_prefix}_list"),
        )

    def delete_view(entity_id: uuid.UUID):
        profile = _profile()
        entity = pc.get_scoped(model, entity_id, profile_id=profile.id)
        if entity is None:
            abort(404)
        pc.delete_entity(entity)
        flash(f"{heading_singular} deleted.", "success")
        return redirect(url_for(f"admin.{endpoint_prefix}_list"))

    def move_up_view(entity_id: uuid.UUID):
        profile = _profile()
        entity = pc.get_scoped(model, entity_id, profile_id=profile.id)
        if entity is None:
            abort(404)
        pc.move(model, entity, "up", profile_id=profile.id)
        return redirect(url_for(f"admin.{endpoint_prefix}_list"))

    def move_down_view(entity_id: uuid.UUID):
        profile = _profile()
        entity = pc.get_scoped(model, entity_id, profile_id=profile.id)
        if entity is None:
            abort(404)
        pc.move(model, entity, "down", profile_id=profile.id)
        return redirect(url_for(f"admin.{endpoint_prefix}_list"))

    admin_bp.add_url_rule(
        f"/{url_slug}", endpoint=f"{endpoint_prefix}_list", view_func=admin_required(list_view)
    )
    admin_bp.add_url_rule(
        f"/{url_slug}/new",
        endpoint=f"{endpoint_prefix}_new",
        view_func=admin_required(new_view),
        methods=["GET", "POST"],
    )
    admin_bp.add_url_rule(
        f"/{url_slug}/<uuid:entity_id>/edit",
        endpoint=f"{endpoint_prefix}_edit",
        view_func=admin_required(edit_view),
        methods=["GET", "POST"],
    )
    admin_bp.add_url_rule(
        f"/{url_slug}/<uuid:entity_id>/delete",
        endpoint=f"{endpoint_prefix}_delete",
        view_func=admin_required(delete_view),
        methods=["POST"],
    )
    admin_bp.add_url_rule(
        f"/{url_slug}/<uuid:entity_id>/move-up",
        endpoint=f"{endpoint_prefix}_move_up",
        view_func=admin_required(move_up_view),
        methods=["POST"],
    )
    admin_bp.add_url_rule(
        f"/{url_slug}/<uuid:entity_id>/move-down",
        endpoint=f"{endpoint_prefix}_move_down",
        view_func=admin_required(move_down_view),
        methods=["POST"],
    )


def _columns(*labels: str) -> Callable[[Any], list[str]]:
    """Build a columns_fn that reads the given attribute names off an entity."""

    def _get(item: object) -> list[str]:
        return [str(getattr(item, name) or "") for name in labels]

    _get.labels = [name.replace("_", " ").title() for name in labels]  # type: ignore[attr-defined]
    return _get


_register_profile_scoped_crud(
    url_slug="social-links",
    endpoint_prefix="social_links",
    model=SocialLink,
    form_cls=SocialLinkForm,
    heading_singular="Social link",
    heading_plural="Social links",
    columns_fn=_columns("platform", "label", "url"),
    label_fn=lambda item: item.platform,
)

_register_profile_scoped_crud(
    url_slug="experience",
    endpoint_prefix="experience",
    model=Experience,
    form_cls=ExperienceForm,
    heading_singular="Experience entry",
    heading_plural="Experience",
    columns_fn=_columns("company", "role", "start_date", "end_date"),
    label_fn=lambda item: f"{item.role} at {item.company}",
)

_register_profile_scoped_crud(
    url_slug="education",
    endpoint_prefix="education",
    model=Education,
    form_cls=EducationForm,
    heading_singular="Education entry",
    heading_plural="Education",
    columns_fn=_columns("institution", "degree", "field"),
    label_fn=lambda item: item.institution,
)

_register_profile_scoped_crud(
    url_slug="certifications",
    endpoint_prefix="certifications",
    model=Certification,
    form_cls=CertificationForm,
    heading_singular="Certification",
    heading_plural="Certifications",
    columns_fn=_columns("name", "issuer", "issue_date"),
    label_fn=lambda item: item.name,
)

_register_profile_scoped_crud(
    url_slug="achievements",
    endpoint_prefix="achievements",
    model=Achievement,
    form_cls=AchievementForm,
    heading_singular="Achievement",
    heading_plural="Achievements",
    columns_fn=_columns("title", "issuer", "achievement_date"),
    label_fn=lambda item: item.title,
)


# --- Projects (Profile-scoped; slug + technology-list handling) -------------


@admin_bp.get("/projects", endpoint="projects_list")
@admin_required
def projects_list():
    profile = profile_service.get_or_create_profile(current_user)
    items = project_service.list_projects(profile)
    rows = [
        {
            "columns": [item.title, item.slug, "Yes" if item.featured else "No"],
            "visible": item.visible,
            "label": item.title,
            "edit_url": url_for("admin.projects_edit", entity_id=item.id),
            "move_up_url": url_for("admin.projects_move_up", entity_id=item.id),
            "move_down_url": url_for("admin.projects_move_down", entity_id=item.id),
            "delete_url": url_for("admin.projects_delete", entity_id=item.id),
        }
        for item in items
    ]
    return render_template(
        "admin/entity_list.html",
        heading="Projects",
        new_url=url_for("admin.projects_new"),
        column_labels=["Title", "Slug", "Featured"],
        rows=rows,
    )


def _project_form_fields(form: ProjectForm) -> tuple[dict, list[str]]:
    fields = _form_fields(form)
    technologies_text = fields.pop("technologies", "") or ""
    return fields, project_service.parse_technologies_text(technologies_text)


@admin_bp.route("/projects/new", methods=["GET", "POST"], endpoint="projects_new")
@admin_required
def projects_new():
    profile = profile_service.get_or_create_profile(current_user)
    form = ProjectForm()
    if form.validate_on_submit():
        fields, technologies = _project_form_fields(form)
        project_service.create_project(profile, fields, technologies)
        flash("Project created.", "success")
        return redirect(url_for("admin.projects_list"))
    return render_template(
        "admin/entity_form.html",
        heading="New project",
        form=form,
        cancel_url=url_for("admin.projects_list"),
    )


@admin_bp.route(
    "/projects/<uuid:entity_id>/edit", methods=["GET", "POST"], endpoint="projects_edit"
)
@admin_required
def projects_edit(entity_id: uuid.UUID):
    profile = profile_service.get_or_create_profile(current_user)
    project = project_service.get_project(profile, entity_id)
    if project is None:
        abort(404)
    form = ProjectForm(obj=project)
    if not form.is_submitted():
        form.technologies.data = project_service.technologies_to_text(project)
    if form.validate_on_submit():
        fields, technologies = _project_form_fields(form)
        project_service.update_project(project, fields, technologies)
        flash("Project updated.", "success")
        return redirect(url_for("admin.projects_list"))
    return render_template(
        "admin/entity_form.html",
        heading="Edit project",
        form=form,
        cancel_url=url_for("admin.projects_list"),
    )


@admin_bp.post("/projects/<uuid:entity_id>/delete", endpoint="projects_delete")
@admin_required
def projects_delete(entity_id: uuid.UUID):
    profile = profile_service.get_or_create_profile(current_user)
    project = project_service.get_project(profile, entity_id)
    if project is None:
        abort(404)
    project_service.delete_project(project)
    flash("Project deleted.", "success")
    return redirect(url_for("admin.projects_list"))


@admin_bp.post("/projects/<uuid:entity_id>/move-up", endpoint="projects_move_up")
@admin_required
def projects_move_up(entity_id: uuid.UUID):
    profile = profile_service.get_or_create_profile(current_user)
    project = project_service.get_project(profile, entity_id)
    if project is None:
        abort(404)
    project_service.move_project(profile, project, "up")
    return redirect(url_for("admin.projects_list"))


@admin_bp.post("/projects/<uuid:entity_id>/move-down", endpoint="projects_move_down")
@admin_required
def projects_move_down(entity_id: uuid.UUID):
    profile = profile_service.get_or_create_profile(current_user)
    project = project_service.get_project(profile, entity_id)
    if project is None:
        abort(404)
    project_service.move_project(profile, project, "down")
    return redirect(url_for("admin.projects_list"))


# --- Skill categories (global) + Skills (nested under a category) -----------


@admin_bp.get("/skill-categories", endpoint="skill_categories_list")
@admin_required
def skill_categories_list():
    items = skill_service.list_skill_categories()
    rows = [
        {
            "columns": [item.name],
            "visible": item.visible,
            "label": item.name,
            "extra_actions": [("Manage skills", url_for("admin.skills_list", category_id=item.id))],
            "edit_url": url_for("admin.skill_categories_edit", entity_id=item.id),
            "move_up_url": url_for("admin.skill_categories_move_up", entity_id=item.id),
            "move_down_url": url_for("admin.skill_categories_move_down", entity_id=item.id),
            "delete_url": url_for("admin.skill_categories_delete", entity_id=item.id),
        }
        for item in items
    ]
    return render_template(
        "admin/entity_list.html",
        heading="Skill categories",
        new_url=url_for("admin.skill_categories_new"),
        column_labels=["Name"],
        rows=rows,
    )


@admin_bp.route("/skill-categories/new", methods=["GET", "POST"], endpoint="skill_categories_new")
@admin_required
def skill_categories_new():
    form = SkillCategoryForm()
    if form.validate_on_submit():
        skill_service.create_skill_category(_form_fields(form))
        flash("Skill category created.", "success")
        return redirect(url_for("admin.skill_categories_list"))
    return render_template(
        "admin/entity_form.html",
        heading="New skill category",
        form=form,
        cancel_url=url_for("admin.skill_categories_list"),
    )


def _get_skill_category_or_404(category_id: uuid.UUID) -> SkillCategory:
    category = skill_service.get_skill_category(category_id)
    if category is None:
        abort(404)
    return category


@admin_bp.route(
    "/skill-categories/<uuid:entity_id>/edit",
    methods=["GET", "POST"],
    endpoint="skill_categories_edit",
)
@admin_required
def skill_categories_edit(entity_id: uuid.UUID):
    category = _get_skill_category_or_404(entity_id)
    form = SkillCategoryForm(obj=category)
    if form.validate_on_submit():
        skill_service.update_skill_category(category, _form_fields(form))
        flash("Skill category updated.", "success")
        return redirect(url_for("admin.skill_categories_list"))
    return render_template(
        "admin/entity_form.html",
        heading="Edit skill category",
        form=form,
        cancel_url=url_for("admin.skill_categories_list"),
    )


@admin_bp.post("/skill-categories/<uuid:entity_id>/delete", endpoint="skill_categories_delete")
@admin_required
def skill_categories_delete(entity_id: uuid.UUID):
    category = _get_skill_category_or_404(entity_id)
    skill_service.delete_skill_category(category)
    flash("Skill category deleted.", "success")
    return redirect(url_for("admin.skill_categories_list"))


@admin_bp.post("/skill-categories/<uuid:entity_id>/move-up", endpoint="skill_categories_move_up")
@admin_required
def skill_categories_move_up(entity_id: uuid.UUID):
    category = _get_skill_category_or_404(entity_id)
    skill_service.move_skill_category(category, "up")
    return redirect(url_for("admin.skill_categories_list"))


@admin_bp.post(
    "/skill-categories/<uuid:entity_id>/move-down", endpoint="skill_categories_move_down"
)
@admin_required
def skill_categories_move_down(entity_id: uuid.UUID):
    category = _get_skill_category_or_404(entity_id)
    skill_service.move_skill_category(category, "down")
    return redirect(url_for("admin.skill_categories_list"))


@admin_bp.get("/skill-categories/<uuid:category_id>/skills", endpoint="skills_list")
@admin_required
def skills_list(category_id: uuid.UUID):
    category = _get_skill_category_or_404(category_id)
    items = skill_service.list_skills(category)
    rows = [
        {
            "columns": [item.name, str(item.proficiency), str(item.years_experience or "")],
            "visible": item.visible,
            "label": item.name,
            "edit_url": url_for("admin.skills_edit", category_id=category.id, entity_id=item.id),
            "move_up_url": url_for(
                "admin.skills_move_up", category_id=category.id, entity_id=item.id
            ),
            "move_down_url": url_for(
                "admin.skills_move_down", category_id=category.id, entity_id=item.id
            ),
            "delete_url": url_for(
                "admin.skills_delete", category_id=category.id, entity_id=item.id
            ),
        }
        for item in items
    ]
    return render_template(
        "admin/entity_list.html",
        heading=f"Skills in {category.name}",
        new_url=url_for("admin.skills_new", category_id=category.id),
        back_url=url_for("admin.skill_categories_list"),
        column_labels=["Name", "Proficiency", "Years"],
        rows=rows,
    )


@admin_bp.route(
    "/skill-categories/<uuid:category_id>/skills/new",
    methods=["GET", "POST"],
    endpoint="skills_new",
)
@admin_required
def skills_new(category_id: uuid.UUID):
    category = _get_skill_category_or_404(category_id)
    form = SkillForm()
    if form.validate_on_submit():
        fields = _form_fields(form)
        fields["proficiency"] = int(fields["proficiency"])
        skill_service.create_skill(category, fields)
        flash("Skill created.", "success")
        return redirect(url_for("admin.skills_list", category_id=category.id))
    return render_template(
        "admin/entity_form.html",
        heading=f"New skill in {category.name}",
        form=form,
        cancel_url=url_for("admin.skills_list", category_id=category.id),
    )


def _get_skill_or_404(category: SkillCategory, entity_id: uuid.UUID) -> Skill:
    skill = skill_service.get_skill(category, entity_id)
    if skill is None:
        abort(404)
    return skill


@admin_bp.route(
    "/skill-categories/<uuid:category_id>/skills/<uuid:entity_id>/edit",
    methods=["GET", "POST"],
    endpoint="skills_edit",
)
@admin_required
def skills_edit(category_id: uuid.UUID, entity_id: uuid.UUID):
    category = _get_skill_category_or_404(category_id)
    skill = _get_skill_or_404(category, entity_id)
    form = SkillForm(obj=skill)
    if not form.is_submitted():
        form.proficiency.data = str(skill.proficiency)
    if form.validate_on_submit():
        fields = _form_fields(form)
        fields["proficiency"] = int(fields["proficiency"])
        skill_service.update_skill(skill, fields)
        flash("Skill updated.", "success")
        return redirect(url_for("admin.skills_list", category_id=category.id))
    return render_template(
        "admin/entity_form.html",
        heading=f"Edit skill in {category.name}",
        form=form,
        cancel_url=url_for("admin.skills_list", category_id=category.id),
    )


@admin_bp.post(
    "/skill-categories/<uuid:category_id>/skills/<uuid:entity_id>/delete", endpoint="skills_delete"
)
@admin_required
def skills_delete(category_id: uuid.UUID, entity_id: uuid.UUID):
    category = _get_skill_category_or_404(category_id)
    skill = _get_skill_or_404(category, entity_id)
    skill_service.delete_skill(skill)
    flash("Skill deleted.", "success")
    return redirect(url_for("admin.skills_list", category_id=category.id))


@admin_bp.post(
    "/skill-categories/<uuid:category_id>/skills/<uuid:entity_id>/move-up",
    endpoint="skills_move_up",
)
@admin_required
def skills_move_up(category_id: uuid.UUID, entity_id: uuid.UUID):
    category = _get_skill_category_or_404(category_id)
    skill = _get_skill_or_404(category, entity_id)
    skill_service.move_skill(category, skill, "up")
    return redirect(url_for("admin.skills_list", category_id=category.id))


@admin_bp.post(
    "/skill-categories/<uuid:category_id>/skills/<uuid:entity_id>/move-down",
    endpoint="skills_move_down",
)
@admin_required
def skills_move_down(category_id: uuid.UUID, entity_id: uuid.UUID):
    category = _get_skill_category_or_404(category_id)
    skill = _get_skill_or_404(category, entity_id)
    skill_service.move_skill(category, skill, "down")
    return redirect(url_for("admin.skills_list", category_id=category.id))


# --- Navigation (Phase 4: global, unscoped, ordered/visible list) ----------
#
# Same shape as skill categories - a small global list, not Profile-scoped
# (single portfolio) - but restricted to a fixed, code-defined set of
# selectable public endpoints (app/services/nav_service.ALLOWED_NAV_ENDPOINTS)
# rather than a free-text URL, so a navigation entry can never point
# anywhere the public site doesn't actually serve.


@admin_bp.get("/navigation", endpoint="navigation_list")
@admin_required
def navigation_list():
    items = nav_service.list_all()
    endpoint_labels = dict(nav_service.endpoint_choices())
    rows = [
        {
            "columns": [item.label, endpoint_labels.get(item.endpoint, item.endpoint)],
            "visible": item.visible,
            "label": item.label,
            "edit_url": url_for("admin.navigation_edit", entity_id=item.id),
            "move_up_url": url_for("admin.navigation_move_up", entity_id=item.id),
            "move_down_url": url_for("admin.navigation_move_down", entity_id=item.id),
            "delete_url": url_for("admin.navigation_delete", entity_id=item.id),
        }
        for item in items
    ]
    return render_template(
        "admin/entity_list.html",
        heading="Navigation",
        new_url=url_for("admin.navigation_new"),
        column_labels=["Label", "Page"],
        rows=rows,
    )


@admin_bp.route("/navigation/new", methods=["GET", "POST"], endpoint="navigation_new")
@admin_required
def navigation_new():
    form = NavigationItemForm()
    if form.validate_on_submit():
        nav_service.create(_form_fields(form))
        flash("Navigation item created.", "success")
        return redirect(url_for("admin.navigation_list"))
    return render_template(
        "admin/entity_form.html",
        heading="New navigation item",
        form=form,
        cancel_url=url_for("admin.navigation_list"),
    )


def _get_navigation_item_or_404(entity_id: uuid.UUID) -> NavigationItem:
    item = nav_service.get(entity_id)
    if item is None:
        abort(404)
    return item


@admin_bp.route(
    "/navigation/<uuid:entity_id>/edit", methods=["GET", "POST"], endpoint="navigation_edit"
)
@admin_required
def navigation_edit(entity_id: uuid.UUID):
    item = _get_navigation_item_or_404(entity_id)
    form = NavigationItemForm(obj=item)
    if form.validate_on_submit():
        nav_service.update(item, _form_fields(form))
        flash("Navigation item updated.", "success")
        return redirect(url_for("admin.navigation_list"))
    return render_template(
        "admin/entity_form.html",
        heading="Edit navigation item",
        form=form,
        cancel_url=url_for("admin.navigation_list"),
    )


@admin_bp.post("/navigation/<uuid:entity_id>/delete", endpoint="navigation_delete")
@admin_required
def navigation_delete(entity_id: uuid.UUID):
    item = _get_navigation_item_or_404(entity_id)
    nav_service.delete(item)
    flash("Navigation item deleted.", "success")
    return redirect(url_for("admin.navigation_list"))


@admin_bp.post("/navigation/<uuid:entity_id>/move-up", endpoint="navigation_move_up")
@admin_required
def navigation_move_up(entity_id: uuid.UUID):
    item = _get_navigation_item_or_404(entity_id)
    nav_service.move(item, "up")
    return redirect(url_for("admin.navigation_list"))


@admin_bp.post("/navigation/<uuid:entity_id>/move-down", endpoint="navigation_move_down")
@admin_required
def navigation_move_down(entity_id: uuid.UUID):
    item = _get_navigation_item_or_404(entity_id)
    nav_service.move(item, "down")
    return redirect(url_for("admin.navigation_list"))


# --- Templates (Phase 3: registry-backed theme selection + preview) --------
#
# "Preview" here means a signed-in admin viewing a theme rendered with their
# own real portfolio content, at an admin_required route - there is no
# public-facing portfolio site yet (that's Phase 4), so this is the only
# place any of the five themes are reachable in a browser today. See
# docs/DECISIONS.md (Phase 3) for why an admin-only preview route, rather
# than a public preview, was chosen for this phase.


@admin_bp.get("/templates", endpoint="templates_list")
@admin_required
def templates_list():
    templates = template_service.list_templates()
    return render_template(
        "admin/templates_list.html",
        heading="Templates",
        templates=templates,
    )


@admin_bp.post("/templates/<string:key>/activate", endpoint="templates_activate")
@admin_required
def templates_activate(key: str):
    try:
        template = template_service.set_active_template(key)
    except template_service.UnknownTemplateError:
        abort(404)
    flash(f"{template.name} is now the active template.", "success")
    return redirect(url_for("admin.templates_list"))


@admin_bp.get("/templates/<string:key>/preview", endpoint="templates_preview")
@admin_required
def templates_preview(key: str):
    if not registry.is_valid_theme(key):
        abort(404)

    profile = profile_service.get_or_create_profile(current_user)
    experiences = pc.list_scoped(Experience, profile_id=profile.id)
    html = template_service.render_preview(key, profile=profile, experiences=experiences)
    return html


# --- Blog (Phase 5: posts, categories, tags) --------------------------------
#
# Posts are NOT registered through `_register_profile_scoped_crud` - they
# have no `profile_id`/OrderingMixin/VisibilityMixin (a blog is global to
# this single-portfolio app, and "visible" is replaced entirely by the
# richer draft/published/scheduled state machine in app/services/
# blog_service.py) and need dedicated publish/unpublish/schedule/preview
# actions the generic factory doesn't model.


def _blog_post_form_fields(form: BlogPostForm) -> tuple[dict, list[str]]:
    fields = _form_fields(form)
    tags_text = fields.pop("tags", "") or ""
    fields["category_id"] = form.category_uuid()
    return fields, blog_tag_service.parse_tag_names(tags_text)


@admin_bp.get("/blog", endpoint="blog_list")
@admin_required
def blog_list():
    status_filter = request.args.get("status") or None
    posts = blog_service.list_posts(status=status_filter)
    return render_template(
        "admin/blog_list.html",
        heading="Blog posts",
        posts=posts,
        status_filter=status_filter,
    )


@admin_bp.route("/blog/new", methods=["GET", "POST"], endpoint="blog_new")
@admin_required
def blog_new():
    form = BlogPostForm()
    preview_html = None
    if form.validate_on_submit():
        fields, tag_names = _blog_post_form_fields(form)
        blog_service.create_post(current_user.id, fields, tag_names)
        flash("Blog post created as a draft.", "success")
        return redirect(url_for("admin.blog_list"))
    if form.is_submitted():
        preview_html = blog_service.preview_html(form.markdown_body.data or "")
    return render_template(
        "admin/blog_form.html",
        heading="New blog post",
        form=form,
        cancel_url=url_for("admin.blog_list"),
        preview_html=preview_html,
        post=None,
    )


@admin_bp.route("/blog/<uuid:entity_id>/edit", methods=["GET", "POST"], endpoint="blog_edit")
@admin_required
def blog_edit(entity_id: uuid.UUID):
    post = blog_service.get_post(entity_id)
    if post is None:
        abort(404)
    form = BlogPostForm(obj=post)
    if not form.is_submitted():
        form.tags.data = blog_tag_service.tags_to_text(post)
        form.category_id.data = str(post.category_id) if post.category_id else ""
    preview_html = None
    if form.validate_on_submit():
        fields, tag_names = _blog_post_form_fields(form)
        blog_service.update_post(post, fields, tag_names)
        flash("Blog post updated.", "success")
        return redirect(url_for("admin.blog_list"))
    if form.is_submitted():
        preview_html = blog_service.preview_html(form.markdown_body.data or "")
    return render_template(
        "admin/blog_form.html",
        heading="Edit blog post",
        form=form,
        cancel_url=url_for("admin.blog_list"),
        preview_html=preview_html,
        post=post,
    )


@admin_bp.post("/blog/<uuid:entity_id>/delete", endpoint="blog_delete")
@admin_required
def blog_delete(entity_id: uuid.UUID):
    post = blog_service.get_post(entity_id)
    if post is None:
        abort(404)
    blog_service.delete_post(post)
    flash("Blog post deleted.", "success")
    return redirect(url_for("admin.blog_list"))


@admin_bp.post("/blog/<uuid:entity_id>/publish", endpoint="blog_publish")
@admin_required
def blog_publish(entity_id: uuid.UUID):
    post = blog_service.get_post(entity_id)
    if post is None:
        abort(404)
    blog_service.publish_post(post)
    flash("Blog post published.", "success")
    return redirect(url_for("admin.blog_list"))


@admin_bp.post("/blog/<uuid:entity_id>/unpublish", endpoint="blog_unpublish")
@admin_required
def blog_unpublish(entity_id: uuid.UUID):
    post = blog_service.get_post(entity_id)
    if post is None:
        abort(404)
    blog_service.unpublish_post(post)
    flash("Blog post unpublished (moved back to draft).", "success")
    return redirect(url_for("admin.blog_list"))


@admin_bp.route(
    "/blog/<uuid:entity_id>/schedule", methods=["GET", "POST"], endpoint="blog_schedule"
)
@admin_required
def blog_schedule(entity_id: uuid.UUID):
    post = blog_service.get_post(entity_id)
    if post is None:
        abort(404)
    form = BlogScheduleForm()
    if form.validate_on_submit():
        scheduled_at = form.scheduled_at.data
        if scheduled_at.tzinfo is None:
            from datetime import UTC

            scheduled_at = scheduled_at.replace(tzinfo=UTC)
        blog_service.schedule_post(post, scheduled_at)
        flash("Blog post scheduled.", "success")
        return redirect(url_for("admin.blog_list"))
    return render_template(
        "admin/entity_form.html",
        heading=f"Schedule: {post.title}",
        form=form,
        cancel_url=url_for("admin.blog_list"),
    )


@admin_bp.get("/blog/<uuid:entity_id>/preview", endpoint="blog_preview")
@admin_required
def blog_preview(entity_id: uuid.UUID):
    post = blog_service.get_post(entity_id)
    if post is None:
        abort(404)
    return render_template("admin/blog_preview.html", post=post, heading=f"Preview: {post.title}")


# --- Blog categories (global, unscoped list) --------------------------------


@admin_bp.get("/blog/categories", endpoint="blog_categories_list")
@admin_required
def blog_categories_list():
    categories = blog_category_service.list_categories()
    rows = [
        {
            "columns": [category.name, category.slug, category.description or ""],
            "label": category.name,
            "edit_url": url_for("admin.blog_categories_edit", entity_id=category.id),
            "delete_url": url_for("admin.blog_categories_delete", entity_id=category.id),
        }
        for category in categories
    ]
    return render_template(
        "admin/blog_taxonomy_list.html",
        heading="Blog categories",
        new_url=url_for("admin.blog_categories_new"),
        column_labels=["Name", "Slug", "Description"],
        rows=rows,
    )


@admin_bp.route("/blog/categories/new", methods=["GET", "POST"], endpoint="blog_categories_new")
@admin_required
def blog_categories_new():
    form = BlogCategoryForm()
    if form.validate_on_submit():
        blog_category_service.create_category(_form_fields(form))
        flash("Blog category created.", "success")
        return redirect(url_for("admin.blog_categories_list"))
    return render_template(
        "admin/entity_form.html",
        heading="New blog category",
        form=form,
        cancel_url=url_for("admin.blog_categories_list"),
    )


@admin_bp.route(
    "/blog/categories/<uuid:entity_id>/edit",
    methods=["GET", "POST"],
    endpoint="blog_categories_edit",
)
@admin_required
def blog_categories_edit(entity_id: uuid.UUID):
    category = blog_category_service.get_category(entity_id)
    if category is None:
        abort(404)
    form = BlogCategoryForm(obj=category)
    if form.validate_on_submit():
        blog_category_service.update_category(category, _form_fields(form))
        flash("Blog category updated.", "success")
        return redirect(url_for("admin.blog_categories_list"))
    return render_template(
        "admin/entity_form.html",
        heading="Edit blog category",
        form=form,
        cancel_url=url_for("admin.blog_categories_list"),
    )


@admin_bp.post("/blog/categories/<uuid:entity_id>/delete", endpoint="blog_categories_delete")
@admin_required
def blog_categories_delete(entity_id: uuid.UUID):
    category = blog_category_service.get_category(entity_id)
    if category is None:
        abort(404)
    blog_category_service.delete_category(category)
    flash("Blog category deleted.", "success")
    return redirect(url_for("admin.blog_categories_list"))


# --- Blog tags (global, unscoped list) --------------------------------------


@admin_bp.get("/blog/tags", endpoint="blog_tags_list")
@admin_required
def blog_tags_list():
    tags = blog_tag_service.list_tags()
    rows = [
        {
            "columns": [tag.name, tag.slug],
            "label": tag.name,
            "edit_url": url_for("admin.blog_tags_edit", entity_id=tag.id),
            "delete_url": url_for("admin.blog_tags_delete", entity_id=tag.id),
        }
        for tag in tags
    ]
    return render_template(
        "admin/blog_taxonomy_list.html",
        heading="Blog tags",
        new_url=url_for("admin.blog_tags_new"),
        column_labels=["Name", "Slug"],
        rows=rows,
    )


@admin_bp.route("/blog/tags/new", methods=["GET", "POST"], endpoint="blog_tags_new")
@admin_required
def blog_tags_new():
    form = BlogTagForm()
    if form.validate_on_submit():
        blog_tag_service.create_tag(_form_fields(form))
        flash("Blog tag created.", "success")
        return redirect(url_for("admin.blog_tags_list"))
    return render_template(
        "admin/entity_form.html",
        heading="New blog tag",
        form=form,
        cancel_url=url_for("admin.blog_tags_list"),
    )


@admin_bp.route(
    "/blog/tags/<uuid:entity_id>/edit", methods=["GET", "POST"], endpoint="blog_tags_edit"
)
@admin_required
def blog_tags_edit(entity_id: uuid.UUID):
    tag = blog_tag_service.get_tag(entity_id)
    if tag is None:
        abort(404)
    form = BlogTagForm(obj=tag)
    if form.validate_on_submit():
        blog_tag_service.update_tag(tag, _form_fields(form))
        flash("Blog tag updated.", "success")
        return redirect(url_for("admin.blog_tags_list"))
    return render_template(
        "admin/entity_form.html",
        heading="Edit blog tag",
        form=form,
        cancel_url=url_for("admin.blog_tags_list"),
    )


@admin_bp.post("/blog/tags/<uuid:entity_id>/delete", endpoint="blog_tags_delete")
@admin_required
def blog_tags_delete(entity_id: uuid.UUID):
    tag = blog_tag_service.get_tag(entity_id)
    if tag is None:
        abort(404)
    blog_tag_service.delete_tag(tag)
    flash("Blog tag deleted.", "success")
    return redirect(url_for("admin.blog_tags_list"))


# --- Contact messages (Phase 7: admin triage of persisted submissions) -----
#
# Global/unscoped list, same "fetch by id, None -> 404" pattern every other
# admin route in this app uses - there is exactly one admin, so no
# ownership scoping applies, only existence (see docs/API_SPEC.md: GET
# /admin/messages, POST /admin/messages/<id>/status).


@admin_bp.get("/messages", endpoint="messages_list")
@admin_required
def messages_list():
    status_filter = request.args.get("status") or None
    messages = contact_service.list_messages(status=status_filter)
    return render_template(
        "admin/messages_list.html",
        heading="Contact messages",
        messages=messages,
        status_filter=status_filter,
    )


@admin_bp.get("/messages/<uuid:entity_id>", endpoint="messages_detail")
@admin_required
def messages_detail(entity_id: uuid.UUID):
    message = contact_service.get_message(entity_id)
    if message is None:
        abort(404)
    if message.status == ContactMessageStatus.NEW:
        contact_service.mark_status(message, ContactMessageStatus.READ)
    return render_template("admin/message_detail.html", heading="Message", message=message)


@admin_bp.post("/messages/<uuid:entity_id>/status", endpoint="messages_status")
@admin_required
def messages_status(entity_id: uuid.UUID):
    message = contact_service.get_message(entity_id)
    if message is None:
        abort(404)
    status = request.form.get("status", "")
    if status not in ContactMessageStatus.ALL:
        abort(400)
    contact_service.mark_status(message, status)
    flash("Message status updated.", "success")
    return redirect(url_for("admin.messages_detail", entity_id=message.id))


@admin_bp.post("/messages/<uuid:entity_id>/delete", endpoint="messages_delete")
@admin_required
def messages_delete(entity_id: uuid.UUID):
    message = contact_service.get_message(entity_id)
    if message is None:
        abort(404)
    contact_service.delete_message(message)
    flash("Message deleted.", "success")
    return redirect(url_for("admin.messages_list"))


# --- Media uploads (Phase 7: local-storage-backed, admin-only) -------------
#
# A general-purpose upload endpoint rather than wiring uploads directly into
# any single existing *_url field (blog cover image, project image, resume,
# profile photo) - the least invasive integration point given those Phase
# 2/5 forms already accept a plain URL string; an admin uploads an image
# here, gets back its public URL, and pastes it into whichever *_url field
# they want. See docs/DECISIONS.md.


@admin_bp.route("/media", methods=["GET", "POST"], endpoint="media_list")
@admin_required
def media_list_view():
    form = MediaUploadForm()
    if form.validate_on_submit():
        storage = get_storage_adapter(current_app)
        max_size = current_app.config.get("MEDIA_MAX_UPLOAD_BYTES", 5 * 1024 * 1024)
        try:
            media_service.validate_and_save_upload(
                form.file.data,
                uploader=current_user,
                storage=storage,
                max_size_bytes=max_size,
            )
            flash("Image uploaded.", "success")
        except UploadValidationError as exc:
            flash(str(exc), "error")
        return redirect(url_for("admin.media_list"))
    assets = media_service.list_assets()
    rows = [
        {
            "asset": asset,
            "url": url_for("public.media_file", stored_name=asset.stored_name),
            "delete_url": url_for("admin.media_delete", entity_id=asset.id),
        }
        for asset in assets
    ]
    return render_template("admin/media_list.html", heading="Media", form=form, rows=rows)


@admin_bp.post("/media/<uuid:entity_id>/delete", endpoint="media_delete")
@admin_required
def media_delete(entity_id: uuid.UUID):
    asset = media_service.get_asset(entity_id)
    if asset is None:
        abort(404)
    storage = get_storage_adapter(current_app)
    media_service.delete_asset(asset, storage)
    flash("Image deleted.", "success")
    return redirect(url_for("admin.media_list"))
