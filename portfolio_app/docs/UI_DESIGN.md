# UI Design System

## Design goal
Create a polished professional portfolio rather than a generic Bootstrap CRUD application.

## Public layout
Header
- logo/name
- configurable navigation
- theme toggle
- resume CTA

Hero
- name
- professional title
- short tagline
- CTA
- social links
- optional profile image

Sections
- about
- experience
- projects
- skills
- certifications
- achievements
- latest blog
- contact

Footer
- social links
- copyright
- RSS
- optional privacy

## Admin
Use a clean dashboard:
- sidebar
- top bar
- breadcrumbs
- cards
- tables
- forms
- inline validation
- toast/alert feedback

## Components
Create reusable Jinja macros/components for:
- navbar
- footer
- project card
- experience item
- skill badge
- certification card
- blog card
- pagination
- flash messages
- form fields
- admin table
- modal confirmation

## Responsive behavior
Desktop:
- multi-column grids

Tablet:
- reduced columns

Mobile:
- single-column
- collapsible navigation
- horizontally scrollable data tables only when unavoidable

## Themes
Each portfolio theme should provide:
- CSS variables
- layout choices
- typography
- component styling
- hero variation
- project card variation

Do not duplicate domain content.

## Accessibility
- semantic landmarks
- one logical H1 per page
- heading hierarchy
- labels
- visible focus
- keyboard operation
- skip link
- alt text
- aria only when semantic HTML is insufficient

## Motion
Use subtle transitions.
Respect prefers-reduced-motion.
No animation should block content.
