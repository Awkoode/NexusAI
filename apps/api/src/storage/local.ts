import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { StorageProvider } from './index';

/**
 * Local filesystem storage provider for development.
 * In production, replace with Supabase Storage or S3.
 */
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = path.join(process.cwd(), 'uploads');
    // Ensure directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filepath = this.resolvePath(key);
    const dir = path.dirname(filepath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(filepath, buffer);
  }

  async download(key: string): Promise<Buffer> {
    const filepath = this.resolvePath(key);
    return fs.promises.readFile(filepath);
  }

  async delete(key: string): Promise<void> {
    const filepath = this.resolvePath(key);
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  }

  getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    // In local storage, return the key as a reference
    // In production, this would generate a signed URL
    return Promise.resolve(`/api/v1/files/${key}`);
  }

  /**
   * Sanitize and generate a safe storage key from user input
   */
  static generateKey(userId: string, projectId: string, filename: string): string {
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString('hex');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${userId}/${projectId}/${timestamp}_${hash}_${sanitizedFilename}`;
  }

  private resolvePath(key: string): string {
    // Prevent directory traversal
    const resolved = path.resolve(this.basePath, key);
    const baseResolved = path.resolve(this.basePath);
    if (!resolved.startsWith(baseResolved)) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    return resolved;
  }
}