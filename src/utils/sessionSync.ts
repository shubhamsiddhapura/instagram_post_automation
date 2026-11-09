import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Logger from './logger';

const logger = Logger.forModule('SessionSync');

/**
 * Checks if session files exist.
 * If running on a fresh cloud container (e.g. Render) without pre-mounted volumes,
 * automatically extracts the pre-authenticated sessions from assets/session.tar.gz!
 */
export function ensureSessionsRestored(): void {
  const waCreds = path.resolve(process.cwd(), 'wa-session', 'creds.json');
  const igCreds = path.resolve(process.cwd(), 'ig_session.json');
  const archivePath = path.resolve(process.cwd(), 'assets', 'session.tar.gz');

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
