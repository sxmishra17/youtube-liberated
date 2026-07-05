# Green YouTube — Android App Implementation Plan

> **App Name:** Green YouTube
> **Project Directory:** `Android_YT_block`
> **Language:** Kotlin (Android)
> **Build System:** Gradle (Kotlin DSL)
> **Min SDK:** 26 (Android 8.0 — required for Picture-in-Picture)
> **Target SDK:** 34 (Android 14)
> **Architecture:** WebView + JavaScript Injection + Foreground Service

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Project Setup](#2-project-setup)
3. [File Structure](#3-file-structure)
4. [Step-by-Step Implementation](#4-step-by-step-implementation)
   - Step 1: Project Initialization
   - Step 2: Android Manifest Configuration
   - Step 3: Main Activity (WebView Container)
   - Step 4: WebView Setup & YouTube Loading
   - Step 5: JavaScript Injection (Ad/Shorts/Posts Blocking)
   - Step 6: CSS Injection (Visual Element Hiding)
   - Step 7: Google Login & Cookie Persistence
   - Step 8: Background Audio Playback Service
   - Step 9: Media Notification Controls
   - Step 10: Picture-in-Picture Mode
   - Step 11: Settings Activity (Toggle Switches)
   - Step 12: App Theme, Icon, & Splash Screen
   - Step 13: Back Navigation & Deep Links
   - Step 14: Build, Sign & Distribute
5. [Legal & Distribution Notes](#5-legal--distribution-notes)

---

## 1. Overview & Architecture

Green YouTube is a standalone Android app that loads YouTube's mobile website (`m.youtube.com`) inside a full-screen WebView. By injecting custom CSS and JavaScript into the WebView, we can:

- **Block ads** (banner ads, video pre-roll/mid-roll ads, overlay ads)
- **Block Shorts** (hide Shorts shelves, redirect /shorts/ URLs to /watch/)
- **Block Community Posts** (hide post elements from feeds)
- **Enable background audio playback** (continue playing when app is minimized)

Since we load YouTube's actual mobile website with cookie persistence, the user gets the **full YouTube experience**: login with Google account, watch history, likes, subscriptions, comments, posting comments, playlists, and all settings — exactly like the official YouTube app.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Green YouTube App                  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              MainActivity                     │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │            WebView                      │  │   │
│  │  │  ┌──────────────────────────────────┐  │  │   │
│  │  │  │    m.youtube.com (Full Mobile)    │  │  │   │
│  │  │  │                                   │  │  │   │
│  │  │  │  + Injected CSS (blocking rules)  │  │  │   │
│  │  │  │  + Injected JS  (ad skipper,      │  │  │   │
│  │  │  │    shorts redirect, post hider)   │  │  │   │
│  │  │  └──────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │  SettingsActivity │  │  AudioPlaybackService   │  │
│  │  - Block Ads ☑    │  │  (Foreground Service)   │  │
│  │  - Block Shorts ☑ │  │  - Extracts audio URL   │  │
│  │  - Block Posts ☑  │  │  - MediaSession API     │  │
│  │  - BG Playback ☑  │  │  - Notification control │  │
│  └──────────────────┘  └─────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │           SharedPreferences                   │   │
│  │  blockAds=true, blockShorts=true,             │   │
│  │  blockPosts=true, bgPlayback=true             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Why WebView Instead of YouTube API?

| Approach | Pros | Cons |
|----------|------|------|
| **WebView (chosen)** | Full YouTube experience, login, comments, history, likes, playlists — everything works automatically | Dependent on YouTube's mobile web layout |
| YouTube Data API v3 | Official API | No video playback, no comments posting, extremely limited, requires API key, quota limits |
| Reverse-engineer YouTube | Full control | Illegal, breaks constantly, enormous effort |

**WebView is the correct choice** because the user wants "same as YouTube app" functionality.

---

## 2. Project Setup

### Prerequisites
- Android Studio (latest stable, e.g., Hedgehog or Ladybug)
- JDK 17+
- Kotlin 1.9+
- Gradle 8.x

### Create Project
```bash
# In Android Studio:
# File → New → New Project → Empty Activity
# Name: Green YouTube
# Package: com.greenyt.app
# Language: Kotlin
# Minimum SDK: API 26 (Android 8.0)
# Build configuration language: Kotlin DSL (build.gradle.kts)
```

---

## 3. File Structure

Below is the complete file tree for the `Android_YT_block` project. Every file is listed with its purpose.

```
Android_YT_block/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/greenyt/app/
│   │   │   │   ├── MainActivity.kt              ← WebView container, JS/CSS injection
│   │   │   │   ├── SettingsActivity.kt           ← Toggle switches UI
│   │   │   │   ├── AudioPlaybackService.kt       ← Foreground service for background audio
│   │   │   │   ├── WebViewSetup.kt               ← WebView configuration helper
│   │   │   │   ├── JavaScriptBridge.kt           ← JS ↔ Kotlin communication interface
│   │   │   │   └── PreferenceManager.kt          ← SharedPreferences wrapper
│   │   │   │
│   │   │   ├── assets/
│   │   │   │   ├── inject_blocker.js             ← JavaScript injection script (blocking logic)
│   │   │   │   └── inject_blocker.css            ← CSS injection stylesheet (element hiding)
│   │   │   │
│   │   │   ├── res/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── activity_main.xml         ← Main layout (full-screen WebView)
│   │   │   │   │   └── activity_settings.xml     ← Settings layout (toggles + switches)
│   │   │   │   ├── menu/
│   │   │   │   │   └── main_menu.xml             ← Overflow menu (Settings, Refresh, etc.)
│   │   │   │   ├── drawable/
│   │   │   │   │   ├── ic_launcher_foreground.xml ← App icon foreground (green play button)
│   │   │   │   │   ├── ic_launcher_background.xml ← App icon background (green gradient)
│   │   │   │   │   ├── ic_play.xml               ← Play notification icon
│   │   │   │   │   ├── ic_pause.xml              ← Pause notification icon
│   │   │   │   │   ├── ic_skip_next.xml          ← Skip next notification icon
│   │   │   │   │   └── ic_skip_prev.xml          ← Skip previous notification icon
│   │   │   │   ├── values/
│   │   │   │   │   ├── strings.xml               ← App strings
│   │   │   │   │   ├── colors.xml                ← Green theme color palette
│   │   │   │   │   └── themes.xml                ← App theme (Material 3, green accent)
│   │   │   │   ├── values-night/
│   │   │   │   │   └── themes.xml                ← Dark mode theme
│   │   │   │   ├── xml/
│   │   │   │   │   ├── network_security_config.xml ← Allow YouTube HTTPS traffic
│   │   │   │   │   └── backup_rules.xml          ← Auto-backup rules
│   │   │   │   └── mipmap-xxxhdpi/               ← App launcher icons (all densities)
│   │   │   │
│   │   │   └── AndroidManifest.xml               ← Permissions, activities, services
│   │   │
│   │   └── test/                                  ← Unit tests (optional)
│   │
│   └── build.gradle.kts                           ← App-level Gradle config
│
├── build.gradle.kts                               ← Project-level Gradle config
├── settings.gradle.kts                            ← Gradle settings
└── gradle.properties                              ← Gradle properties
```

---

## 4. Step-by-Step Implementation

> **IMPORTANT FOR GEMINI FLASH:** Follow each step sequentially. Each step produces one or more files. Every code block includes the **complete file contents** — do not skip or abbreviate. Comments in the code explain every decision.

---

### Step 1: Project Initialization

**What to do:** Create a new Android project in Android Studio with the settings from Section 2.

**Key Gradle dependencies to add in `app/build.gradle.kts`:**

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.greenyt.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.greenyt.app"
        minSdk = 26          // Required for PiP mode
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.webkit:webkit:1.10.0")         // Modern WebView APIs
    implementation("androidx.media:media:1.7.0")            // MediaSession for notifications
    implementation("androidx.preference:preference-ktx:1.2.1") // Preferences
}
```

**Why each dependency:**
- `core-ktx` — Kotlin extensions for Android core APIs
- `appcompat` — Backward-compatible Activity, Toolbar, etc.
- `material` — Material Design 3 components (switches, cards, theming)
- `webkit` — Modern WebView APIs (ProxyConfig, SafeBrowsing, etc.)
- `media` — MediaSessionCompat for background playback notification controls
- `preference-ktx` — SharedPreferences Kotlin extensions

---

### Step 2: Android Manifest Configuration

**File:** `app/src/main/AndroidManifest.xml`

**What to include and why:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- ── PERMISSIONS ─────────────────────────────────────────────────── -->

    <!-- Internet access: required to load YouTube in WebView -->
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- Foreground service: required for background audio playback -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

    <!-- Wake lock: keeps CPU awake during background audio playback -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- Post notifications: required on Android 13+ for foreground service notification -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.GreenYouTube"
        android:networkSecurityConfig="@xml/network_security_config"
        android:usesCleartextTraffic="false"
        tools:targetApi="34">

        <!-- ── MAIN ACTIVITY ───────────────────────────────────────────── -->
        <!-- supportsPictureInPicture: enables PiP mode for video playback -->
        <!-- configChanges: prevents Activity restart on rotation/resize   -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|smallestScreenSize|screenLayout|keyboardHidden"
            android:supportsPictureInPicture="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Deep link handler: intercept youtube.com URLs -->
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="www.youtube.com" />
                <data android:scheme="https" android:host="m.youtube.com" />
                <data android:scheme="https" android:host="youtube.com" />
                <data android:scheme="https" android:host="youtu.be" />
            </intent-filter>
        </activity>

        <!-- ── SETTINGS ACTIVITY ───────────────────────────────────────── -->
        <activity
            android:name=".SettingsActivity"
            android:exported="false"
            android:label="@string/settings_title"
            android:parentActivityName=".MainActivity" />

        <!-- ── BACKGROUND AUDIO SERVICE ────────────────────────────────── -->
        <!-- foregroundServiceType="mediaPlayback" is required on Android 14+ -->
        <service
            android:name=".AudioPlaybackService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />

    </application>
</manifest>
```

**Key decisions explained:**
- `singleTask` launch mode prevents multiple instances of the app
- `configChanges` prevents WebView from reloading on rotation
- `supportsPictureInPicture="true"` enables floating video window
- Deep link `intent-filter` lets users open YouTube links directly in Green YouTube
- `foregroundServiceType="mediaPlayback"` is mandatory on Android 14+ for audio services

---

### Step 3: PreferenceManager (Settings Storage)

**File:** `app/src/main/java/com/greenyt/app/PreferenceManager.kt`

**Purpose:** A simple wrapper around SharedPreferences for reading/writing the four toggle settings. This is used by both the MainActivity and SettingsActivity.

**Implementation details:**

```kotlin
/**
 * PreferenceManager.kt
 *
 * Centralized settings storage for Green YouTube.
 * Wraps Android SharedPreferences with typed getters/setters.
 *
 * Settings stored:
 *   - blockAds (Boolean, default: true)     → Hide YouTube ad elements & skip video ads
 *   - blockShorts (Boolean, default: true)  → Hide Shorts shelves & redirect /shorts/ URLs
 *   - blockPosts (Boolean, default: true)   → Hide Community Posts from feeds
 *   - bgPlayback (Boolean, default: true)   → Allow audio to continue when app is minimized
 */
package com.greenyt.app

import android.content.Context
import android.content.SharedPreferences

class PreferenceManager(context: Context) {

    companion object {
        private const val PREFS_NAME = "green_yt_prefs"
        const val KEY_BLOCK_ADS = "blockAds"
        const val KEY_BLOCK_SHORTS = "blockShorts"
        const val KEY_BLOCK_POSTS = "blockPosts"
        const val KEY_BG_PLAYBACK = "bgPlayback"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var blockAds: Boolean
        get() = prefs.getBoolean(KEY_BLOCK_ADS, true)
        set(value) = prefs.edit().putBoolean(KEY_BLOCK_ADS, value).apply()

    var blockShorts: Boolean
        get() = prefs.getBoolean(KEY_BLOCK_SHORTS, true)
        set(value) = prefs.edit().putBoolean(KEY_BLOCK_SHORTS, value).apply()

    var blockPosts: Boolean
        get() = prefs.getBoolean(KEY_BLOCK_POSTS, true)
        set(value) = prefs.edit().putBoolean(KEY_BLOCK_POSTS, value).apply()

    var bgPlayback: Boolean
        get() = prefs.getBoolean(KEY_BG_PLAYBACK, true)
        set(value) = prefs.edit().putBoolean(KEY_BG_PLAYBACK, value).apply()
}
```

---

### Step 4: Main Activity (WebView Container)

**File:** `app/src/main/java/com/greenyt/app/MainActivity.kt`

**Purpose:** The main screen of the app. Contains a full-screen WebView that loads `m.youtube.com`. Handles:
- WebView configuration (JavaScript enabled, DOM storage, cookies)
- CSS and JS injection after each page load
- Navigation (back button handling, URL interception)
- PiP mode entry when app is minimized during video playback
- Starting/stopping the background audio service

**Key implementation points:**

1. **WebView Configuration:**
   ```kotlin
   webView.settings.apply {
       javaScriptEnabled = true             // Required for YouTube to function
       domStorageEnabled = true             // YouTube uses localStorage extensively
       databaseEnabled = true               // For IndexedDB (YouTube caching)
       mediaPlaybackRequiresUserGesture = false  // Allow autoplay (for background playback)
       userAgentString = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
       // Custom UA ensures YouTube serves the full mobile experience
       // (not the simplified WebView version)
       allowContentAccess = true
       allowFileAccess = false              // Security: don't allow file:// access
       setSupportZoom(false)                // YouTube handles its own zoom
   }
   ```

2. **Cookie Persistence (for Google Login):**
   ```kotlin
   // Enable cookies so the user can log in to Google and stay logged in
   val cookieManager = CookieManager.getInstance()
   cookieManager.setAcceptCookie(true)
   cookieManager.setAcceptThirdPartyCookies(webView, true)
   // Cookies are persisted to disk automatically by Android's CookieManager
   // The user's Google login session survives app restarts
   ```

3. **Page Load Injection (WebViewClient):**
   ```kotlin
   webView.webViewClient = object : WebViewClient() {
       override fun onPageFinished(view: WebView?, url: String?) {
           super.onPageFinished(view, url)
           // After every page load, inject our blocking CSS and JS
           injectBlockerCSS()
           injectBlockerJS()
       }

       override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
           val url = request?.url?.toString() ?: return false

           // Handle Shorts redirect: /shorts/VIDEO_ID → /watch?v=VIDEO_ID
           if (prefManager.blockShorts && url.contains("/shorts/")) {
               val videoId = url.substringAfter("/shorts/").substringBefore("?").substringBefore("/")
               if (videoId.isNotEmpty()) {
                   view?.loadUrl("https://m.youtube.com/watch?v=$videoId")
                   return true  // We handled this URL ourselves
               }
           }

           // Keep all youtube.com URLs inside the WebView
           if (url.contains("youtube.com") || url.contains("youtu.be") || url.contains("accounts.google.com")) {
               return false  // Let WebView handle it normally
           }

           // Open external URLs in the default browser
           startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
           return true
       }
   }
   ```

4. **Inject CSS Function:**
   ```kotlin
   private fun injectBlockerCSS() {
       // Read the CSS file from assets/inject_blocker.css
       val css = assets.open("inject_blocker.css").bufferedReader().readText()
       // Escape for JS injection
       val escapedCss = css.replace("\\", "\\\\")
                           .replace("'", "\\'")
                           .replace("\n", "\\n")

       // Build dynamic CSS based on current toggle states
       val toggleClasses = buildString {
           if (prefManager.blockAds) append(" yt-block-ads")
           if (prefManager.blockShorts) append(" yt-block-shorts")
           if (prefManager.blockPosts) append(" yt-block-posts")
       }

       // Inject: add CSS <style> element + toggle classes on <html>
       val jsCode = """
           (function() {
               // Add toggle classes to root element
               document.documentElement.className += '$toggleClasses';

               // Inject CSS if not already injected
               if (!document.getElementById('green-yt-css')) {
                   var style = document.createElement('style');
                   style.id = 'green-yt-css';
                   style.textContent = '$escapedCss';
                   document.head.appendChild(style);
               }
           })();
       """.trimIndent()

       webView.evaluateJavascript(jsCode, null)
   }
   ```

5. **Inject JS Function:**
   ```kotlin
   private fun injectBlockerJS() {
       // Read the JS file from assets/inject_blocker.js
       val js = assets.open("inject_blocker.js").bufferedReader().readText()
       webView.evaluateJavascript(js, null)
   }
   ```

6. **Back Button Navigation:**
   ```kotlin
   @Deprecated("Deprecated in Java")
   override fun onBackPressed() {
       if (webView.canGoBack()) {
           webView.goBack()  // Navigate back in WebView history
       } else {
           super.onBackPressed()  // Exit the app
       }
   }
   ```

7. **PiP Mode + Background Playback (onUserLeaveHint):**
   ```kotlin
   // Called when the user presses Home or switches to another app
   override fun onUserLeaveHint() {
       super.onUserLeaveHint()

       if (prefManager.bgPlayback) {
           // Try to enter Picture-in-Picture mode
           if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
               val pipParams = PictureInPictureParams.Builder()
                   .setAspectRatio(Rational(16, 9))
                   .build()
               enterPictureInPictureMode(pipParams)
           }

           // Also start the foreground service to keep audio playing
           startAudioPlaybackService()
       }
   }
   ```

8. **Stopping background playback when returning:**
   ```kotlin
   override fun onResume() {
       super.onResume()
       // If returning from background, stop the foreground service
       // (the WebView will handle playback again)
       stopAudioPlaybackService()
   }
   ```

---

### Step 5: JavaScript Injection Script (Blocking Logic)

**File:** `app/src/main/assets/inject_blocker.js`

**Purpose:** This is the core blocking engine — adapted from the Firefox extension's `content.js`. It runs inside the WebView after each page load.

**What it does:**
1. Sets up a debounced MutationObserver to watch for dynamically inserted ad elements
2. Auto-clicks "Skip Ad" buttons when they appear
3. Fast-forwards and mutes video ad segments (sets playbackRate to 16x, seeks to end)
4. Listens for YouTube SPA navigation events (`yt-navigate-finish`) to re-apply blocking on page transitions
5. Redirects `/shorts/` URLs to `/watch?v=` (as a JS-level fallback in addition to the Kotlin-level redirect in Step 4)

**Key code sections to include:**

```javascript
/**
 * Green YouTube — Blocker Injection Script
 *
 * This script is injected into the YouTube mobile WebView.
 * It handles dynamic ad skipping that CSS alone cannot achieve.
 *
 * Features:
 * - Auto-click "Skip Ad" buttons
 * - Fast-forward unskippable ads (16x speed + mute + seek to end)
 * - Monitor for new ad elements via MutationObserver (debounced, 100ms)
 * - Handle YouTube SPA navigation to re-apply blocking
 * - Redirect /shorts/ URLs to /watch?v= standard player
 */
(function() {
    'use strict';

    // Prevent double-injection
    if (window.__greenYtInjected) return;
    window.__greenYtInjected = true;

    // ── AD SKIPPER ──────────────────────────────────────────────────
    function skipVideoAds() {
        // Check if the player is currently showing an ad
        var player = document.querySelector('.html5-video-player');
        var isAd = player && (
            player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting')
        );

        if (isAd) {
            // Fast-forward and mute the ad
            var videos = document.querySelectorAll('video');
            for (var i = 0; i < videos.length; i++) {
                var v = videos[i];
                if (!isNaN(v.duration) && v.currentTime < v.duration) {
                    v.muted = true;
                    v.playbackRate = 16;
                    v.currentTime = v.duration - 0.1;
                }
            }
        }

        // Click any skip buttons
        var skipSelectors = [
            '.ytp-skip-ad-button',
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            'button.ytp-ad-skip-button-text'
        ];
        for (var j = 0; j < skipSelectors.length; j++) {
            var btn = document.querySelector(skipSelectors[j]);
            if (btn) { btn.click(); break; }
        }
    }

    // ── DEBOUNCED MUTATION OBSERVER ─────────────────────────────────
    var timer = null;
    var observer = new MutationObserver(function() {
        if (timer) return;
        timer = setTimeout(function() {
            timer = null;
            skipVideoAds();
        }, 100);
    });

    // Start observing
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    // Initial sweep
    skipVideoAds();

    // ── SPA NAVIGATION LISTENER ────────────────────────────────────
    var lastUrl = location.href;
    document.addEventListener('yt-navigate-finish', function() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            skipVideoAds();

            // Shorts redirect (JS-level fallback)
            if (location.pathname.indexOf('/shorts/') === 0) {
                var vid = location.pathname.split('/')[2];
                if (vid) {
                    location.replace('/watch?v=' + vid);
                }
            }
        }
    });
})();
```

> **NOTE:** This script uses `var` instead of `let/const` for maximum WebView compatibility across older Android versions.

---

### Step 6: CSS Injection Stylesheet (Visual Element Hiding)

**File:** `app/src/main/assets/inject_blocker.css`

**Purpose:** Adapted from the Firefox extension's `content.css`. Hides ad elements, Shorts sections, and Community Posts using CSS `display: none !important`. Scoped under root classes (`yt-block-ads`, `yt-block-shorts`, `yt-block-posts`) so they can be toggled independently.

**Use the exact same CSS rules from the Firefox extension's `content/content.css`**, which includes:

**Ads (18+ selectors):**
- `#masthead-ad`, `ytd-banner-promo-renderer` (homepage banner ads)
- `ytd-ad-slot-renderer`, `ytd-in-feed-ad-layout-renderer` (feed ads)
- `ytd-promoted-sparkles-web-renderer`, `ytd-promoted-video-renderer` (promoted content)
- `.ytp-ad-overlay-container`, `.ytp-ad-text-overlay`, `.ytp-ad-message-container` (player overlays)
- `ytd-display-ad-renderer`, `ytd-compact-promoted-item-renderer`, `#player-ads` (sidebar)
- `ytd-mealbar-promo-renderer`, `yt-mealbar-promo-renderer` (Premium promos)
- `ytd-merch-shelf-renderer`, `ytd-companion-slot-renderer` (merch/companion)
- `ytd-statement-banner-renderer`, `ytd-brand-video-singleton-renderer` (brand ads)

**Shorts (8+ selectors):**
- `ytd-rich-shelf-renderer[is-shorts]`, `ytd-reel-shelf-renderer` (shelves)
- `ytd-guide-entry-renderer` with Shorts links (sidebar)
- `ytd-mini-guide-entry-renderer` with Shorts (mini sidebar)
- Channel page Shorts tab

**Posts (7+ selectors):**
- `ytd-backstage-post-thread-renderer`, `ytd-backstage-post-renderer` (post threads)
- `ytd-post-renderer`, `ytd-shared-post-renderer` (individual posts)
- Grid/section container wrappers (prevent blank spaces)

> **IMPORTANT FOR MOBILE:** YouTube's mobile site (`m.youtube.com`) uses slightly different element names than the desktop site in some cases. The selectors above work on both, but the following mobile-specific selectors should ALSO be added:

```css
/* Mobile-specific ad selectors */
html.yt-block-ads ytm-promoted-sparkles-web-renderer,
html.yt-block-ads ytm-ad-slot-renderer,
html.yt-block-ads .ytm-ad-overlay-container,
html.yt-block-ads .ad-container,
html.yt-block-ads .companion-ad-container {
    display: none !important;
}

/* Mobile-specific Shorts selectors */
html.yt-block-shorts ytm-reel-shelf-renderer,
html.yt-block-shorts ytm-shorts-lockup-view-model-v2 {
    display: none !important;
}

/* Mobile-specific Posts selectors */
html.yt-block-posts ytm-post-renderer,
html.yt-block-posts ytm-backstage-post-thread-renderer {
    display: none !important;
}
```

---

### Step 7: Google Login & Cookie Persistence

**No separate file needed.** This is handled within `MainActivity.kt` (Step 4).

**How it works:**
- Android's `CookieManager` automatically persists cookies to disk
- When the user navigates to `accounts.google.com` (YouTube's login page), the WebView handles the full Google OAuth flow natively
- After login, cookies are stored and the user remains logged in across app restarts
- The `shouldOverrideUrlLoading` method (Step 4) allows `accounts.google.com` URLs to load inside the WebView

**Implementation in MainActivity.kt `onCreate`:**
```kotlin
// Enable persistent cookies for Google login
val cookieManager = CookieManager.getInstance()
cookieManager.setAcceptCookie(true)
cookieManager.setAcceptThirdPartyCookies(webView, true)
// Flush cookies to disk when app is paused
// (handled in onPause)
```

```kotlin
override fun onPause() {
    super.onPause()
    CookieManager.getInstance().flush()  // Save cookies to disk
}
```

**What the user gets:**
- Tap "Sign In" on YouTube → Google login page loads in WebView
- Enter Google credentials → session cookie is stored
- All YouTube features work: watch history, subscriptions, likes, comments, posting comments, playlists, account settings
- Session persists across app restarts (cookies saved to disk)

---

### Step 8: Background Audio Playback Service

**File:** `app/src/main/java/com/greenyt/app/AudioPlaybackService.kt`

**Purpose:** A Foreground Service that keeps the app alive and audio playing when the user minimizes the app or locks the screen. Uses a `MediaSessionCompat` for lock-screen and notification controls.

**How background audio works with a WebView:**

The key trick is that when the user leaves the app, the WebView's video playback normally pauses (Android's default behavior). To prevent this:

1. **In the WebView**, we set `mediaPlaybackRequiresUserGesture = false` (Step 4)
2. **When the app goes to background**, we inject JavaScript to keep the video playing:
   ```javascript
   // Prevent YouTube from pausing when tab/page loses visibility
   Object.defineProperty(document, 'hidden', { value: false, writable: false });
   Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
   document.dispatchEvent(new Event('visibilitychange'));
   ```
3. **The Foreground Service** holds a `PARTIAL_WAKE_LOCK` to keep the CPU running
4. **MediaSessionCompat** creates a media notification with play/pause/skip controls

**Implementation structure:**

```kotlin
/**
 * AudioPlaybackService.kt
 *
 * Foreground Service for background audio playback.
 *
 * When the user minimizes Green YouTube while a video is playing:
 * 1. This service starts as a foreground service with a persistent notification
 * 2. It holds a PARTIAL_WAKE_LOCK to keep the CPU running
 * 3. A MediaSessionCompat provides lock-screen and notification playback controls
 * 4. JavaScript is injected into the WebView to override the Page Visibility API,
 *    preventing YouTube from auto-pausing when the app goes to the background
 *
 * The actual audio continues to play through the WebView — this service
 * simply keeps the process alive and provides the media notification.
 */
package com.greenyt.app

class AudioPlaybackService : Service() {

    private lateinit var mediaSession: MediaSessionCompat
    private lateinit var wakeLock: PowerManager.WakeLock

    override fun onCreate() {
        super.onCreate()

        // Create MediaSession for notification controls
        mediaSession = MediaSessionCompat(this, "GreenYouTube")
        mediaSession.setCallback(object : MediaSessionCompat.Callback() {
            override fun onPlay() { /* Send JS to WebView: play video */ }
            override fun onPause() { /* Send JS to WebView: pause video */ }
            override fun onSkipToNext() { /* Send JS: click next button */ }
            override fun onSkipToPrevious() { /* Send JS: click prev button */ }
        })
        mediaSession.isActive = true

        // Acquire wake lock to keep CPU running
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GreenYT::AudioLock")
        wakeLock.acquire(60 * 60 * 1000L) // 1 hour max
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Build the foreground notification
        val notification = buildMediaNotification()
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }

    private fun buildMediaNotification(): Notification {
        // Create notification channel (required on Android 8+)
        val channel = NotificationChannel(
            CHANNEL_ID, "Audio Playback",
            NotificationManager.IMPORTANCE_LOW  // Low = no sound/vibration
        )
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)

        // Build notification with media controls
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_play)
            .setContentTitle("Green YouTube")
            .setContentText("Playing in background")
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .addAction(R.drawable.ic_skip_prev, "Previous", /* PendingIntent */)
            .addAction(R.drawable.ic_pause, "Pause", /* PendingIntent */)
            .addAction(R.drawable.ic_skip_next, "Next", /* PendingIntent */)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        mediaSession.release()
        if (wakeLock.isHeld) wakeLock.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "green_yt_audio"
    }
}
```

**Communication between Service and WebView:**

The `AudioPlaybackService` needs to send play/pause commands to the WebView in `MainActivity`. Use a `LocalBroadcastManager` or a shared singleton:

```kotlin
// In AudioPlaybackService, when user taps Pause on notification:
val intent = Intent("com.greenyt.MEDIA_ACTION")
intent.putExtra("action", "pause")
LocalBroadcastManager.getInstance(this).sendBroadcast(intent)

// In MainActivity, register receiver:
val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.getStringExtra("action")
        when (action) {
            "pause" -> webView.evaluateJavascript(
                "document.querySelector('video')?.pause()", null
            )
            "play" -> webView.evaluateJavascript(
                "document.querySelector('video')?.play()", null
            )
        }
    }
}
LocalBroadcastManager.getInstance(this)
    .registerReceiver(receiver, IntentFilter("com.greenyt.MEDIA_ACTION"))
```

---

### Step 9: Media Notification Controls

Covered in Step 8. The notification provides:
- **Play/Pause** button
- **Skip Previous** and **Skip Next** buttons
- **Content title** showing "Green YouTube"
- **Content text** showing "Playing in background"
- Uses `MediaStyle` notification for lock-screen integration
- Tapping the notification brings the user back to `MainActivity`

---

### Step 10: Picture-in-Picture Mode

**Handled in `MainActivity.kt`** (partially shown in Step 4).

**Full PiP implementation:**

```kotlin
// Enter PiP when user presses Home button during video playback
override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (prefManager.bgPlayback && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        enterPipMode()
    }
}

@RequiresApi(Build.VERSION_CODES.O)
private fun enterPipMode() {
    val params = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(16, 9))
        .build()
    enterPictureInPictureMode(params)
}

// Hide UI elements when in PiP mode
override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration
) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    if (isInPictureInPictureMode) {
        // Hide toolbar, show only video
        supportActionBar?.hide()
    } else {
        // Restore full UI
        supportActionBar?.show()
    }
}
```

---

### Step 11: Settings Activity (Toggle Switches)

**File:** `app/src/main/java/com/greenyt/app/SettingsActivity.kt`

**Layout File:** `app/src/main/res/layout/activity_settings.xml`

**Purpose:** A simple settings screen with four Material Design switches:
1. **Block Ads** (default: ON)
2. **Block Shorts** (default: ON)
3. **Block Posts** (default: ON)
4. **Background Playback** (default: ON)

**Layout XML (`activity_settings.xml`):**

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="?android:colorBackground"
    android:padding="16dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Blocker Settings"
        android:textSize="20sp"
        android:textStyle="bold"
        android:layout_marginBottom="24dp" />

    <!-- Block Ads Toggle -->
    <com.google.android.material.switchmaterial.SwitchMaterial
        android:id="@+id/switch_block_ads"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Block Ads"
        android:padding="12dp"
        android:checked="true" />

    <!-- Block Shorts Toggle -->
    <com.google.android.material.switchmaterial.SwitchMaterial
        android:id="@+id/switch_block_shorts"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Block Shorts"
        android:padding="12dp"
        android:checked="true" />

    <!-- Block Posts Toggle -->
    <com.google.android.material.switchmaterial.SwitchMaterial
        android:id="@+id/switch_block_posts"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Block Posts"
        android:padding="12dp"
        android:checked="true" />

    <View
        android:layout_width="match_parent"
        android:layout_height="1dp"
        android:background="?android:attr/listDivider"
        android:layout_marginVertical="16dp" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Playback Settings"
        android:textSize="20sp"
        android:textStyle="bold"
        android:layout_marginBottom="24dp" />

    <!-- Background Playback Toggle -->
    <com.google.android.material.switchmaterial.SwitchMaterial
        android:id="@+id/switch_bg_playback"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Background Audio Playback"
        android:padding="12dp"
        android:checked="true" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Continue playing audio when the app is minimized or screen is locked."
        android:textSize="12sp"
        android:textColor="?android:textColorSecondary"
        android:paddingStart="12dp"
        android:layout_marginTop="4dp" />

</LinearLayout>
```

**Kotlin (`SettingsActivity.kt`):**

```kotlin
/**
 * SettingsActivity.kt
 *
 * Presents four toggle switches. Reads/writes settings via PreferenceManager.
 * When the user returns to MainActivity, the new settings are applied
 * by re-injecting CSS/JS.
 */
package com.greenyt.app

class SettingsActivity : AppCompatActivity() {

    private lateinit var prefManager: PreferenceManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        // Enable back arrow in toolbar
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        prefManager = PreferenceManager(this)

        // Load current settings into switches
        val switchAds = findViewById<SwitchMaterial>(R.id.switch_block_ads)
        val switchShorts = findViewById<SwitchMaterial>(R.id.switch_block_shorts)
        val switchPosts = findViewById<SwitchMaterial>(R.id.switch_block_posts)
        val switchBg = findViewById<SwitchMaterial>(R.id.switch_bg_playback)

        switchAds.isChecked = prefManager.blockAds
        switchShorts.isChecked = prefManager.blockShorts
        switchPosts.isChecked = prefManager.blockPosts
        switchBg.isChecked = prefManager.bgPlayback

        // Save changes on toggle
        switchAds.setOnCheckedChangeListener { _, isChecked -> prefManager.blockAds = isChecked }
        switchShorts.setOnCheckedChangeListener { _, isChecked -> prefManager.blockShorts = isChecked }
        switchPosts.setOnCheckedChangeListener { _, isChecked -> prefManager.blockPosts = isChecked }
        switchBg.setOnCheckedChangeListener { _, isChecked -> prefManager.bgPlayback = isChecked }
    }
}
```

---

### Step 12: App Theme, Icon & Splash Screen

**Colors (`res/values/colors.xml`):**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="green_primary">#2E7D32</color>       <!-- Material Green 800 -->
    <color name="green_primary_dark">#1B5E20</color>   <!-- Material Green 900 -->
    <color name="green_accent">#66BB6A</color>         <!-- Material Green 400 -->
    <color name="white">#FFFFFF</color>
    <color name="black">#000000</color>
    <color name="dark_bg">#121212</color>
</resources>
```

**Theme (`res/values/themes.xml`):**

```xml
<resources>
    <style name="Theme.GreenYouTube" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="colorPrimary">@color/green_primary</item>
        <item name="colorPrimaryDark">@color/green_primary_dark</item>
        <item name="colorAccent">@color/green_accent</item>
        <item name="android:statusBarColor">@color/green_primary_dark</item>
        <item name="android:navigationBarColor">@color/black</item>
    </style>
</resources>
```

**Strings (`res/values/strings.xml`):**

```xml
<resources>
    <string name="app_name">Green YouTube</string>
    <string name="settings_title">Settings</string>
</resources>
```

**App Icon:** Create a green-colored play button icon using Android Studio's Image Asset Studio:
- Foreground: White play triangle on green circle
- Background: Green gradient (#2E7D32 → #66BB6A)

---

### Step 13: Back Navigation & Deep Links

**Back navigation** is handled in `MainActivity.kt` (Step 4) — the back button navigates the WebView history first, then exits the app.

**Deep links** are configured in the manifest (Step 2). When a user clicks a YouTube link anywhere on their phone and chooses "Green YouTube", the link opens directly in the app:
- `https://www.youtube.com/watch?v=...` → loads in WebView
- `https://youtu.be/...` → loads in WebView
- `https://www.youtube.com/shorts/...` → redirected to `/watch?v=` if Shorts blocking is enabled

---

### Step 14: Build, Sign & Distribute

1. **Debug Build:**
   ```bash
   ./gradlew assembleDebug
   # APK at: app/build/outputs/apk/debug/app-debug.apk
   ```

2. **Release Build:**
   ```bash
   ./gradlew assembleRelease
   # Requires signing config in build.gradle.kts
   ```

3. **Generate Signed APK** in Android Studio:
   - Build → Generate Signed Bundle / APK
   - Create or select a keystore
   - Build the release APK

4. **Install on phone:**
   - Transfer APK to phone
   - Enable "Install from unknown sources" in Android Settings
   - Open and install the APK

5. **Distribution options:**
   - **Sideload** (share APK directly)
   - **F-Droid** (open-source app store)
   - **NOT Google Play Store** (will be rejected due to YouTube ToS violation)

---

## 5. Legal & Distribution Notes

> **⚠️ IMPORTANT:** This app is for **personal/educational use only**.

- **YouTube Terms of Service** prohibit ad blocking and background playback (these are YouTube Premium features)
- **Google Play Store** will reject this app — distribute via sideloading or F-Droid only
- **Google may block WebView access** if they detect automated ad skipping (unlikely for personal use, but possible)
- Similar open-source apps (**NewPipe**, **LibreTube**) exist and are distributed outside Google Play
- This app does **NOT** download, rip, or redistribute YouTube content — it simply loads the mobile website with CSS/JS modifications

---

## Summary of All Files to Create

| # | File | Language | Purpose |
|---|------|----------|---------|
| 1 | `build.gradle.kts` (project) | Kotlin DSL | Project-level Gradle config |
| 2 | `app/build.gradle.kts` | Kotlin DSL | App dependencies & SDK config |
| 3 | `AndroidManifest.xml` | XML | Permissions, activities, service |
| 4 | `MainActivity.kt` | Kotlin | WebView container, injection, PiP |
| 5 | `SettingsActivity.kt` | Kotlin | Toggle switches UI |
| 6 | `AudioPlaybackService.kt` | Kotlin | Foreground service for background audio |
| 7 | `PreferenceManager.kt` | Kotlin | SharedPreferences wrapper |
| 8 | `JavaScriptBridge.kt` | Kotlin | JS ↔ Kotlin interface (optional) |
| 9 | `inject_blocker.js` | JavaScript | Ad skipper & blocking logic |
| 10 | `inject_blocker.css` | CSS | Element hiding rules |
| 11 | `activity_main.xml` | XML | Full-screen WebView layout |
| 12 | `activity_settings.xml` | XML | Settings toggles layout |
| 13 | `main_menu.xml` | XML | Overflow menu |
| 14 | `colors.xml` | XML | Green color palette |
| 15 | `themes.xml` | XML | Material 3 green theme |
| 16 | `strings.xml` | XML | App strings |
| 17 | `network_security_config.xml` | XML | HTTPS traffic config |
| 18 | Drawable icons | XML | Play, pause, skip icons |
