#!/usr/bin/env python3
"""
src/instagram/ig_bridge.py

Instagram direct Reels uploader using instagrapi.
Handles persistent session caching, 2FA, official Instagram Music searching, and Reel publishing.
"""

import os
import sys
import json
import random
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Load .env from root directory
root_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(root_dir / ".env")

try:
    from instagrapi import Client
    from instagrapi.exceptions import (
        BadPassword,
        TwoFactorRequired,
        ChallengeRequired,
        LoginRequired,
        FeedbackRequired,
        PleaseWaitFewMinutes
    )
except ImportError:
    print(json.dumps({
        "status": "error",
        "message": "instagrapi is not installed. Please run: pip install instagrapi"
    }))
    sys.exit(1)


def print_json_response(data: dict):
    """Prints only the JSON response preceded by a recognizable delimiter."""
    print("\n__IG_BRIDGE_OUTPUT__")
    print(json.dumps(data))
    sys.stdout.flush()


def get_client(session_file: str, username: str, password: str, proxy: str = None) -> Client:
    session_path = Path(session_file)

    # 1. Try loading cached session
    if session_path.exists():
        cl = Client()
        if proxy:
            cl.set_proxy(proxy)
        try:
            cl.load_settings(session_path)
            cl.get_timeline_feed()  # Quick check if session is valid
            return cl
        except Exception:
            # Session expired or invalidated, proceed to clean login with a brand new client
            pass

    # 2. Fresh login with credentials and a clean client instance
    if not username or not password:
        raise ValueError("Instagram username and password must be provided in .env or arguments")

    cl = Client()
    if proxy:
        cl.set_proxy(proxy)

    try:
        cl.login(username, password)
        cl.dump_settings(session_path)
        return cl
    except TwoFactorRequired:
        code = input("Enter 2FA Code (SMS or Authenticator): ").strip()
        cl.login(username, password, verification_code=code)
        cl.dump_settings(session_path)
        return cl


def main():
    parser = argparse.ArgumentParser(description="Instagram Reel Bridge for momaidham automation")
    parser.add_argument("--login-only", action="store_true", help="Login and cache session to file")
    parser.add_argument("--upload-reel", action="store_true", help="Upload a video as an Instagram Reel")
    parser.add_argument("--search-music", type=str, help="Search Instagram's official music catalog")
    parser.add_argument("--fetch-music", action="store_true", help="Search and download official Instagram music track")
    parser.add_argument("--track-id", type=str, default=None, help="Explicit Instagram track ID to link to upload")
    parser.add_argument("--video", type=str, help="Path to MP4 video file")
    parser.add_argument("--thumbnail", type=str, default=None, help="Path to thumbnail image file")
    parser.add_argument("--caption", type=str, default="", help="Caption for the Reel")
    parser.add_argument("--music-query", type=str, default=os.getenv("IG_MUSIC_QUERY", ""), help="Official Instagram song search query (e.g. 'Momai Maa')")
    parser.add_argument("--username", type=str, default=os.getenv("INSTAGRAM_USERNAME", ""))
    parser.add_argument("--password", type=str, default=os.getenv("INSTAGRAM_PASSWORD", ""))
    parser.add_argument("--session-file", type=str, default=os.getenv("IG_SESSION_FILE", "./ig_session.json"))
    parser.add_argument("--proxy", type=str, default=os.getenv("IG_PROXY", None))

    args = parser.parse_args()

    session_file = str(Path(args.session_file).resolve())
    username = args.username.strip()
    password = args.password.strip()

    if args.login_only:
        try:
            cl = get_client(session_file, username, password, args.proxy)
            print_json_response({
                "status": "success",
                "message": f"Successfully authenticated as @{username} and saved session to {session_file}"
            })
            sys.exit(0)
        except Exception as e:
            print_json_response({
                "status": "error",
                "message": f"Login failed: {str(e)}"
            })
            sys.exit(1)

    if args.search_music:
        try:
            cl = get_client(session_file, username, password, args.proxy)
            tracks = cl.search_music(args.search_music)
            results = []
            for t in tracks[:10]:
                results.append({
                    "id": getattr(t, "id", ""),
                    "title": getattr(t, "title", ""),
                    "artist": getattr(t, "display_artist", ""),
                    "audio_asset_id": getattr(t, "audio_asset_id", ""),
                    "audio_cluster_id": getattr(t, "audio_cluster_id", "")
                })
            print_json_response({
                "status": "success",
                "query": args.search_music,
                "count": len(results),
                "tracks": results
            })
            sys.exit(0)
        except Exception as e:
            print_json_response({
                "status": "error",
                "message": f"Music search failed: {str(e)}"
            })
            sys.exit(1)

    if args.fetch_music:
        query = (args.music_query or "Momai Maa").strip()

        try:
            cl = get_client(session_file, username, password, args.proxy)
            tracks = cl.search_music(query)
            if not tracks:
                sys.stderr.write(f"No tracks found for '{query}', falling back to 'Momai Maa'\n")
                tracks = cl.search_music("Momai Maa")

            if not tracks:
                print_json_response({
                    "status": "error",
                    "message": f"No tracks found for Mataji queries"
                })
                sys.exit(1)

            selected_track = random.choice(tracks[:3])
            dl_url = str(getattr(selected_track, "progressive_download_url", None) or getattr(selected_track, "fast_start_progressive_download_url", None) or "")
            
            start_time = 0.0
            highlight_times = getattr(selected_track, "highlight_start_times_in_ms", None)
            if highlight_times and len(highlight_times) > 0:
                start_time = highlight_times[0] / 1000.0

            audio_dir = Path("temp/audio")
            audio_dir.mkdir(parents=True, exist_ok=True)
            audio_file = audio_dir / f"track_{selected_track.id}.mp4"

            if dl_url and (not audio_file.exists() or audio_file.stat().st_size == 0):
                import urllib.request
                req = urllib.request.Request(dl_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req) as resp, open(audio_file, "wb") as f:
                    f.write(resp.read())

            print_json_response({
                "status": "success",
                "track_id": str(getattr(selected_track, "id", "")),
                "title": str(getattr(selected_track, "title", "")),
                "artist": str(getattr(selected_track, "display_artist", "")),
                "audio_path": str(audio_file.resolve()),
                "start_time_seconds": start_time
            })
            sys.exit(0)

        except Exception as e:
            print_json_response({
                "status": "error",
                "message": f"Failed to fetch music: {str(e)}"
            })
            sys.exit(1)

    if args.upload_reel:
        if not args.video or not Path(args.video).exists():
            print_json_response({
                "status": "error",
                "message": f"Video file not found: {args.video}"
            })
            sys.exit(1)

        try:
            cl = get_client(session_file, username, password, args.proxy)
            
            selected_track = None
            music_query = (args.music_query or "Momai Maa").strip()

            # Search official Instagram music if query or track_id is specified
            if music_query or args.track_id:
                try:
                    tracks = cl.search_music(music_query)
                    if not tracks:
                        tracks = cl.search_music("Momai Maa")
                    if tracks:
                        if args.track_id:
                            matched = [t for t in tracks if str(getattr(t, "id", "")) == str(args.track_id)]
                            selected_track = matched[0] if matched else tracks[0]
                        else:
                            selected_track = random.choice(tracks[:3])
                        sys.stderr.write(f"Found Instagram official track: '{selected_track.title}' by {selected_track.display_artist}\n")
                    else:
                        sys.stderr.write(f"No Instagram tracks found for query: '{music_query}'. Uploading without track metadata.\n")
                except Exception as m_err:
                    sys.stderr.write(f"Could not fetch official music from Instagram: {str(m_err)}. Proceeding without track.\n")

            thumb_path = Path(args.thumbnail).resolve() if args.thumbnail and Path(args.thumbnail).exists() else None

            # Upload Reel: with official music if available, otherwise standard
            if selected_track:
                try:
                    media = cl.clip_upload_with_music(
                        path=Path(args.video),
                        caption=args.caption,
                        track=selected_track,
                        thumbnail=thumb_path
                    )
                except Exception as music_err:
                    sys.stderr.write(f"clip_upload_with_music notice: {str(music_err)}. Falling back to direct clip_upload...\n")
                    media = cl.clip_upload(
                        path=Path(args.video),
                        caption=args.caption,
                        thumbnail=thumb_path
                    )
            else:
                media = cl.clip_upload(
                    path=Path(args.video),
                    caption=args.caption,
                    thumbnail=thumb_path
                )

            media_code = getattr(media, "code", None)
            if not media_code and hasattr(media, "pk") and media.pk:
                try:
                    media_code = cl.media_pk_to_code(media.pk)
                except Exception:
                    media_code = None

            reel_url = f"https://www.instagram.com/reel/{media_code}/" if media_code else ""
            
            resp = {
                "status": "success",
                "media_id": str(getattr(media, "id", "")),
                "code": media_code or "",
                "url": reel_url
            }

            if selected_track:
                resp["official_track"] = {
                    "title": getattr(selected_track, "title", ""),
                    "artist": getattr(selected_track, "display_artist", ""),
                    "id": getattr(selected_track, "id", "")
                }

            print_json_response(resp)
            sys.exit(0)

        except FeedbackRequired as e:
            print_json_response({
                "status": "error",
                "message": f"Instagram feedback/rate limit required: {str(e)}"
            })
            sys.exit(1)
        except PleaseWaitFewMinutes as e:
            print_json_response({
                "status": "error",
                "message": "Instagram requested a cooldown (PleaseWaitFewMinutes). Will retry later."
            })
            sys.exit(1)
        except Exception as e:
            print_json_response({
                "status": "error",
                "message": f"Reel upload failed: {str(e)}"
            })
            sys.exit(1)

    parser.print_help()


if __name__ == "__main__":
    main()
