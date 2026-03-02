const axios = require("axios");

exports.handler = async (event, context) => {
  const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!ALPHA_KEY || !GEMINI_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing API Keys in environment variables." })
    };
  }

  try {
    console.log("DEBUG: Fetching News from Alpha Vantage...");

    const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=CRYPTO:BTC,FOREX:USDINR&apikey=${ALPHA_KEY}`;

    const newsRes = await axios.get(newsUrl);

    // Rate limit handling
    if (!newsRes.data.feed) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Alpha Vantage rate limit reached." })
      };
    }

    // Extract top 5 news
    const newsFeed = newsRes.data.feed.slice(0, 5).map(n => ({
      title: n.title,
      summary: n.summary,
      source: n.source,
      url: n.url
    }));

    console.log("DEBUG: Calling Gemini AI...");

    const aiRequest = {
      contents: [
        {
          parts: [
            {
              text: `
You are an expert financial market analyst.

Analyze the following news and determine:

- headline
- summary (simple, to the point)
- affected_assets
- bias (Buy / Sell / Hold)
- impact (Bullish / Bearish / Neutral)
- confidence (Low / Medium / High)
- url

Return ONLY valid JSON array.

News Data:
${JSON.stringify(newsFeed)}
`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              headline: { type: "string" },
              summary: { type: "string" },
              affected_assets: {
                type: "array",
                items: { type: "string" }
              },
              bias: { type: "string" },
              impact: { type: "string" },
              confidence: { type: "string" },
              url: { type: "string" }
            }
          }
        }
      }
    };

    const aiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`,
      aiRequest,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    let finalData = [];

    try {
      finalData = JSON.parse(
        aiRes.data.candidates[0].content.parts[0].text
      );
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "AI response format error." })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        data: finalData
      })
    };

  } catch (error) {
    console.error("DEBUG ERROR:", error.response?.data || error.message);

    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: error.response?.data || error.message
      })
    };
  }
};
