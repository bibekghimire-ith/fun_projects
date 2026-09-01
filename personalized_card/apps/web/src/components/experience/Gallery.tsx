import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../ui';
import { useExperience } from './context';
import { useDialog, useSwipe } from './hooks';
import { resolveImage } from './media';
import { ThemePortal } from './ThemePortal';
import { SafeImage } from './SafeImage';
import styles from './gallery.module.css';

export interface GalleryProps {
  mediaIds: string[];
  caption?: string;
  layout?: 'grid' | 'masonry' | 'carousel';
}

export function Gallery({ mediaIds, caption, layout = 'grid' }: GalleryProps) {
  const { t, mediaIndex } = useExperience();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const images = useMemo(
    () => mediaIds.filter((id) => typeof id === 'string' && id.length > 0).map((id) => resolveImage(mediaIndex, id)),
    [mediaIds, mediaIndex],
  );

  const close = useCallback(() => setOpenIndex(null), []);

  const next = useCallback(() => {
    setOpenIndex((current) => (current === null ? null : (current + 1) % images.length));
  }, [images.length]);

  const previous = useCallback(() => {
    setOpenIndex((current) =>
      current === null ? null : (current - 1 + images.length) % images.length,
    );
  }, [images.length]);

  const dialogRef = useDialog(openIndex !== null, close);
  const swipe = useSwipe(next, previous);

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openIndex, next, previous]);

  if (images.length === 0) return null;

  const active = openIndex === null ? null : images[openIndex];

  return (
    <div className={styles.wrap}>
      <ul className={cx(styles.grid, layout === 'masonry' && styles.masonry, layout === 'carousel' && styles.carousel)}>
        {images.map((image, index) => (
          <li key={image.id} className={styles.cell}>
            <button
              type="button"
              className={styles.thumbButton}
              onClick={() => setOpenIndex(index)}
              aria-label={t('gallery.title')}
            >
              <SafeImage
                className={styles.thumb}
                src={image.thumbnailUrl}
                alt=""
                width={image.width}
                height={image.height}
              />
            </button>
          </li>
        ))}
      </ul>

      {caption && <p className={styles.caption}>{caption}</p>}

      {active && (
        <ThemePortal>
          <div
            className={styles.lightbox}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('gallery.title')}
            tabIndex={-1}
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
          >
            <button type="button" className={cx(styles.control, styles.close)} onClick={close}>
              <X size={20} aria-hidden />
              <span className={styles.srOnly}>{t('gallery.close')}</span>
            </button>

            <figure className={styles.figure}>
              <SafeImage className={styles.full} src={active.url} alt={caption ?? ''} eager />
            </figure>

            {images.length > 1 && (
              <div className={styles.pager}>
                <button type="button" className={styles.control} onClick={previous}>
                  <ChevronLeft size={22} aria-hidden />
                  <span className={styles.srOnly}>{t('gallery.previous')}</span>
                </button>
                <span className={styles.count} aria-hidden>
                  {t('nav.progress', {
                    current: String((openIndex ?? 0) + 1),
                    total: String(images.length),
                  })}
                </span>
                <button type="button" className={styles.control} onClick={next}>
                  <ChevronRight size={22} aria-hidden />
                  <span className={styles.srOnly}>{t('gallery.next')}</span>
                </button>
              </div>
            )}
          </div>
        </ThemePortal>
      )}
    </div>
  );
}

export default Gallery;
