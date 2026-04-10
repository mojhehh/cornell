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

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
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
