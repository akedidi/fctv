const express = require('express');
const cors = require('cors');
const { connect } = require('puppeteer-real-browser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'puppeteer-real-browser', timestamp: new Date().toISOString() });
});

/**
 * Extract stream using puppeteer-real-browser for Cloudflare v2 bypass
 */
app.post('/extract-stream', async (req, res) => {
  const { url, referer } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Missing url parameter' });
  }

  console.log(`\n🌐 [EXTRACTION] ${url.substring(0, 80)}...`);

  let browser = null;

  try {
    console.log('🔧 Launching Real Browser (bypasses CF v2)...');

    const response = await connect({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
      turnstile: true,
      disableXvfb: false
    });

    browser = response.browser;
    const page = response.page;

    console.log('   ✅ Real browser connected');

    // Collect M3U8 URLs from network
    const m3u8Urls = [];

    page.on('request', request => {
      const reqUrl = request.url();
      if (reqUrl.includes('.m3u8') && !m3u8Urls.includes(reqUrl)) {
        console.log(`   🎯 M3U8: ${reqUrl.substring(0, 80)}...`);
        m3u8Urls.push(reqUrl);
      }
    });

    if (referer) {
      await page.setExtraHTTPHeaders({ 'Referer': referer });
    }

    console.log('   📄 Navigating to page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('   ✅ Page loaded');

    // Wait for CF to resolve
    console.log('   ⏳ Waiting for CF challenge (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    if (m3u8Urls.length > 0) {
      console.log('   ✅ Found M3U8 after CF bypass');
      await browser.close();
      return res.json({ success: true, m3u8Url: m3u8Urls[0] });
    }

    // Click in center of page to trigger player
    console.log('   🖱️ Clicking center of page...');
    const viewport = page.viewport();
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
    await new Promise(r => setTimeout(r, 3000));

    if (m3u8Urls.length > 0) {
      console.log('   ✅ Found M3U8 after center click');
      await browser.close();
      return res.json({ success: true, m3u8Url: m3u8Urls[0] });
    }

    // Find and click inside iframes
    console.log('   🔍 Searching iframes...');
    const iframes = await page.$$('iframe');
    console.log(`   📋 Found ${iframes.length} iframe(s)`);

    for (let i = 0; i < iframes.length; i++) {
      try {
        const box = await iframes[i].boundingBox();
        if (box && box.width > 100 && box.height > 100) {
          console.log(`   🎯 Clicking iframe ${i + 1} at center (${Math.round(box.x + box.width / 2)}, ${Math.round(box.y + box.height / 2)})`);
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await new Promise(r => setTimeout(r, 5000));

          if (m3u8Urls.length > 0) {
            console.log('   ✅ Found M3U8 after iframe click');
            await browser.close();
            return res.json({ success: true, m3u8Url: m3u8Urls[0] });
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Iframe ${i + 1} click failed: ${e.message}`);
      }
    }

    // Extended wait for dynamic loading
    console.log('   ⏳ Extended wait (20s)...');
    await new Promise(r => setTimeout(r, 20000));

    if (m3u8Urls.length > 0) {
      console.log('   ✅ Found M3U8 after extended wait');
      await browser.close();
      return res.json({ success: true, m3u8Url: m3u8Urls[0] });
    }

    // Search in all frames for M3U8 in HTML
    console.log('   🔍 Deep frame search...');
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const frameM3U8 = await frame.evaluate(() => {
          const html = document.documentElement?.innerHTML || '';
          const match = html.match(/(https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*)/i);
          return match ? match[0] : null;
        });
        if (frameM3U8) {
          console.log('   ✅ Found M3U8 in frame HTML');
          await browser.close();
          return res.json({ success: true, m3u8Url: frameM3U8 });
        }
      } catch (e) { }
    }

    // Final DOM search
    const m3u8FromDOM = await page.evaluate(() => {
      const html = document.documentElement?.innerHTML || '';
      const match = html.match(/(https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*)/i);
      return match ? match[0] : null;
    });

    if (m3u8FromDOM) {
      console.log('   ✅ Found M3U8 in DOM');
      await browser.close();
      return res.json({ success: true, m3u8Url: m3u8FromDOM });
    }

    await browser.close();
    res.json({ success: false, error: 'No M3U8 found after CF v2 bypass and player interaction' });

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    if (browser) await browser.close().catch(() => { });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Real Browser CF Bypass Server on port ${PORT}`);
  console.log(`   POST http://localhost:${PORT}/extract-stream\n`);
});
