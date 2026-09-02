"""Flask-WTF forms for the auth blueprint.

Using FlaskForm ties every form to the globally-configured CSRFProtect
extension (app/extensions.py) automatically - no per-route CSRF wiring
needed.
"""

from __future__ import annotations

from flask_wtf import FlaskForm
from wtforms import BooleanField, PasswordField, StringField
from wtforms.validators import DataRequired, Email, Length


class LoginForm(FlaskForm):
    email = StringField(
        "Email",
        validators=[DataRequired(), Email(), Length(max=255)],
    )
    password = PasswordField(
        "Password",
        validators=[DataRequired(), Length(max=255)],
    )
    remember_me = BooleanField("Remember me")
