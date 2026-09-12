"""Login/logout routes for the single administrator account.

Business logic (password verification, recording last login, bootstrap)
lives in app/services/auth_service.py - routes only handle HTTP concerns:
form validation, session lifecycle, and redirects.
"""

from __future__ import annotations

from flask import Blueprint, current_app, flash, redirect, render_template, session, url_for
from flask_login import current_user, login_required, login_user, logout_user

from app.auth.forms import LoginForm
from app.extensions import limiter
from app.services import auth_service

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/login", methods=["GET", "POST"])
@limiter.limit(lambda: current_app.config.get("LOGIN_RATE_LIMIT", "5 per minute"))
def login():
    # Already logged in? Don't re-render the login form.
    if current_user.is_authenticated:
        return redirect(url_for("admin.dashboard"))

    form = LoginForm()
    if form.validate_on_submit():
        user = auth_service.authenticate(form.email.data, form.password.data)
        if user is None:
            current_app.logger.warning(
                "admin_login_failed", extra={"email": auth_service.normalize_email(form.email.data)}
            )
            flash("Invalid email or password.", "error")
        else:
            # Rotate the session on privilege escalation: discard whatever
            # (anonymous) session data existed before login rather than
            # mutating it in place, mitigating session fixation.
            session.clear()
            login_user(user, remember=form.remember_me.data)
            session.permanent = True
            auth_service.record_successful_login(user)
            current_app.logger.info("admin_login_success", extra={"user_id": str(user.id)})
            return redirect(url_for("admin.dashboard"))

    return render_template("auth/login.html", form=form)


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    current_app.logger.info("admin_logout", extra={"user_id": str(current_user.id)})
    logout_user()
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("auth.login"))
