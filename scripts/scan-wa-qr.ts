/**
 * scripts/scan-wa-qr.ts
 * Run: npm run wa:scan
 *
 * Scans WhatsApp QR code and lists all participating groups and their IDs.
 */

import './patch-baileys.js';
import WhatsAppClient from '../src/whatsapp/client';

console.log('\n--- WhatsApp Authentication & Group Discovery Utility ---');
console.log('1. Scan the QR code displayed below using WhatsApp > Linked Devices.');
console.log('2. Once connected, your joined groups and their JID values will be listed.');
console.log('3. Copy the target group JID and paste it into TARGET_WHATSAPP_GROUP_JID in .env\n');

const client = new WhatsAppClient();
client.start();
