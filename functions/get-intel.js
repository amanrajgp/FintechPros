const axios = require('axios');

exports.handler = async (event, context) => {
    const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        console.log("DEBUG: Step 1 - Fetching Market News...");
        const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=CRYPTO:BTC,FOREX:INR&apikey=${ALPHA_KEY}`;
        const newsRes = await axios.get(newsUrl);
        
        if (!newsRes.data.feed) {
            console.error("Alpha Vantage Error or Limit:", newsRes.data);
            return { statusCode: 429, body: JSON.stringify({ error: "Data limit reached. Wait 60s." }) };
        }

        const newsToAnalyze = newsRes.data.feed.slice(0, 5).map(n => ({
            title: n.title,
            summary: n.summary,
            url: n.url
        }));

        console.log("DEBUG: Step 2 - Analyzing with Gemini 2.5 Flash...");
        
        // Updated 2026 Production Endpoint and Model ID
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

        const aiRequest = {
            contents: [{
                parts: [{
                    text: `Analyze these 5 financial news items for profit opportunities. 
                    Data: ${JSON.stringify(newsToAnalyze)}.
                    Focus on Indian and Global market impact.`
                }]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                // This Schema prevents "JSON Parse" errors by forcing the AI to follow your layout
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            headline: { type: "STRING" },
                            summary: { type: "STRING" },
                            affected_assets: { type: "ARRAY", items: { type: "STRING" } },
                            bias: { type: "STRING" },
                            impact: { type: "STRING" },
                            confidence: { type: "STRING" },
                            url: { type: "STRING" }
                        },
                        required: ["headline", "summary", "affected_assets", "bias", "impact", "confidence", "url"]
                    }
                }
            }
        };

        const aiRes = await axios.post(GEMINI_URL, aiRequest);

        // Robust parsing of the candidate text
        const rawAiText = aiRes.data.candidates[0].content.parts[0].text;
        const finalData = JSON.parse(rawAiText);

        console.log("DEBUG: Step 3 - Sending result to frontend.");
        return {
            statusCode: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
            },
            body: JSON.stringify(finalData)
        };

    } catch (error) {
        console.error("DEBUG: CRASH ->", error.response?.data || error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "AI Processing Failed", 
                details: error.message,
                apiResponse: error.response?.data 
            })
        };
    }
};
