import './patch-baileys.js';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WAMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config/env';

const targetGroup = config.targetGroupJid;
console.log('Target Group:', targetGroup);

async function check() {
  const { state } = await useMultiFileAuthState(config.waSessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: true,
  });

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      console.log('Connected to WhatsApp! Fetching messages...');
    }
  });

  sock.ev.on('messaging-history.set', ({ messages, chats }) => {
    console.log(`[messaging-history.set] ${messages.length} messages received, ${chats.length} chats`);
    for (const m of messages) {
      if (m.key.remoteJid === targetGroup) {
        console.log('Found message in target group:', {
          id: m.key.id,
          fromMe: m.key.fromMe,
          timestamp: new Date(Number(m.messageTimestamp) * 1000).toLocaleString(),
          messageType: Object.keys(m.message || {})
        });
      }
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    console.log(`[messages.upsert] ${messages.length} messages (type: ${type})`);
    for (const m of messages) {
      if (m.key.remoteJid === targetGroup) {
        console.log('Found message in target group (upsert):', {
          id: m.key.id,
          fromMe: m.key.fromMe,
          timestamp: new Date(Number(m.messageTimestamp) * 1000).toLocaleString(),
          messageType: Object.keys(m.message || {})
        });
      }
    }
  });

  // Keep alive for 15s to capture all initial sync packets
  setTimeout(() => {
    console.log('Check finished.');
    process.exit(0);
  }, 15000);
}

check().catch(console.error);
