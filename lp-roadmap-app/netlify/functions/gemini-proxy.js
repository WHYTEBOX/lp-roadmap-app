/**
 * Netlify Function: gemini-proxy.js
 *
 * This function acts as a secure "middle-man" or "proxy" between your
 * public website and the Google Gemini API.
 *
 * 1. Your public app (index.html) calls this function.
 * 2. This function secretly retrieves your API key from Netlify's
 * Environment Variables (where it's safe).
 * 3. It adds the key to the request and calls the REAL Gemini API.
 * 4. It gets the response from Google and sends it back to your app.
 *
 * This way, your API key is NEVER exposed to the public.
 */

// This is the main function Netlify will run
export const handler = async (event) => {
    
    // 1. Get the prompt from the client's request
    // We only accept POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return { statusCode: 400, body: 'Bad Request: Invalid JSON.' };
    }
    
    const { prompt, systemPrompt } = body;

    if (!prompt) {
        return { statusCode: 400, body: 'Bad Request: "prompt" is required.' };
    }

    // 2. Get the SECRET API key from Netlify's environment
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // This is a server-side error, don't expose it to the client
        console.error('GEMINI_API_KEY is not set in Netlify environment.');
        return { statusCode: 500, body: 'Internal Server Error: API configuration missing.' };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    // 3. Construct the payload for the *real* Gemini API
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt || "" }] // Use systemPrompt if provided
        },
    };

    // 4. Call the Google Gemini API
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Gemini API error: ${response.status}`, errorText);
            return { statusCode: response.status, body: `Gemini API Error: ${errorText}` };
        }

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            
            // 5. Send the successful response back to the client app
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            };
        } else {
            return { statusCode: 500, body: 'Gemini API returned no candidates.' };
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return { statusCode: 500, body: `Internal Server Error: ${error.message}` };
    }
};