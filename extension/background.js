// JobPilot Background Service Worker (Manifest V3)

const IS_PROD = false; // Toggle this for production build
const API_BASE = IS_PROD ? "https://api.jobpilot.io/api/v1" : "http://localhost:8000/api/v1";
const WEB_BASE = IS_PROD ? "https://app.jobpilot.io" : "http://localhost:3000";

chrome.runtime.onInstalled.addListener(() => {
  // console.log("[JobPilot Copilot] Extension installed/updated.");
  chrome.storage.local.set({
    jobpilot_api_url: API_BASE,
    jobpilot_active: true
  });
});

// Helper to retrieve token from storage, cookies, or open tabs
async function getAuthToken() {
  // 1. Check local extension storage
  const stored = await chrome.storage.local.get(["jobpilot_token"]);
  if (stored.jobpilot_token) {
    return stored.jobpilot_token;
  }

  // 2. Read access_token cookie from any allowed host
  try {
    const cookies = await chrome.cookies.getAll({ name: "access_token" });
    if (cookies && cookies.length > 0) {
      const validCookie = cookies.find(c => c.value && c.value.length > 20);
      if (validCookie) {
        await chrome.storage.local.set({ jobpilot_token: validCookie.value });
        return validCookie.value;
      }
    }
  } catch (e) {
    // console.warn("Could not query cookies:", e);
  }

  // 3. Fallback: Query open JobPilot tabs on localhost:3000 to read localStorage token
  try {
    const tabs = await chrome.tabs.query({ url: [`${WEB_BASE}/*`, "http://127.0.0.1:3000/*"] });
    for (const t of tabs) {
      if (t.id) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: () => localStorage.getItem("jobpilot_token")
        });
        const token = results?.[0]?.result;
        if (token && token.length > 20) {
          await chrome.storage.local.set({ jobpilot_token: token });
          return token;
        }
      }
    }
  } catch (e) {}

  return null;
}

// Helper to fetch user profile
async function fetchUserProfile(token) {
  if (!token) return null;

  const endpoints = [
    `${API_BASE}/profile`,
    `${API_BASE}/profile/primary`,
    `${API_BASE}/profile/master`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const profile = await res.json();
        await chrome.storage.local.set({ jobpilot_profile: profile });
        return profile;
      }
    } catch (err) {}
  }
  return null;
}

// Message Listener
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "GET_AUTH_STATUS") {
    (async () => {
      const token = await getAuthToken();
      let user = null;
      let profile = null;

      if (token) {
        try {
          const authRes = await fetch(`${API_BASE}/bootstrap`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (authRes.ok) {
            const data = await authRes.json();
            user = data.user;
            profile = data.profile_summary;
          } else {
            // Token might be expired, remove and retry cookie check
            await chrome.storage.local.remove(["jobpilot_token"]);
          }
        } catch (e) {}
      }

      sendResponse({
        authenticated: !!user,
        user,
        profile,
        token
      });
    })();
    return true; // async
  }

  if (req.action === "CLIP_JOB_POSTING") {
    (async () => {
      try {
        const token = req.token || (await getAuthToken());
        if (!token) {
          return sendResponse({ success: false, error: `Please log in to JobPilot at ${WEB_BASE}` });
        }

        const res = await fetch(`${API_BASE}/jobs/manual`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(req.payload)
        });

        if (!res.ok) {
          const err = await res.json();
          return sendResponse({ success: false, error: err.detail || "Failed to clip job" });
        }

        const match = await res.json();
        const score = Math.round(match.match_score || 85);
        sendResponse({ success: true, match, score });
      } catch (err) {
        sendResponse({ success: false, error: err.message || "Network error" });
      }
    })();
    return true;
  }

  if (req.action === "FETCH_LATEST_PROFILE") {
    (async () => {
      const token = await getAuthToken();
      const profile = await fetchUserProfile(token);
      sendResponse({ profile });
    })();
    return true;
  }
});

// Update badge when on supported ATS / job domains
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const url = tab.url.toLowerCase();
    if (
      url.includes("greenhouse.io") ||
      url.includes("lever.co") ||
      url.includes("ashbyhq.com") ||
      url.includes("linkedin.com/jobs") ||
      url.includes("workable.com") ||
      url.includes("myworkdayjobs.com") ||
      url.includes("smartrecruiters.com") ||
      url.includes("jobvite.com") ||
      url.includes("bamboohr.com") ||
      url.includes("/job/") ||
      url.includes("/jobs/") ||
      url.includes("/career/") ||
      url.includes("/careers/")
    ) {
      chrome.action.setBadgeText({ tabId, text: "JOB" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#6366f1" });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  }
});
