const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Apply stealth plugin to avoid detection
chromium.use(StealthPlugin());

/**
 * Simulate human-like mouse movement
 */
async function humanMouseMove(page, x, y) {
    const steps = 10 + Math.floor(Math.random() * 10);
    const currentPos = { x: 0, y: 0 };

    for (let i = 0; i < steps; i++) {
        const progress = i / steps;
        const nextX = currentPos.x + (x - currentPos.x) * progress + (Math.random() - 0.5) * 20;
        const nextY = currentPos.y + (y - currentPos.y) * progress + (Math.random() - 0.5) * 20;
        await page.mouse.move(nextX, nextY);
        await page.waitForTimeout(10 + Math.random() * 30);
    }
    await page.mouse.move(x, y);
}

/**
 * Simulate human-like scrolling
 */
async function humanScroll(page) {
    const scrollAmount = 100 + Math.floor(Math.random() * 300);
    await page.mouse.wheel(0, scrollAmount);
    await page.waitForTimeout(500 + Math.random() * 1000);
}

/**
 * Random delay to simulate human reading
 */
async function humanDelay(min = 1000, max = 3000) {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Extract M3U8 stream URL with stealth and human behavior
 */
async function extractStreamURL(url, referer = null) {
    let browser = null;

    try {
        console.log('🔧 Launching Stealth Chromium browser...');

        browser = await chromium.launch({
            headless: process.env.HEADLESS !== 'false', // Set HEADLESS=false for visible mode
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1920,1080'
            ]
        });

        console.log('✅ Stealth browser ready');

        // Create context with realistic fingerprint
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            locale: 'fr-FR',
            timezoneId: 'Europe/Paris',
            permissions: ['geolocation'],
            geolocation: { latitude: 48.8566, longitude: 2.3522 },
            colorScheme: 'light',
            extraHTTPHeaders: {
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                ...(referer ? { 'Referer': referer } : {})
            },
            ignoreHTTPSErrors: true
        });

        const page = await context.newPage();

        // Override webdriver detection
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });

            // Chrome runtime
            window.chrome = { runtime: {} };

            // Permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);
        });

        // Collect M3U8 URLs from network
        const m3u8Urls = [];

        page.on('request', request => {
            const reqUrl = request.url();
            if (reqUrl.includes('.m3u8')) {
                console.log(`   🎯 Network M3U8: ${reqUrl.substring(0, 80)}...`);
                if (!m3u8Urls.includes(reqUrl)) m3u8Urls.push(reqUrl);
            }
        });

        console.log('   📄 Loading page with human behavior...');

        // Navigate
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        console.log('   ✅ Page loaded');

        // Check for immediate M3U8
        if (m3u8Urls.length > 0) {
            console.log('   ✅ Found M3U8 on initial load');
            return m3u8Urls[0];
        }

        // Simulate human behavior to bypass Turnstile
        console.log('   🧑 Simulating human behavior...');

        // Move mouse randomly
        await humanMouseMove(page, 400 + Math.random() * 400, 300 + Math.random() * 200);
        await humanDelay(500, 1500);

        // Scroll a bit
        await humanScroll(page);
        await humanDelay(1000, 2000);

        // Move mouse to center
        await humanMouseMove(page, 960, 540);
        await humanDelay(500, 1000);

        // Wait for Turnstile to potentially resolve
        console.log('   ⏳ Waiting for Turnstile challenge...');
        await page.waitForTimeout(5000);

        // Check M3U8 after human behavior
        if (m3u8Urls.length > 0) {
            console.log('   ✅ Found M3U8 after human simulation');
            return m3u8Urls[0];
        }

        // Try to find and interact with player
        console.log('   🎮 Looking for player elements...');

        const playerSelectors = [
            'video',
            '.video-player',
            '.player',
            '#player',
            'iframe[src*="embed"]',
            '.play-btn',
            '[class*="play"]'
        ];

        for (const selector of playerSelectors) {
            try {
                const el = await page.$(selector);
                if (el) {
                    console.log(`   🎯 Found: ${selector}`);
                    const box = await el.boundingBox();
                    if (box) {
                        await humanMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
                        await humanDelay(300, 800);
                        await el.click().catch(() => { });
                        await page.waitForTimeout(2000);

                        if (m3u8Urls.length > 0) {
                            console.log('   ✅ Found M3U8 after click');
                            return m3u8Urls[0];
                        }
                    }
                }
            } catch (e) { }
        }

        // Check iframes
        console.log('   🔍 Checking iframes...');
        const frames = page.frames();
        console.log(`   📋 Found ${frames.length} frame(s)`);

        for (const frame of frames) {
            const frameUrl = frame.url();
            if (frameUrl.includes('cloudflare')) {
                console.log(`   ⚠️ Cloudflare challenge iframe detected`);
                continue;
            }

            try {
                const m3u8FromFrame = await frame.evaluate(() => {
                    const html = document.documentElement?.innerHTML || '';
                    const match = html.match(/(https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*)/i);
                    return match ? match[0] : null;
                });

                if (m3u8FromFrame) {
                    console.log('   ✅ Found M3U8 in iframe');
                    return m3u8FromFrame;
                }
            } catch (e) { }
        }

        // Extended wait
        console.log('   ⏳ Extended wait for dynamic content...');
        await page.waitForTimeout(8000);

        if (m3u8Urls.length > 0) {
            console.log('   ✅ Found M3U8 after extended wait');
            return m3u8Urls[0];
        }

        // Final DOM search
        console.log('   🔍 Final DOM search...');
        const m3u8FromDOM = await page.evaluate(() => {
            const html = document.documentElement?.innerHTML || '';
            const match = html.match(/(https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*)/i);
            return match ? match[0] : null;
        });

        if (m3u8FromDOM) {
            console.log('   ✅ Found in DOM');
            return m3u8FromDOM;
        }

        throw new Error('No M3U8 URL found on page (Turnstile may still be blocking)');

    } catch (error) {
        console.error(`   ❌ Extraction failed: ${error.message}`);
        throw error;
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }
    }
}

async function closeBrowser() { }

module.exports = { extractStreamURL, closeBrowser };
