// JobPilot Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log("JobPilot Copilot extension installed.");
  chrome.storage.local.set({
    jobpilot_api_url: "http://localhost:8000/api/v1",
    jobpilot_active: true
  });
});

// Update badge when on supported ATS domains
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const url = tab.url.toLowerCase();
    if (
      url.includes("greenhouse.io") ||
      url.includes("lever.co") ||
      url.includes("ashbyhq.com") ||
      url.includes("linkedin.com/jobs") ||
      url.includes("workable.com")
    ) {
      chrome.action.setBadgeText({ tabId, text: "ATS" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#4f46e5" });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  }
});
