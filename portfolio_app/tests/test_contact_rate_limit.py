"""Contact form rate limiting (Phase 7).

Same pattern as tests/test_rate_limit.py's login coverage, applied to
`CONTACT_RATE_LIMIT` / `POST /contact`.
"""

from __future__ import annotations


def _payload(n: int) -> dict:
    return {
        "name": "Ada Lovelace",
        "email": f"ada{n}@example.com",
        "subject": "Hello",
        "message": "Hi there.",
        "website": "",
    }


def test_contact_form_is_rate_limited_after_repeated_submissions(app, client):
    app.config["CONTACT_RATE_LIMIT"] = "3 per minute"

    statuses = []
    for i in range(5):
        response = client.post("/contact", data=_payload(i))
        statuses.append(response.status_code)

    assert statuses[:3] == [200, 200, 200]
    assert 429 in statuses[3:]


def test_contact_rate_limit_fresh_window_is_not_pre_blocked(app, client):
    app.config["CONTACT_RATE_LIMIT"] = "5 per minute"

    response = client.post("/contact", data=_payload(0))
    assert response.status_code == 200
