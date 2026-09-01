import type { Media, PublicExperience } from '@letter/types';
import { API_BASE_URL } from '../../api';

/**
 * The API serves every file from one streaming route, so an id is enough to
 * build a URL. The public payload only carries the media records it happens to
 * reference directly (a block's own file, a memory's photo…), and a gallery
 * block stores bare ids — this is how those are resolved.
 */
export function mediaStreamUrl(id: string): string {
  return `${API_BASE_URL}/api/media/${id}/stream`;
}

/** Every media record reachable from the payload, keyed by id. */
export function buildMediaIndex(experience: PublicExperience): Map<string, Media> {
  const index = new Map<string, Media>();
  const add = (media: Media | null | undefined) => {
    if (media?.id) index.set(media.id, media);
  };

  // The full media list travels with the payload precisely so a bare id (a
  // GALLERY block's mediaIds, for instance) resolves to a real
  // thumbnailUrl/width/height instead of the guessed stream URL below.
  for (const media of experience.media ?? []) add(media);

  add(experience.coverMedia);
  add(experience.musicMedia);
  for (const section of experience.sections) {
    for (const block of section.blocks) add(block.media);
  }
  for (const memory of experience.memories) add(memory.media);
  for (const message of experience.openWhenMessages) add(message.media);
  add(experience.futureLetter?.media);
  add(experience.finalSurprise?.media);

  return index;
}

export interface ResolvedImage {
  id: string;
  url: string;
  /** Falls back to the full-size URL when no thumbnail was generated. */
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
}

export function resolveImage(index: Map<string, Media>, id: string): ResolvedImage {
  const media = index.get(id);
  const url = media?.url ?? mediaStreamUrl(id);
  return {
    id,
    url,
    thumbnailUrl: media?.thumbnailUrl ?? url,
    width: media?.width ?? null,
    height: media?.height ?? null,
  };
}
