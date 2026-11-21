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

  function cloudSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g fill="var(--bg-cloud-color)">
        <ellipse cx="130" cy="128" rx="84" ry="27"/>
        <ellipse cx="184" cy="113" rx="48" ry="24"/>
        <ellipse cx="88" cy="113" rx="36" ry="18"/>
        <ellipse cx="420" cy="82" rx="74" ry="23"/>
        <ellipse cx="466" cy="70" rx="40" ry="19"/>
        <ellipse cx="380" cy="70" rx="31" ry="15"/>
        <ellipse cx="748" cy="154" rx="92" ry="25"/>
        <ellipse cx="802" cy="140" rx="46" ry="21"/>
        <ellipse cx="700" cy="144" rx="38" ry="18"/>
        <ellipse cx="900" cy="76" rx="52" ry="17"/>
        <ellipse cx="934" cy="67" rx="29" ry="14"/>
      </g>
      <g fill="var(--bg-cloud-soft)">
        <ellipse cx="300" cy="192" rx="104" ry="17"/>
        <ellipse cx="344" cy="184" rx="56" ry="13"/>
        <ellipse cx="618" cy="196" rx="118" ry="18"/>
        <ellipse cx="658" cy="187" rx="60" ry="14"/>
      </g>
    </svg>`;
  }

  function mountainSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-mountain-deep)" opacity=".82"
        d="M0 540V422l92-86 48 34 74-72 58 56 62-104 50 76 72-86 68 74 58-54 62 76 58-44 68 86 54-58 62 88 64-48v214Z"/>
      <path fill="var(--bg-mountain-color)" opacity=".92"
        d="M0 540V468l82-58 52 30 56-44 54 42 70-66 58 54 62-78 58 58 72-44 64 62 58-46 70 72 58-40 66 76 52-34 68 78v110Z"/>
      <path fill="var(--bg-mountain-deep)" opacity=".42"
        d="M0 540V496l92-34 58 20 64-30 58 26 66-34 52 24 74-38 58 30 62-28 72 38 54-24 68 34 62-26 70 36 56-20 62 30v52Z"/>
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

  function track(svg) {
    return `<div class="bg-track">${svg}${svg}${svg}</div>`;
  }

  function build() {
    if (!container) return;
    container.innerHTML = [
      '<div class="bg-layer bg-sky"></div>',
      '<div class="bg-layer bg-stars"></div>',
      `<div class="bg-layer bg-clouds">${track(cloudSvg())}</div>`,
      `<div class="bg-layer bg-mountains">${track(mountainSvg())}</div>`,
      `<div class="bg-layer bg-foreground">${track(foregroundSvg())}</div>`,
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
