import { getEnv } from '../config/env';
import { LocalStorageProvider } from './local';
import { SupabaseStorageProvider } from './supabase';

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (provider) return provider;

  const env = getEnv();
  if (
    env.STORAGE_DRIVER === 'supabase' &&
    env.SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    provider = new SupabaseStorageProvider(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.STORAGE_BUCKET
    );
    return provider;
  }

  provider = new LocalStorageProvider();
  return provider;
}

/** Test-only hook to reset the singleton between tests. */
export function resetStorage(): void {
  provider = null;
}

/** Test-only hook to inject a fake provider. */
export function setStorage(p: StorageProvider): void {
  provider = p;
}

export { LocalStorageProvider } from './local';
export { SupabaseStorageProvider } from './supabase';
