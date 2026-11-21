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

  // Small deterministic generator so the flock keeps its character.
  let birdSeed = 0x9e3779b9;
  let birds = [];
  const random = () => {
    birdSeed = (birdSeed * 1664525 + 1013904223) >>> 0;
    return birdSeed / 4294967296;
  };

  function cloudSvg(variant = 0) {
    const gid = nextArtId('bg-cloud');
    const v = ((variant % 3) + 3) % 3;

    const bodies = [
      [
        '<path d="M48 148c-14-1-23-11-20-23 3-11 14-17 26-17 3-16 16-28 33-28 10-17 32-25 50-17 12-12 31-13 44-2 16-7 34 1 40 17 16 1 28 13 26 26-1 12-12 20-25 20H68c-7 0-14 8-20 14Z"/>',
        '<path d="M292 170c-13-1-22-10-20-21 2-10 12-17 23-17 3-14 15-25 30-25 8-14 26-20 40-14 10-10 27-10 38 1 14-5 30 2 35 16 13 2 22 13 20 24-2 10-12 17-23 17H310c-6 0-13 8-18 13Z"/>',
        '<path d="M654 150c-16-1-26-13-22-27 4-13 17-20 31-20 4-18 19-31 38-31 11-17 33-24 52-17 13-11 33-11 46 1 17-4 35 6 40 24 16 3 27 17 24 31-2 12-13 21-27 21H674c-8 0-15 9-20 17Z"/>',
        '<path d="M846 106c-9 0-15-7-13-15 2-7 8-11 16-11 2-8 9-14 18-14 6-8 17-11 26-7 7-4 16-2 20 4 8 0 14 6 13 13-1 6-6 10-13 10h-55c-4 0-8 6-12 9Z"/>',
      ],
      [
        '<path d="M82 184c-26-2-40-22-33-43 7-20 27-32 49-28 9-28 35-46 63-39 18-22 51-26 74-10 21-14 48-4 59 19 25-2 45 15 47 36 2 20-14 35-35 37H114c-12 0-22 12-32 28Z"/>',
        '<path d="M360 154c-14-1-23-11-20-23 3-11 15-18 27-16 5-15 18-25 34-23 9-11 25-12 36-2 11-2 23 4 28 14 12 1 20 10 20 21 0 10-9 18-20 18H384c-7 0-14 7-19 11Z"/>',
        '<path d="M710 132c-12-1-20-9-17-19 2-9 12-15 22-14 4-12 14-20 26-19 7-9 20-10 29-2 9-1 18 4 22 12 9 1 15 8 15 16 0 8-7 14-16 14H733c-6 0-12 6-16 12Z"/>',
      ],
      [
        '<path d="M8 132c104-28 208-30 312-12 104 18 208 12 312-8 80-14 148-4 200 12v14c-80-8-160 0-240 10-112 14-224 4-336-6-80-8-168-4-248 4Z" opacity=".42"/>',
        '<path d="M84 172c92-18 184-18 276-2 92 16 184 10 276-4 52-8 100-2 144 10v12c-70-6-140 2-210 10-100 12-200 4-300-4-62-5-124-1-186 2Z" opacity=".3"/>',
        '<path d="M580 108c-15-1-24-12-20-24 3-11 14-18 26-17 4-15 17-24 32-22 8-10 23-12 34-4 10-2 20 3 25 11 11 1 18 9 18 19 0 9-8 16-18 16H600c-6 0-12 6-20 12Z" opacity=".7"/>',
      ],
    ][v].join('');

    const details = [
      [
        '<g class="cloud-detail" fill="var(--bg-cloud-highlight)" opacity=".62">',
        '<path d="M66 114c3-13 15-23 29-24 6-11 19-18 32-16 9-8 23-7 31 2 13 0 23 9 24 21 2 11-7 20-19 21H86c-10 0-18-4-20-4Z"/>',
        '<path d="M330 142c3-12 13-21 25-22 6-10 18-16 29-14 8-7 21-6 28 2 11 0 20 8 21 18 1 10-6 17-17 18h-64c-9 0-16-2-22-2Z"/>',
        '<path d="M700 120c4-14 16-24 30-25 7-12 20-18 33-15 9-8 23-6 31 4 13 1 23 10 23 22 0 11-9 20-21 20h-76c-10 0-16-6-20-6Z"/>',
        '</g>',
        '<g fill="var(--bg-cloud-shadow)" opacity=".24">',
        '<path d="M58 147h166c-18 9-48 12-78 10-33-2-64-4-88-10Z"/>',
        '<path d="M302 169h158c-19 8-44 10-71 9-30-1-60-3-87-9Z"/>',
        '<path d="M666 149h198c-21 9-52 12-85 11-41-1-80-4-113-11Z"/>',
        '</g>',
        '<g class="cloud-detail" fill="none" stroke="var(--bg-cloud-wisp)" stroke-width="2.2" stroke-linecap="round" opacity=".65">',
        '<path d="M104 176c20-5 40-6 60-3 16 2 30 1 44-4"/>',
        '<path d="M336 202c24-4 49-4 72 0 15 2 30 1 44-3"/>',
        '<path d="M704 184c20-4 40-4 60 0 12 2 23 1 34-2"/>',
        '</g>',
      ],
      [
        '<g class="cloud-detail" fill="var(--bg-cloud-highlight)" opacity=".58">',
        '<path d="M102 137c8-25 29-42 55-43 10-18 30-28 51-23 13-11 32-10 44 3 17-3 32 7 37 23 12 4 20 15 18 27-2 11-12 18-24 18H132c-14 0-23-3-30-5Z"/>',
        '<path d="M380 130c6-18 21-30 39-31 7-13 22-20 37-16 9-8 23-7 31 3 12 1 21 10 22 21 1 10-8 18-20 18h-94c-6 0-11 3-15 5Z"/>',
        '<path d="M728 111c5-15 18-25 33-26 6-11 19-17 32-13 8-7 20-6 27 2 10 1 18 8 19 18 1 9-7 16-17 16h-77c-6 0-12 2-17 3Z"/>',
        '</g>',
        '<g fill="var(--bg-cloud-shadow)" opacity=".26">',
        '<path d="M78 184h292c-30 12-76 16-126 12-51-3-93-6-166-12Z"/>',
        '<path d="M372 152h128c-17 8-43 11-70 9-24-2-42-4-58-9Z"/>',
        '<path d="M716 134h154c-22 10-53 13-86 11-30-1-56-4-68-11Z"/>',
        '</g>',
        '<g class="cloud-detail" fill="none" stroke="var(--bg-cloud-wisp)" stroke-width="2" stroke-linecap="round" opacity=".58">',
        '<path d="M62 204c27-6 55-7 83-3 20 2 38 1 55-4"/>',
        '<path d="M418 178c24-4 48-4 72-1 17 2 32 1 48-3"/>',
        '<path d="M742 154c20-4 40-4 59-1 12 2 22 1 34-2"/>',
        '</g>',
      ],
      [
        '<g class="cloud-detail" fill="var(--bg-cloud-highlight)" opacity=".38">',
        '<path d="M30 121c78-16 156-18 234-8 114 14 228 10 342-8 112-18 220-8 328 8v8c-110-14-220-14-330 2-112 16-224 16-336 4-80-8-160-4-238 2Z"/>',
        '<path d="M132 159c74-11 148-10 222 2 102 16 204 12 306-2 82-12 154-6 228 6v7c-84-10-168-4-252 6-102 12-204 10-306-2-66-8-132-6-198-1Z"/>',
        '<path d="M612 100c22-2 43 4 64 12-19 5-40 8-60 6-16-1-30-5-42-12 12-3 25-5 38-6Z" opacity=".7"/>',
        '</g>',
        '<g class="cloud-detail" fill="none" stroke="var(--bg-cloud-wisp)" stroke-width="1.8" stroke-linecap="round" opacity=".54">',
        '<path d="M68 198c44-8 88-8 132-2"/>',
        '<path d="M388 214c46-7 92-6 138 1"/>',
        '<path d="M690 190c34-5 68-4 102 2"/>',
        '</g>',
      ],
    ][v].join('');

    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--bg-cloud-highlight)"/>
          <stop offset=".58" style="stop-color:var(--bg-cloud-color)"/>
          <stop offset="1" style="stop-color:var(--bg-cloud-shadow)"/>
        </linearGradient>
      </defs>
      <g fill="url(#${gid})">${bodies}</g>
      ${details}
    </svg>`;
  }

  function mountainSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-mountain-far)" opacity=".68"
        d="M0 540V338c82-24 142 8 222-12 80-20 140-4 208 14 68 18 128-22 208-16 80 6 150 30 220 14 40-9 70-2 102 6V540Z"/>
      <path class="mountain-detail" fill="var(--bg-mountain-haze)" opacity=".24"
        d="M0 430c120-20 220 10 340-2 120-12 240 14 360 4 100-8 180 8 260 10v18c-80-8-160 10-240 2-140-14-280 10-420-2-100-9-200 8-300-2Z"/>
      <path fill="var(--bg-mountain-mid)" opacity=".94"
        d="M0 540V440c70-26 120-50 180-100 40-35 70-108 110-118 40-10 60 78 100 120 40 42 80 18 120-12 40-30 60-100 100-112 40-12 70 82 110 134 40 52 90 62 140 74 40 10 70 12 100 14V540Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".2">
        <path d="M300 222l32 54-20 2-17-38Z"/>
        <path d="M520 250l32 54-20 2-17-38Z"/>
        <path d="M620 218l32 54-20 2-17-38Z"/>
        <path d="M120 330l52 30-18 6-38-20Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".28">
        <path d="M300 222l-24 54 17 2 15-38Z"/>
        <path d="M520 250l-24 54 17 2 15-38Z"/>
        <path d="M620 218l-24 54 17 2 15-38Z"/>
        <path d="M180 340l-38 28 18 6 34-22Z"/>
      </g>
      <g fill="var(--bg-mountain-snow)" opacity=".82">
        <path d="M300 212l12 22-6 2-6-12-6 11-5-2Z"/>
        <path d="M520 240l12 22-6 2-6-12-6 11-5-2Z"/>
        <path d="M620 208l12 22-6 2-6-12-6 11-5-2Z"/>
      </g>
      <path fill="var(--bg-mountain-near)" opacity=".96"
        d="M0 540V474c120-18 220 12 340-2 120-14 220 20 340 6 120-14 220 8 280-4V540Z"/>
      <path fill="var(--bg-mountain-shadow)" opacity=".34"
        d="M0 540v-26c120-8 240-4 360-10 120-6 240 8 360 0 80-5 160 4 240 8v28Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".22">
        <path d="M196 360c24 14 48 28 76 42l-22 10c-26-18-46-34-68-44Z"/>
        <path d="M526 384c24-16 48-12 78 26l-24 4c-20-24-38-32-60-22Z"/>
        <path d="M684 394c24-12 46 6 78 24l-22 6c-22-14-40-20-58-18Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".28">
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

  function birdSvg() {
    return `<svg viewBox="0 0 34 18" aria-hidden="true" focusable="false">
      <g class="bg-bird__wings" fill="none" stroke="var(--bg-bird-color)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 11Q9 2 17 10"/>
        <path d="M17 10Q25 2 33 11"/>
        <path d="M13 10h8" stroke-width="1.6"/>
      </g>
    </svg>`;
  }

  function buildBirds() {
    birds = Array.from({ length: 7 }, (_, index) => ({
      base: random(),
      y: .07 + random() * .26,
      speed: .006 + random() * .018,
      dir: index % 2 === 0 ? 1 : -1,
      phase: random() * Math.PI * 2,
      flap: .55 + random() * .35,
      scale: .7 + random() * .65,
    }));
    return birds.map((bird, index) => (
      `<span class="bg-bird" data-bird="${index}" style="--bird-scale:${bird.scale.toFixed(2)};--bird-flap:${bird.flap.toFixed(2)}s">${birdSvg()}</span>`
    )).join('');
  }

  function track(makeSvg) {
    return `<div class="bg-track">${[0, 1, 2].map((index) => makeSvg(index)).join('')}</div>`;
  }

  function build() {
    if (!container) return;
    container.innerHTML = [
      '<div class="bg-layer bg-sky"></div>',
      '<div class="bg-layer bg-stars"></div>',
      `<div class="bg-layer bg-clouds">${track(cloudSvg)}</div>`,
      `<div class="bg-layer bg-birds">${buildBirds()}</div>`,
      `<div class="bg-layer bg-mountains">${track(mountainSvg)}</div>`,
      `<div class="bg-layer bg-foreground">${track(foregroundSvg)}</div>`,
    ].join('');
  }

  function updateBirds(time) {
    if (!container) return;
    const elements = container.querySelectorAll('.bg-bird');
    for (let index = 0; index < elements.length; index += 1) {
      const bird = birds[index];
      if (!bird) continue;
      const left = mod(bird.base + bird.dir * time * bird.speed, 1.2) - .1;
      const top = bird.y + Math.sin(time * .8 + bird.phase) * .018;
      elements[index].style.left = `${(left * 100).toFixed(2)}%`;
      elements[index].style.top = `${(top * 100).toFixed(2)}%`;
    }
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
    updateBirds(time);
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
