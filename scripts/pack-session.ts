/**
 * scripts/pack-session.ts
 * Run: npm run session:pack
 *
 * 1. Bundles active WhatsApp credentials and Instagram session into assets/session.tar.gz
 * 2. Generates compact cloud environment variables (WA_SESSION_DATA & IG_SESSION_DATA)
 *    so your sessions survive all Render restarts and container rebuilds!
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';

const waDir = path.resolve(process.cwd(), 'wa-session');
const waCreds = path.join(waDir, 'creds.json');
const igCreds = path.resolve(process.cwd(), 'ig_session.json');
const archivePath = path.resolve(process.cwd(), 'assets', 'session.tar.gz');

if (!fs.existsSync(waCreds)) {
  console.error('❌ Error: wa-session/creds.json not found! Please run "npm run wa:scan" first to connect WhatsApp.');
  process.exit(1);
}

console.log('📦 Packaging essential authentication credentials...');

// 1. Pack essential files into assets/session.tar.gz (excluding thousands of temporary lid-mappings)
try {
  const assetsDir = path.dirname(archivePath);
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const tempPackDir = path.resolve(process.cwd(), 'temp', 'pack_session');
  if (fs.existsSync(tempPackDir)) fs.rmSync(tempPackDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(tempPackDir, 'wa-session'), { recursive: true });

  // Copy only essential auth files (creds, keys, app-state)
  const files = fs.readdirSync(waDir);
  for (const f of files) {
    if (!f.startsWith('lid-') && !f.startsWith('tctoken-')) {
      fs.copyFileSync(path.join(waDir, f), path.join(tempPackDir, 'wa-session', f));
    }
  }

  const packItems = ['wa-session'];
  if (fs.existsSync(igCreds)) {
    fs.copyFileSync(igCreds, path.join(tempPackDir, 'ig_session.json'));
    packItems.push('ig_session.json');
  }

  // Create tar archive from clean directory
  execSync(`tar -czf "${archivePath}" -C "${tempPackDir}" ${packItems.join(' ')}`);
  fs.rmSync(tempPackDir, { recursive: true, force: true });
  console.log(`✅ Successfully updated: ${archivePath}`);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`⚠️ Could not update tar archive: ${msg}`);
}

// 2. Generate cloud environment variables
const rawWa = fs.readFileSync(waCreds, 'utf8');
const waGzipped = zlib.gzipSync(Buffer.from(rawWa, 'utf8')).toString('base64');

let igGzipped = '';
if (fs.existsSync(igCreds)) {
  const rawIg = fs.readFileSync(igCreds, 'utf8');
  igGzipped = zlib.gzipSync(Buffer.from(rawIg, 'utf8')).toString('base64');
}

console.log('\n=============================================================================');
console.log('🌟 PERSISTENT CLOUD ENVIRONMENT VARIABLES (Render / Docker / Railway)');
console.log('=============================================================================');
console.log('Add these Environment Variables in your Render Dashboard to ensure WhatsApp');
console.log('and Instagram stay connected permanently, even across restarts and resets!\n');

console.log('1️⃣ Variable Name: WA_SESSION_DATA');
console.log('   Value:');
console.log(waGzipped);
console.log('');

if (igGzipped) {
  console.log('2️⃣ Variable Name: IG_SESSION_DATA');
  console.log('   Value:');
  console.log(igGzipped);
  console.log('');
}

console.log('=============================================================================');
console.log('👉 How to Apply:');
console.log('1. Go to your Render Dashboard -> Your Service -> Environment');
console.log('2. Add WA_SESSION_DATA with the value printed above');
console.log('3. Add IG_SESSION_DATA with the value printed above');
console.log('4. Click "Save Changes"');
console.log('From now on, whenever Render resets or deploys, your sessions will stay 100% active!');
console.log('=============================================================================\n');
