import { useCallback, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  BlockPreset,
  BlockType,
  ContentBlock,
  Experience,
  ExperienceConfig,
  ExperienceSection,
  FinalSurprise,
  FutureLetter,
  Media,
  Memory,
  OpenWhenMessage,
  PublishCheck,
  Response as LetterResponse,
  ShareInfo,
  TemplateDefinition,
  TemplateSummary,
  Theme,
} from '@letter/types';
import type {
  CreateFromTemplateInput,
  CreateMemoryInput,
  CreateOpenWhenInput,
  CreateThemeInput,
  ExperienceConfigInput,
  FinalSurpriseInput,
  FutureLetterInput,
  UpdateExperienceInput,
  UpdateMemoryInput,
  UpdateOpenWhenInput,
} from '@letter/validation';
import { api } from '../api';
import type { MediaTokenResponse } from '../lib/mediaUrl';

/* ── Query keys ───────────────────────────────────────────────────────────────
   One place for every key in the creator app, so a mutation can always name
   precisely what it invalidates instead of guessing.                          */

export const keys = {
  experiences: ['experiences'] as const,
  experience: (id: string) => ['experience', id] as const,
  sections: (id: string) => ['sections', id] as const,
  memories: (id: string) => ['memories', id] as const,
  openWhen: (id: string) => ['open-when', id] as const,
  media: (id: string) => ['media', id] as const,
  mediaToken: (id: string) => ['media-token', id] as const,
  config: (id: string) => ['config', id] as const,
  themes: ['themes'] as const,
  templates: ['templates'] as const,
  template: (slug: string) => ['templates', slug] as const,
  presets: ['presets'] as const,
  share: (id: string) => ['share', id] as const,
  publishCheck: (id: string) => ['publish-check', id] as const,
  responses: (id: string) => ['responses', id] as const,
};

/* ── Server row shapes ────────────────────────────────────────────────────────
   The creator endpoints return database rows, so the `isUnlocked` and `media`
   fields the recipient view gets are not present here. These aliases keep that
   honest rather than pretending the fields exist.                             */

export type OpenWhenRow = Omit<OpenWhenMessage, 'isUnlocked' | 'media'>;
export type FutureLetterRow = Omit<FutureLetter, 'isUnlocked' | 'media'>;
export type FinalSurpriseRow = Omit<FinalSurprise, 'media'>;

/** What GET /api/experiences/:id returns: the letter and everything under it. */
export interface ExperienceDetail extends Experience {
  /** Every media item on the experience, with url/thumbnailUrl resolved. */
  media: Media[];
  sections: ExperienceSection[];
  memories: Memory[];
  openWhenMessages: OpenWhenRow[];
  futureLetter: FutureLetterRow | null;
  finalSurprise: FinalSurpriseRow | null;
}

/* ── Experiences ──────────────────────────────────────────────────────────── */

export function useExperiences(): UseQueryResult<Experience[]> {
  return useQuery({
    queryKey: keys.experiences,
    queryFn: () => api.get<Experience[]>('/api/experiences'),
  });
}

export function useExperience(id: string | undefined) {
  return useQuery({
    queryKey: keys.experience(id ?? 'unknown'),
    queryFn: () => api.get<ExperienceDetail>(`/api/experiences/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFromTemplateInput) =>
      api.post<Experience>('/api/experiences', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.experiences });
    },
  });
}

export function useUpdateExperience(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateExperienceInput) =>
      api.patch<Experience>(`/api/experiences/${id}`, input),
    onSuccess: () => invalidateExperience(queryClient, id),
  });
}

export function useDuplicateExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Experience>(`/api/experiences/${id}/duplicate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.experiences });
    },
  });
}

export function useDeleteExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<null>(`/api/experiences/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.experiences });
    },
  });
}

/** Everything that depends on the letter row itself, refreshed together. */
function invalidateExperience(queryClient: QueryClient, id: string) {
  void queryClient.invalidateQueries({ queryKey: keys.experience(id) });
  void queryClient.invalidateQueries({ queryKey: keys.experiences });
  void queryClient.invalidateQueries({ queryKey: keys.publishCheck(id) });
  void queryClient.invalidateQueries({ queryKey: keys.share(id) });
}

/* ── Sections and blocks ──────────────────────────────────────────────────── */

export function useSections(experienceId: string) {
  return useQuery({
    queryKey: keys.sections(experienceId),
    queryFn: () => api.get<ExperienceSection[]>(`/api/experiences/${experienceId}/sections`),
  });
}

/** Sections and the publish check both change whenever content does. */
function invalidateContent(queryClient: QueryClient, experienceId: string) {
  void queryClient.invalidateQueries({ queryKey: keys.sections(experienceId) });
  void queryClient.invalidateQueries({ queryKey: keys.publishCheck(experienceId) });
}

export function useCreateSection(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      api.post<ExperienceSection>(`/api/experiences/${experienceId}/sections`, { title }),
    onSuccess: () => invalidateContent(queryClient, experienceId),
  });
}

export function useUpdateSection(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; enabled?: boolean }) =>
      api.patch<ExperienceSection>(`/api/sections/${id}`, input),
    onSuccess: () => invalidateContent(queryClient, experienceId),
  });
}

export function useDeleteSection(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<null>(`/api/sections/${id}`),
    onSuccess: () => invalidateContent(queryClient, experienceId),
  });
}

export function useReorderSections(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<null>(`/api/experiences/${experienceId}/sections/reorder`, { ids }),
    // The list is already showing the new order optimistically; only reconcile
    // if the server disagreed.
    onError: () => invalidateContent(queryClient, experienceId),
  });
}

export function useCreateBlock(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sectionId,
      type,
      content,
      mediaId,
    }: {
      sectionId: string;
      type: BlockType;
      content: Record<string, unknown>;
      mediaId?: string | null;
    }) =>
      api.post<ContentBlock>(`/api/sections/${sectionId}/blocks`, {
        type,
        content,
        ...(mediaId ? { mediaId } : {}),
      }),
    onSuccess: () => invalidateContent(queryClient, experienceId),
  });
}

export function useUpdateBlock(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      enabled?: boolean;
      content?: Record<string, unknown>;
      mediaId?: string | null;
    }) => api.patch<ContentBlock>(`/api/blocks/${id}`, input),
    onSuccess: () => invalidateContent(queryClient, experienceId),
  });
}

export function useDeleteBlock(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<null>(`/api/blocks/${id}`),
    onSuccess: () => invalidateContent(queryClient, experienceId),
  });
}

export function useReorderBlocks(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, ids }: { sectionId: string; ids: string[] }) =>
      api.post<null>(`/api/sections/${sectionId}/blocks/reorder`, { ids }),
    onError: () => invalidateContent(queryClient, experienceId),
  });
}

export function useApplyPreset(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, slug }: { sectionId: string; slug: string }) =>
      api.post<ContentBlock[]>(`/api/sections/${sectionId}/apply-preset`, { slug }),
    onSuccess: () => invalidateContent(queryClient, experienceId),
  });
}

/* ── Memories ─────────────────────────────────────────────────────────────── */

export function useMemories(experienceId: string) {
  return useQuery({
    queryKey: keys.memories(experienceId),
    queryFn: () => api.get<Memory[]>(`/api/experiences/${experienceId}/memories`),
  });
}

export function useCreateMemory(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMemoryInput) =>
      api.post<Memory>(`/api/experiences/${experienceId}/memories`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.memories(experienceId) });
    },
  });
}

export function useUpdateMemory(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateMemoryInput & { id: string }) =>
      api.patch<Memory>(`/api/memories/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.memories(experienceId) });
    },
  });
}

export function useDeleteMemory(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<null>(`/api/memories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.memories(experienceId) });
    },
  });
}

export function useReorderMemories(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<null>(`/api/experiences/${experienceId}/memories/reorder`, { ids }),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: keys.memories(experienceId) });
    },
  });
}

/* ── "Open when…" notes ───────────────────────────────────────────────────── */

export function useOpenWhen(experienceId: string) {
  return useQuery({
    queryKey: keys.openWhen(experienceId),
    queryFn: () => api.get<OpenWhenRow[]>(`/api/experiences/${experienceId}/open-when`),
  });
}

export function useCreateOpenWhen(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpenWhenInput) =>
      api.post<OpenWhenRow>(`/api/experiences/${experienceId}/open-when`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.openWhen(experienceId) });
    },
  });
}

export function useUpdateOpenWhen(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateOpenWhenInput & { id: string }) =>
      api.patch<OpenWhenRow>(`/api/open-when/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.openWhen(experienceId) });
    },
  });
}

export function useDeleteOpenWhen(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<null>(`/api/open-when/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.openWhen(experienceId) });
    },
  });
}

export function useManualUnlock(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<OpenWhenRow>(`/api/open-when/${id}/manual-unlock`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.openWhen(experienceId) });
    },
  });
}

/* ── Future letter and final surprise ─────────────────────────────────────────
   Both live on the experience record, so they refresh the ['experience', id]
   query rather than owning a key of their own.                                */

export function useSaveFutureLetter(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FutureLetterInput) =>
      api.put<FutureLetterRow>(`/api/experiences/${experienceId}/future-letter`, input),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

export function useDeleteFutureLetter(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.del<null>(`/api/experiences/${experienceId}/future-letter`),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

export function useSaveFinalSurprise(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FinalSurpriseInput) =>
      api.put<FinalSurpriseRow>(`/api/experiences/${experienceId}/final-surprise`, input),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

export function useDeleteFinalSurprise(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.del<null>(`/api/experiences/${experienceId}/final-surprise`),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

/* ── Media ────────────────────────────────────────────────────────────────── */

export function useMedia(experienceId: string) {
  return useQuery({
    queryKey: keys.media(experienceId),
    queryFn: () => api.get<Media[]>(`/api/experiences/${experienceId}/media`),
  });
}

/**
 * A short-lived, single-experience token that unlocks a draft's media for
 * plain <img>/<audio>/<video> tags, which cannot send an Authorization
 * header. A published letter never needs this — its media streams openly.
 * staleTime sits well under the server's expiry so a stale token is never
 * handed to a freshly mounted element.
 */
export function useMediaToken(experienceId: string | undefined) {
  return useQuery({
    queryKey: keys.mediaToken(experienceId ?? 'unknown'),
    queryFn: () => api.get<MediaTokenResponse>(`/api/experiences/${experienceId}/media-token`),
    enabled: Boolean(experienceId),
    staleTime: 20 * 60 * 1000,
    refetchOnMount: 'always' as const,
  });
}

export function useDeleteMedia(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<null>(`/api/media/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.media(experienceId) });
      // A deleted cover changes whether the letter can be published.
      void queryClient.invalidateQueries({ queryKey: keys.publishCheck(experienceId) });
      void queryClient.invalidateQueries({ queryKey: keys.experience(experienceId) });
    },
  });
}

export interface UploadItem {
  /** Local id — the file has no server id until it lands. */
  id: string;
  name: string;
  percent: number;
  error?: string;
}

/**
 * Uploads with per-file progress. XHR (not fetch) reports progress, so this
 * sits outside react-query's mutation flow and reconciles the cache itself.
 */
export function useMediaUploader(experienceId: string) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const upload = useCallback(
    async (files: File[]): Promise<Media[]> => {
      const done: Media[] = [];

      for (const file of files) {
        const localId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setUploads((current) => [...current, { id: localId, name: file.name, percent: 0 }]);

        const form = new FormData();
        form.append('file', file);
        form.append('experienceId', experienceId);

        try {
          const media = await api.upload<Media>('/api/media/upload', form, (percent) => {
            setUploads((current) =>
              current.map((item) => (item.id === localId ? { ...item, percent } : item)),
            );
          });
          done.push(media);
          setUploads((current) => current.filter((item) => item.id !== localId));
        } catch (error) {
          // Failures stay on screen with their message — the creator needs to
          // know which file was rejected and why.
          setUploads((current) =>
            current.map((item) =>
              item.id === localId
                ? {
                    ...item,
                    percent: 100,
                    error: error instanceof Error ? error.message : 'That upload failed.',
                  }
                : item,
            ),
          );
        }
      }

      if (done.length > 0) {
        void queryClient.invalidateQueries({ queryKey: keys.media(experienceId) });
      }
      return done;
    },
    [experienceId, queryClient],
  );

  const dismissUpload = useCallback((id: string) => {
    setUploads((current) => current.filter((item) => item.id !== id));
  }, []);

  return { uploads, upload, dismissUpload };
}

/* ── Config ───────────────────────────────────────────────────────────────── */

export function useConfig(experienceId: string) {
  return useQuery({
    queryKey: keys.config(experienceId),
    queryFn: () => api.get<ExperienceConfig>(`/api/experiences/${experienceId}/config`),
  });
}

export function useUpdateConfig(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExperienceConfigInput) =>
      api.put<ExperienceConfig>(`/api/experiences/${experienceId}/config`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(keys.config(experienceId), data);
    },
  });
}

/* ── Themes ───────────────────────────────────────────────────────────────── */

export function useThemes() {
  return useQuery({
    queryKey: keys.themes,
    queryFn: () => api.get<Theme[]>('/api/themes'),
  });
}

export function useSetTheme(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) =>
      api.post<Experience>(`/api/experiences/${experienceId}/theme`, { themeId }),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

export function useCreateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThemeInput) => api.post<Theme>('/api/themes', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.themes });
    },
  });
}

export function useForkTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ themeId, name }: { themeId: string; name?: string }) =>
      api.post<Theme>('/api/themes/fork', { themeId, ...(name ? { name } : {}) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.themes });
    },
  });
}

export function useUpdateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateThemeInput> & { id: string }) =>
      api.patch<Theme>(`/api/themes/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.themes });
      // A themed experience shows the new colours immediately.
      void queryClient.invalidateQueries({ queryKey: ['experience'] });
    },
  });
}

export function useDeleteTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<null>(`/api/themes/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.themes });
      void queryClient.invalidateQueries({ queryKey: ['experience'] });
    },
  });
}

/* ── Templates and presets ────────────────────────────────────────────────── */

export function useTemplates() {
  return useQuery({
    queryKey: keys.templates,
    queryFn: () => api.get<TemplateSummary[]>('/api/templates'),
    // Templates ship with the app; they do not change while you are looking.
    staleTime: 10 * 60_000,
  });
}

export function useTemplate(slug: string | null) {
  return useQuery({
    queryKey: keys.template(slug ?? 'none'),
    queryFn: () => api.get<TemplateDefinition>(`/api/templates/${slug}`),
    enabled: Boolean(slug),
    staleTime: 10 * 60_000,
  });
}

export function usePresets() {
  return useQuery({
    queryKey: keys.presets,
    queryFn: () => api.get<BlockPreset[]>('/api/templates/presets'),
    staleTime: 10 * 60_000,
  });
}

/* ── Share, publish, responses ────────────────────────────────────────────── */

export function useShare(experienceId: string) {
  return useQuery({
    queryKey: keys.share(experienceId),
    queryFn: () => api.get<ShareInfo>(`/api/experiences/${experienceId}/share`),
  });
}

export function usePublishCheck(experienceId: string) {
  return useQuery({
    queryKey: keys.publishCheck(experienceId),
    queryFn: () => api.get<PublishCheck>(`/api/experiences/${experienceId}/publish-check`),
  });
}

export function usePublish(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allowWithoutCover: boolean) =>
      api.post<Experience>(`/api/experiences/${experienceId}/publish`, { allowWithoutCover }),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

export function useUnpublish(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Experience>(`/api/experiences/${experienceId}/unpublish`),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

export function useRevoke(experienceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Experience>(`/api/experiences/${experienceId}/revoke`),
    onSuccess: () => invalidateExperience(queryClient, experienceId),
  });
}

export function useResponses(experienceId: string) {
  return useQuery({
    queryKey: keys.responses(experienceId),
    queryFn: () => api.get<LetterResponse[]>(`/api/experiences/${experienceId}/responses`),
  });
}

/* ── Small shared helpers ─────────────────────────────────────────────────── */

/** `<input type="datetime-local">` speaks local time; the API speaks ISO. */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** `<input type="date">` value for an ISO timestamp. */
export function toDateInputValue(iso: string | null | undefined): string {
  return toLocalInputValue(iso).slice(0, 10);
}

/** Turn a local datetime-local / date input back into an ISO string. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
