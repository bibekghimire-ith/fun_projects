import { useState } from 'react';
import { cx } from '../../ui';
import { withMediaToken } from '../../lib/mediaUrl';
import { useExperience } from './context';
import styles from './safeImage.module.css';

interface SafeImageProps {
  src: string;
  /** Always meaningful, or an empty string when the picture is decorative. */
  alt: string;
  className?: string;
  width?: number | null;
  height?: number | null;
  /** Above the fold — skip lazy loading. */
  eager?: boolean;
}

/**
 * An image that fails quietly. A photo the viewer is not allowed to fetch (a
 * draft in the creator's preview, a file that has since gone) leaves a calm
 * blank rather than a broken-image icon in the middle of a letter.
 *
 * The scoped media token (present only while the creator previews their own
 * draft) is applied here so every call site can keep passing a plain url.
 */
export function SafeImage({ src, alt, className, width, height, eager }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const { mediaToken } = useExperience();

  if (failed) {
    return <span className={cx(styles.placeholder, className)} role="presentation" />;
  }

  return (
    <img
      className={cx(styles.image, className)}
      src={withMediaToken(src, mediaToken)}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export default SafeImage;
