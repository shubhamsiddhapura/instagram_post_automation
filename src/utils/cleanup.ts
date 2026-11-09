import fs from 'fs';
import path from 'path';
import Logger from './logger';

const logger = Logger.forModule('Cleanup');

/**
 * Safely removes a file if it exists.
 */
export function deleteFile(filePath: string | null): void {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Removed temporary file: ${path.basename(filePath)}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Could not delete file ${filePath}: ${msg}`);
  }
}

/**
 * Ensures all required temp directories exist.
 */
export function ensureDirectories(dirs: string[]): void {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
