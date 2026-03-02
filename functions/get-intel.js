const axios = require('axios');

exports.handler = async () => {
    const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        // 1. Fetch News
        const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=CRYPTO:BTC,FOREX:INR&apikey=${ALPHA_KEY}`;
        const newsRes = await axios.get(newsUrl);
        const rawFeed = newsRes.data.feed.slice(0, 5);

        // 2. AI Request with Gemini 3.1 specific parameters
        const aiRequest = {
            contents: [{
                parts: [{
                    text: `Analyze these news items for financial profit opportunities. 
                    Return ONLY a JSON array of objects.
                    Data: ${JSON.stringify(rawFeed)}`
                }]
            }],
            generationConfig: {
                responseMimeType: "application/json", // 2026 native JSON mode
                temperature: 0.2 // Lower temp for factual financial data
            }
        };

        // NEW 2026 ENDPOINT
        const aiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`,
            aiRequest
        );

        const finalData = JSON.parse(aiRes.data.candidates[0].content.parts[0].text);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalData)
        };
    } catch (error) {
        console.error("ERROR:", error.response?.data || error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

