/* ============================================================
   Layered background controller
   No external assets, no independent rAF. The game loop calls
   update() once per rendered frame; this file only updates CSS
   variables that move the inline-SVG layers.
   ============================================================ */

(() => {
  'use strict';

  const DESIGN_W = 960;
  const TRACK_SHIFT = 100 / 3;
  const THEMES = new Set(['day', 'dusk', 'night']);
  const mediaMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const mediaCoarse = window.matchMedia
    ? window.matchMedia('(pointer: coarse)')
    : null;

  let container = null;
  let shell = null;
  let theme = 'day';
  let mode = 'menu';
  let userReduced = false;
  let systemReduced = Boolean(mediaMotion && mediaMotion.matches);
  let lite = Boolean(mediaCoarse && mediaCoarse.matches);

  const mod = (value, size) => ((value % size) + size) % size;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let artUid = 0;
  const nextArtId = (prefix) => `${prefix}-${++artUid}`;

  function cloudSvg() {
    const gid = nextArtId('bg-cloud');
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--bg-cloud-highlight)"/>
          <stop offset=".58" style="stop-color:var(--bg-cloud-color)"/>
          <stop offset="1" style="stop-color:var(--bg-cloud-shadow)"/>
        </linearGradient>
      </defs>
      <g fill="url(#${gid})">
        <path d="M48 148c-14-1-23-11-20-23 3-11 14-17 26-17 3-16 16-28 33-28 10-17 32-25 50-17 12-12 31-13 44-2 16-7 34 1 40 17 16 1 28 13 26 26-1 12-12 20-25 20H68c-7 0-14 8-20 14Z"/>
        <path d="M292 170c-13-1-22-10-20-21 2-10 12-17 23-17 3-14 15-25 30-25 8-14 26-20 40-14 10-10 27-10 38 1 14-5 30 2 35 16 13 2 22 13 20 24-2 10-12 17-23 17H310c-6 0-13 8-18 13Z"/>
        <path d="M654 150c-16-1-26-13-22-27 4-13 17-20 31-20 4-18 19-31 38-31 11-17 33-24 52-17 13-11 33-11 46 1 17-4 35 6 40 24 16 3 27 17 24 31-2 12-13 21-27 21H674c-8 0-15 9-20 17Z"/>
        <path d="M846 106c-9 0-15-7-13-15 2-7 8-11 16-11 2-8 9-14 18-14 6-8 17-11 26-7 7-4 16-2 20 4 8 0 14 6 13 13-1 6-6 10-13 10h-55c-4 0-8 6-12 9Z"/>
      </g>
      <g class="cloud-detail" fill="var(--bg-cloud-highlight)" opacity=".62">
        <path d="M66 114c3-13 15-23 29-24 6-11 19-18 32-16 9-8 23-7 31 2 13 0 23 9 24 21 2 11-7 20-19 21H86c-10 0-18-4-20-4Z"/>
        <path d="M330 142c3-12 13-21 25-22 6-10 18-16 29-14 8-7 21-6 28 2 11 0 20 8 21 18 1 10-6 17-17 18h-64c-9 0-16-2-22-2Z"/>
        <path d="M700 120c4-14 16-24 30-25 7-12 20-18 33-15 9-8 23-6 31 4 13 1 23 10 23 22 0 11-9 20-21 20h-76c-10 0-16-6-20-6Z"/>
      </g>
      <g fill="var(--bg-cloud-shadow)" opacity=".24">
        <path d="M58 147h166c-18 9-48 12-78 10-33-2-64-4-88-10Z"/>
        <path d="M302 169h158c-19 8-44 10-71 9-30-1-60-3-87-9Z"/>
        <path d="M666 149h198c-21 9-52 12-85 11-41-1-80-4-113-11Z"/>
      </g>
      <g class="cloud-detail" fill="var(--bg-cloud-highlight)" opacity=".38">
        <path d="M78 112c8-10 20-15 33-13 6-11 17-18 30-18 5-7 13-11 21-11-12 9-19 20-24 33-10 1-19 4-27 9-11-2-22-2-33 0Z"/>
        <path d="M318 137c7-9 18-14 29-12 5-9 14-15 25-15 5-6 12-9 19-10-10 8-16 18-20 29-9 1-17 4-24 8-10-2-20-2-29 0Z"/>
        <path d="M680 117c8-10 20-15 33-13 6-11 17-18 30-18 4-6 11-10 18-11-11 9-18 20-22 32-10 1-19 4-27 9-10-2-21-2-32 1Z"/>
      </g>
      <g class="cloud-detail" fill="none" stroke="var(--bg-cloud-wisp)" stroke-width="2.2" stroke-linecap="round" opacity=".65">
        <path d="M104 176c20-5 40-6 60-3 16 2 30 1 44-4"/>
        <path d="M336 202c24-4 49-4 72 0 15 2 30 1 44-3"/>
        <path d="M704 184c20-4 40-4 60 0 12 2 23 1 34-2"/>
      </g>
    </svg>`;
  }

  function mountainSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-mountain-far)" opacity=".68"
        d="M0 540V356c28-12 54-30 82-24 30 6 48 30 78 20 24-8 34-48 62-70 28-22 52 0 74 26 26 30 48 10 76-12 28-22 50 0 74 26 24 26 46 4 72-16 28-22 52-6 78 18 26 24 50 6 76-14 28-22 52 0 78 24 26 24 52 4 78-14 28-20 52-4 76 14 24 18 42 10 56 2V540Z"/>
      <path class="mountain-detail" fill="var(--bg-mountain-haze)" opacity=".28"
        d="M0 410c140-18 260 10 400-8s280 12 420-4c60-7 120 2 140 6v44c-80-8-160 10-240 2-140-14-280 10-420-2-100-9-200 8-300-2-20-2-20 0 0 0Z"/>
      <path fill="var(--bg-mountain-mid)" opacity=".94"
        d="M0 540V430c42-16 84-28 124-22 36 6 62-38 92-68l30-30 30 40c34 34 72 48 112 52 40 4 70-44 100-70l30-26 30 38c32 34 70 52 110 56 42 4 72-44 102-72l30-28 32 38c32 32 68 50 106 58 24 6 44 10 62 12V540Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".24">
        <path d="M246 310l32 40-20 2-17-28Z"/>
        <path d="M516 288l32 40-20 2-17-28Z"/>
        <path d="M788 292l32 40-20 2-17-28Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".3">
        <path d="M246 310l-24 38 17 2 15-26Z"/>
        <path d="M516 288l-24 38 17 2 15-26Z"/>
        <path d="M788 292l-24 38 17 2 15-26Z"/>
      </g>
      <g fill="var(--bg-mountain-snow)" opacity=".7">
        <path d="M246 310l9 14-5 2-4-7-4 6-4-2Z"/>
        <path d="M516 288l9 14-5 2-4-7-4 6-4-2Z"/>
        <path d="M788 292l9 14-5 2-4-7-4 6-4-2Z"/>
      </g>
      <path fill="var(--bg-mountain-near)" opacity=".96"
        d="M0 540V482c48-8 96-30 144-20 48 10 84-24 132-18 48 6 84 32 132 24 48-8 84-32 132-26 48 6 84 32 132 24 48-8 84-30 132-24 48 6 104 28 156 20V540Z"/>
      <path fill="var(--bg-mountain-shadow)" opacity=".34"
        d="M0 540v-34c120-10 240-4 360-12 120-8 240 8 360 0 80-5 160 4 240 8v38Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".24">
        <path d="M216 342c24 14 48 28 76 42l-22 10c-26-18-46-34-68-44Z"/>
        <path d="M526 384c24-16 48-12 78 26l-24 4c-20-24-38-32-60-22Z"/>
        <path d="M684 394c24-12 46 6 78 24l-22 6c-22-14-40-20-58-18Z"/>
        <path d="M160 352c20 12 36 24 52 36l-18 8c-18-14-32-26-46-34Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".3">
        <path d="M292 384c-22 18-40 26-64 28l12 12c30-6 46-20 64-32Z"/>
        <path d="M604 410c-20 16-38 22-60 24l10 10c28-4 44-16 62-28Z"/>
        <path d="M762 418c-18 14-34 20-54 22l8 10c26-4 40-14 56-24Z"/>
      </g>

    </svg>`;
  }

  function foregroundSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-foreground-soft)" opacity=".82"
        d="M0 540V354c54-24 106-8 158 4 52 12 104-12 158-6 54 6 104 22 158 12 54-10 104-8 158 0 54 8 104 18 158 4 42-11 82-6 120 2V540Z"/>
      <path fill="var(--bg-grass)"
        d="M0 540V424c58-26 108-8 164 8 56 16 108-12 164-4 56 8 108 24 164 10 56-14 108-10 164 2 56 12 108 20 164 4 32-10 62-8 90 0V540Z"/>
      <path fill="var(--bg-track)"
        d="M0 540V510c52 6 92 4 144 5 66 1 110 6 176 4 66-2 110-6 176-4 66 2 110 6 176 4 50-1 88-3 128-4v25Z"/>
      <g fill="var(--bg-foreground-soft)" opacity=".9">
        <ellipse cx="90" cy="386" rx="82" ry="28"/>
        <ellipse cx="140" cy="364" rx="40" ry="20"/>
        <ellipse cx="752" cy="388" rx="92" ry="30"/>
        <ellipse cx="814" cy="366" rx="36" ry="17"/>
        <ellipse cx="436" cy="400" rx="56" ry="22"/>
        <ellipse cx="486" cy="380" rx="29" ry="14"/>
      </g>
      <g fill="var(--bg-foreground-color)" opacity=".78">
        <path d="M180 540v-54h28v-26h6v26h18v54Zm520 0v-60h22v-24h6v24h16v60Z"/>
        <path d="M224 540v-42h24v-18h5v18h16v42Z" opacity=".55"/>
        <path d="M604 540v-46h20v-18h5v18h15v46Z" opacity=".5"/>
      </g>
    </svg>`;
  }

  function track(makeSvg) {
    return `<div class="bg-track">${makeSvg()}${makeSvg()}${makeSvg()}</div>`;
  }

  function build() {
    if (!container) return;
    container.innerHTML = [
      '<div class="bg-layer bg-sky"></div>',
      '<div class="bg-layer bg-stars"></div>',
      `<div class="bg-layer bg-clouds">${track(cloudSvg)}</div>`,
      `<div class="bg-layer bg-mountains">${track(mountainSvg)}</div>`,
      `<div class="bg-layer bg-foreground">${track(foregroundSvg)}</div>`,
    ].join('');
  }

  function applyReduced() {
    const reduced = userReduced || systemReduced;
    if (!container) return;
    container.classList.toggle('bg-reduced', reduced);
    document.documentElement.classList.toggle('reduce-motion', reduced);
    if (reduced) {
      container.style.setProperty('--bg-cloud-shift', '0');
      container.style.setProperty('--bg-mountain-shift', '0');
      container.style.setProperty('--bg-foreground-shift', '0');
    }
  }

  function setReducedMotion(value) {
    userReduced = Boolean(value);
    applyReduced();
  }

  function setTheme(next) {
    const valid = THEMES.has(next) ? next : 'day';
    theme = valid;
    document.documentElement.classList.remove('theme-day', 'theme-dusk', 'theme-night');
    document.documentElement.classList.add(`theme-${valid}`);
    if (container) container.dataset.theme = valid;
  }

  function setMode(next) {
    mode = next || 'menu';
    if (shell) shell.dataset.screen = mode;
  }

  function setLite(value) {
    lite = Boolean(value);
    document.documentElement.classList.toggle('bg-lite', lite);
  }

  function update(input = {}) {
    if (!container) return;
    if (userReduced || systemReduced || document.hidden) return;

    const time = Number(input.time) || 0;
    const camera = Number(input.camera) || 0;
    const currentMode = input.mode || mode;
    const menu = currentMode === 'menu' || currentMode === 'gameover';

    // One full cloud loop takes ~30 seconds on the menu. The second and
    // third copies keep the track filled while it scrolls.
    const cloudShift = mod(
      menu ? time * (TRACK_SHIFT / 30) : (camera / DESIGN_W) * 3.4 + time * .035,
      TRACK_SHIFT,
    );
    const mountainShift = mod(
      menu ? time * .035 : (camera / DESIGN_W) * 9.2 + time * .012,
      TRACK_SHIFT,
    );
    const foregroundShift = mod(
      menu ? 0 : (camera / DESIGN_W) * 18,
      TRACK_SHIFT,
    );

    container.style.setProperty('--bg-cloud-shift', cloudShift.toFixed(3));
    container.style.setProperty('--bg-mountain-shift', mountainShift.toFixed(3));
    container.style.setProperty('--bg-foreground-shift', foregroundShift.toFixed(3));
    container.style.setProperty(
      '--bg-star-shift',
      String(mod(time * .5, 100).toFixed(2)),
    );
  }

  function init(options = {}) {
    container = options.container || document.getElementById('worldBackground');
    shell = options.shell || document.getElementById('gameShell');
    if (!container) return;
    build();
    setTheme(options.theme || theme);
    setMode(options.mode || mode);
    if (options.lite !== undefined) setLite(options.lite);
    else if (mediaCoarse && mediaCoarse.matches) setLite(true);
    applyReduced();
    if (shell) shell.classList.add('has-background');
  }

  if (mediaMotion) {
    const onMotionChange = (event) => {
      systemReduced = event.matches;
      applyReduced();
    };
    if (mediaMotion.addEventListener) mediaMotion.addEventListener('change', onMotionChange);
    else if (mediaMotion.addListener) mediaMotion.addListener(onMotionChange);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && container) {
      // The next game loop update resumes without a large jump.
      container.style.willChange = 'transform';
    }
  });

  window.RunnerBackground = {
    init,
    setTheme,
    setMode,
    update,
    setReducedMotion,
    setLite,
    get theme() { return theme; },
  };
})();
