import type {
  BlockPreset,
  TemplateDefinition,
  TemplateSummary,
} from '@letter/types';

// ─── Built-in experience templates ────────────────────────────────────────────
// Adding a template: drop a JSON file in ../templates and add it here.
// Adding one *without* rebuilding: point TEMPLATES_EXTRA_DIR at a folder of
// JSON files — the API loads those at startup (see loadExtraTemplates).

import birthdayClassic from '../templates/birthday-classic.json';
import anniversaryTimeline from '../templates/anniversary-timeline.json';
import valentinesRomance from '../templates/valentines-romance.json';
import farewellColleague from '../templates/farewell-colleague.json';
import graduationDay from '../templates/graduation-day.json';
import thankYou from '../templates/thank-you.json';
import longDistance from '../templates/long-distance.json';
import blankCanvas from '../templates/blank-canvas.json';

import writingPresets from '../presets/writing.json';
import mediaPresets from '../presets/media.json';
import momentPresets from '../presets/moments.json';
import interactivePresets from '../presets/interactive.json';
import layoutPresets from '../presets/layout.json';

const BUILT_IN: TemplateDefinition[] = [
  blankCanvas,
  birthdayClassic,
  anniversaryTimeline,
  valentinesRomance,
  longDistance,
  farewellColleague,
  graduationDay,
  thankYou,
] as unknown as TemplateDefinition[];

const BUILT_IN_PRESETS: BlockPreset[] = [
  ...writingPresets,
  ...mediaPresets,
  ...momentPresets,
  ...interactivePresets,
  ...layoutPresets,
] as unknown as BlockPreset[];

const registry = new Map<string, TemplateDefinition>();
for (const template of BUILT_IN) registry.set(template.slug, template);

const presetRegistry = new Map<string, BlockPreset>();
for (const preset of BUILT_IN_PRESETS) presetRegistry.set(preset.slug, preset);

/** Minimal shape check so a hand-written JSON file fails loudly, not silently. */
export function assertTemplate(value: unknown): asserts value is TemplateDefinition {
  const t = value as Partial<TemplateDefinition>;
  const problems: string[] = [];
  if (!t || typeof t !== 'object') problems.push('not an object');
  if (!t?.slug) problems.push('missing "slug"');
  if (!t?.name) problems.push('missing "name"');
  if (!t?.eventType) problems.push('missing "eventType"');
  if (!t?.themeSlug) problems.push('missing "themeSlug"');
  if (!t?.defaults?.title) problems.push('missing "defaults.title"');
  if (!Array.isArray(t?.sections)) problems.push('missing "sections" array');
  if (problems.length) {
    throw new Error(`Invalid template (${String(t?.slug ?? 'unknown')}): ${problems.join(', ')}`);
  }
}

/** Register a template at runtime (used for TEMPLATES_EXTRA_DIR). */
export function registerTemplate(template: unknown): TemplateDefinition {
  assertTemplate(template);
  registry.set(template.slug, template);
  return template;
}

export function registerPreset(preset: BlockPreset): BlockPreset {
  presetRegistry.set(preset.slug, preset);
  return preset;
}

export function getTemplate(slug: string): TemplateDefinition | undefined {
  return registry.get(slug);
}

export function listTemplates(): TemplateDefinition[] {
  return [...registry.values()];
}

export function getPreset(slug: string): BlockPreset | undefined {
  return presetRegistry.get(slug);
}

export function listPresets(): BlockPreset[] {
  return [...presetRegistry.values()];
}

/** What a template card shows, without shipping the whole body to the client. */
export function summarize(template: TemplateDefinition): TemplateSummary {
  const includes: string[] = [];
  if (template.memories?.length) includes.push(`${template.memories.length} timeline moments`);
  if (template.openWhen?.length) includes.push(`${template.openWhen.length} “open when” notes`);
  if (template.futureLetter) includes.push('a future letter');
  if (template.finalSurprise) includes.push('a final surprise');
  if (template.config?.copy && Object.keys(template.config.copy).length) {
    includes.push('custom wording');
  }

  return {
    slug: template.slug,
    name: template.name,
    description: template.description,
    tagline: template.tagline,
    eventType: template.eventType,
    themeSlug: template.themeSlug,
    emoji: template.emoji,
    tags: template.tags,
    estimatedMinutes: template.estimatedMinutes,
    sectionCount: template.sections.length,
    blockCount: template.sections.reduce((sum, s) => sum + s.blocks.length, 0),
    includes,
  };
}

export function listTemplateSummaries(): TemplateSummary[] {
  return listTemplates().map(summarize);
}

export type { TemplateDefinition, TemplateSummary, BlockPreset };
