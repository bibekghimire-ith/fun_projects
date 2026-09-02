# Database Design

Use PostgreSQL as production database.

## User
- id UUID
- email unique
- password_hash
- role
- is_active
- last_login_at
- created_at
- updated_at

## Profile
- id
- user_id unique
- display_name
- professional_title
- tagline
- biography
- profile_image_url
- location_text
- availability_text
- public_email
- created_at
- updated_at

## SocialLink
- id
- profile_id
- platform
- label
- url
- icon
- display_order
- visible

## Experience
- id
- profile_id
- company
- role
- employment_type
- location
- start_date
- end_date nullable
- is_current
- description
- display_order
- visible

## Education
- id
- profile_id
- institution
- degree
- field
- start_date
- end_date
- grade_summary
- description
- display_order
- visible

## SkillCategory
- id
- name
- display_order
- visible

## Skill
- id
- category_id
- name
- proficiency
- years_experience nullable
- icon
- display_order
- visible

## Project
- id
- profile_id
- title
- slug unique
- short_description
- description
- image_url
- github_url
- demo_url
- documentation_url
- featured
- display_order
- visible
- created_at
- updated_at

## ProjectTechnology
- id
- project_id
- name
- display_order

## Certification
- id
- profile_id
- name
- issuer
- issue_date
- expiry_date nullable
- credential_id
- credential_url
- description
- display_order
- visible

## Achievement
- id
- profile_id
- title
- issuer
- achievement_date
- description
- url
- display_order
- visible

## Resume
- id
- profile_id
- title
- storage_reference
- public_url
- download_enabled
- updated_at

## SiteSetting
- id
- key unique
- value
- value_type
- updated_at

## PortfolioTemplate
- id
- key unique
- name
- description
- version
- active
- configuration_json

## BlogCategory
- id
- name unique
- slug unique
- description

## BlogTag
- id
- name unique
- slug unique

## BlogPost
- id
- author_id
- title
- slug unique
- excerpt
- markdown_body
- rendered_body optional/cacheable
- cover_image_url
- category_id
- status
- featured
- published_at
- scheduled_at
- seo_title
- seo_description
- canonical_url
- created_at
- updated_at

## BlogPostTag
- post_id
- tag_id
- unique(post_id, tag_id)

## ContactMessage
- id
- name
- email
- subject
- message
- status
- created_at
- processed_at

## AuditLog
- id
- actor_user_id
- action
- entity_type
- entity_id
- request_id
- metadata_json
- created_at

## Constraints
- unique slugs
- foreign keys
- indexes on slug, status, published_at
- indexes on display_order
- check constraints where useful
- timestamps
- soft-delete only where it adds clear value

Use UUIDs for externally exposed identifiers where practical.
