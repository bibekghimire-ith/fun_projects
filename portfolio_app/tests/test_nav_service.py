"""Phase 4 navigation configuration: service defaults + admin CRUD routes."""

from __future__ import annotations

from app.extensions import db
from app.models.navigation import NavigationItem
from app.services import nav_service


class TestNavServiceDefaults:
    def test_sync_defaults_seeds_full_default_set_once(self, app):
        assert db.session.query(NavigationItem).count() == 0
        nav_service.sync_defaults()
        items = db.session.query(NavigationItem).order_by(NavigationItem.display_order).all()
        assert [item.endpoint for item in items] == [
            key for key, _ in nav_service.ALLOWED_NAV_ENDPOINTS
        ]

    def test_sync_defaults_reseeds_after_admin_deletes_all(self, app):
        # An empty navigation table is treated as "use the defaults" (there
        # is no separate "already initialized" flag - see nav_service's
        # docstring), the same deterministic-default philosophy
        # template_service.sync_registry() uses.
        nav_service.sync_defaults()
        for item in db.session.query(NavigationItem).all():
            db.session.delete(item)
        db.session.commit()

        nav_service.sync_defaults()
        assert db.session.query(NavigationItem).count() == len(nav_service.ALLOWED_NAV_ENDPOINTS)

    def test_list_visible_nav_items_excludes_hidden(self, app):
        nav_service.sync_defaults()
        home_item = db.session.query(NavigationItem).filter_by(endpoint="public.home").one()
        home_item.visible = False
        db.session.commit()

        visible = nav_service.list_visible_nav_items()
        assert "public.home" not in [item.endpoint for item in visible]

    def test_is_allowed_endpoint(self, app):
        assert nav_service.is_allowed_endpoint("public.projects")
        assert not nav_service.is_allowed_endpoint("admin.dashboard")
        assert not nav_service.is_allowed_endpoint("not.a.real.endpoint")


class TestNavigationAdminRoutes:
    def test_unauthenticated_navigation_list_redirects_to_login(self, client):
        response = client.get("/admin/navigation")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]

    def test_create_edit_delete_cycle(self, admin_client):
        response = admin_client.post(
            "/admin/navigation/new",
            data={"label": "Blog", "endpoint": "public.contact", "visible": "y"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        item = db.session.query(NavigationItem).filter_by(label="Blog").one()
        assert item.endpoint == "public.contact"

        response = admin_client.post(
            f"/admin/navigation/{item.id}/edit",
            data={"label": "Get in touch", "endpoint": "public.contact"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        db.session.expire_all()
        assert db.session.get(NavigationItem, item.id).label == "Get in touch"

        response = admin_client.post(f"/admin/navigation/{item.id}/delete", follow_redirects=True)
        assert response.status_code == 200
        assert db.session.get(NavigationItem, item.id) is None

    def test_move_up_swaps_order(self, admin_client):
        admin_client.get("/admin/navigation")  # triggers sync_defaults()
        items = db.session.query(NavigationItem).order_by(NavigationItem.display_order).all()
        second = items[1]
        first_order, second_order = items[0].display_order, items[1].display_order

        admin_client.post(f"/admin/navigation/{second.id}/move-up")
        db.session.expire_all()
        assert db.session.get(NavigationItem, second.id).display_order == first_order
        assert db.session.get(NavigationItem, items[0].id).display_order == second_order

    def test_edit_nonexistent_id_404s(self, admin_client):
        import uuid

        response = admin_client.get(f"/admin/navigation/{uuid.uuid4()}/edit")
        assert response.status_code == 404
