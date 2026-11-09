# 🌺 MomaiDham Automation: WhatsApp Group to Instagram Reels

An automated system that listens to a designated **WhatsApp Group** for incoming darshan/puja photos, converts each photo into a vertical **9:16 Instagram Reel** with background music using **FFmpeg**, and publishes it to **Instagram Reels** with custom captions and hashtags.

---

## 🏗️ Architecture & Workflow

```
   WhatsApp Group (Darshan Photo Received)
                 │
                 ▼
       [Baileys Group Listener]
                 │  - Detects image in target group
                 │  - Downloads full-resolution media buffer
                 ▼
       [Sequential Job Queue]
                 │  - Processes photos one by one
                 │  - Built-in anti-spam cooldown between posts
                 ▼
      [FFmpeg Reel Video Engine]
                 │  - Generates 9:16 vertical video (1080x1920)
                 │  - Blurred background + centered photo layout
                 │  - Attaches MP3 music with smooth audio fade-out
                 ▼
    [Direct Instagram Publisher (instagrapi)]
                 │  - Direct login with session caching (no Facebook page needed!)
                 │  - Formats caption & hashtags
                 │  - Publishes directly to Instagram Reels
                 ▼
       🎉 Instagram Reel Published!
```

---

## 📁 Project Structure

```
momaidham automation/
├── assets/
│   └── music/                  # Put your background .mp3 audio tracks here
├── config/
│   ├── env.js                  # Environment configuration & defaults
│   ├── music.js                # Day-wise official Instagram music search queries (e.g. Friday: Lakshmi Maa)
│   └── captions.js             # Gujarati caption generator (Date, Day, Year | Tithi, Jay Momai Ma, 5 viral hashtags)
├── scripts/
│   ├── scan-wa-qr.js           # Scan WhatsApp QR & discover group JIDs
│   ├── search-insta-music.js   # Search Instagram's official music catalog
│   ├── test-video.js           # Test Reel video generation locally
│   └── test-pipeline.js        # Full dry-run pipeline test
├── src/
│   ├── index.js                # Main application entry point
│   ├── instagram/
│   │   ├── ig_bridge.py        # Python instagrapi engine for Reels upload & session management
│   │   └── uploader.js         # Node.js wrapper for Instagram publishing
│   ├── utils/
│   │   ├── cleanup.js          # Temporary file management
│   │   ├── logger.js           # Formatted console logger
│   │   └── queue.js            # Sequential task queue with anti-rate-limit delay
│   ├── video/
│   │   └── reelGenerator.js    # FFmpeg 9:16 video renderer with blurred backdrop
│   └── whatsapp/
│       ├── client.js           # Baileys WhatsApp client & group listener
│       └── mediaHelper.js      # Downloads and validates image messages
├── .env.example                # Configuration template
├── .env                        # Active credentials & settings
├── package.json
└── requirements.txt            # Python dependencies
```

---

## ⚡ Quick Setup Guide

### Step 1: Install Dependencies

#### Node.js packages:
```bash
npm install
```

#### Python packages (for Instagram publisher):
```bash
pip install -r requirements.txt
```

---

### Step 2: Configure Environment Variables

Open the `.env` file and configure your settings:

```env
# Target WhatsApp Group (Leave empty initially, or run "npm run wa:scan" to find it)
TARGET_WHATSAPP_GROUP_JID=

# Instagram Credentials
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password

# Official Instagram Music search query (links official Instagram audio sticker to the Reel)
# Examples: "Momai Maa", "Bhakti Song", "Mataji Na Garba", etc.
IG_MUSIC_QUERY=Momai Maa

# Set to "true" when you are ready to publish to Instagram live
ENABLE_AUTO_UPLOAD=false

# Reel Length in seconds
REEL_DURATION_SECONDS=15
```

---

### Step 3: Gujarati Caption Template (`config/captions.js`)
Captions are managed directly in [`config/captions.js`](config/captions.js) (not in `.env`). It automatically calculates the Hindu Panchang Tithi every day:
```
🗓️ 09/11/2026, સોમવાર | તિથિ: કાર્તક સુદ એકમ

🙏 જય મોમાઈ માં 🙏
✨ શ્રી મોમાઈ ધામ - દર્શન ✨

#momaidham #jaymomaima #reelsindia #trendingreels #viralreels
```
*(You can open and customize the text or hashtags in `config/captions.js` anytime).*

---

### Step 4: Day-Wise Official Instagram Music (`config/music.js`)
The bot automatically searches and attaches official songs from Instagram's Music catalog according to the day of the week!
All queries are managed in [`config/music.js`](config/music.js) (not in `.env`):

- **રવિવાર (Sunday)**: `Momai Maa`
- **સોમવાર (Monday)**: `Mahadev Shiv Bhajan`
- **મંગળવાર (Tuesday)**: `Hanumanji Bhajan`
- **બુધવાર (Wednesday)**: `Ganesh Aarti Bhajan`
- **ગુરુવાર (Thursday)**: `Mataji Na Garba`
- **શુક્રવાર (Friday)**: `Lakshmi Maa Bhajan`
- **શનિવાર (Saturday)**: `Hanuman Chalisa`

You can test searching any day's song in Instagram's catalog:
```bash
npm run ig:music
```
*(You can open and customize these queries in `config/music.js` anytime).*

*(Optional: You can also drop your own offline `.mp3` files into `assets/music/` as a local fallback).*

---

### Step 4: Link WhatsApp & Find Your Group ID

Run the WhatsApp discovery script:
```bash
npm run wa:scan
```
1. Scan the **QR Code** on your screen using your phone (**WhatsApp > Settings > Linked Devices > Link a Device**).
2. Once connected, your joined groups will appear in your console:
   ```
   --- Connected WhatsApp Groups ---
     "Momai Dham Darshan Group" -> ID: 120363012345678901@g.us
     "Family Group"             -> ID: 120363098765432109@g.us
   ---------------------------------
   ```
3. Copy the ID of your target group and paste it into `TARGET_WHATSAPP_GROUP_JID` inside `.env`.

---

### Step 5: Test Locally

Test the video generator without WhatsApp or Instagram:
```bash
npm run test:video
```
This generates a test video in `temp/videos/` with blurred background and audio so you can preview the quality on your computer.

---

### Step 6: Start the Automation!

Run:
```bash
npm start
```
Whenever anyone posts a photo in the target WhatsApp group:
1. The photo is downloaded automatically.
2. An HD 9:16 Reel is produced.
3. The Reel is posted to your Instagram account with the caption and hashtags!

---

## 🛡️ Anti-Ban & Safety Features
- **Sequential Queue (`src/utils/queue.js`)**: If multiple photos are sent at the same time in the group, they are queued and processed one-by-one with a 20-second safety delay to avoid Instagram spam triggers.
- **Session Caching (`ig_session.json` & `wa-session/`)**: Sessions are persisted locally so you only authenticate once and avoid repetitive login attempts.
- **Local Video Processing**: All FFmpeg processing happens locally on your machine with no external rendering API costs.
