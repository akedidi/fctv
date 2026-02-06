# Cloudflare Bypass Proxy Server

Puppeteer-based proxy server to bypass Cloudflare protection and extract M3U8 stream URLs.

## Features

- ✅ Real Chrome browser simulation via Puppeteer
- ✅ Stealth plugin to avoid bot detection
- ✅ Multiple extraction strategies (4 methods)
- ✅ Network request interception
- ✅ Base64 decoding support
- ✅ CORS enabled for iOS app

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Installation

```bash
cd web
npm install
```

This will install:
- `express` - HTTP server
- `puppeteer` - Chrome automation
- `puppeteer-extra` + `stealth-plugin` - Anti-detection
- `cors` - Enable iOS app requests

## Usage

### Start Server

```bash
npm start
```

Server will start on `http://localhost:3000`

### Development Mode (Auto-reload)

```bash
npm run dev
```

## API Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "fctv-cloudflare-bypass-proxy",
  "timestamp": "2026-02-05T10:58:00Z"
}
```

### Extract Stream

```bash
POST /extract-stream
Content-Type: application/json

{
  "url": "https://theo32ar.cq60vsomebodytil4cfrequently.sbs/fr/football/...",
  "referer": "https://optional-referer.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "m3u8Url": "https://extracted-stream.m3u8?token=...",
  "extractedAt": "2026-02-05T10:58:00Z",
  "duration": "2341ms"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "No M3U8 URL found on page",
  "details": "..."
}
```

## Testing

Test extraction manually with curl:

```bash
curl -X POST http://localhost:3000/extract-stream \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://theo32ar.cq60vsomebodytil4cfrequently.sbs/fr/football/2526-national-league-4328325/sagaing-vs-thitsar-arman-fc.html"
  }'
```

## Extraction Strategies

The proxy uses 4 strategies in order:

1. **`<video>` elements** - Check video.src attributes
2. **DOM search** - Regex search for `.m3u8` in page HTML
3. **Base64 decoding** - Decode obfuscated URLs in `<script>` tags
4. **Network interception** - Wait for M3U8 network requests

## Deployment

### Local (Development)

```bash
npm start
```

iOS app connects to: `http://localhost:3000`
⚠️ **Only works in iOS simulator**

### Network (Same WiFi)

Find your Mac's local IP:

```bash
ifconfig | grep "inet "
```

iOS app connects to: `http://192.168.x.x:3000`
✅ **Works on physical devices**

### Cloud (Production)

Deploy to Railway/Render/Fly.io:

```bash
# Railway
railway up

# Render
# Connect GitHub repo, Render auto-detects Node.js

# Fly.io
fly deploy
```

iOS app connects to: `https://your-app.railway.app`
✅ **Works everywhere**

## Configuration

Create `.env` file:

```env
PORT=3000
NODE_ENV=production
```

## Troubleshooting

### "Browser not found" error

Install Chromium dependencies (Linux):

```bash
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libasound2
```

### Port already in use

Change port in `.env` or:

```bash
PORT=3001 npm start
```

## License

MIT
