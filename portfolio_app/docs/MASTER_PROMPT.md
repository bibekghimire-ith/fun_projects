# MASTER PROMPT — Personal Portfolio + Blog Platform

You are the Principal Software Architect and Principal Software Engineer responsible for implementing this repository end-to-end.

This repository is a personal portfolio website/application with an integrated blogging CMS. It is not an investment-management product.

Read these documents before implementation:
- CLAUDE.md
- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/DATABASE_DESIGN.md
- docs/API_SPEC.md
- docs/UI_DESIGN.md
- docs/SECURITY.md
- docs/TESTING.md
- docs/DEPLOYMENT.md
- docs/IMPLEMENTATION_PLAN.md

## Primary objective
Create a polished, production-ready, self-hostable personal portfolio platform where an administrator can manage professional content and publish blog articles without modifying source code.

The final application must be Dockerized and deployable on arbitrary infrastructure that supports containers.

## Required capabilities

### Public portfolio
Implement:
- Home
- About
- Experience
- Education
- Skills
- Projects
- Project detail
- Certifications
- Achievements
- Resume
- Blog
- Blog detail
- Contact
- 404
- optional privacy page

The exact public navigation should be configurable.

### Admin CMS
Implement an authenticated admin area:
- dashboard
- profile editor
- experience CRUD/reordering
- education CRUD/reordering
- skills CRUD/reordering
- projects CRUD/reordering
- certifications CRUD/reordering
- achievements CRUD/reordering
- social links
- resume metadata
- site settings
- theme/template selection
- blog posts
- categories
- tags
- preview
- publish/unpublish
- scheduling abstraction

### Template engine
Implement a template registry and theme abstraction.

Required templates:
- Minimal Developer
- Modern Professional
- Cybersecurity / Engineering
- Academic / Research
- Creative

The administrator can select the active template.

Changing the template must not modify portfolio content.

Templates must share the same domain models and content services.

### Blog
Implement Markdown-based blog authoring.

Post fields should include:
- title
- slug
- excerpt
- Markdown body
- rendered/sanitized body strategy
- cover image URL
- category
- tags
- status
- featured
- published_at
- scheduled_at
- SEO title
- SEO description
- canonical URL
- author
- created_at
- updated_at

Public blog:
- list
- pagination
- search
- category
- tag
- detail
- related posts
- RSS
- sitemap
- social metadata

### Contact
Implement a secure contact form with validation, CSRF and rate limiting.

Use an email adapter so SMTP/email providers are not hard-coded.

### Data model
Use normalized relational tables.

At minimum:
User
Role
Profile
SocialLink
Experience
Education
Skill
SkillCategory
Project
ProjectTechnology
Certification
Achievement
Resume
SiteSetting
PortfolioTemplate
BlogPost
BlogCategory
BlogTag
BlogPostTag
ContactMessage
AuditLog

Add other tables if needed.

### Content ordering
Use explicit ordering fields for:
- navigation
- experience
- education
- skills
- projects
- certifications
- achievements
- social links

### Security
All admin operations require authorization.
All mutations require CSRF where browser forms are used.
All user input is validated.
Blog Markdown must be converted and sanitized before rendering.
Use secure session cookies.
Rate limit authentication/contact abuse.
Prevent IDOR.

### Configuration
Use .env.example and documented environment variables:
- APP_ENV
- SECRET_KEY
- DATABASE_URL
- ADMIN_BOOTSTRAP_EMAIL
- ADMIN_BOOTSTRAP_PASSWORD_HASH or secure bootstrap mechanism
- BASE_URL
- MAIL configuration
- STORAGE configuration
- LOG_LEVEL
- RATELIMIT configuration

Never commit actual secrets.

### Quality
Use:
- Python 3.12+
- Flask
- SQLAlchemy
- Flask-Migrate/Alembic
- Jinja2
- HTMX
- Bootstrap 5
- vanilla JS
- pytest
- Ruff
- Black
- mypy where practical
- Docker
- Gunicorn
- PostgreSQL

## Implementation approach

Do not generate the entire system blindly in one pass.

Work through phases in docs/IMPLEMENTATION_PLAN.md.

For each phase:
1. inspect current code
2. implement
3. add tests
4. run targeted tests
5. run linting
6. update implementation state
7. only then proceed

If you discover an architectural issue, fix it before continuing.

If a requirement is ambiguous:
- choose the safest/simple production-quality default
- record the decision in docs/DECISIONS.md
- continue unless it affects security/data integrity

## UI quality bar
The website must look like a real professional developer portfolio, not a generic CRUD dashboard.

Requirements:
- polished typography
- strong visual hierarchy
- responsive layout
- dark/light theme
- reusable components
- smooth but restrained interactions
- good project cards
- professional timeline for experience
- visually strong hero
- readable blog
- code blocks
- accessible navigation
- meaningful empty/error states

Do not overuse animations.

## Engineering rules
- application factory
- blueprints
- service layer
- repositories only where useful
- migrations
- explicit constraints
- indexes for common lookup paths
- pagination for blog/admin lists
- transactions for multi-step writes
- optimistic/conservative concurrency where appropriate
- no N+1 queries on major pages
- avoid premature caching
- no external API dependency for core functionality

## Verification
Before completion:
- run full test suite
- run coverage
- run Ruff
- run Black check
- run mypy if configured
- build Docker image
- start Docker Compose
- run health checks
- verify migration on empty DB
- verify admin authentication
- verify public portfolio
- verify blog publish flow
- verify template switching
- verify contact flow
- run security tests

## Final response
Provide:
1. implemented features
2. architecture
3. important design decisions
4. database summary
5. environment variables
6. commands to run locally
7. Docker deployment instructions
8. test/lint results
9. security verification
10. known limitations
11. any unimplemented requirements

Never state "complete" if requirements remain unimplemented.
