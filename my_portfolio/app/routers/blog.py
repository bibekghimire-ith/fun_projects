"""Public-facing blog routes: list, detail, and an RSS feed.

Analytics are intentionally privacy-preserving: a view increments a
per-post, per-UTC-day counter (PostView) and the post's all-time
view_count. No IP address, cookie, user agent, or referrer is ever
stored (see BLOG_PLAN.md section 5).
"""
from datetime import datetime, timezone
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.deps import get_db, get_site_settings
from app.models import Post, PostView

router = APIRouter(tags=["blog"])
templates = Jinja2Templates(directory="app/templates")

_POSTS_PER_PAGE = 10


def _record_view(db: Session, post: Post) -> None:
    """Increment the post's all-time counter and upsert today's day-bucketed
    row. No identifying visitor information is read or stored — only a
    date and a count."""
    today = datetime.now(timezone.utc).date()
    post.view_count = (post.view_count or 0) + 1
    row = (
        db.query(PostView)
        .filter(PostView.post_id == post.id, PostView.day == today)
        .first()
    )
    if row is None:
        row = PostView(post_id=post.id, day=today, count=1)
        db.add(row)
    else:
        row.count += 1
    db.add(post)
    db.commit()


@router.get("/blog")
def blog_list(
    request: Request,
    page: int = 1,
    db: Session = Depends(get_db),
    site=Depends(get_site_settings),
):
    page = max(1, page)
    query = (
        db.query(Post)
        .filter(Post.published.is_(True))
        .order_by(Post.published_at.desc(), Post.order_index)
    )
    total = query.count()
    posts = query.offset((page - 1) * _POSTS_PER_PAGE).limit(_POSTS_PER_PAGE).all()
    has_next = page * _POSTS_PER_PAGE < total
    has_prev = page > 1
    return templates.TemplateResponse(
        "public/blog_list.html",
        {
            "request": request,
            "site": site,
            "posts": posts,
            "page": page,
            "has_next": has_next,
            "has_prev": has_prev,
        },
    )


@router.get("/blog/rss.xml")
def blog_rss(request: Request, db: Session = Depends(get_db), site=Depends(get_site_settings)):
    posts = (
        db.query(Post)
        .filter(Post.published.is_(True))
        .order_by(Post.published_at.desc())
        .limit(30)
        .all()
    )
    base_url = str(request.base_url).rstrip("/")
    site_title = xml_escape(site.site_title or "Blog")
    site_desc = xml_escape(site.tagline or "")
    items = []
    for post in posts:
        link = f"{base_url}/blog/{post.slug}"
        pub_date = (post.published_at or post.updated_at)
        pub_date_str = pub_date.strftime("%a, %d %b %Y %H:%M:%S +0000") if pub_date else ""
        items.append(
            "<item>"
            f"<title>{xml_escape(post.title)}</title>"
            f"<link>{xml_escape(link)}</link>"
            f"<guid>{xml_escape(link)}</guid>"
            f"<pubDate>{pub_date_str}</pubDate>"
            f"<description>{xml_escape(post.summary or '')}</description>"
            "</item>"
        )
    rss = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0"><channel>'
        f"<title>{site_title}</title>"
        f"<link>{xml_escape(base_url)}/blog</link>"
        f"<description>{site_desc}</description>"
        + "".join(items)
        + "</channel></rss>"
    )
    return Response(content=rss, media_type="application/rss+xml")


@router.get("/blog/{slug}")
def blog_detail(
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
    site=Depends(get_site_settings),
):
    post = db.query(Post).filter(Post.slug == slug).first()
    if post is None or not post.published:
        raise HTTPException(status_code=404, detail="Post not found")
    _record_view(db, post)
    return templates.TemplateResponse(
        "public/blog_detail.html", {"request": request, "site": site, "post": post}
    )
