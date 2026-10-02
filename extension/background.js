// JobPilot Background Service Worker (Manifest V3)

const API_BASE = "http://localhost:8000/api/v1";

chrome.runtime.onInstalled.addListener(() => {
  console.log("JobPilot Copilot extension v1.1.0 installed.");
  chrome.storage.local.set({
    jobpilot_api_url: API_BASE,
    jobpilot_active: true
  });
});

// Helper to retrieve token from cookies or storage
async function getAuthToken() {
  // 1. Check local storage
  const stored = await chrome.storage.local.get(["jobpilot_token"]);
  if (stored.jobpilot_token) {
    return stored.jobpilot_token;
  }

  // 2. Try reading access_token cookie from localhost:8000 / localhost:3000 / 127.0.0.1
  const cookieUrls = [
    "http://localhost:8000",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:3000"
  ];

  for (const url of cookieUrls) {
    try {
      const cookie = await chrome.cookies.get({ url, name: "access_token" });
      if (cookie && cookie.value) {
        await chrome.storage.local.set({ jobpilot_token: cookie.value });
        return cookie.value;
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
}

// Helper to fetch user profile
async function fetchUserProfile(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/profile/primary`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (res.ok) {
      const profile = await res.json();
      await chrome.storage.local.set({ jobpilot_profile: profile });
      return profile;
    }
  } catch (err) {
    console.error("Error fetching profile:", err);
  }
  return null;
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "GET_AUTH_STATUS") {
    (async () => {
      const token = await getAuthToken();
      let user = null;
      let profile = null;

      if (token) {
        try {
          const authRes = await fetch(`${API_BASE}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (authRes.ok) {
            user = await authRes.json();
            profile = await fetchUserProfile(token);
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
    return true; // async sendResponse
  }

  if (req.action === "CLIP_JOB_POSTING") {
    (async () => {
      try {
        const token = req.token || (await getAuthToken());
        if (!token) {
          return sendResponse({ success: false, error: "Please log in to JobPilot at http://localhost:3000" });
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
        const score = Math.round((match.match_score || 0.85 * 100));
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
