const newsGrid = document.getElementById("news-grid");
const refreshBtn = document.getElementById("refresh-btn");
const lastUpdate = document.getElementById("last-update");

async function fetchMarketIntel() {
  newsGrid.innerHTML =
    '<div class="skeleton-loader">🤖 AI is processing live feeds...</div>';
  refreshBtn.disabled = true;

  try {
    // Calling our Netlify Serverless Function
    const response = await fetch("/.netlify/functions/get-intel");
    const data = await response.json();

    renderCards(data);
    lastUpdate.innerText = `Last Updated: ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    newsGrid.innerHTML = `<div class="error">Failed to fetch data. Check Console / API Keys.</div>`;
  } finally {
    refreshBtn.disabled = false;
  }
}

function renderCards(items) {
  newsGrid.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = `card ${item.impact}`;
    card.innerHTML = `
            <span class="impact-tag ${item.impact}">${item.impact} (${item.confidence} Conf)</span>
            <h3>${item.headline}</h3>
            <p class="summary">${item.summary}</p>
            <div class="meta-row">
                <span>🎯 ${item.affected_assets.join(", ")}</span>
                <span class="action-badge">${item.bias}</span>
            </div>
            <a href="${item.url}" target="_blank" style="font-size: 11px; margin-top:10px; color:#64748b">View Source</a>
        `;
    newsGrid.appendChild(card);
  });
}

refreshBtn.addEventListener("click", fetchMarketIntel);
// Auto-load on start
fetchMarketIntel();
