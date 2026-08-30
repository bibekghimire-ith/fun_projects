import { describe, expect, it } from 'vitest';
import { RegisterSchema, PinSchema } from '@letter/validation';

describe('validation schemas', () => {
  it('rejects weak passwords', () => {
    const result = RegisterSchema.safeParse({
      email: 'a@b.com',
      password: 'short',
      name: 'A',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid registration payload', () => {
    const result = RegisterSchema.safeParse({
      email: 'creator@example.com',
      password: 'Password123!',
      name: 'Demo',
    });
    expect(result.success).toBe(true);
  });

  it('requires a 4-digit PIN', () => {
    expect(PinSchema.safeParse({ pin: '12' }).success).toBe(false);
    expect(PinSchema.safeParse({ pin: 'abcd' }).success).toBe(false);
    expect(PinSchema.safeParse({ pin: '1234' }).success).toBe(true);
  });
});
