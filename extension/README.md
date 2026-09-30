# 🚀 JobPilot Copilot — Chrome Extension (Manifest V3)

> Autonomous 1-Click ATS Job Clipper & Application Auto-Filler for Google Chrome, Brave, and Edge.

---

## 🌟 Capabilities

1. **1-Click Job Clipping**: Automatically parses job title, company name, location, and full job description from Greenhouse, Lever, Ashby, LinkedIn, and custom company career pages.
2. **Instant Profile Scoring**: Automatically pushes clipped jobs to your JobPilot backend (`/api/v1/jobs/manual`), runs Gemini-powered ATS keyword matching, and scores compatibility.
3. **Smart Form Auto-Fill**: Injects candidate contact info (name, email, phone, LinkedIn, GitHub, portfolio) into ATS application forms with full synthetic input event dispatch.
4. **Floating In-Page Widget**: Subtle, high-tech glassmorphic pill button floating directly on active job application pages for instant 1-click execution.

---

## 📥 How to Install & Load Unpacked

1. Open Google Chrome, Brave, or Microsoft Edge.
2. Navigate to: `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Toggle on **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** in the top-left toolbar.
5. Select this folder:
   ```
   C:\Users\arjun\Desktop\job_pilot\extension
   ```
6. The **JobPilot Copilot** icon will appear in your browser toolbar!

---

## ⚙️ Configuration

- Ensure JobPilot backend is running on `http://localhost:8000` (or your cloud URL).
- Open the extension popup and verify the status badge reads **Connected**.
- You can provide your JWT token or log in through `http://localhost:3000`.
