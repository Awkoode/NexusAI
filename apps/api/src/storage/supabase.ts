import fs from 'fs';
import path from 'path';
import type { StorageProvider } from './index';

/**
 * Supabase Storage provider for private buckets.
 * Uses the service-role key exclusively on the server.
 */
export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private serviceRoleKey: string;
  private bucket: string;

  constructor(supabaseUrl: string, serviceRoleKey: string, bucket: string) {
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
    this.bucket = bucket;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const url = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/')}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': mimeType || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });
    if (!response.ok) {
      throw new Error(`Supabase Storage upload failed: ${response.status}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    const url = `${this.supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(
      this.bucket
    )}/${key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/')}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase Storage download failed: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    const url = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/')}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase Storage delete failed: ${response.status}`);
    }
  }

  getSignedUrl(_key: string, _expiresInSeconds = 3600): Promise<string> {
    // Private bucket: never expose direct URLs. Downloads go through the API.
    return Promise.reject(new Error('Direct file URLs are disabled for private buckets'));
  }
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).slice(0, 100);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'dataset.csv';
}

export function assertLocalOnly(): void {
  if (!fs.existsSync(process.cwd())) {
    throw new Error('Working directory unavailable');
  }
}
