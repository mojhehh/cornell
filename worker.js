const CEREBRAS_API_KEY = 'csk-wnhhkvm58e8f3yhppm6xjf8dkdmy2nvxxj8dn5yrc95wec8t';

const PROMPTS = {
    cornell: `Create Cornell Notes from this content. Return ONLY valid JSON, no other text:
{"topic":"topic title","mainIdeas":["idea1","idea2"],"notes":["note1","note2"],"summary":"summary"}
Find the key questions or main concepts. Use them as main ideas with thorough answers as notes. DO NOT use dashes, hyphens, or bullet points. Write in complete sentences.`,

    vocab: `Extract vocabulary terms and definitions. Return ONLY valid JSON:
{"topic":"Vocabulary","mainIdeas":["Term1","Term2"],"notes":["Definition of term1","Definition of term2"],"summary":"Key concepts summary"}
Extract ALL key terms. Put the WORD in mainIdeas and DEFINITION in notes. Write definitions as complete sentences.`,

    timeline: `Create a timeline. Return ONLY valid JSON:
{"topic":"Timeline","mainIdeas":["Date1","Date2"],"notes":["What happened","What happened"],"summary":"Overview of time period"}
Extract ALL dates and events. Put DATE in mainIdeas, EVENT in notes. Order chronologically. Write in complete sentences.`,

    character: `Create character notes. Return ONLY valid JSON:
{"topic":"Characters","mainIdeas":["Name1","Name2"],"notes":["Who they are","Who they are"],"summary":"How characters relate"}
Extract ALL characters. Put NAME in mainIdeas, DESCRIPTION in notes. Include role, traits, importance. Write in complete sentences.`,

    all: `Create comprehensive Cornell Notes covering everything important. Return ONLY valid JSON:
{"topic":"topic title","mainIdeas":["concept1","concept2","concept3"],"notes":["explanation1","explanation2","explanation3"],"summary":"Complete summary"}
Extract ALL important info: terms, dates, people, events, concepts. Each main idea is a short label, each note is a detailed explanation. Write in complete sentences.`
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function stripHtml(html) {
    let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/\s+/g, ' ');
    return text.trim();
}

const GARBAGE_WORDS = [
    'javascript is disabled', 'enable javascript', 'please enable cookies',
    'access denied', 'captcha', 'checking your browser', 'just a moment',
    'cloudflare', 'attention required', 'one more step', 'verify you are human',
    'signing in', 'sign in to', 'log in to continue', 'authentication required',
    'okta', 'sso', 'single sign-on', 'session expired', 'refresh this page',
    'please wait', 'redirecting', 'loading...', 'incapsula', 'robot',
    '403 forbidden', '404 not found', 'page not found', 'unauthorized'
];

function looksLikeGarbage(text) {
    if (!text || text.length < 150) return true;
    const lower = text.toLowerCase();
    const hits = GARBAGE_WORDS.filter(w => lower.includes(w));
    if (hits.length >= 1) return true;
    const words = text.split(/\s+/).filter(w => w.length > 2);
    if (words.length < 20) return true;
    return false;
}

async function scrapeWithRetry(targetUrl) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    };
    const res1 = await fetch(targetUrl, { headers, redirect: 'follow' });
    if (!res1.ok) return { ok: false, status: res1.status };
    const html1 = await res1.text();
    const text1 = stripHtml(html1);
    if (!looksLikeGarbage(text1)) return { ok: true, text: text1.slice(0, 30000) };
    await new Promise(r => setTimeout(r, 2000));
    const res2 = await fetch(targetUrl, { headers, redirect: 'follow' });
    if (!res2.ok) return { ok: false, status: res2.status };
    const html2 = await res2.text();
    const text2 = stripHtml(html2);
    return { ok: true, text: text2.slice(0, 30000) };
}

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);
        
        if (url.pathname === '/scrape' && request.method === 'POST') {
            try {
                const body = await request.json();
                const targetUrl = body.url;
                if (!targetUrl || typeof targetUrl !== 'string') {
                    return new Response(JSON.stringify({ error: 'Missing url field' }), {
                        status: 400,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                    });
                }
                let parsed;
                try { parsed = new URL(targetUrl); } catch {
                    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
                        status: 400,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                    });
                }
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return new Response(JSON.stringify({ error: 'Only HTTP/HTTPS URLs allowed' }), {
                        status: 400,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                    });
                }
                const result = await scrapeWithRetry(targetUrl);
                if (!result.ok) {
                    return new Response(JSON.stringify({ error: `Failed to fetch: ${result.status}` }), {
                        status: 502,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ text: result.text }), {
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message || 'Scrape failed' }), {
                    status: 500,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
            }
        }

        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        try {
            const body = await request.json();
            const { content, noteType } = body;

            if (!content || typeof content !== 'string' || content.trim().length < 50) {
                return new Response(JSON.stringify({ error: 'Content too short' }), {
                    status: 400,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
            }

            const systemPrompt = PROMPTS[noteType] || PROMPTS.cornell;

            const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CEREBRAS_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'qwen-3-235b-a22b-instruct-2507',
                    max_tokens: 3000,
                    temperature: 0.6,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: content.slice(0, 15000) }
                    ]
                })
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                return new Response(JSON.stringify({ error: `AI API error: ${response.status}` }), {
                    status: 502,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
            }

            const data = await response.json();

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                return new Response(JSON.stringify({ error: 'Invalid AI response' }), {
                    status: 502,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
            }

            const text = data.choices[0].message.content;
            const match = text.match(/\{[\s\S]*\}/);

            if (!match) {
                return new Response(JSON.stringify({ error: 'No JSON in AI response' }), {
                    status: 502,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
            }

            const parsed = JSON.parse(match[0]);

            if (!Array.isArray(parsed.mainIdeas) || !Array.isArray(parsed.notes)) {
                return new Response(JSON.stringify({ error: 'Malformed notes structure' }), {
                    status: 502,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify(parsed), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }
    }
};
