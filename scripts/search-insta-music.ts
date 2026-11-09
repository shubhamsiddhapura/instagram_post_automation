/**
 * scripts/search-insta-music.ts
 * Run: npm run ig:music -- "Momai Maa"
 *
 * Searches Instagram's official music catalog for available songs/tracks.
 */

import path from 'path';
import { spawn } from 'child_process';
import config from '../config/env';
import { getMusicQueryForDay } from '../config/music';
import Logger from '../src/utils/logger';

const logger = Logger.forModule('SearchMusic');

const query = process.argv[2] || getMusicQueryForDay() || 'Momai Maa';

console.log(`\n🔍 Searching Instagram Official Music Library for: "${query}"...\n`);

const pythonScript = path.resolve(__dirname, '../src/instagram/ig_bridge.py');
const args: string[] = [
  pythonScript,
  '--search-music', query,
  '--session-file', config.igSessionFile
];

if (config.instagramUsername) {
  args.push('--username', config.instagramUsername);
}
if (config.instagramPassword) {
  args.push('--password', config.instagramPassword);
}
if (config.igProxy) {
  args.push('--proxy', config.igProxy);
}

const pyProcess = spawn('python', args, {
  cwd: process.cwd(),
  stdio: ['inherit', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

pyProcess.stdout.on('data', (d: Buffer) => stdout += d.toString());
pyProcess.stderr.on('data', (d: Buffer) => stderr += d.toString());

pyProcess.on('close', (code: number | null) => {
  if (code !== 0) {
    logger.error('Failed to search Instagram music. Make sure your Instagram credentials in .env are set.');
    try {
      const errObj = JSON.parse(stdout.trim());
      console.error(errObj.message);
    } catch {
      console.error(stderr || stdout);
    }
    process.exit(1);
  }

  try {
    const res = JSON.parse(stdout.trim());
    if (res.status === 'success') {
      console.log(`✅ Found ${res.count} track(s) on Instagram:\n`);
      res.tracks.forEach((t: { title: string; artist?: string; id: string }, i: number) => {
        console.log(`  ${i + 1}. 🎵 "${t.title}"`);
        console.log(`     👤 Artist: ${t.artist || 'Unknown'}`);
        console.log(`     🆔 Track ID: ${t.id}\n`);
      });
      console.log(`👉 You can set this in config/music.ts for any day of the week!`);
    }
  } catch (err) {
    console.error('Invalid response:', stdout);
  }
});
