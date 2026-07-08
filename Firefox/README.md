# Youtube Smooth (Firefox Extension)

A lightweight, single-purpose Firefox extension built on **Manifest V2** to declutter the YouTube viewing interface and provide a clean, distraction-free environment. 

This utility runs entirely in your browser using local CSS injection and DOM observers to customize your YouTube interface in real-time.

---

## 🚀 Key Features (Modular Toggles)

You can customize your layout by toggling separate focus modes directly from the toolbar popup panel:

1.  **Block Ads & Sponsored Promos**:
    *   Hides commercial layout clutter including homepage masthead ads, in-feed banners, search ads, sidebar promotions, and sponsored tags.
    *   Bypasses video ad overlays and programmatically skips video pre-rolls/mid-rolls instantly (with a 4-layer backup skipper that mutes and plays ads at 16x speed).
2.  **Block Shorts**:
    *   Removes vertical Shorts video shelves and recommendation grids from the Homepage, Subscriptions, and Search Results.
    *   Hides "Shorts" links from the main sidebar, mini collapsed sidebar, and channel page tabs.
    *   Automatically redirects short-form vertical `/shorts/` video links to YouTube's standard watch page player.
3.  **Block Posts**:
    *   Filters out social/community posts and backstage text/image updates from your subscription and home screen layout, keeping the focus entirely on video releases.
4.  **Background Play (Focus Mode)**:
    *   Overrides the browser Page Visibility API so that video audio keeps playing seamlessly when Firefox is minimized, you switch tabs, or lock your screen.

---

## 🛠️ File Structure

The Firefox extension uses the following architecture:

*   **`manifest.json`** — The Manifest V2 configuration defining action overrides, permissions, and matching host rules for Gecko.
*   **`content/`** — Script injections running directly on YouTube pages:
    *   `content.css` — High-performance style declarations to hide unwanted layout elements.
    *   `content.js` — Core controller (runs in the browser's `ISOLATED` world) to toggle CSS classes, handle page redirects, and perform ad skipping and background play overrides.
*   **`popup/`** — The toolbar customization interface:
    *   `popup.html` — Sleek dark-mode settings panel using YouTube-inspired styles.
    *   `popup.css` — Modern styling and animations for the toggle switches.
    *   `popup.js` — Handles loading and saving your preferences to storage.
*   **`icons/`** — High-quality extension branding and developer logo assets.

---

## 💻 Local Installation (For Development / Testing)

1.  Clone or download this repository.
2.  Open **Firefox**.
3.  Type **`about:debugging`** in the URL address bar and press **Enter**.
4.  Click **This Firefox** in the left sidebar menu.
5.  Click the **Load Temporary Add-on...** button in the top-right.
6.  Navigate to your local repository directory, open the **`Firefox/`** folder, and select the **`manifest.json`** file.
7.  The **Youtube Smooth** icon will appear in your extensions list. Pin it to your toolbar for easy access.

---

## 🔒 User Data & Privacy Practices

*   **Zero Data Collection**: This extension does not collect, record, process, or transmit any user data, web history, analytics, or personally identifiable information (PII).
*   **Local Storage Only**: Your preferences are saved strictly on your local machine using the standard `browser.storage.local` API.
*   **No Third-Party Sharing**: No data is sent over the network. Your configurations and layout adjustments remain entirely private.
