import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import Logger from './logger';

const logger = Logger.forModule('SessionSync');

function decodeGzipOrPlain(raw: string): string {
  const buf = Buffer.from(raw.trim(), 'base64');
  try {
    return zlib.gunzipSync(buf).toString('utf8');
  } catch {
    return buf.toString('utf8');
  }
}

/**
 * Checks if session files exist.
 * Supports:
 * 1. WA_SESSION_DATA environment variable (survives all ephemeral resets without disks)
 * 2. IG_SESSION_DATA environment variable
 * 3. Fallback extraction from assets/session.tar.gz archive
 */
export function ensureSessionsRestored(): void {
  const waDir = path.resolve(process.cwd(), 'wa-session');
  const waCreds = path.join(waDir, 'creds.json');
  const igCreds = path.resolve(process.cwd(), 'ig_session.json');
  const archivePath = path.resolve(process.cwd(), 'assets', 'session.tar.gz');

  // 1. WhatsApp session restoration from Environment Variable (Permanent on cloud)
  if (process.env.WA_SESSION_DATA && !fs.existsSync(waCreds)) {
    try {
      if (!fs.existsSync(waDir)) fs.mkdirSync(waDir, { recursive: true });
      const decoded = decodeGzipOrPlain(process.env.WA_SESSION_DATA);
      fs.writeFileSync(waCreds, decoded, 'utf8');
      logger.success('✅ Restored WhatsApp credentials from WA_SESSION_DATA environment variable!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to decode WA_SESSION_DATA: ${msg}`);
    }
  }

  // 2. Instagram session restoration from Environment Variable
  if (process.env.IG_SESSION_DATA && !fs.existsSync(igCreds)) {
    try {
      const decoded = decodeGzipOrPlain(process.env.IG_SESSION_DATA);
      fs.writeFileSync(igCreds, decoded, 'utf8');
      logger.success('✅ Restored Instagram session from IG_SESSION_DATA environment variable!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to decode IG_SESSION_DATA: ${msg}`);
    }
  }

  // 3. Fallback: extract from bundled archive
  if ((!fs.existsSync(waCreds) || !fs.existsSync(igCreds)) && fs.existsSync(archivePath)) {
    logger.info('📦 Restoring pre-authenticated sessions from bundled archive...');
    try {
      execSync(`tar -xzf "${archivePath}" -C "${process.cwd()}"`);
      logger.success('✅ Pre-authenticated WhatsApp and Instagram sessions restored successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Could not extract session archive: ${msg}`);
    }
  }
}
