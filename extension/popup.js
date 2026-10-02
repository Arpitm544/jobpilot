// JobPilot Copilot — Popup Script (Manifest V3)

const API_BASE = "http://localhost:8000/api/v1";

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("statusBadge");
  const statusBadgeText = document.getElementById("statusBadgeText");
  const userName = document.getElementById("userName");
  const tokenToggleBtn = document.getElementById("tokenToggleBtn");
  const tokenSection = document.getElementById("tokenSection");
  const tokenInput = document.getElementById("tokenInput");

  const detectedTitle = document.getElementById("detectedTitle");
  const detectedCompany = document.getElementById("detectedCompany");
  const detectedLocation = document.getElementById("detectedLocation");
  const atsBadge = document.getElementById("atsBadge");

  const clipBtn = document.getElementById("clipBtn");
  const autofillBtn = document.getElementById("autofillBtn");
  const statusBox = document.getElementById("statusBox");

  let currentToken = null;
  let currentUser = null;
  let currentProfile = null;
  let pageJobData = null;

  // Toggle manual token view
  tokenToggleBtn.addEventListener("click", () => {
    const isHidden = tokenSection.style.display === "none" || !tokenSection.style.display;
    tokenSection.style.display = isHidden ? "block" : "none";
  });

  tokenInput.addEventListener("change", async () => {
    const val = tokenInput.value.trim();
    if (val) {
      await chrome.storage.local.set({ jobpilot_token: val });
      currentToken = val;
      checkAuthStatus();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Check Authentication Status (Cookie / Storage / API)
  // ─────────────────────────────────────────────────────────────────────────────
  async function checkAuthStatus() {
    chrome.runtime.sendMessage({ action: "GET_AUTH_STATUS" }, (res) => {
      if (res && res.authenticated && res.user) {
        currentUser = res.user;
        currentProfile = res.profile;
        currentToken = res.token;

        statusBadge.className = "badge badge-connected";
        statusBadgeText.textContent = "Connected";
        userName.textContent = currentUser.full_name || currentUser.email || "Active User";

        if (currentToken) {
          tokenInput.value = currentToken;
        }
      } else {
        statusBadge.className = "badge badge-disconnected";
        statusBadgeText.textContent = "Not Connected";
        userName.innerHTML = '<a href="http://localhost:3000/login" target="_blank" style="color: #fbbf24; text-decoration: underline;">Log in at localhost:3000</a>';
      }
    });
  }

  await checkAuthStatus();

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Query Active Tab & Ensure Content Script Injected
  // ─────────────────────────────────────────────────────────────────────────────
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  // Function to safely request job details from tab
  async function loadJobDetailsFromTab() {
    try {
      // First attempt: send message
      let res;
      try {
        res = await chrome.tabs.sendMessage(tab.id, { action: "GET_JOB_DATA" });
      } catch (err) {
        // If content script wasn't injected yet, dynamically inject it now
        if (chrome.scripting && tab.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          });
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["content.css"]
          });
          // Retry message
          res = await chrome.tabs.sendMessage(tab.id, { action: "GET_JOB_DATA" });
        }
      }

      if (res && res.title) {
        pageJobData = res;
        detectedTitle.textContent = res.title;
        detectedCompany.textContent = res.company || "Company";
        detectedLocation.textContent = res.location || "Remote";
        atsBadge.textContent = res.atsType || "Web";
      } else {
        fallbackTabInfo();
      }
    } catch (e) {
      fallbackTabInfo();
    }
  }

  function fallbackTabInfo() {
    let cleanTitle = tab.title || "Job Posting";
    let companyName = "Career Portal";
    try {
      const urlObj = new URL(tab.url);
      companyName = urlObj.hostname.replace("www.", "");
    } catch {}

    pageJobData = {
      title: cleanTitle,
      company: companyName,
      location: "Remote",
      atsType: "web",
      jdText: tab.title + " " + tab.url,
      url: tab.url,
    };

    detectedTitle.textContent = cleanTitle;
    detectedCompany.textContent = companyName;
    detectedLocation.textContent = "Remote";
    atsBadge.textContent = "Web";
  }

  await loadJobDetailsFromTab();

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Clip & Score Job Handler
  // ─────────────────────────────────────────────────────────────────────────────
  clipBtn.addEventListener("click", async () => {
    clipBtn.disabled = true;
    clipBtn.innerHTML = "<span>⏳ Clipping & Scoring...</span>";
    statusBox.className = "status-msg";
    statusBox.style.display = "none";

    const payload = {
      company_name: pageJobData?.company || "Company",
      title: pageJobData?.title || tab.title || "Software Engineer",
      location: pageJobData?.location || "Remote",
      workplace_type: "Remote",
      job_type: "Full-time",
      jd_text: pageJobData?.jdText || (tab.title + " " + tab.url),
      apply_url: tab.url,
    };

    chrome.runtime.sendMessage({ action: "CLIP_JOB_POSTING", payload, token: currentToken }, (res) => {
      if (res && res.success) {
        const score = res.score || 85;
        showStatus(`✓ Clipped & scored: <b>${score}% Fit</b>! Added to your Pipeline.`, true);
        clipBtn.innerHTML = "<span>✅ Clipped to JobPilot!</span>";
        clipBtn.style.background = "#10b981";
      } else {
        const errMsg = res?.error || "Could not clip job. Make sure backend is running and you are logged in.";
        showStatus(`Error: ${errMsg}`, false);
        clipBtn.disabled = false;
        clipBtn.innerHTML = "<span>📌 1-Click Clip & Score Job</span>";
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Autofill Application Handler
  // ─────────────────────────────────────────────────────────────────────────────
  autofillBtn.addEventListener("click", async () => {
    autofillBtn.disabled = true;
    autofillBtn.innerHTML = "<span>⚡ Autofilling Fields...</span>";

    try {
      // Ensure we have user's profile
      if (!currentProfile) {
        const profRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: "FETCH_LATEST_PROFILE" }, resolve);
        });
        currentProfile = profRes?.profile;
      }

      // Send autofill command to content script in current tab
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, {
          action: "AUTOFILL_APPLICATION",
          profile: currentProfile
        });
      } catch (err) {
        // If content script was missing, inject and retry
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        result = await chrome.tabs.sendMessage(tab.id, {
          action: "AUTOFILL_APPLICATION",
          profile: currentProfile
        });
      }

      const count = result?.filledCount || 0;
      if (count > 0) {
        showStatus(`✓ Autofill complete: filled <b>${count} fields</b> with your Master Profile!`, true);
        autofillBtn.innerHTML = `<span>✅ Filled ${count} Fields!</span>`;
      } else {
        showStatus(`Autofill scanned page: no matching empty application fields found on this step.`, true);
        autofillBtn.innerHTML = `<span>⚡ Auto-Fill Application Form</span>`;
        autofillBtn.disabled = false;
      }
    } catch (err) {
      showStatus(`Autofill error: ${err.message}`, false);
      autofillBtn.disabled = false;
      autofillBtn.innerHTML = "<span>⚡ Auto-Fill Application Form</span>";
    }
  });

  function showStatus(htmlText, isSuccess) {
    statusBox.innerHTML = htmlText;
    statusBox.className = `status-msg ${isSuccess ? "status-success" : "status-error"}`;
    statusBox.style.display = "block";
  }
});
