# Architecture

## High-level

Browser
  |
  v
Nginx (optional)
  |
  v
Gunicorn
  |
  v
Flask application
  |
  +-- Presentation
  |     +-- Jinja2
  |     +-- HTMX
  |     +-- Bootstrap
  |
  +-- Application services
  |
  +-- Domain
  |
  +-- Infrastructure
  |     +-- SQLAlchemy
  |     +-- Email adapter
  |     +-- Storage adapter
  |     +-- Scheduler abstraction
  |
  +-- PostgreSQL

## Flask package layout

app/
  __init__.py
  config.py
  extensions.py

  auth/
  admin/
  public/
  portfolio/
  blog/
  contact/
  templates_engine/
  seo/

  models/
  services/
  repositories/
  common/

  templates/
    base/
    public/
    admin/
    themes/
      minimal/
      modern/
      cybersecurity/
      academic/
      creative/

  static/
    css/
    js/
    images/

## Application factory

Use:
create_app(config_object=None)

No module-level global Flask app.

## Domain boundaries

### Portfolio domain
Profile, experience, education, skills, projects, certifications, achievements, resume.

### Blog domain
Posts, categories, tags, publishing lifecycle, rendering/sanitization.

### Template domain
Template registry and active template resolution.

### Identity domain
Administrator authentication and authorization.

### Contact domain
Contact messages and email delivery.

### Platform domain
Configuration, health, logging, storage, scheduling.

## Service examples
ProfileService
ExperienceService
ProjectService
CertificationService
BlogPostService
BlogPublishingService
TemplateService
ContactService
SeoService

Routes should call services rather than containing business rules.

## Template engine
Use a registry such as:
TemplateRegistry.get(name)

Each template exposes reusable presentation fragments.

The content model remains shared.

## External adapters

EmailProvider
  +-- SMTPProvider
  +-- ConsoleProvider

StorageProvider
  +-- LocalStorageProvider
  +-- S3CompatibleProvider (future)

SchedulerProvider
  +-- DisabledScheduler
  +-- APSchedulerProvider

Do not make core application behavior depend on a particular vendor.

## Caching
Do not introduce Redis in V1 unless required.
Use database-backed content and normal HTTP caching headers first.

## Background jobs
Scheduling should be optional.
A post may be published:
- immediately
- through request-time status evaluation
- through optional scheduler

The system must remain functional with the scheduler disabled.

## Performance
Prevent:
- N+1 queries
- unbounded admin lists
- unbounded blog queries
- loading all posts on homepage

Use pagination and eager loading appropriately.

## Deployment
The application must run:
- directly with Gunicorn
- behind Nginx
- in Docker Compose
- in a generic container platform

No host-specific assumptions.
