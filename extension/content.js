// JobPilot Content Script — Advanced ATS Job Scraper & Form Auto-Filler
// Supports: Greenhouse, Lever, Ashby, LinkedIn, Workday, SmartRecruiters, Indeed, BambooHR, and Custom Career Sites.

(function () {
  // Prevent duplicate script execution
  if (window.__jobpilot_copilot_initialized) return;
  window.__jobpilot_copilot_initialized = true;

  console.log("JobPilot Copilot v1.1.0 loaded.");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ATS Detection
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

    // Generic career portal checks
    if (url.includes("/job/") || url.includes("/jobs/") || url.includes("/career/") || url.includes("/careers/") || url.includes("/openings/")) {
      return "careers";
    }
    return "general";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Structured Job Details Extractor
  // ─────────────────────────────────────────────────────────────────────────────
  function extractJobDetails() {
    const ats = detectATS();
    let title = "";
    let company = "";
    let location = "Remote";
    let jdText = "";

    // ── Method A: Parse JSON-LD Schema (Industry Standard for JobPostings) ──
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

    // ── Method B: Platform-Specific Selectors ────────────────────────────────
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

    // ── Method C: OpenGraph & General Meta Tag Fallbacks ─────────────────────
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
      // Capitalize company name cleanly
      if (company && company.length < 30) {
        company = company.charAt(0).toUpperCase() + company.slice(1);
      }
    }

    if (!jdText) {
      jdText = document.querySelector("main, article, [role='main'], #job-description, .job-description, body")?.innerText?.slice(0, 4000) || "";
    }

    return {
      atsType: ats,
      title: (title || document.title || "Software Engineer").replace(/\s+/g, " ").trim(),
      company: (company || "Company").replace(/\s+/g, " ").trim(),
      location: (location || "Remote").replace(/\s+/g, " ").trim(),
      jdText: jdText.replace(/\s+/g, " ").trim(),
      url: window.location.href,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Ultra-Robust Form Auto-Filler
  // ─────────────────────────────────────────────────────────────────────────────
  function setNativeValue(element, value) {
    if (!element || value == null) return;
    try {
      const isInput = element instanceof HTMLInputElement;
      const isTextArea = element instanceof HTMLTextAreaElement;
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

  function autofillPage(profile) {
    const contact = profile?.contact_info || {};
    const fullName = contact.full_name || "Candidate";
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
    const email = contact.email || "";
    const phone = contact.phone || "";
    const location = contact.location || "Bengaluru, India";
    const linkedin = contact.linkedin || "";
    const github = contact.github || "";
    const website = contact.portfolio || github || linkedin;
    const summary = profile?.summary || "";

    let filledCount = 0;
    const filledElements = new Set();

    // Helper: Find input elements by checking label text, name, id, placeholder, and aria-label
    function findInput(keywords, typeCheck = null) {
      const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea"));

      for (const input of inputs) {
        if (filledElements.has(input) || (input.value && input.value.trim().length > 0)) continue;

        if (typeCheck && input.type !== typeCheck && typeCheck !== "text") continue;

        // 1. Check ID, name, placeholder, aria-label
        const attrs = [
          input.id,
          input.name,
          input.placeholder,
          input.getAttribute("aria-label"),
          input.getAttribute("autocomplete"),
          input.getAttribute("data-automation-id")
        ].filter(Boolean).map(s => s.toLowerCase());

        // 2. Check associated label
        let labelText = "";
        if (input.id) {
          const lbl = document.querySelector(`label[for="${input.id}"]`);
          if (lbl) labelText += " " + lbl.innerText;
        }
        const parentLabel = input.closest("label, .field, .form-group, [class*='field'], [class*='question']");
        if (parentLabel) labelText += " " + parentLabel.innerText;

        const combined = attrs.join(" ") + " " + labelText.toLowerCase();

        for (const kw of keywords) {
          if (combined.includes(kw.toLowerCase())) {
            return input;
          }
        }
      }
      return null;
    }

    function fillField(keywords, value, typeCheck = null) {
      if (!value) return;
      const el = findInput(keywords, typeCheck);
      if (el) {
        setNativeValue(el, value);
        filledElements.add(el);
        filledCount++;
      }
    }

    // ── Standard Identity & Contact Fields ──
    fillField(["first_name", "firstname", "first name", "given name", "given-name"], firstName);
    fillField(["last_name", "lastname", "last name", "family name", "surname", "family-name"], lastName);

    // Full name fallback if separate fields weren't matched
    if (!filledElements.size || Array.from(filledElements).every(el => !el.name?.includes("first"))) {
      fillField(["full_name", "fullname", "full name", "your name", "candidate name", "name"], fullName);
    }

    fillField(["email", "e-mail", "email address"], email, "email");
    fillField(["phone", "telephone", "mobile", "contact number", "phone number"], phone, "tel");

    // ── Location & Address ──
    fillField(["location", "city", "current city", "address", "current location"], location);

    // ── Online Links / Socials ──
    fillField(["linkedin", "linked in", "linkedin profile", "linkedin url"], linkedin);
    fillField(["github", "git hub", "github url", "github profile"], github);
    fillField(["portfolio", "website", "personal website", "portfolio url", "personal link", "other website"], website);

    // ── Cover Letter / Summary / Comments ──
    if (summary) {
      fillField(["summary", "cover letter", "bio", "additional information", "comments", "notes"], summary);
    }

    // ── Work Authorization & Radio/Checkbox Questions ──
    try {
      const radioGroups = document.querySelectorAll("input[type='radio'], input[type='checkbox']");
      for (const radio of radioGroups) {
        const parent = radio.closest("fieldset, .field, .question, [class*='question'], div");
        if (!parent) continue;
        const qText = parent.innerText.toLowerCase();

        // Question: Are you authorized to work in India / this country?
        if (qText.includes("authorized to work") || qText.includes("legally authorized") || qText.includes("right to work") || qText.includes("18 years of age")) {
          const radioLabel = (radio.labels?.[0]?.innerText || radio.parentElement?.innerText || radio.value || "").toLowerCase();
          if (radioLabel.includes("yes") && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event("change", { bubbles: true }));
            filledCount++;
          }
        }

        // Question: Will you require visa sponsorship?
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

    return filledCount;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Floating Action Widget (Glassmorphic In-Page Pill)
  // ─────────────────────────────────────────────────────────────────────────────
  function injectFloatingPill() {
    if (document.getElementById("jobpilot-floating-widget")) return;

    // Check if current page looks like a job or application form
    const isJobPage = detectATS() !== "general" ||
                      window.location.href.includes("job") ||
                      window.location.href.includes("career") ||
                      document.querySelector("input[name*='name'], input[type='email'], #first_name, .app-title, .job-title");

    if (!isJobPage) return;

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
        <button id="jp-close-btn" class="jp-pill-close" title="Dismiss widget on this page">✕</button>
      </div>
    `;

    document.body.appendChild(widget);

    // Close button
    document.getElementById("jp-close-btn")?.addEventListener("click", () => {
      widget.remove();
    });

    // In-page 1-Click Clip button
    document.getElementById("jp-clip-btn")?.addEventListener("click", async () => {
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
          btn.title = res?.error || "Please log in to JobPilot";
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "📌 Clip";
          }, 3000);
        }
      });
    });

    // In-page 1-Click Auto-Fill button
    document.getElementById("jp-autofill-btn")?.addEventListener("click", async () => {
      const btn = document.getElementById("jp-autofill-btn");
      if (!btn) return;
      btn.textContent = "⏳ Filling...";

      // Retrieve cached or latest user profile
      chrome.runtime.sendMessage({ action: "FETCH_LATEST_PROFILE" }, (res) => {
        const profile = res?.profile;
        const count = autofillPage(profile);
        btn.textContent = `✓ Filled ${count}`;
        setTimeout(() => {
          btn.textContent = "⚡ Auto-Fill";
        }, 3000);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Message Listener from Extension Popup
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

  // Inject widget after initial DOM settle
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(injectFloatingPill, 1000));
  } else {
    setTimeout(injectFloatingPill, 1000);
  }
})();
