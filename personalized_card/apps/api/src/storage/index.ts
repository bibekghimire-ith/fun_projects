import { config } from '../config/env';
import type { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  cached =
    config.MEDIA_STORAGE_PROVIDER === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
  return cached;
}
