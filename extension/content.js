// JobPilot Content Script — Advanced ATS Job Scraper & Form Auto-Filler
// Supports: Greenhouse, Lever, Ashby, LinkedIn, Workday, SmartRecruiters, Indeed, BambooHR, and Custom Career Sites.

(function () {
  if (window.__jobpilot_copilot_initialized) return;
  window.__jobpilot_copilot_initialized = true;

  console.log("[JobPilot Copilot] Active on page:", window.location.href);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Sync Token from JobPilot Web App (localhost:3000)
  // ─────────────────────────────────────────────────────────────────────────────
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    const syncToken = () => {
      try {
        const token = localStorage.getItem("jobpilot_token");
        if (token) {
          chrome.storage.local.set({ jobpilot_token: token });
        }
      } catch (e) {}
    };

    syncToken();
    window.addEventListener("storage", (e) => {
      if (e.key === "jobpilot_token" && e.newValue) {
        chrome.storage.local.set({ jobpilot_token: e.newValue });
      }
    });
    // Also periodically sync in case of login without reload
    setInterval(syncToken, 3000);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ATS Detection
  // ─────────────────────────────────────────────────────────────────────────────
  function detectATS() {
    const host = window.location.hostname.toLowerCase();
    const url = window.location.href.toLowerCase();

    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("lever.co")) return "lever";
    if (host.includes("ashbyhq.com")) return "ashby";
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("workday") || host.includes("myworkdayjobs.com")) return "workday";
    if (host.includes("workable.com")) return "workable";
    if (host.includes("smartrecruiters.com")) return "smartrecruiters";
    if (host.includes("jobvite.com")) return "jobvite";
    if (host.includes("bamboohr.com")) return "bamboohr";
    if (host.includes("indeed.com")) return "indeed";

    if (url.includes("/job/") || url.includes("/jobs/") || url.includes("/career/") || url.includes("/careers/") || url.includes("/openings/")) {
      return "careers";
    }
    return "general";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Structured Job Details Extractor
  // ─────────────────────────────────────────────────────────────────────────────
  function extractJobDetails() {
    const ats = detectATS();
    let title = "";
    let company = "";
    let location = "Remote";
    let jdText = "";

    // Method A: Parse JSON-LD Schema (Industry Standard)
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const parsed = JSON.parse(script.innerText);
          const item = parsed["@type"] === "JobPosting" ? parsed : (Array.isArray(parsed["@graph"]) ? parsed["@graph"].find(x => x["@type"] === "JobPosting") : null);
          if (item) {
            if (item.title) title = item.title;
            if (item.hiringOrganization?.name) company = item.hiringOrganization.name;
            if (item.jobLocation?.address) {
              const addr = item.jobLocation.address;
              location = typeof addr === "string" ? addr : [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ");
            }
            if (item.description) {
              const temp = document.createElement("div");
              temp.innerHTML = item.description;
              jdText = temp.innerText.trim();
            }
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Method B: Platform-Specific Selectors
    if (!title || !company) {
      if (ats === "greenhouse") {
        title = title || document.querySelector(".app-title, h1.job-title, h1.app__title, #header h1, h1")?.innerText?.trim() || "";
        company = company || document.querySelector(".company-name, #header .company, .sub-title, .header__company-name")?.innerText?.trim() || "";
        location = location !== "Remote" ? location : (document.querySelector(".location, .body--metadata, .app__location")?.innerText?.trim() || "Remote");
        jdText = jdText || document.querySelector("#content, #job-description, .content, .app__description")?.innerText?.trim() || "";
      } else if (ats === "lever") {
        title = title || document.querySelector(".posting-headline h2, .posting-title, h2")?.innerText?.trim() || "";
        company = company || document.querySelector(".main-header-logo img")?.alt || document.title.split("-")[1]?.trim() || "";
        location = location !== "Remote" ? location : (document.querySelector(".posting-categories .location")?.innerText?.trim() || "Remote");
        jdText = jdText || document.querySelector(".section-wrapper, .posting-page, [data-qa='job-description']")?.innerText?.trim() || "";
      } else if (ats === "ashby") {
        title = title || document.querySelector("h1, .ashby-job-posting-heading, [data-testid='job-title']")?.innerText?.trim() || "";
        company = company || document.querySelector("[data-testid='company-name']")?.innerText?.trim() || document.title.split("-")[0]?.trim() || "";
        location = location !== "Remote" ? location : (document.querySelector(".ashby-job-posting-brief-info, [class*='location']")?.innerText?.trim() || "Remote");
        jdText = jdText || document.querySelector(".ashby-job-posting-description, [class*='description']")?.innerText?.trim() || "";
      } else if (ats === "linkedin") {
        title = title || document.querySelector(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.topcard__title, h1")?.innerText?.trim() || "";
        company = company || document.querySelector(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .topcard__org-name-link")?.innerText?.trim() || "";
        location = location !== "Remote" ? location : (document.querySelector(".job-details-jobs-unified-top-card__primary-description-container, .topcard__flavor--bullet")?.innerText?.trim() || "Remote");
        jdText = jdText || document.querySelector("#job-details, .jobs-description__content, .show-more-less-html__markup")?.innerText?.trim() || "";
      } else if (ats === "workday") {
        title = title || document.querySelector("[data-automation-id='jobPostingHeader'], h2[data-automation-id='jobTitle']")?.innerText?.trim() || "";
        company = company || document.querySelector("[data-automation-id='companyName']")?.innerText?.trim() || "";
        location = location !== "Remote" ? location : (document.querySelector("[data-automation-id='jobPostingLocation']")?.innerText?.trim() || "Remote");
        jdText = jdText || document.querySelector("[data-automation-id='jobPostingDescription']")?.innerText?.trim() || "";
      }
    }

    // Method C: OpenGraph & General Meta Tag Fallbacks
    if (!title) {
      title = document.querySelector('meta[property="og:title"]')?.content ||
              document.querySelector('meta[name="twitter:title"]')?.content ||
              document.querySelector("h1")?.innerText?.trim() ||
              document.title;
    }

    if (!company) {
      company = document.querySelector('meta[property="og:site_name"]')?.content ||
                document.querySelector('meta[name="author"]')?.content ||
                document.title.split(/[-|–]/)[0]?.trim() ||
                window.location.hostname.replace(/^(www\.|jobs\.|careers\.)/, "").split(".")[0];
      if (company && company.length < 30) {
        company = company.charAt(0).toUpperCase() + company.slice(1);
      }
    }

    if (!jdText) {
      jdText = document.querySelector("main, article, [role='main'], #job-description, .job-description, body")?.innerText?.slice(0, 4000) || "";
    }

    return {
      atsType: ats,
      title: (title || document.title || "Job Posting").replace(/\s+/g, " ").trim(),
      company: (company || "Company").replace(/\s+/g, " ").trim(),
      location: (location || "Remote").replace(/\s+/g, " ").trim(),
      jdText: jdText.replace(/\s+/g, " ").trim(),
      url: window.location.href,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Reliable Reactive Field Value Setter
  // ─────────────────────────────────────────────────────────────────────────────
  function setNativeValue(element, value) {
    if (!element || value == null) return;
    try {
      const isInput = element instanceof HTMLInputElement;
      const isTextArea = element instanceof HTMLTextAreaElement;
      const isSelect = element instanceof HTMLSelectElement;

      if (isSelect) {
        // Dropdown selection matching
        const valStr = String(value).toLowerCase();
        let matched = false;
        for (let i = 0; i < element.options.length; i++) {
          const opt = element.options[i];
          const optText = (opt.text || "").toLowerCase();
          const optVal = (opt.value || "").toLowerCase();
          if (optText.includes(valStr) || optVal === valStr) {
            element.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched && (valStr === "yes" || valStr === "1")) {
          // Find affirmative option
          for (let i = 0; i < element.options.length; i++) {
            if (element.options[i].text.toLowerCase().includes("yes")) {
              element.selectedIndex = i;
              break;
            }
          }
        }
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      const prototype = isInput ? HTMLInputElement.prototype : (isTextArea ? HTMLTextAreaElement.prototype : Object.getPrototypeOf(element));
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

      if (valueSetter) {
        valueSetter.call(element, value);
      } else {
        element.value = value;
      }

      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (e) {
      try {
        element.value = value;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (err) {}
    }
  }

  // Extracts dedicated field text without whole-form container leakage
  function getFieldLabelText(el) {
    const parts = [];

    // 1. Direct label[for="id"]
    if (el.id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) parts.push(lbl.innerText);
      } catch (e) {}
    }

    // 2. Direct parent <label>
    const parentLabel = el.closest("label");
    if (parentLabel) parts.push(parentLabel.innerText);

    // 3. Label within immediate parent container (ONLY if container has <= 2 inputs to prevent whole-form leakage)
    const container = el.parentElement;
    if (container && container.querySelectorAll("input, select, textarea").length <= 2) {
      const siblingLabel = container.querySelector("label, [class*='label'], .title, legend");
      if (siblingLabel) parts.push(siblingLabel.innerText);
    }

    // 4. Input attributes
    if (el.placeholder) parts.push(el.placeholder);
    if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
    if (el.name) parts.push(el.name);
    if (el.id) parts.push(el.id);
    if (el.getAttribute("autocomplete")) parts.push(el.getAttribute("autocomplete"));
    if (el.getAttribute("data-automation-id")) parts.push(el.getAttribute("data-automation-id"));

    return parts.join(" ").toLowerCase();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Intelligent Multi-Field Form Auto-Filler
  // ─────────────────────────────────────────────────────────────────────────────
  function autofillPage(profile) {
    if (!profile) {
      console.warn("[JobPilot Copilot] No user profile provided for autofill.");
      return 0;
    }

    const contact = profile.contact_info || {};
    const fullName = (contact.full_name || "").trim();
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
    const email = contact.email || "";
    const phone = contact.phone || "";
    const location = contact.location || "Bengaluru, India";
    const linkedin = contact.linkedin || "";
    const github = contact.github || "";
    const website = contact.portfolio || github || linkedin;
    const summary = profile.summary || "";
    const currentCompany = profile.experience?.[0]?.company || "";
    const currentTitle = profile.experience?.[0]?.title || "";
    const school = profile.education?.[0]?.institution || "";
    const degree = profile.education?.[0]?.degree || "";

    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select"));
    let filledCount = 0;
    const filledElements = new Set();

    const FIELD_RULES = [
      {
        patterns: [/\bfirst\s*name\b/i, /\bgiven\s*name\b/i, /^first_name$/i, /^firstname$/i, /fname/i],
        value: firstName,
      },
      {
        patterns: [/\blast\s*name\b/i, /\bfamily\s*name\b/i, /\bsurname\b/i, /^last_name$/i, /^lastname$/i, /lname/i],
        value: lastName,
      },
      {
        patterns: [/\bfull\s*name\b/i, /\bcandidate\s*name\b/i, /\byour\s*name\b/i, /^name$/i],
        value: fullName,
        condition: () => !Array.from(filledElements).some(el => el.name?.includes("first") || el.id?.includes("first")),
      },
      {
        patterns: [/\be-?mail\b/i],
        value: email,
      },
      {
        patterns: [/\bphone\b/i, /\bmobile\b/i, /\btelephone\b/i, /\bcontact\s*number\b/i],
        value: phone,
      },
      {
        patterns: [/\blinked\s*in\b/i],
        value: linkedin,
      },
      {
        patterns: [/\bgit\s*hub\b/i],
        value: github,
      },
      {
        patterns: [/\bportfolio\b/i, /\bwebsite\b/i, /\bpersonal\s*(?:site|url|link)\b/i, /\bother\s*website\b/i],
        value: website,
      },
      {
        patterns: [/\bcity\b/i, /\blocation\b/i, /\bcurrent\s*location\b/i, /\baddress\b/i],
        value: location,
      },
      {
        patterns: [/\bcurrent\s*company\b/i, /\bcurrent\s*employer\b/i, /\bmost\s*recent\s*company\b/i, /^org$/i],
        value: currentCompany,
      },
      {
        patterns: [/\bcurrent\s*(?:job\s*)?title\b/i, /\bcurrent\s*role\b/i],
        value: currentTitle,
      },
      {
        patterns: [/\buniversity\b/i, /\bcollege\b/i, /\bschool\b/i, /\binstitution\b/i],
        value: school,
      },
      {
        patterns: [/\bdegree\b/i, /\bqualification\b/i],
        value: degree,
      },
      {
        patterns: [/\bcover\s*letter\b/i, /\bsummary\b/i, /\badditional\s*info/i, /\bcomments\b/i],
        value: summary,
      },
    ];

    // Pass 1: Fill text inputs, textareas, and selects based on field rules
    for (const rule of FIELD_RULES) {
      if (!rule.value) continue;
      if (rule.condition && !rule.condition()) continue;

      for (const el of inputs) {
        if (filledElements.has(el)) continue;
        if (el.value && el.value.trim().length > 0) continue;

        const labelText = getFieldLabelText(el);
        const matches = rule.patterns.some(p => p.test(labelText));

        if (matches) {
          setNativeValue(el, rule.value);
          filledElements.add(el);
          filledCount++;
          break;
        }
      }
    }

    // Pass 2: Work Authorization & Visa Sponsorship Radios / Checkboxes
    try {
      const radios = document.querySelectorAll("input[type='radio'], input[type='checkbox']");
      for (const radio of radios) {
        const parent = radio.closest("fieldset, .field, [class*='question'], [class*='field'], tr, div");
        if (!parent) continue;
        const qText = parent.innerText.toLowerCase();

        // Legal authorization to work in country
        if (qText.includes("authorized to work") || qText.includes("legally authorized") || qText.includes("right to work") || qText.includes("18 years of age")) {
          const radioLabel = (radio.labels?.[0]?.innerText || radio.parentElement?.innerText || radio.value || "").toLowerCase();
          if (radioLabel.includes("yes") && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event("change", { bubbles: true }));
            filledCount++;
          }
        }

        // Future visa sponsorship
        if (qText.includes("require sponsorship") || qText.includes("visa sponsorship") || qText.includes("sponsorship in the future")) {
          const radioLabel = (radio.labels?.[0]?.innerText || radio.parentElement?.innerText || radio.value || "").toLowerCase();
          if (radioLabel.includes("no") && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event("change", { bubbles: true }));
            filledCount++;
          }
        }
      }
    } catch (e) {}

    console.log(`[JobPilot Copilot] Auto-filled ${filledCount} fields.`);
    return filledCount;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Floating In-Page Widget (Pill Button)
  // ─────────────────────────────────────────────────────────────────────────────
  function injectFloatingPill() {
    if (document.getElementById("jobpilot-floating-widget")) return;

    // Don't show on JobPilot internal web app itself
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

    // Check if current page is relevant (job posting, application form, or ATS)
    const ats = detectATS();
    const hasJobUrl = window.location.href.includes("job") || window.location.href.includes("career");
    const hasFormFields = !!document.querySelector("input[name*='name'], input[type='email'], #first_name, #email, .app-title, .job-title");

    if (ats === "general" && !hasJobUrl && !hasFormFields) return;

    const widget = document.createElement("div");
    widget.id = "jobpilot-floating-widget";
    widget.innerHTML = `
      <div class="jp-pill" id="jp-pill-container">
        <div class="jp-pill-logo" title="JobPilot Copilot Active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </div>
        <span class="jp-pill-title">JobPilot</span>
        <button id="jp-clip-btn" class="jp-pill-btn-secondary" title="Clip and score this job to your JobPilot pipeline">
          <span>📌 Clip</span>
        </button>
        <button id="jp-autofill-btn" class="jp-pill-btn-primary" title="Autofill this application form with your Master Profile">
          <span>⚡ Auto-Fill</span>
        </button>
        <button id="jp-close-btn" class="jp-pill-close" title="Dismiss widget">✕</button>
      </div>
    `;

    document.body.appendChild(widget);

    // Dismiss
    document.getElementById("jp-close-btn")?.addEventListener("click", () => {
      widget.remove();
    });

    // 1-Click Clip
    document.getElementById("jp-clip-btn")?.addEventListener("click", () => {
      const btn = document.getElementById("jp-clip-btn");
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = "⏳ Clipping...";

      const details = extractJobDetails();
      const payload = {
        company_name: details.company,
        title: details.title,
        location: details.location,
        workplace_type: "Remote",
        job_type: "Full-time",
        jd_text: details.jdText,
        apply_url: details.url,
      };

      chrome.runtime.sendMessage({ action: "CLIP_JOB_POSTING", payload }, (res) => {
        if (res && res.success) {
          btn.textContent = `✓ Saved (${res.score}% Fit)`;
          btn.style.background = "#10b981";
        } else {
          btn.textContent = "⚠ Login Needed";
          btn.title = res?.error || "Please log in at localhost:3000";
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "📌 Clip";
          }, 3000);
        }
      });
    });

    // 1-Click Auto-Fill
    document.getElementById("jp-autofill-btn")?.addEventListener("click", () => {
      const btn = document.getElementById("jp-autofill-btn");
      if (!btn) return;
      btn.textContent = "⏳ Filling...";

      chrome.runtime.sendMessage({ action: "FETCH_LATEST_PROFILE" }, (res) => {
        const profile = res?.profile;
        if (!profile) {
          btn.textContent = "⚠ Login Needed";
          setTimeout(() => { btn.textContent = "⚡ Auto-Fill"; }, 3000);
          return;
        }

        const count = autofillPage(profile);
        btn.textContent = count > 0 ? `✓ Filled ${count}` : "No Fields Found";
        setTimeout(() => { btn.textContent = "⚡ Auto-Fill"; }, 3000);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Dynamic Observer for Single Page Applications (LinkedIn, Ashby, Workday)
  // ─────────────────────────────────────────────────────────────────────────────
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectFloatingPill, 600);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(injectFloatingPill, 800);

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Message Listener from Extension Popup
  // ─────────────────────────────────────────────────────────────────────────────
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
})();
