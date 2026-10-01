// JobPilot Content Script — Form Detection & DOM Scraper

(function () {
  console.log("JobPilot Copilot active on page.");

  function detectATS() {
    const host = window.location.hostname;
    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("lever.co")) return "lever";
    if (host.includes("ashbyhq.com")) return "ashby";
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("workable.com")) return "workable";
    return "general";
  }

  function extractJobDetails() {
    const ats = detectATS();
    let title = "";
    let company = "";
    let location = "Remote";
    let jdText = "";

    if (ats === "greenhouse") {
      title = document.querySelector(".app-title, h1.job-title, h1")?.innerText?.trim() || "";
      company = document.querySelector(".company-name, #header .company, .sub-title")?.innerText?.trim() || "";
      location = document.querySelector(".location, .body--metadata")?.innerText?.trim() || "Remote";
      jdText = document.querySelector("#content, #job-description, .content")?.innerText?.trim() || "";
    } else if (ats === "lever") {
      title = document.querySelector(".posting-headline h2, h2")?.innerText?.trim() || "";
      company = document.querySelector(".main-header-logo img")?.alt || document.title.split("-")[1]?.trim() || "";
      location = document.querySelector(".posting-categories .location")?.innerText?.trim() || "Remote";
      jdText = document.querySelector(".section-wrapper, .posting-page")?.innerText?.trim() || "";
    } else if (ats === "ashby") {
      title = document.querySelector("h1, .ashby-job-posting-heading")?.innerText?.trim() || "";
      company = document.title.split("-")[0]?.trim() || "";
      location = document.querySelector(".ashby-job-posting-brief-info, [class*='location']")?.innerText?.trim() || "Remote";
      jdText = document.querySelector(".ashby-job-posting-description, [class*='description']")?.innerText?.trim() || "";
    } else if (ats === "linkedin") {
      title = document.querySelector(".job-details-jobs-unified-top-card__job-title, h1")?.innerText?.trim() || "";
      company = document.querySelector(".job-details-jobs-unified-top-card__company-name a")?.innerText?.trim() || "";
      location = document.querySelector(".job-details-jobs-unified-top-card__primary-description-container")?.innerText?.trim() || "Remote";
      jdText = document.querySelector("#job-details, .jobs-description__content")?.innerText?.trim() || "";
    } else {
      title = document.querySelector("h1")?.innerText?.trim() || document.title;
      company = document.title.split(/[-|–]/)[0]?.trim() || window.location.hostname.replace("www.", "");
      jdText = document.querySelector("main, article, [role='main'], body")?.innerText?.slice(0, 3000) || "";
    }

    return {
      atsType: ats,
      title: title || document.title,
      company: company || "Hiring Company",
      location: location || "Remote",
      jdText: jdText || document.body.innerText.slice(0, 2000),
      url: window.location.href,
    };
  }

  function setNativeValue(element, value) {
    if (!element || value == null) return;
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function autofillPage(profile) {
    const contact = profile?.contact_info || {};
    const fullName = contact.full_name || "Arjun Rathod";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "Arjun";
    const lastName = nameParts.slice(1).join(" ") || "Rathod";
    const email = contact.email || "candidate@example.com";
    const phone = contact.phone || "+1 (555) 019-2834";
    const linkedin = contact.linkedin || "https://linkedin.com/in/candidate";
    const github = contact.github || "https://github.com/candidate";
    const website = contact.portfolio || github;

    let filledCount = 0;

    const fillIfMatch = (selectors, value) => {
      if (!value) return;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && !el.value) {
          setNativeValue(el, value);
          filledCount++;
          break;
        }
      }
    };

    // First Name
    fillIfMatch(['#first_name', 'input[name="first_name"]', 'input[name*="firstName" i]', 'input[autocomplete="given-name"]'], firstName);
    // Last Name
    fillIfMatch(['#last_name', 'input[name="last_name"]', 'input[name*="lastName" i]', 'input[autocomplete="family-name"]'], lastName);
    // Full Name
    fillIfMatch(['input[name="name"]', 'input[name="full_name"]', 'input[id*="name" i]:not([id*="first"]):not([id*="last"])'], fullName);
    // Email
    fillIfMatch(['#email', 'input[name="email"]', 'input[type="email"]', 'input[autocomplete="email"]'], email);
    // Phone
    fillIfMatch(['#phone', 'input[name="phone"]', 'input[type="tel"]', 'input[autocomplete="tel"]'], phone);
    // LinkedIn
    fillIfMatch(['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[aria-label*="linkedin" i]'], linkedin);
    // GitHub / Website
    fillIfMatch(['input[name*="github" i]', 'input[id*="github" i]', 'input[name*="website" i]', 'input[name*="portfolio" i]'], website);

    return filledCount;
  }

  // Floating Action Pill Widget
  function injectFloatingPill() {
    if (document.getElementById("jobpilot-floating-widget")) return;

    const widget = document.createElement("div");
    widget.id = "jobpilot-floating-widget";
    widget.innerHTML = `
      <div class="jp-pill">
        <div class="jp-pill-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </div>
        <span class="jp-pill-text">JobPilot Ready</span>
        <button id="jp-quick-fill-btn" class="jp-pill-btn">Auto-Fill</button>
      </div>
    `;

    document.body.appendChild(widget);

    document.getElementById("jp-quick-fill-btn")?.addEventListener("click", () => {
      const count = autofillPage();
      const btn = document.getElementById("jp-quick-fill-btn");
      if (btn) {
        btn.textContent = `✓ Filled (${count})`;
        setTimeout(() => { btn.textContent = "Auto-Fill"; }, 3000);
      }
    });
  }

  // Message Listener from Popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "GET_JOB_DATA") {
      const details = extractJobDetails();
      sendResponse(details);
    } else if (req.action === "AUTOFILL_APPLICATION") {
      const count = autofillPage(req.profile);
      sendResponse({ success: true, filledCount: count });
    }
    return true;
  });

  // Inject widget on relevant career pages
  if (window.location.href.includes("job") || window.location.href.includes("career") || detectATS() !== "general") {
    setTimeout(injectFloatingPill, 1200);
  }
})();
