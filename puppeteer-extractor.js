const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Extract M3U8 stream URL from web page using Puppeteer
 * Creates a new browser for each request for stability
 */
async function extractStreamURL(url, referer = null) {
    let browser = null;
    let page = null;

    try {
        console.log('🔧 Launching Chromium browser...');

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--ignore-certificate-errors',
                '--disable-blink-features=AutomationControlled'
            ],
            defaultViewport: { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true,
            timeout: 60000
        });

        console.log('✅ Browser ready');

        page = await browser.newPage();

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            ...(referer ? { 'Referer': referer } : {})
        });

        // Collect M3U8 URLs from network requests
        const m3u8Urls = [];

        await page.setRequestInterception(true);

        page.on('request', request => {
            const reqUrl = request.url();
            if (reqUrl.includes('.m3u8')) {
                console.log(`   🎯 Network M3U8: ${reqUrl.substring(0, 80)}...`);
                m3u8Urls.push(reqUrl);
            }
            request.continue();
        });

        console.log(`   📄 Loading page...`);

        // Navigate with better error handling
        try {
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            console.log(`   ✅ Page loaded`);
        } catch (navError) {
            console.log(`   ⚠️ Navigation issue: ${navError.message}`);
            // Continue anyway, we might have captured M3U8 URLs
        }

        // Wait a bit for dynamic content
        console.log(`   ⏳ Waiting for dynamic content...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if we found M3U8 via network
        if (m3u8Urls.length > 0) {
            console.log(`   ✅ Found ${m3u8Urls.length} M3U8 URL(s) via network`);
            return m3u8Urls[0];
        }

        // Strategy 1: Search DOM for M3U8 URLs
        console.log(`   🔍 Strategy 1: Searching DOM...`);
        try {
            const m3u8FromDOM = await page.evaluate(() => {
                const bodyText = document.body ? document.body.innerHTML : '';
                const m3u8Regex = /(https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)/gi;
                const matches = bodyText.match(m3u8Regex);
                return matches ? matches[0] : null;
            });

            if (m3u8FromDOM) {
                console.log(`   ✅ Found in DOM`);
                return m3u8FromDOM;
            }
        } catch (e) {
            console.log(`   ⚠️ DOM search failed: ${e.message}`);
        }

        // Strategy 2: Check video elements
        console.log(`   🔍 Strategy 2: Checking <video> elements...`);
        try {
            const videoSrc = await page.evaluate(() => {
                const videos = document.querySelectorAll('video, video source');
                for (const el of videos) {
                    const src = el.src || el.getAttribute('src');
                    if (src && src.includes('.m3u8')) {
                        return src;
                    }
                }
                return null;
            });

            if (videoSrc) {
                console.log(`   ✅ Found via <video>`);
                return videoSrc;
            }
        } catch (e) {
            console.log(`   ⚠️ Video search failed: ${e.message}`);
        }

        // Strategy 3: Check iframes
        console.log(`   🔍 Strategy 3: Checking iframes...`);
        try {
            const frames = page.frames();
            for (const frame of frames) {
                try {
                    const iframeM3U8 = await frame.evaluate(() => {
                        const bodyText = document.body ? document.body.innerHTML : '';
                        const m3u8Regex = /(https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)/gi;
                        const matches = bodyText.match(m3u8Regex);
                        return matches ? matches[0] : null;
                    });

                    if (iframeM3U8) {
                        console.log(`   ✅ Found in iframe`);
                        return iframeM3U8;
                    }
                } catch (frameError) {
                    // Skip inaccessible frames
                }
            }
        } catch (e) {
            console.log(`   ⚠️ Iframe search failed: ${e.message}`);
        }

        // Strategy 4: Wait longer for network requests
        console.log(`   🔍 Strategy 4: Waiting more for network M3U8...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        if (m3u8Urls.length > 0) {
            console.log(`   ✅ Found via delayed network`);
            return m3u8Urls[0];
        }

        throw new Error('No M3U8 URL found on page');

    } catch (error) {
        console.error(`   ❌ Extraction failed: ${error.message}`);
        throw error;
    } finally {
        if (page) {
            try { await page.close(); } catch (e) { }
        }
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }
    }
}

/**
 * Used for graceful shutdown compatibility
 */
async function closeBrowser() {
    // No global browser to close
}

module.exports = { extractStreamURL, closeBrowser };
