import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import config from '../../config/env';
import { getMusicQueryForDay } from '../../config/music';
import Logger from '../utils/logger';

const logger = Logger.forModule('InstagramUploader');

export interface UploadOptions {
  musicQuery?: string;
  thumbnailPath?: string;
  trackId?: string;
}

export interface OfficialTrackInfo {
  title: string;
  artist: string;
  id: string;
}

export interface PreparedMusicTrack {
  trackId: string;
  title: string;
  artist: string;
  audioPath: string;
  startTimeSeconds: number;
}

export interface UploadResult {
  success: boolean;
  skipped?: boolean;
  url?: string;
  mediaId?: string;
  officialTrack?: OfficialTrackInfo;
  message?: string;
}

function parseBridgeOutput(raw: string): any {
  if (raw.includes('__IG_BRIDGE_OUTPUT__')) {
    const parts = raw.split('__IG_BRIDGE_OUTPUT__');
    const jsonPart = parts[parts.length - 1].trim();
    return JSON.parse(jsonPart);
  }
  const lines = raw.trim().split('\n').map(l => l.trim()).reverse();
  for (const line of lines) {
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        return JSON.parse(line);
      } catch {
        // continue
      }
    }
  }
  return JSON.parse(raw.trim());
}

function getIgBridgeScript(): string {
  const local = path.resolve(__dirname, 'ig_bridge.py');
  if (fs.existsSync(local)) return local;
  return path.resolve(process.cwd(), 'src', 'instagram', 'ig_bridge.py');
}

/**
 * Searches and downloads the official Instagram devotional audio for the given query.
 */
export async function prepareOfficialTrack(musicQuery: string): Promise<PreparedMusicTrack | null> {
  return new Promise((resolve) => {
    logger.info(`🔍 Fetching and downloading official Instagram music for query: "${musicQuery}"...`);

    const pythonScript = getIgBridgeScript();
    const args: string[] = [
      pythonScript,
      '--fetch-music',
      '--music-query', musicQuery,
      '--session-file', config.igSessionFile
    ];

    if (config.instagramUsername) args.push('--username', config.instagramUsername);
    if (config.instagramPassword) args.push('--password', config.instagramPassword);
    if (config.igProxy) args.push('--proxy', config.igProxy);

    const pyProcess = spawn('python', args, {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (c: Buffer) => { stdoutData += c.toString(); });
    pyProcess.stderr.on('data', (c: Buffer) => { stderrData += c.toString(); });

    pyProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        logger.warn(`Could not fetch official music from Instagram: ${stderrData || stdoutData}. Falling back to local music.`);
        return resolve(null);
      }

      try {
        const res = parseBridgeOutput(stdoutData);
        if (res.status === 'success') {
          logger.success(`🎵 Successfully downloaded official Instagram track: '${res.title}' by ${res.artist}`);
          logger.info(`⏳ Highlight Start Offset: ${res.start_time_seconds}s`);
          return resolve({
            trackId: res.track_id,
            title: res.title,
            artist: res.artist,
            audioPath: res.audio_path,
            startTimeSeconds: res.start_time_seconds
          });
        }
      } catch (err) {
        logger.warn(`Failed to parse music bridge output: ${err}`);
      }
      resolve(null);
    });
  });
}

/**
 * Publishes an MP4 video as an Instagram Reel.
 * Supports linking official Instagram music tracks according to the day of the week.
 */
export async function uploadReel(
  videoPath: string,
  caption: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  if (!config.enableAutoUpload) {
    logger.warn('ℹ️ ENABLE_AUTO_UPLOAD is set to false in .env. Skipping Instagram upload.');
    return {
      success: true,
      skipped: true,
      message: 'Upload skipped because ENABLE_AUTO_UPLOAD is false.'
    };
  }

  return new Promise((resolve, reject) => {
    logger.info(`📤 Uploading Reel to Instagram for user: @${config.instagramUsername || 'configured_account'}...`);

    const pythonScript = getIgBridgeScript();
    const args: string[] = [
      pythonScript,
      '--upload-reel',
      '--video', videoPath,
      '--caption', caption,
      '--session-file', config.igSessionFile
    ];

    if (options.thumbnailPath) {
      args.push('--thumbnail', options.thumbnailPath);
    }

    if (options.trackId) {
      args.push('--track-id', options.trackId);
    }

    const musicQuery = options.musicQuery || getMusicQueryForDay();
    if (musicQuery) {
      logger.info(`🎵 Day-wise official Instagram music query: "${musicQuery}"`);
      args.push('--music-query', musicQuery);
    }

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

    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (chunk: Buffer) => {
      stdoutData += chunk.toString();
    });

    pyProcess.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrData += text;
      if (text.trim().startsWith('Found Instagram official track:')) {
        logger.success(`🎵 ${text.trim()}`);
      }
    });

    pyProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        logger.error(`Python uploader process exited with code ${code}`);
        try {
          const parsed = parseBridgeOutput(stdoutData);
          return reject(new Error(parsed.message || 'Instagram upload failed'));
        } catch {
          return reject(new Error(stderrData || stdoutData || `Upload failed with exit code ${code}`));
        }
      }

      try {
        const result = parseBridgeOutput(stdoutData);
        if (result.status === 'success') {
          logger.success(`🎉 Reel published successfully! URL: ${result.url || result.media_id}`);
          if (result.official_track) {
            logger.success(`🎶 Attached Official Track: "${result.official_track.title}" by ${result.official_track.artist}`);
          }
          resolve({
            success: true,
            url: result.url,
            mediaId: result.media_id,
            officialTrack: result.official_track
          });
        } else {
          logger.error(`Instagram upload failed: ${result.message}`);
          reject(new Error(result.message));
        }
      } catch (err: unknown) {
        logger.error(`Failed to parse Instagram uploader response: ${stdoutData}`);
        reject(new Error(`Invalid response from Instagram bridge: ${stdoutData}`));
      }
    });
  });
}
