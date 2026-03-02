const axios = require("axios");

exports.handler = async () => {
  // These must be set in Netlify Dashboard
  const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  try {
    // 1. Fetch Indian & Global news from Alpha Vantage
    const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=CRYPTO:BTC,FOREX:INR&apikey=${ALPHA_KEY}`;
    const newsRes = await axios.get(newsUrl);
    const rawFeed = newsRes.data.feed.slice(0, 6); // Top 6 headlines

    // 2. Format data for AI
    const simplifiedNews = rawFeed.map((n) => ({
      title: n.title,
      summary: n.summary,
      url: n.url,
    }));

    // 3. Ask Gemini for structured financial analysis
    const aiPrompt = {
      contents: [
        {
          parts: [
            {
              text: `Act as a senior financial analyst. Analyze these news items for profit opportunities. 
                    Return ONLY a JSON array of objects with keys: 
                    "headline", "summary" (max 3 lines), "affected_assets" (array), "bias" (Buy/Sell/Hold), 
                    "impact" (Bullish/Bearish), "confidence" (High/Low), "url".
                    Focus on India market impact if mentioned.
                    News to analyze: ${JSON.stringify(simplifiedNews)}`,
            },
          ],
        },
      ],
    };

    const aiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      aiPrompt,
    );

    // Clean AI response (removes markdown backticks if present)
    const cleanJson = aiRes.data.candidates[0].content.parts[0].text.replace(
      /```json|```/g,
      "",
    );
    const finalData = JSON.parse(cleanJson);

    return {
      statusCode: 200,
      body: JSON.stringify(finalData),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
