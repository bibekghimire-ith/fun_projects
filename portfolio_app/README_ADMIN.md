# Admin Functionality Guide

The Portfolio App includes a comprehensive administrative interface (`/admin`) for managing all aspects of the public portfolio and blog. 

## Features Overview

The admin panel allows the site owner to perform CRUD (Create, Read, Update, Delete) operations as well as reorder most entities. Access to all routes is protected and requires an authenticated administrator account. 

### 1. General Profile & Resume
* **Profile (`/admin/profile`)**: Manage your basic information (name, headline, bio, etc.). This serves as the foundation for your portfolio.
* **Resume (`/admin/resume`)**: Update resume content directly.
* **Social Links (`/admin/social-links`)**: Manage social media links (e.g., GitHub, LinkedIn, Twitter) displayed on the site.

### 2. Portfolio Content
These sections allow you to detail your professional background. All lists here can be reordered to control the display sequence on the public site:
* **Experience (`/admin/experience`)**: Add and arrange work experiences.
* **Education (`/admin/education`)**: Detail your academic background.
* **Certifications (`/admin/certifications`)**: List professional certificates.
* **Achievements (`/admin/achievements`)**: Highlight significant milestones or awards.
* **Projects (`/admin/projects`)**: Manage portfolio projects. You can feature specific projects, write descriptions, specify technologies used, and set project URLs.

### 3. Skills Management
Skills are grouped by category to keep the portfolio organized:
* **Skill Categories (`/admin/skill-categories`)**: Create overarching categories (e.g., "Languages", "Frameworks").
* **Skills (`/admin/skill-categories/<id>/skills`)**: Add individual skills within a category, including proficiency levels and years of experience.

### 4. Site Configuration
* **Navigation (`/admin/navigation`)**: Control the main navigation menu of the site. You can choose which pages to link to, set the labels, and order the items.
* **Templates (`/admin/templates`)**: View available themes. You can preview how your current content looks in different themes and activate the one you prefer.

### 5. Blog Engine
A fully-featured blogging platform:
* **Blog Posts (`/admin/blog`)**: Write and manage blog posts. Posts support Markdown and can be saved as drafts, published immediately, or scheduled for a future date.
* **Categories (`/admin/blog/categories`)**: Group blog posts by category.
* **Tags (`/admin/blog/tags`)**: Add tags to posts for more granular discovery.

### 6. Media & Contact
* **Media Uploads (`/admin/media`)**: A centralized place to upload images (for blog posts, project thumbnails, etc.). Once uploaded, you can copy the URL to use anywhere else in the app.
* **Contact Messages (`/admin/messages`)**: Read, manage status, and delete messages submitted through the public contact form.

## Security Notes
* Every route under `/admin` is strictly protected by `@admin_required`.
* All state-changing requests (POST, PUT, DELETE, including reordering) are protected against Cross-Site Request Forgery (CSRF).
* The application enforces Indirect Object Reference (IDOR) guards. When accessing a resource by ID, the server re-verifies ownership against the current admin's profile.

