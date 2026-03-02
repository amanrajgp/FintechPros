const axios = require('axios');

exports.handler = async (event, context) => {
    const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        console.log("DEBUG: Fetching News...");
        const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=CRYPTO:BTC,FOREX:INR&apikey=${ALPHA_KEY}`;
        const newsRes = await axios.get(newsUrl);
        
        // Handle Rate Limits
        if (!newsRes.data.feed) {
            return { statusCode: 429, body: JSON.stringify({ error: "Alpha Vantage Limit" }) };
        }

        const newsFeed = newsRes.data.feed.slice(0, 5).map(n => ({
            title: n.title,
            summary: n.summary
        }));

        console.log("DEBUG: Calling Gemini...");
        const aiRequest = {
            contents: [{
                parts: [{
                    text: `Analyze these 5 news items for market impact. Data: ${JSON.stringify(newsFeed)}`
                }]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                // Force a specific JSON structure
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
                        }
                    }
                }
            }
        };

        // Using 1.5-flash as it is the most stable for production logic
        const aiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
            aiRequest
        );

        const finalData = JSON.parse(aiRes.data.candidates[0].content.parts[0].text);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(finalData)
        };

    } catch (error) {
        console.error("DEBUG: ERROR ->", error.response?.data || error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
