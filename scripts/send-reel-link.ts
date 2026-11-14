import './patch-baileys.js';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config/env';
import Logger from '../src/utils/logger';
import { generateWhatsAppShareMessage } from '../config/captions';

const logger = Logger.forModule('SendReelLink');

const reelUrl = process.argv[2] || 'https://www.instagram.com/reel/Dft0XrsogaO/';
const targetGroupJid = config.targetGroupJid.split(',')[0].trim();

async function sendLink() {
  logger.info(`Target WhatsApp Group: ${targetGroupJid}`);
  logger.info(`Reel Link to Share: ${reelUrl}`);

  const { state, saveCreds } = await useMultiFileAuthState(config.waSessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'warn' }),
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    getMessage: async () => ({ conversation: '' }),
  });

  sock.ev.on('creds.update', saveCreds);

  let sent = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const err = lastDisconnect?.error;
      logger.warn(`Connection closed: ${err}`);
    }

    if (connection === 'open' && !sent) {
      sent = true;
      logger.success('✅ Connected to WhatsApp!');

      try {
        logger.info('Syncing participating groups...');
        await sock.groupFetchAllParticipating();

        const shareText = generateWhatsAppShareMessage(reelUrl);
        logger.info(`Sending message to ${targetGroupJid}...`);
        logger.info(`Message preview:\n${shareText}`);

        const result = await sock.sendMessage(targetGroupJid, { text: shareText });
        logger.success(`🎉 Message sent successfully! Result ID: ${result?.key?.id}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Error sending message: ${msg}`, err);
      } finally {
        setTimeout(() => {
          sock.end(undefined);
          process.exit(0);
        }, 3000);
      }
    }
  });
}

sendLink().catch((err) => {
  logger.error('Fatal error running script:', err);
  process.exit(1);
});
