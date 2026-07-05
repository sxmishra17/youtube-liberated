# YouTube Liberated (Chrome Extension)

A lightweight, single-purpose Chrome extension built on **Manifest V3** to declutter the YouTube viewing interface and provide a clean, distraction-free environment. 

This utility runs entirely in your browser using local CSS injection and DOM observers to customize your YouTube interface in real-time.

---

## 🚀 Key Features (Modular Toggles)

You can customize your layout by toggling five separate focus modes directly from the toolbar popup panel:

1.  **Block Ads & Sponsored Promos**:
    *   Hides commercial layout clutter including homepage masthead ads, in-feed banners, search ads, sidebar promotions, and sponsored tags.
    *   Bypasses video ad overlays and programmatically skips video pre-rolls/mid-rolls instantly (with a 4-layer backup skipper that mutes and plays ads at 16x speed).
2.  **Block Shorts**:
    *   Removes vertical Shorts video shelves and recommendation grids from the Homepage, Subscriptions, and Search Results.
    *   Hides "Shorts" links from the main sidebar, mini collapsed sidebar, and channel page tabs.
    *   Automatically redirects short-form vertical `/shorts/` video links to YouTube's standard watch page player.
3.  **Block Posts**:
    *   Filters out social/community posts and backstage text/image updates from your subscription and home screen layout, keeping the focus entirely on video releases.
4.  **Block Games (Playables)**:
    *   Hides the YouTube Playables/mini-games shelves, grids, and sidebar navigation entries to prevent distractions.
5.  **Background Play (Focus Mode)**:
    *   Overrides the browser Page Visibility API so that video audio keeps playing seamlessly when Chrome is minimized, you switch tabs, or lock your screen.

---

## 🛠️ File Structure

The Chrome extension uses the following architecture:

*   **`manifest.json`** — The Manifest V3 configuration defining action overrides, permissions, and matching host rules.
*   **`content/`** — Script injections running directly on YouTube pages:
    *   `content.css` — High-performance style declarations to hide unwanted layout elements.
    *   `content.js` — Core controller (runs in the browser's `ISOLATED` world) to toggle CSS classes, handle page redirects, and communicate toggle states.
    *   `inject.js` — Native override script (runs in the page's `MAIN` world) to safely bypass the Page Visibility API for background playback.
*   **`popup/`** — The toolbar customization interface:
    *   `popup.html` — Sleek dark-mode settings panel using YouTube-inspired styles.
    *   `popup.css` — Modern styling and animations for the toggle switches.
    *   `popup.js` — Handles loading and saving your preferences to storage.
*   **`icons/`** — High-quality extension branding and developer logo assets.
*   **`screenshots/`** — Standardized 1280x800 and 440x280 store assets.

---

## 💻 Local Installation (For Development / Testing)

1.  Clone or download this repository.
2.  Open **Google Chrome** and navigate to `chrome://extensions/`.
3.  In the top-right corner, toggle the **Developer mode** switch to **ON**.
4.  Click the **Load unpacked** button in the top-left corner.
5.  Select the **`Chrome/`** folder containing the `manifest.json` file.
6.  The **YouTube Liberated** icon will appear in your extensions list. Pin it to your toolbar for easy access.

---

## 🔒 User Data & Privacy Practices

*   **Zero Data Collection**: This extension does not collect, record, process, or transmit any user data, web history, analytics, or personally identifiable information (PII).
*   **Local Storage Only**: Your preferences are saved strictly on your local machine using the standard `chrome.storage.local` API.
*   **No Third-Party Sharing**: No data is sent over the network. Your configurations and layout adjustments remain entirely private.
