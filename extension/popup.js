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
  // 1. Check Authentication Status (Storage / Cookie / API)
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
        userName.innerHTML = '<a href="http://localhost:3000/login" target="_blank" style="color: #fbbf24; text-decoration: underline; font-weight: 700;">Login to JobPilot →</a>';
      }
    });
  }

  await checkAuthStatus();

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Query Active Tab & Request Job Details
  // ─────────────────────────────────────────────────────────────────────────────
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  function fallbackTabInfo(customTitle = null) {
    let cleanTitle = customTitle || tab.title || "Job Posting";
    let companyName = "Career Portal";
    try {
      if (tab.url) {
        const urlObj = new URL(tab.url);
        companyName = urlObj.hostname.replace(/^(www\.|jobs\.|careers\.)/, "").split(".")[0];
        companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
      }
    } catch {}

    pageJobData = {
      title: cleanTitle,
      company: companyName,
      location: "Remote",
      atsType: "web",
      jdText: (tab.title || "") + " " + (tab.url || ""),
      url: tab.url || "",
    };

    detectedTitle.textContent = cleanTitle;
    detectedCompany.textContent = companyName;
    detectedLocation.textContent = "Remote";
    atsBadge.textContent = "Web";
  }

  // Handle restricted browser pages
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
    fallbackTabInfo("Open any job posting in your browser.");
    return;
  }

  // Request extracted job data from content script
  try {
    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, { action: "GET_JOB_DATA" });
    } catch (err) {
      // If content script was not injected, inject now
      if (chrome.scripting && tab.id) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content.css"]
        });
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
      title: pageJobData?.title || tab.title || "Job Posting",
      location: pageJobData?.location || "Remote",
      workplace_type: "Remote",
      job_type: "Full-time",
      jd_text: pageJobData?.jdText || (tab.title + " " + tab.url),
      apply_url: tab.url || "",
    };

    chrome.runtime.sendMessage({ action: "CLIP_JOB_POSTING", payload, token: currentToken }, (res) => {
      if (res && res.success) {
        const score = res.score || 85;
        showStatus(`✓ Clipped & scored: <b>${score}% Fit</b>! <a href="http://localhost:3000/pipeline" target="_blank" style="color:#6ee7b7; text-decoration:underline; font-weight:700;">Open Pipeline →</a>`, true);
        clipBtn.innerHTML = "<span>✅ Clipped to JobPilot!</span>";
        clipBtn.style.background = "#10b981";
      } else {
        const errMsg = res?.error || "Could not clip job. Please make sure backend is running and you are logged in at localhost:3000.";
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

      if (!currentProfile) {
        showStatus(`Please <a href="http://localhost:3000/login" target="_blank" style="color:#fda4af; text-decoration:underline; font-weight:700;">log in to JobPilot</a> first so your Master Profile can be used for autofill.`, false);
        autofillBtn.disabled = false;
        autofillBtn.innerHTML = "<span>⚡ Auto-Fill Application Form</span>";
        return;
      }

      // Send autofill command to tab
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, {
          action: "AUTOFILL_APPLICATION",
          profile: currentProfile
        });
      } catch (err) {
        // Retry with injection
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
        showStatus(`Autofill scanned page: no matching empty application fields found on this form step.`, true);
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
