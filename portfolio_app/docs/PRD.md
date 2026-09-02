# Product Requirements Document

## Product name
Personal Portfolio + Blog Platform

## Vision
A self-hostable personal website platform that allows a professional to manage their public identity, work history, projects and technical writing through a secure admin CMS.

## Users

### Visitor
Can browse the portfolio and blog, search articles, read posts and send a contact message.

### Administrator
Can manage all portfolio content, site settings, templates and blog content.

## Core requirements

### R1 — Homepage
Display:
- profile/hero
- headline
- summary
- social links
- featured projects
- selected experience
- skills
- latest blog posts
- contact CTA

### R2 — Profile
Editable:
- name
- professional title
- tagline
- biography
- profile image URL
- location text
- availability text
- email/contact configuration
- social links

### R3 — Experience
Fields:
- company
- role
- employment type
- location
- start date
- end date
- current flag
- description
- technologies
- order
- visible

### R4 — Education
Fields:
- institution
- degree
- field
- start date
- end date
- grade/summary
- description
- order
- visible

### R5 — Skills
Support categories and individual skills:
- name
- category
- proficiency label
- years optional
- icon identifier optional
- order
- visible

### R6 — Projects
Fields:
- title
- slug
- short description
- detailed description
- project image URL
- technologies
- GitHub URL
- demo URL
- documentation URL
- featured
- order
- visible

### R7 — Certifications
Fields:
- name
- issuer
- issue date
- expiry date optional
- credential ID optional
- credential URL optional
- description
- order
- visible

### R8 — Achievements
Fields:
- title
- issuer
- date
- description
- URL optional
- order
- visible

### R9 — Resume
Support:
- resume title
- file URL or storage reference
- download enabled
- updated date
- public/private configuration

### R10 — Templates
At least five templates:
- Minimal Developer
- Modern Professional
- Cybersecurity / Engineering
- Academic / Research
- Creative

The selected template is global site configuration.

### R11 — Blog
Posts support:
- title
- slug
- excerpt
- Markdown body
- cover
- category
- tags
- draft/published
- scheduled publication
- featured
- SEO fields
- canonical URL
- timestamps

### R12 — Blog discovery
Support:
- search
- categories
- tags
- pagination
- related posts
- RSS

### R13 — SEO
Support:
- titles
- descriptions
- canonical URLs
- OpenGraph
- sitemap
- robots
- RSS
- clean URLs

### R14 — Contact
Contact form:
- name
- email
- subject
- message
- validation
- CSRF
- rate limiting
- email adapter
- optional persistence for admin review

### R15 — Admin
Admin dashboard should show:
- content counts
- recent blog posts
- drafts
- contact messages
- current theme
- quick actions

### R16 — Settings
Admin can manage:
- site name
- tagline
- favicon URL
- logo URL
- default SEO
- social links
- theme
- blog settings
- contact settings
- footer text

## Non-functional requirements
- responsive
- accessible
- secure
- portable
- Dockerized
- PostgreSQL compatible
- migration safe
- testable
- observable
- SEO friendly
- maintainable

## Out of scope for V1
- multi-user public author registration
- e-commerce
- payments
- job-board functionality
- social network
- visitor accounts
- comments
- newsletter marketing automation
- proprietary analytics platform
