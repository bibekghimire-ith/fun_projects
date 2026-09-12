# API / Endpoint Specification

The primary application is server-rendered. JSON endpoints should be added only where they improve HTMX or future API use.

## Public

GET /
GET /about
GET /experience
GET /education
GET /skills
GET /projects
GET /projects/<slug>
GET /certifications
GET /achievements
GET /resume
GET /blog
GET /blog/<slug>
GET /blog/category/<slug>
GET /blog/tag/<slug>
GET /blog/search
GET /rss.xml
GET /sitemap.xml
GET /robots.txt
GET /contact
POST /contact

## Authentication

GET /admin/login
POST /admin/login
POST /admin/logout

No public admin registration.

## Admin

GET /admin
GET /admin/profile
POST /admin/profile

CRUD/reordering routes for:
- experience
- education
- skills
- projects
- certifications
- achievements
- social links

Blog:
GET /admin/blog
GET /admin/blog/new
POST /admin/blog
GET /admin/blog/<id>/edit
POST /admin/blog/<id>
POST /admin/blog/<id>/publish
POST /admin/blog/<id>/unpublish
POST /admin/blog/<id>/delete
GET /admin/blog/<id>/preview

Templates:
GET /admin/template
POST /admin/template

Settings:
GET /admin/settings
POST /admin/settings

Contact:
GET /admin/messages
POST /admin/messages/<id>/status

## API rules
- authorization is mandatory for admin endpoints
- CSRF for browser mutations
- validation for all input
- consistent error handling
- never expose internal exceptions
- no endpoint may bypass ownership/authorization
