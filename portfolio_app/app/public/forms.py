"""Public-facing forms (Phase 7: contact).

`ContactForm` is a `FlaskForm`, so it is CSRF-protected automatically via
the already-global `CSRFProtect` extension (the same convention every other
form in this app follows). `website` is an intentionally-undocumented
honeypot field: real visitors never see or fill it in (hidden off-screen in
CSS, see app/templates/public/contact.html), so any non-empty value is a
strong bot signal - see app/public/routes.py and docs/DECISIONS.md for how
it's handled (silently dropped, not a validation error, so as not to teach
a bot which field tipped it off).
"""

from __future__ import annotations

from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField
from wtforms.validators import DataRequired, Email, Length, Optional

_EMAIL_MSG = "Enter a valid email address."


class ContactForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=150)])
    email = StringField(
        "Email", validators=[DataRequired(), Length(max=255), Email(message=_EMAIL_MSG)]
    )
    subject = StringField("Subject", validators=[Optional(), Length(max=200)])
    message = TextAreaField("Message", validators=[DataRequired(), Length(min=1, max=5000)])
    # Honeypot: must stay empty. Not `Optional()`-only by accident - no
    # validator at all, since filling it never produces a user-facing
    # validation error (see routes.py's handling).
    website = StringField("Website")
