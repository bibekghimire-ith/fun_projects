import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/env';
import type { StorageProvider } from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  private root() {
    return path.resolve(config.MEDIA_LOCAL_PATH);
  }

  private full(key: string) {
    const resolved = path.resolve(this.root(), key);
    if (!resolved.startsWith(this.root())) {
      throw new Error('Invalid storage path');
    }
    return resolved;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const dest = this.full(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.full(key));
    } catch {
      // already gone
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.full(key));
      return true;
    } catch {
      return false;
    }
  }
}
