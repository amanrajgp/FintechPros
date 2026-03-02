const axios = require('axios');

exports.handler = async (event, context) => {
    const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    // 1. Check if keys actually exist
    if (!ALPHA_KEY || !GEMINI_KEY) {
        console.error("CRITICAL ERROR: Missing API Keys in Environment Variables");
        return { statusCode: 500, body: JSON.stringify({ error: "Missing API Keys" }) };
    }

    try {
        console.log("Fetching news from Alpha Vantage...");
        const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=CRYPTO:BTC,FOREX:INR&apikey=${ALPHA_KEY}`;
        const newsRes = await axios.get(newsUrl);
        
        if (!newsRes.data.feed) {
            console.error("Alpha Vantage Error:", newsRes.data);
            return { statusCode: 500, body: JSON.stringify({ error: "No news feed found" }) };
        }

        const simplifiedNews = newsRes.data.feed.slice(0, 5).map(n => ({ 
            title: n.title, 
            summary: n.summary, 
            url: n.url 
        }));

        console.log("Sending data to Gemini AI...");
        const aiPrompt = {
            contents: [{
                parts: [{
                    text: `Analyze these news items. Return ONLY a valid JSON array of objects. 
                    Keys: "headline", "summary", "affected_assets", "bias", "impact", "confidence", "url".
                    Data: ${JSON.stringify(simplifiedNews)}`
                }]
            }]
        };

        const aiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
            aiPrompt
        );

        const rawText = aiRes.data.candidates[0].content.parts[0].text;
        // This regex extracts the JSON array safely even if AI adds extra text
        const jsonMatch = rawText.match(/\[[\s\S]*\]/); 
        const finalData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

        console.log("Success! Sending data to frontend.");
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalData)
        };

    } catch (error) {
        console.error("FUNCTION ERROR:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
