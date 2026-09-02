"""Login rate limiting tests (app/auth/routes.py + Flask-Limiter).

See docs/DECISIONS.md for why Flask-Limiter with an in-process memory
store was chosen for this single-instance deployment.
"""

from __future__ import annotations


def test_login_is_rate_limited_after_repeated_attempts(app, client):
    app.config["LOGIN_RATE_LIMIT"] = "3 per minute"

    statuses = []
    for _ in range(5):
        response = client.post(
            "/auth/login",
            data={"email": "admin@example.com", "password": "wrong"},
        )
        statuses.append(response.status_code)

    # The first 3 attempts are evaluated normally (200: invalid credentials);
    # once the limit is exceeded, Flask-Limiter short-circuits with 429
    # before the view (and thus the password check) even runs.
    assert statuses[:3] == [200, 200, 200]
    assert 429 in statuses[3:]


def test_rate_limit_is_scoped_so_a_fresh_window_is_not_already_blocked(app, client):
    app.config["LOGIN_RATE_LIMIT"] = "5 per minute"

    response = client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": "wrong"},
    )
    assert response.status_code == 200
