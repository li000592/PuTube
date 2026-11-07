# PuTube (PureTube for iPad & iOS)

[![Build PureTube IPA](https://github.com/li000592/PuTube/actions/workflows/build_ipa.yml/badge.svg)](https://github.com/li000592/PuTube/actions/workflows/build_ipa.yml)

A high-performance, ad-free native YouTube client for iPadOS and iOS, engineered with the same architectural principles behind Brave Shields and uBlock Origin.

---

## Key Features

- **Multi-Layer Ad Defense**:
  - **WebKit Content Blocker (`WKContentRuleList`)**: Declarative kernel-level blocking of tracking and ad-serving domains.
  - **Player Response Defuser**: Injected at `document_start` to intercept `ytInitialPlayerResponse` and `/youtubei/v1/player` responses, stripping `adPlacements` and `playerAds` before the video initializes.
  - **No Empty Grid Cells**: Seamless CSS `:has()` rules and DOM cleanup that automatically eliminate the blank placeholders left by blocked ads, collapsing the grid just like YouTube Premium.
  - **Anti-Universal Links Sandbox**: Automatically blocks attempts by Google / YouTube OAuth to bounce you out into the official YouTube app.
- **Native Gesture Engine**:
  - **Double Tap Left / Right**: Rewinds or fast-forwards 10 seconds with custom smooth feedback HUDs.
  - **Press & Hold**: Instant **2X Speed** playback with top glass capsule banner; release to restore.
  - **Swipe UP on video**: Enters native iPadOS Fullscreen.
  - **Swipe DOWN on video**: Exits Fullscreen or launches Picture-in-Picture (PiP).
  - **Two-Finger Tap**: Quick Play / Pause toggle.
- **Background & Lock Screen Audio Playback**:
  - Native `AVAudioSession` with `.playback` & `.moviePlayback`.
  - Spoofs `document.hidden = false` and blocks visibility-pause hooks so playback continues when switching apps or locking your iPad.
- **Hardware Keyboard Shortcuts (iPad Magic Keyboard)**:
  - `Space`: Play / Pause
  - `←` / `→`: Seek 5s
  - `J` / `L`: Seek 10s
  - `F`: Fullscreen
  - `⌘ + R`: Reload
  - `⌘ + [` / `⌘ + ]`: History navigation

---

## Installation Methods

### Method 1: Sideloading via SideStore (Auto-refresh on Wi-Fi, No PC needed after initial setup)
1. Download `PureTube.ipa` from the repository releases or GitHub Actions artifact.
2. Send `PureTube.ipa` to your iPad via AirDrop.
3. Open with **SideStore** and tap Install.
4. Enjoy continuous automatic background renewal!

### Method 2: Direct Xcode Install
1. Clone this repository:
   ```bash
   git clone https://github.com/li000592/PuTube.git
   cd PuTube
   ```
2. Open in Xcode:
   ```bash
   open PureTube.xcodeproj
   ```
3. Connect your iPad, select it as the run target, choose your Apple ID Team in **Signing & Capabilities**, and hit **Run** (`⌘ + R`).
