"""Tests for the application factory and configuration resolution."""

from __future__ import annotations

import pytest

from app import create_app
from app.config import DevelopmentConfig, ProductionConfig, TestingConfig, get_config


def test_create_app_defaults_to_testing_config_object():
    app = create_app("testing")

    assert app.config["TESTING"] is True
    assert app.config["WTF_CSRF_ENABLED"] is False


def test_create_app_accepts_config_class_directly():
    app = create_app(DevelopmentConfig)

    assert app.config["APP_ENV"] == "development"
    assert app.config["DEBUG"] is True


def test_get_config_resolves_known_names():
    assert get_config("development") is DevelopmentConfig
    assert get_config("testing") is TestingConfig
    assert get_config("production") is ProductionConfig


def test_get_config_falls_back_to_production_for_unknown_name():
    assert get_config("not-a-real-env") is ProductionConfig


def test_production_config_init_app_requires_secret_key():
    from flask import Flask

    app = Flask(__name__)
    app.config["SECRET_KEY"] = ""
    app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql+psycopg://x/y"

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        ProductionConfig.init_app(app)


def test_production_config_init_app_requires_database_url():
    from flask import Flask

    app = Flask(__name__)
    app.config["SECRET_KEY"] = "a-real-secret"
    app.config["SQLALCHEMY_DATABASE_URI"] = ""

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        ProductionConfig.init_app(app)


def test_no_route_registered_twice():
    app = create_app("testing")

    rules = [rule.rule for rule in app.url_map.iter_rules()]

    assert rules.count("/healthz") == 1
    assert rules.count("/readyz") == 1
