/**
 * PureTube Native Gesture Engine for iPad
 * Features:
 * 1. Double Tap Left/Right: Rewind / Fast Forward 10 seconds with native ripple HUD
 * 2. Press & Hold: 2x Speed with top pill indicator (returns to 1x on release)
 * 3. Swipe UP on video: Enter Fullscreen
 * 4. Swipe DOWN on video: Exit Fullscreen or Enter PiP
 * 5. Two-Finger Tap: Toggle Play / Pause
 */
(function() {
  'use strict';
  const host = window.location.hostname || '';
  if (!host.includes('youtube.com') && !host.includes('youtu.be')) return;
  if (window.__pureTubeGesturesLoaded) return;
  window.__pureTubeGesturesLoaded = true;

  console.log('[PureTube] Native Gesture Engine Initialized');

  // Inject Styles for Native HUD Overlays
  const style = document.createElement('style');
  style.id = 'puretube-gestures-style';
  style.textContent = `
    .pt-hud-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .pt-hud-seek {
      position: absolute;
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      opacity: 0;
      transform: scale(0.7);
      transition: opacity 0.15s ease-out, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .pt-hud-seek.show {
      opacity: 1;
      transform: scale(1);
    }
    .pt-hud-seek-left {
      left: 10%;
    }
    .pt-hud-seek-right {
      right: 10%;
    }
    .pt-hud-speed {
      position: absolute;
      top: 24px;
      padding: 8px 18px;
      border-radius: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 6px;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .pt-hud-speed.show {
      opacity: 1;
      transform: translateY(0);
    }
    .pt-hud-playpause {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      opacity: 0;
      transform: scale(0.6);
      transition: opacity 0.15s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .pt-hud-playpause.show {
      opacity: 1;
      transform: scale(1);
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // HUD Elements
  let hudContainer = null;
  let seekLeftHUD = null;
  let seekRightHUD = null;
  let speedHUD = null;
  let playPauseHUD = null;

  function ensureHUD(parent) {
    if (!parent) return;
    if (!hudContainer || !parent.contains(hudContainer)) {
      hudContainer = document.createElement('div');
      hudContainer.className = 'pt-hud-container';

      seekLeftHUD = document.createElement('div');
      seekLeftHUD.className = 'pt-hud-seek pt-hud-seek-left';
      seekLeftHUD.innerHTML = '◀◀<div style="margin-top:4px;">10 秒</div>';

      seekRightHUD = document.createElement('div');
      seekRightHUD.className = 'pt-hud-seek pt-hud-seek-right';
      seekRightHUD.innerHTML = '▶▶<div style="margin-top:4px;">10 秒</div>';

      speedHUD = document.createElement('div');
      speedHUD.className = 'pt-hud-speed';
      speedHUD.innerHTML = '2X 快进中 ▶▶';

      playPauseHUD = document.createElement('div');
      playPauseHUD.className = 'pt-hud-playpause';
      playPauseHUD.innerHTML = '▶';

      hudContainer.appendChild(seekLeftHUD);
      hudContainer.appendChild(seekRightHUD);
      hudContainer.appendChild(speedHUD);
      hudContainer.appendChild(playPauseHUD);

      parent.style.position = 'relative';
      parent.appendChild(hudContainer);
    }
  }

  function showSeekHUD(direction) {
    const el = direction === 'left' ? seekLeftHUD : seekRightHUD;
    if (!el) return;
    el.classList.add('show');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 450);
  }

  function showPlayPauseHUD(isPlaying) {
    if (!playPauseHUD) return;
    playPauseHUD.innerHTML = isPlaying ? '⏸' : '▶';
    playPauseHUD.classList.add('show');
    clearTimeout(playPauseHUD._hideTimer);
    playPauseHUD._hideTimer = setTimeout(() => {
      playPauseHUD.classList.remove('show');
    }, 350);
  }

  function set2xSpeed(active) {
    const video = document.querySelector('video');
    if (!video) return;

    if (active) {
      if (!video._originalRate) {
        video._originalRate = video.playbackRate || 1.0;
      }
      video.playbackRate = 2.0;
      if (speedHUD) speedHUD.classList.add('show');
    } else {
      if (video._originalRate) {
        video.playbackRate = video._originalRate;
        video._originalRate = null;
      } else {
        video.playbackRate = 1.0;
      }
      if (speedHUD) speedHUD.classList.remove('show');
    }
  }

  // State Tracking
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let longPressTimer = null;
  let is2xActive = false;
  let isSwiping = false;

  function initPlayerGestures() {
    const player = document.querySelector('#movie_player, .html5-video-player');
    if (!player) return;

    ensureHUD(player);

    if (player._ptGesturesBound) return;
    player._ptGesturesBound = true;

    player.addEventListener('touchstart', function(e) {
      // Don't intercept controls taps
      if (e.target.closest('.ytp-chrome-bottom, .ytp-chrome-top, .ytp-popup, button, a')) {
        return;
      }

      ensureHUD(player);

      // Handle Two-Finger Tap
      if (e.touches.length === 2) {
        e.preventDefault();
        const video = document.querySelector('video');
        if (video) {
          if (video.paused) {
            video.play();
            showPlayPauseHUD(false);
          } else {
            video.pause();
            showPlayPauseHUD(true);
          }
        }
        return;
      }

      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isSwiping = false;
      is2xActive = false;

      // Start long-press timer for 2x playback speed
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        const video = document.querySelector('video');
        if (video && !video.paused && !isSwiping) {
          is2xActive = true;
          set2xSpeed(true);
        }
      }, 400);
    }, { passive: false });

    player.addEventListener('touchmove', function(e) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // If user moved finger significantly, cancel long press
      if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
        clearTimeout(longPressTimer);
        isSwiping = true;
        if (is2xActive) {
          is2xActive = false;
          set2xSpeed(false);
        }
      }
    }, { passive: true });

    player.addEventListener('touchend', function(e) {
      clearTimeout(longPressTimer);

      if (is2xActive) {
        is2xActive = false;
        set2xSpeed(false);
        e.preventDefault();
        return;
      }

      const touchEndTime = Date.now();
      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const duration = touchEndTime - touchStartTime;

      // 1. Swipe Up / Down Detection (Vertical gesture)
      if (Math.abs(deltaY) > 60 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && duration < 500) {
        const video = document.querySelector('video');
        if (deltaY < -60) {
          // Swipe UP -> Enter Fullscreen!
          console.log('[PureTube Gesture] Swipe UP -> Fullscreen');
          if (window.__pureTubeEnterFullscreen) {
            window.__pureTubeEnterFullscreen();
          }
          e.preventDefault();
          return;
        } else if (deltaY > 60) {
          // Swipe DOWN -> Exit Fullscreen or Trigger PiP!
          console.log('[PureTube Gesture] Swipe DOWN -> Exit FS / PiP');
          if (video && video.webkitDisplayingFullscreen) {
            if (video.webkitSetPresentationMode) {
              video.webkitSetPresentationMode('inline');
            }
          } else {
            if (window.__pureTubeRequestPiP) {
              window.__pureTubeRequestPiP();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // 2. Double Tap Detection (Left 40% vs Right 40%)
      const timeSinceLastTap = touchEndTime - lastTapTime;
      const distFromLastTap = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);

      if (timeSinceLastTap < 320 && distFromLastTap < 50 && !isSwiping) {
        // Double Tap confirmed!
        const rect = player.getBoundingClientRect();
        const tapXInPlayer = touch.clientX - rect.left;
        const playerWidth = rect.width;
        const video = document.querySelector('video');

        if (video) {
          if (tapXInPlayer < playerWidth * 0.42) {
            // Double tap on LEFT -> Rewind 10s
            video.currentTime = Math.max(0, video.currentTime - 10);
            showSeekHUD('left');
            e.preventDefault();
            e.stopPropagation();
          } else if (tapXInPlayer > playerWidth * 0.58) {
            // Double tap on RIGHT -> Forward 10s
            video.currentTime = Math.min(video.duration || 999999, video.currentTime + 10);
            showSeekHUD('right');
            e.preventDefault();
            e.stopPropagation();
          }
        }
        lastTapTime = 0; // Reset
        return;
      }

      lastTapTime = touchEndTime;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
    }, { passive: false });

    player.addEventListener('touchcancel', function() {
      clearTimeout(longPressTimer);
      if (is2xActive) {
        is2xActive = false;
        set2xSpeed(false);
      }
    });
  }

  // Initialize and observe for player SPA replacement
  initPlayerGestures();
  setInterval(initPlayerGestures, 1000);
})();
