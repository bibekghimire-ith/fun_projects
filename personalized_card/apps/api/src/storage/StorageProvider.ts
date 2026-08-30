import { z } from 'zod';

export interface StorageProvider {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const mediaTypeFromMime = z.enum(['IMAGE', 'VIDEO', 'AUDIO']);
