const axios = require('axios');

exports.handler = async (event, context) => {
    // 1. Validate Environment Variables
    const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!ALPHA_KEY || !GEMINI_KEY) {
        console.error("DEBUG: Missing API Keys in Netlify Environment Variables");
        return { statusCode: 500, body: JSON.stringify({ error: "Missing API Keys" }) };
    }

    try {
        // 2. Fetch News from Alpha Vantage
        console.log("DEBUG: Step 1 - Fetching Alpha Vantage News...");
        const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=CRYPTO:BTC,FOREX:INR&apikey=${ALPHA_KEY}`;
        const newsRes = await axios.get(newsUrl);
        
        // Handle Alpha Vantage Rate Limits (5 calls/min for free tier)
        if (newsRes.data.Note || !newsRes.data.feed) {
            console.warn("DEBUG: Alpha Vantage limit or error:", newsRes.data);
            return { statusCode: 429, body: JSON.stringify({ error: "Market data limit reached. Try again in 1 min." }) };
        }

        const newsFeed = newsRes.data.feed.slice(0, 5).map(n => ({
            title: n.title,
            summary: n.summary,
            url: n.url
        }));

        // 3. Request to Gemini 3 Flash
        console.log("DEBUG: Step 2 - Sending to Gemini 3 Flash...");
        
        const aiRequest = {
            contents: [{
                parts: [{
                    text: `Analyze these news items for profit opportunities. 
                    Data to process: ${JSON.stringify(newsFeed)}.
                    
                    Return a JSON array of objects with these EXACT keys: 
                    "headline", "summary", "affected_assets" (array), "bias" (Buy/Sell/Hold), 
                    "impact" (Bullish/Bearish), "confidence" (High/Medium/Low), "url".`
                }]
            }],
            generationConfig: {
                // FORCE Gemini 3 to return only JSON
                responseMimeType: "application/json",
                temperature: 0.1 // Keep it factual, not creative
            }
        };

        const aiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GEMINI_KEY}`,
            aiRequest,
            { headers: { 'Content-Type': 'application/json' } }
        );

        // 4. Validate AI Response
        if (!aiRes.data.candidates || !aiRes.data.candidates[0].content.parts[0].text) {
            throw new Error("Gemini returned an empty response.");
        }

        const finalData = JSON.parse(aiRes.data.candidates[0].content.parts[0].text);
        console.log(`DEBUG: Success! Processed ${finalData.length} signals.`);

        return {
            statusCode: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" // Allows frontend to read data
            },
            body: JSON.stringify(finalData)
        };

    } catch (error) {
        // 5. Advanced Debugging Output
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("DEBUG: Function Crash ->", errorMsg);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "AI Analysis Failed", 
                details: error.message,
                status: error.response?.status 
            })
        };
    }
};
