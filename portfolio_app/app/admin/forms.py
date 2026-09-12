"""Flask-WTF forms for the admin portfolio-content CRUD screens.

Every form is a `FlaskForm`, so each is CSRF-protected automatically via
the globally-configured `CSRFProtect` extension (see app/auth/forms.py's
docstring for the same convention used in Phase 1). Field lengths mirror
the column lengths in the corresponding app/models/*.py definitions so
client-side/server-side validation agree with what the database will
actually accept.
"""

from __future__ import annotations

from flask_wtf import FlaskForm
from flask_wtf.file import FileAllowed, FileField, FileRequired
from wtforms import (
    BooleanField,
    DateField,
    DateTimeField,
    IntegerField,
    SelectField,
    StringField,
    TextAreaField,
)
from wtforms.validators import URL, DataRequired, Email, Length, NumberRange, Optional

from app.services import blog_category_service, nav_service

_URL_MSG = "Enter a valid URL."


class ProfileForm(FlaskForm):
    display_name = StringField("Display name", validators=[DataRequired(), Length(max=150)])
    professional_title = StringField("Professional title", validators=[Optional(), Length(max=150)])
    tagline = StringField("Tagline", validators=[Optional(), Length(max=255)])
    biography = TextAreaField("Biography", validators=[Optional(), Length(max=10000)])
    profile_image_url = StringField(
        "Profile image URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    location_text = StringField("Location", validators=[Optional(), Length(max=150)])
    availability_text = StringField("Availability", validators=[Optional(), Length(max=150)])
    public_email = StringField(
        "Public email",
        validators=[Optional(), Length(max=255), Email(message="Enter a valid email.")],
    )


class SocialLinkForm(FlaskForm):
    platform = StringField("Platform", validators=[DataRequired(), Length(max=50)])
    label = StringField("Label", validators=[Optional(), Length(max=100)])
    url = StringField("URL", validators=[DataRequired(), Length(max=500), URL(message=_URL_MSG)])
    icon = StringField("Icon", validators=[Optional(), Length(max=50)])
    visible = BooleanField("Visible", default=True)


class ExperienceForm(FlaskForm):
    company = StringField("Company", validators=[DataRequired(), Length(max=150)])
    role = StringField("Role", validators=[DataRequired(), Length(max=150)])
    employment_type = StringField("Employment type", validators=[Optional(), Length(max=50)])
    location = StringField("Location", validators=[Optional(), Length(max=150)])
    start_date = DateField("Start date", validators=[DataRequired()])
    end_date = DateField("End date", validators=[Optional()])
    is_current = BooleanField("Currently working here")
    description = TextAreaField("Description", validators=[Optional(), Length(max=10000)])
    visible = BooleanField("Visible", default=True)

    def validate(self, extra_validators=None) -> bool:
        ok = super().validate(extra_validators=extra_validators)
        if ok and not self.is_current.data and self.end_date.data is None:
            self.end_date.errors.append("End date is required unless this is your current role.")
            ok = False
        if ok and self.end_date.data and self.end_date.data < self.start_date.data:
            self.end_date.errors.append("End date cannot be before the start date.")
            ok = False
        return ok


class EducationForm(FlaskForm):
    institution = StringField("Institution", validators=[DataRequired(), Length(max=150)])
    degree = StringField("Degree", validators=[Optional(), Length(max=150)])
    field = StringField("Field of study", validators=[Optional(), Length(max=150)])
    start_date = DateField("Start date", validators=[Optional()])
    end_date = DateField("End date", validators=[Optional()])
    grade_summary = StringField("Grade summary", validators=[Optional(), Length(max=150)])
    description = TextAreaField("Description", validators=[Optional(), Length(max=10000)])
    visible = BooleanField("Visible", default=True)


class SkillCategoryForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=100)])
    visible = BooleanField("Visible", default=True)


class SkillForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=100)])
    proficiency = SelectField(
        "Proficiency",
        choices=[
            ("1", "1 - Beginner"),
            ("2", "2 - Novice"),
            ("3", "3 - Intermediate"),
            ("4", "4 - Advanced"),
            ("5", "5 - Expert"),
        ],
        validators=[DataRequired()],
    )
    years_experience = IntegerField(
        "Years of experience", validators=[Optional(), NumberRange(min=0, max=80)]
    )
    icon = StringField("Icon", validators=[Optional(), Length(max=50)])
    visible = BooleanField("Visible", default=True)


class ProjectForm(FlaskForm):
    title = StringField("Title", validators=[DataRequired(), Length(max=150)])
    slug = StringField(
        "Slug (leave blank to auto-generate from the title)",
        validators=[Optional(), Length(max=180)],
    )
    short_description = StringField("Short description", validators=[Optional(), Length(max=300)])
    description = TextAreaField("Description", validators=[Optional(), Length(max=20000)])
    image_url = StringField(
        "Image URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    github_url = StringField(
        "GitHub URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    demo_url = StringField(
        "Demo URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    documentation_url = StringField(
        "Documentation URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    technologies = StringField(
        "Technologies (comma-separated)", validators=[Optional(), Length(max=1000)]
    )
    featured = BooleanField("Featured")
    visible = BooleanField("Visible", default=True)


class CertificationForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=200)])
    issuer = StringField("Issuer", validators=[DataRequired(), Length(max=150)])
    issue_date = DateField("Issue date", validators=[Optional()])
    expiry_date = DateField("Expiry date", validators=[Optional()])
    credential_id = StringField("Credential ID", validators=[Optional(), Length(max=150)])
    credential_url = StringField(
        "Credential URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    description = TextAreaField("Description", validators=[Optional(), Length(max=10000)])
    visible = BooleanField("Visible", default=True)


class AchievementForm(FlaskForm):
    title = StringField("Title", validators=[DataRequired(), Length(max=200)])
    issuer = StringField("Issuer", validators=[Optional(), Length(max=150)])
    achievement_date = DateField("Date", validators=[Optional()])
    description = TextAreaField("Description", validators=[Optional(), Length(max=10000)])
    url = StringField("URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)])
    visible = BooleanField("Visible", default=True)


class NavigationItemForm(FlaskForm):
    label = StringField("Label", validators=[DataRequired(), Length(max=100)])
    endpoint = SelectField("Page", validators=[DataRequired()], choices=[])
    visible = BooleanField("Visible", default=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Populated at construction time (not class-definition time) so a
        # future addition to app/services/nav_service.ALLOWED_NAV_ENDPOINTS
        # is picked up without needing to touch this form.
        self.endpoint.choices = nav_service.endpoint_choices()


class BlogCategoryForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=100)])
    slug = StringField(
        "Slug (leave blank to auto-generate from the name)",
        validators=[Optional(), Length(max=120)],
    )
    description = StringField("Description", validators=[Optional(), Length(max=500)])


class BlogTagForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=50)])
    slug = StringField(
        "Slug (leave blank to auto-generate from the name)",
        validators=[Optional(), Length(max=70)],
    )


class BlogPostForm(FlaskForm):
    """Create/edit fields for a blog post.

    Publishing state (`status`/`published_at`/`scheduled_at`) is
    deliberately NOT part of this form - it is changed only through the
    dedicated publish/unpublish/schedule actions (app/admin/routes.py), so a
    plain "Save" can never accidentally publish or unpublish a post.
    """

    title = StringField("Title", validators=[DataRequired(), Length(max=200)])
    slug = StringField(
        "Slug (leave blank to auto-generate from the title)",
        validators=[Optional(), Length(max=220)],
    )
    excerpt = StringField("Excerpt", validators=[Optional(), Length(max=500)])
    markdown_body = TextAreaField("Body (Markdown)", validators=[DataRequired()])
    cover_image_url = StringField(
        "Cover image URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    category_id = SelectField("Category", validators=[Optional()], choices=[])
    tags = StringField("Tags (comma-separated)", validators=[Optional(), Length(max=500)])
    featured = BooleanField("Featured")
    seo_title = StringField("SEO title", validators=[Optional(), Length(max=200)])
    seo_description = StringField("SEO description", validators=[Optional(), Length(max=300)])
    canonical_url = StringField(
        "Canonical URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Populated at construction time so a newly-created category shows up
        # without needing to touch this form - same pattern as
        # NavigationItemForm.endpoint above.
        self.category_id.choices = [("", "(none)")] + [
            (str(category.id), category.name)
            for category in blog_category_service.list_categories()
        ]

    def category_uuid(self):
        import uuid

        return uuid.UUID(self.category_id.data) if self.category_id.data else None


class BlogScheduleForm(FlaskForm):
    scheduled_at = DateTimeField(
        "Scheduled for (UTC)", format="%Y-%m-%dT%H:%M", validators=[DataRequired()]
    )


class MediaUploadForm(FlaskForm):
    """Admin image upload (Phase 7).

    `FileAllowed` checks the client-supplied filename extension - a
    first, cheap rejection - but is not itself the security control:
    app/services/media_service.py always re-validates the actual file
    content by sniffing its byte signature server-side before ever writing
    it to disk, since a filename/extension is entirely client-controlled
    and not trustworthy on its own (docs/SECURITY.md's "content
    inspection" requirement).
    """

    file = FileField(
        "Image file",
        validators=[
            FileRequired(message="Choose a file to upload."),
            FileAllowed(["png", "jpg", "jpeg", "gif", "webp"], "Only image files are allowed."),
        ],
    )


class ResumeForm(FlaskForm):
    title = StringField("Title", validators=[Optional(), Length(max=150)])
    storage_reference = StringField("Storage reference", validators=[Optional(), Length(max=500)])
    public_url = StringField(
        "Public URL", validators=[Optional(), Length(max=500), URL(message=_URL_MSG)]
    )
    download_enabled = BooleanField("Downloads enabled", default=True)
