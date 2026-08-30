import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateExperienceSchema, type CreateExperienceInput } from '@letter/validation';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Experience } from '@letter/types';

export function ExperienceNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateExperienceInput>({
    resolver: zodResolver(CreateExperienceSchema),
    defaultValues: {
      eventType: 'BIRTHDAY',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateExperienceInput) =>
      api.post<Experience>('/api/experiences', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['experiences'] });
      navigate(`/experiences/${data.id}/edit`);
    },
  });

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Create a new letter</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: '2rem' }}>
        Start crafting your personalized experience.
      </p>

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <label>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Title</div>
          <input
            {...register('title')}
            placeholder="A Letter From Me To You"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.title && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.title.message}</p>}
        </label>

        <label>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Recipient Name</div>
          <input
            {...register('recipientName')}
            placeholder="Jane"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.recipientName && (
            <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.recipientName.message}</p>
          )}
        </label>

        <label>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Event Type</div>
          <select
            {...register('eventType')}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="BIRTHDAY">Birthday</option>
            <option value="ANNIVERSARY">Anniversary</option>
            <option value="VALENTINES">Valentine's Day</option>
            <option value="CUSTOM">Custom</option>
          </select>
          {errors.eventType && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.eventType.message}</p>}
        </label>

        <label>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Event Date (Optional)</div>
          <input
            type="datetime-local"
            {...register('eventDate')}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 500,
          }}
        >
          {mutation.isPending ? 'Creating...' : 'Create Experience'}
        </button>

        {mutation.isError && (
          <p style={{ color: 'red' }}>
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create experience'}
          </p>
        )}
      </form>
    </div>
  );
}
