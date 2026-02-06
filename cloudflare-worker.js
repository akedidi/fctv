/**
 * FCTV Cloudflare Proxy Worker
 * Simple fetch proxy running on Cloudflare edge
 */

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url')

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    }

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers })
    }

    if (!targetUrl) {
        return new Response(JSON.stringify({
            endpoints: [
                '/?url=<page_url> - Extract M3U8 from page',
                '/proxy?url=<stream_url> - Proxy raw content'
            ]
        }), { headers })
    }

    // Fetch with browser headers (trusted by Cloudflare since we ARE Cloudflare)
    const resp = await fetch(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Ch-Ua': '"Chrome";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1'
        }
    })

    const text = await resp.text()

    // Extract M3U8 URLs
    const m3u8Regex = /(https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)/gi
    const matches = text.match(m3u8Regex)

    if (matches && matches.length > 0) {
        return new Response(JSON.stringify({
            success: true,
            m3u8Url: matches[0],
            allUrls: [...new Set(matches)],
            status: resp.status
        }), { headers })
    }

    // Check for Cloudflare challenge
    if (text.includes('challenge-platform') || text.includes('Checking your browser')) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Cloudflare challenge detected',
            status: resp.status
        }), { headers })
    }

    return new Response(JSON.stringify({
        success: false,
        error: 'No M3U8 found',
        status: resp.status,
        htmlLength: text.length
    }), { headers })
}
