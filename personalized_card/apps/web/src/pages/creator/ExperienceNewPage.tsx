import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText } from 'lucide-react';
import { CreateFromTemplateSchema, type CreateFromTemplateInput } from '@letter/validation';
import type { TemplateSummary } from '@letter/types';
import {
  fromLocalInputValue,
  useCreateExperience,
  useTemplate,
  useTemplates,
} from '../../hooks/useExperience';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Textarea,
  cx,
  useToast,
} from '../../ui';
import styles from './creator.module.css';

const BLANK_SLUG = 'blank-canvas';

export default function ExperienceNewPage() {
  const navigate = useNavigate();
  const { notifyError } = useToast();
  const templates = useTemplates();
  const create = useCreateExperience();

  const [slug, setSlug] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [eventDateValue, setEventDateValue] = useState('');

  const chosen = useTemplate(slug);
  const preview = useTemplate(previewSlug);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<CreateFromTemplateInput>({
    resolver: zodResolver(CreateFromTemplateSchema),
    defaultValues: {
      title: '',
      recipientName: '',
      eventType: 'CUSTOM',
      eventDate: null,
      openingMessage: '',
      closingMessage: '',
      templateSlug: null,
    },
  });

  // Prefill from the chosen template, but never overwrite words the creator has
  // already typed — their draft always wins over a suggestion.
  const template = chosen.data;
  useEffect(() => {
    if (!template) return;
    setValue('templateSlug', template.slug);
    setValue('eventType', template.eventType);
    if (!dirtyFields.title) setValue('title', template.defaults.title);
    if (!dirtyFields.openingMessage) setValue('openingMessage', template.defaults.openingMessage);
    if (!dirtyFields.closingMessage) setValue('closingMessage', template.defaults.closingMessage);
  }, [template, setValue, dirtyFields.title, dirtyFields.openingMessage, dirtyFields.closingMessage]);

  function onSubmit(values: CreateFromTemplateInput) {
    create.mutate(
      { ...values, templateSlug: slug },
      {
        onSuccess: (experience) => navigate(`/experiences/${experience.id}/edit`),
        onError: notifyError,
      },
    );
  }

  const all = templates.data ?? [];
  const blank = all.find((item) => item.slug === BLANK_SLUG);
  const gallery = all.filter((item) => item.slug !== BLANK_SLUG);
  // The blank-canvas template seeds one empty chapter; without it, no template
  // at all. Either way the creator starts on a page they own.
  const blankValue = blank ? blank.slug : null;

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.pageTitle}>Start a new letter</h1>
        <p className={styles.pageLead}>
          Pick a shape to start from. Every part of it can be rewritten, moved or removed later —
          this only saves you the blank page.
        </p>
      </div>

      {templates.isPending && <Spinner label="Loading the starting points" />}
      {templates.isError && (
        <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
      )}

      {templates.data && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.sectionTitle}>Choose a starting point</legend>

          <ul className={cx(styles.grid, styles.resetList)}>
            {gallery.map((item) => (
              <li key={item.slug} className={styles.tileWrap}>
                <TemplateTile
                  template={item}
                  selected={slug === item.slug}
                  onSelect={() => setSlug(item.slug)}
                />
                <Button size="sm" variant="ghost" onClick={() => setPreviewSlug(item.slug)}>
                  See what&rsquo;s inside
                </Button>
              </li>
            ))}
          </ul>

          <label
            className={cx(styles.tile, slug === blankValue && styles.tileSelected, styles.blankTile)}
          >
            <input
              type="radio"
              name="template"
              className={styles.srOnly}
              checked={slug === blankValue}
              onChange={() => setSlug(blankValue)}
            />
            <span className={styles.tileEmoji} aria-hidden>
              <FileText size={22} />
            </span>
            <span className={styles.tileName}>Blank canvas</span>
            <span className={cx(styles.muted, styles.small)}>
              {blank
                ? 'One empty chapter and nothing else. Best when you already know what you want to say.'
                : 'Start with nothing at all and build it up block by block.'}
            </span>
          </label>
        </fieldset>
      )}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack>
            <h2 className={styles.sectionTitle}>Who is it for?</h2>

            <div className={styles.fieldRow}>
              <Field label="Title" error={errors.title?.message} hint="Only you will see this.">
                {(props) => <Input {...props} {...register('title')} placeholder="For Sam" />}
              </Field>

              <Field label="Their name" error={errors.recipientName?.message}>
                {(props) => (
                  <Input {...props} {...register('recipientName')} placeholder="Sam" autoComplete="off" />
                )}
              </Field>
            </div>

            <div className={styles.fieldRow}>
              <Field label="Occasion" error={errors.eventType?.message}>
                {(props) => (
                  <Select {...props} {...register('eventType')}>
                    <option value="BIRTHDAY">Birthday</option>
                    <option value="ANNIVERSARY">Anniversary</option>
                    <option value="VALENTINES">Valentine&rsquo;s</option>
                    <option value="CUSTOM">Just because</option>
                  </Select>
                )}
              </Field>

              <Field
                label="The date it marks"
                hint="Optional. Used for countdowns and the date in your wording."
                error={errors.eventDate?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={eventDateValue}
                    onChange={(event) => {
                      setEventDateValue(event.target.value);
                      setValue('eventDate', fromLocalInputValue(event.target.value), {
                        shouldDirty: true,
                      });
                    }}
                  />
                )}
              </Field>
            </div>

            <Field
              label="How it opens"
              hint="The first thing they read. Optional."
              error={errors.openingMessage?.message}
            >
              {(props) => <Textarea {...props} {...register('openingMessage')} rows={3} />}
            </Field>

            <Field
              label="How it closes"
              hint="The last thing they read. Optional."
              error={errors.closingMessage?.message}
            >
              {(props) => <Textarea {...props} {...register('closingMessage')} rows={3} />}
            </Field>

            <div className={styles.actions}>
              <Button type="submit" variant="primary" loading={create.isPending}>
                Create the letter
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
            </div>
          </Stack>
        </form>
      </Card>

      <Modal
        open={previewSlug !== null}
        onClose={() => setPreviewSlug(null)}
        title={preview.data?.name ?? 'Have a look inside'}
        description={preview.data?.description}
        wide
        footer={
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={!preview.data}
              onClick={() => {
                if (preview.data) setSlug(preview.data.slug);
                setPreviewSlug(null);
              }}
            >
              Start from this
            </Button>
            <Button variant="ghost" onClick={() => setPreviewSlug(null)}>
              Close
            </Button>
          </div>
        }
      >
        {preview.isPending && <Spinner label="Opening the template" />}
        {preview.isError && (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        )}
        {preview.data && (
          <Stack>
            <p className={styles.muted}>{preview.data.tagline}</p>

            <div>
              <h3 className={styles.sectionTitle}>The chapters</h3>
              <ol className={styles.chapterList}>
                {preview.data.sections.map((section, index) => (
                  <li key={`${section.title}-${index}`}>
                    <strong>{section.title}</strong>
                    <span className={cx(styles.muted, styles.small)}>
                      {' '}
                      — {section.blocks.length} {section.blocks.length === 1 ? 'block' : 'blocks'}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className={styles.sectionTitle}>It also comes with</h3>
              <ul className={styles.chapterList}>
                {preview.data.memories?.length ? (
                  <li>{preview.data.memories.length} moments on the timeline</li>
                ) : null}
                {preview.data.openWhen?.length ? (
                  <li>{preview.data.openWhen.length} sealed &ldquo;open when&rdquo; notes</li>
                ) : null}
                {preview.data.futureLetter ? <li>A letter that unlocks later</li> : null}
                {preview.data.finalSurprise ? <li>A final question at the end</li> : null}
                <li>The {preview.data.themeSlug.replace(/-/g, ' ')} theme</li>
              </ul>
            </div>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

function TemplateTile({
  template,
  selected,
  onSelect,
}: {
  template: TemplateSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={cx(styles.tile, selected && styles.tileSelected)}>
      <input
        type="radio"
        name="template"
        className={styles.srOnly}
        checked={selected}
        onChange={onSelect}
      />
      <span className={styles.tileEmoji} aria-hidden>
        {template.emoji}
      </span>
      <span className={styles.tileName}>{template.name}</span>
      <span className={cx(styles.muted, styles.small)}>{template.tagline}</span>

      <span className={cx(styles.itemMeta, styles.small)}>
        <Clock size={13} aria-hidden />
        <span>about {template.estimatedMinutes} minutes to fill in</span>
      </span>

      <span className={cx(styles.muted, styles.small)}>
        {template.sectionCount} chapters, {template.blockCount} blocks
        {template.includes.length > 0 ? `, plus ${template.includes.join(', ')}` : ''}
      </span>

      <span className={styles.tileTags}>
        {template.tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
      </span>
    </label>
  );
}
