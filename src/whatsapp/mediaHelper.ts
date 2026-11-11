import fs from 'fs';
import path from 'path';
import { downloadMediaMessage, proto, WAMessage } from '@whiskeysockets/baileys';
import config from '../../config/env';
import Logger from '../utils/logger';

const logger = Logger.forModule('MediaHelper');

/**
 * Downloads an image message from Baileys and saves it to the temporary images folder.
 */
export async function downloadWhatsAppImage(message: WAMessage): Promise<string> {
  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        reuploadRequest: (msg: any) => Promise.resolve(msg),
      } as any
    );

    if (!buffer || buffer.length === 0) {
      throw new Error('Downloaded buffer is empty.');
    }

    const filename = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const destPath = path.join(config.tempImagesDir, filename);

    fs.writeFileSync(destPath, buffer);
    logger.success(`Downloaded WhatsApp image (${(buffer.length / 1024).toFixed(1)} KB) -> ${filename}`);

    return destPath;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to download WhatsApp media: ${msg}`, err);
    throw err;
  }
}

/**
 * Checks whether a Baileys message contains an image.
 */
export function isImageMessage(message?: proto.IMessage | null): boolean {
  if (!message) return false;
  return Boolean(
    message.imageMessage ||
    message.ephemeralMessage?.message?.imageMessage ||
    message.viewOnceMessage?.message?.imageMessage ||
    message.viewOnceMessageV2?.message?.imageMessage ||
    message.viewOnceMessageV2Extension?.message?.imageMessage ||
    message.documentWithCaptionMessage?.message?.imageMessage ||
    (message.documentMessage && message.documentMessage.mimetype?.startsWith('image/'))
  );
}

/**
 * Extracts caption if the image was sent with a text caption in WhatsApp.
 */
export function getImageCaption(message?: proto.IMessage | null): string {
  if (!message) return '';
  return (
    message.imageMessage?.caption ||
    message.ephemeralMessage?.message?.imageMessage?.caption ||
    message.documentWithCaptionMessage?.message?.imageMessage?.caption ||
    message.documentMessage?.caption ||
    ''
  );
}
