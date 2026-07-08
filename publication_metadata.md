# Chrome Web Store Publication Metadata

Below is the structured metadata, optimized descriptions, and asset list required to publish **Youtube Smooth** to the Chrome Web Store.

---

## 📋 Basic Listing Information

### 🏷️ Extension Name
```text
Youtube Smooth
```

### ✍️ Short Description (Max 150 characters)
*Must explicitly declare a single, narrow purpose to pass the automated store policy check.*
```text
Declutter the YouTube interface for a distraction-free viewing experience by toggling off ads, Shorts, community posts, and Playables.
```

---

## 📝 Detailed Description
*Aligned with Chrome Web Store's Single Purpose Policy. It describes all features as parts of a single, unified utility: interface decluttering.*

```text
Youtube Smooth is a single-purpose utility designed to declutter the YouTube viewing interface, allowing you to create a clean, distraction-free layout tailored to your needs. 

By running ultra-lightweight CSS layout adjustments, Youtube Smooth removes modern interface clutter and non-video feed distractions. Users can modularly toggle which interface elements to hide directly from the extension's popup panel:

🧹 UNIFIED DECLUTTERING FEATURES:

1. Remove Commercial Clutter:
- Hides sidebar ads, homepage masthead banners, and sponsored tags.
- Bypasses video ad overlays and auto-skips video pre-rolls/mid-rolls to maintain a clean layout stream.

2. Hide Short-Form Video Shelves:
- Hides the "Shorts" navigation links in the sidebar, mini-guide, and channel tabs.
- Hides Shorts shelves/grids across the homepage, subscriptions feed, and search pages.
- Automatically redirects /shorts/ video links to the standard, decluttered watch page.

3. Filter Social Feed Posts:
- Cleans up subscription and home feeds by hiding Community and Backstage posts.

4. Block Interactive Playables:
- Removes the Playables/mini-games shelves and links from the homepage, sidebar, and search results to focus entirely on video content.

5. Background Focus Mode:
- Overrides page visibility listeners so you can keep listening to video audio when the browser window is minimized or hidden, ensuring an uninterrupted background focus session.

🛠️ ON-THE-FLY INTERFACE CUSTOMIZATION:
Click the toolbar icon to access a minimal customization panel. Toggle any layout element ON or OFF in real-time. Changes are stored locally, persist across browser restarts, and take effect instantly without reloading the page.

🔒 PRIVACY & LIGHTWEIGHT DESIGN:
Youtube Smooth requires only "storage" permissions to save your custom layout preferences, and host permissions for youtube.com. It features no tracking, collects no user metrics, and uses pure CSS injection for maximum performance and a zero-latency browsing experience.
```

---

## 🗂️ Categorization & Tags

### 🏷️ Primary Category
```text
Productivity
```
*(Aligns perfectly with the single purpose of decluttering for productivity/focus.)*

### 🏷️ Secondary Category (Optional)
```text
Social & Communication
```

### 🔍 Search Tags / Keywords (Up to 5)
```text
declutter youtube, clean feed, remove shorts, hide playables, block ads
```

---

## 🔒 Permission Justifications
*Required in the "Privacy Practices" tab of the Chrome Developer Dashboard.*

### 🛡️ Storage Permission (`storage`)
```text
The storage permission is used exclusively to save the user's interface toggle preferences (Block Ads, Block Shorts, Block Posts, Block Games, and Background Play). Using chrome.storage.local allows these customization settings to persist locally on the user's machine across page reloads and browser sessions.
```

### 🌐 Host Permission
```text
None requested. The extension relies exclusively on static content script declarations in manifest.json to apply layout changes on YouTube, ensuring a minimal permissions footprint and speeding up store reviews.
```

---

## 💾 User Data & Data Usage Disclosures
*Required under the "Privacy Practices" -> "User Data Privacy" section.*

### 1. Data Collection Declaration
*In the list of checkbox categories (e.g., Personally Identifiable Info, Financial Info, Location, Web History):*
```text
Leave all categories UNCHECKED. 

Select: "No, I am not collecting or using user data."
```

### 2. Public Data Usage Justification / Disclosure
*This copy is displayed publicly on your item's Chrome Web Store details page under the Privacy tab:*
```text
Youtube Smooth is committed to absolute user privacy. The extension operates entirely client-side and does not collect, record, process, store, or transmit any user data, personally identifiable information (PII), browsing history, or analytics.

All user preferences (such as feature toggle selections) are stored locally on the user's own device using the standard chrome.storage.local API. No data is sent over the network to external servers or third-party entities. The extension uses host permissions exclusively to apply CSS styling rules and perform local DOM modifications on YouTube pages to deliver a distraction-free viewing layout.
```

### 3. Certification Disclosures (Required Checkboxes)
*You must check these declarations at the bottom of the form:*
```text
[Check] Establish that the data will not be sold to third parties.
[Check] Establish that the data will not be used or transferred for purposes that are unrelated to the item's core functionality.
[Check] Establish that the data will not be used or transferred to determine creditworthiness or for lending purposes.
```

---

## 🎨 Store Visual Assets Checklist

When uploading to the developer dashboard, you will need the following assets:

| Asset Type | Required Dimension | Description / Purpose |
|---|---|---|
| **Store Icon** | `128 x 128 px` | Provided inside the ZIP file: [icon-128.png](file:///c:/Satish_Files/YT_ads_shorts/Chrome/icons/icon-128.png) |
| **Screenshot 1** | `1280 x 800` or `640 x 400 px` | Showing YouTube homepage clean feed with ads/Shorts/Playables hidden. |
| **Screenshot 2** | `1280 x 800` or `640 x 400 px` | Showing the popup control panel showing toggles in action. |
| **Promotional Tile (Small)** | `440 x 280 px` | Graphic showing the extension logo and name for search promos. |
| **Promotional Tile (Large)** | `920 x 680 px` | (Optional) Used for featured slots on the home page of the store. |
| **Marquee Banner** | `1400 x 560 px` | (Optional) Used for top-level banner feature slots. |
