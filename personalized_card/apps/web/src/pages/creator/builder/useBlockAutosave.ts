import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ContentBlock, ExperienceSection } from '@letter/types';
import { parseBlockContent } from '@letter/validation';
import { api } from '../../../api';
import { keys } from '../../../hooks/useExperience';
import { useToast } from '../../../ui';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'invalid';

const DEBOUNCE_MS = 900;
const SAVED_FOR_MS = 2200;

/**
 * Holds a block's content locally and writes it back on a debounce.
 *
 * Two rules drive the shape of this: the creator's typing is never thrown away
 * (local state is the source of truth while a block is on screen, and a pending
 * change is flushed on blur and on unmount), and content that would be rejected
 * is caught here rather than sent — otherwise every keystroke in a half-written
 * heading would raise a server error.
 */
export function useBlockAutosave(experienceId: string, block: ContentBlock) {
  const queryClient = useQueryClient();
  const { notifyError } = useToast();

  const [content, setContent] = useState<Record<string, unknown>>(block.content);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const timer = useRef<number | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const blockId = block.id;
  const blockType = block.type;

  const persist = useCallback(
    async (next: Record<string, unknown>) => {
      let payload: Record<string, unknown>;
      try {
        payload = parseBlockContent(blockType, next);
      } catch {
        setStatus('invalid');
        return;
      }

      setStatus('saving');
      try {
        const updated = await api.patch<ContentBlock>(`/api/blocks/${blockId}`, {
          content: payload,
        });
        // Patch the cache by hand rather than invalidating: a refetch would
        // race the editor and could pull an older draft back on screen.
        queryClient.setQueryData<ExperienceSection[]>(keys.sections(experienceId), (sections) =>
          sections?.map((section) => ({
            ...section,
            blocks: section.blocks.map((item) => (item.id === blockId ? updated : item)),
          })),
        );
        setStatus('saved');
      } catch (error) {
        setStatus('idle');
        notifyError(error);
      }
    },
    [blockId, blockType, experienceId, notifyError, queryClient],
  );

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    pending.current = null;
    if (next) void persist(next);
  }, [persist]);

  const update = useCallback(
    (next: Record<string, unknown>) => {
      setContent(next);
      pending.current = next;
      setStatus('idle');
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        const queued = pending.current;
        pending.current = null;
        if (queued) void persist(queued);
      }, DEBOUNCE_MS);
    },
    [persist],
  );

  // Whatever is still queued when the block leaves the screen gets written.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  // "Saved" is a reassurance, not a state — it fades on its own.
  useEffect(() => {
    if (status !== 'saved') return;
    const handle = window.setTimeout(() => setStatus('idle'), SAVED_FOR_MS);
    return () => window.clearTimeout(handle);
  }, [status]);

  return { content, update, flush, status };
}
