# YouTube Liberated

A lightweight, minimal Firefox extension to block YouTube ads, Shorts, Community Posts, and play audio in the background with independent toggle controls.

---

## 🚀 How to Install and Use (Temporary Installation)

Because Firefox requires signed extensions for permanent installation by default, the easiest way to run and test this extension is using Firefox's built-in developer tools:

1. Open **Firefox**.
2. Type **`about:debugging`** in the address bar and press **Enter**.
3. Click **"This Firefox"** in the left sidebar menu.
4. Click the **"Load Temporary Add-on..."** button.
5. In the file explorer, navigate to this folder (`YT_ads_shorts/`) and select the **`manifest.json`** file.
6. The extension is now loaded! You will see a shield icon (**🛡️**) in your Firefox toolbar.
7. Click the **🛡️** icon to toggle the **Ads Blocker**, **Shorts Blocker**, and **Posts Blocker** ON or OFF independently.

---

## 🛠️ File Structure

This extension consists of the following components:

- **`manifest.json`** — The WebExtension manifest that tells Firefox what permissions are required and which scripts to load.
- **`popup/`** — The extension toolbar popup UI:
  - **`popup.html`** — The visual layout containing the three toggle switches.
  - **`popup.css`** — Sleek dark theme styling, resembling YouTube's own interface.
  - **`popup.js`** — Handles reading/writing user preference states in browser storage.
- **`content/`** — Script injectors running directly on YouTube pages:
  - **`content.css`** — CSS rules that hide ad banners, promos, Shorts sections, and Community Posts instantly.
  - **`content.js`** — JavaScript that handles configuration class injection, auto-clicks ad skip buttons, fast-forwards through video advertisements, and redirects Shorts URLs.
- **`icons/`** — Extension icons (48x48 and 96x96 pixels).

---

## 💡 How It Works Under the Hood

### 1. Instant CSS Hiding (No Flicker)
When you enable the blocker settings, the content script attaches classes `yt-block-ads`, `yt-block-shorts`, and `yt-block-posts` to the root `<html>` element of the page. The injected `content.css` hides matching selectors:
- **Ads blocker**: Hides homepage banners, feed ads, search ads, sidebar promotions, and video player overlay ads.
- **Shorts blocker**: Hides home screen shelves, sidebar navigation items, search shelf containers, and video channel tabs.
- **Posts blocker**: Hides Community feed posts, text/image update shelves, and their grid cells to prevent blank slots.

### 2. JavaScript Skipping (Pre-roll & Mid-roll Ads)
For video ads that CSS cannot easily block without breaking player functionality, `content.js` uses a fast, debounced `MutationObserver`:
- **Auto-Clicking**: Detects and programmatically clicks the "Skip Ad" button as soon as it appears.
- **Fast-Forward & Mute**: When an ad segment is active, the video is instantly muted and its playback speed is boosted to `16x` (the browser limit), skipping to the end in a fraction of a second.
- **Performance Optimized**: The observer checks for ad containers asynchronously and is debounced to run at most once every 100ms. It has **zero effect** on video streaming, page load times, or general tab responsiveness.

### 3. Shorts Redirections
When the Shorts blocker is active, visiting any URL starting with `/shorts/` will parse the video identifier and immediately redirect your page to `/watch?v=VIDEO_ID`. This forces YouTube to play the Shorts video inside the standard, feature-rich player instead of the vertical swipe-feed.

---

## ⚠️ Notes for Maintenance

YouTube's layout updates frequently. If you notice ads, Shorts sections, or Community Posts slipping through, you can inspect the elements and update the CSS selectors in [content.css](content/content.css) or the skipping selectors in [content.js](content/content.js).
