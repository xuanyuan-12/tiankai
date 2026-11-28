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

  function mountainFarSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-mountain-far)" opacity=".5"
        d="M0 540V330
          C72 308 118 322 188 302
          C258 282 316 248 388 266
          C460 284 510 312 584 298
          C658 284 716 246 786 264
          C846 280 904 306 960 330
          V540Z"/>
      <path class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".16"
        d="M0 396
          C108 408 208 382 318 392
          C428 402 536 412 648 394
          C756 378 864 398 960 412
          V422
          C864 412 756 392 648 408
          C536 426 428 416 318 406
          C208 396 108 422 0 410Z"/>
    </svg>`;
  }

  function mountainMidSvg() {
    const snowId = nextArtId('bg-snow');
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${snowId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--bg-mountain-snow)"/>
          <stop offset=".12" style="stop-color:var(--bg-mountain-snow)"/>
          <stop offset=".26" style="stop-color:var(--bg-mountain-mid)"/>
          <stop offset="1" style="stop-color:var(--bg-mountain-mid)"/>
        </linearGradient>
      </defs>
      <path fill="url(#${snowId})" opacity=".96"
        d="M0 540V438
          C58 424 112 392 170 366
          C232 338 268 224 332 214
          C392 204 436 292 496 326
          C554 358 604 314 662 278
          C722 240 770 218 826 238
          C878 256 918 320 960 438
          V540Z"/>
      <path class="mountain-detail" fill="var(--bg-mountain-haze)" opacity=".24"
        d="M0 438
          C104 420 208 448 312 436
          C424 424 528 452 640 440
          C752 428 856 448 960 456
          V472
          C856 456 752 448 640 462
          C528 474 424 452 312 456
          C208 460 104 442 0 454Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".22">
        <path d="M332 214C350 242 366 264 382 280L362 286C348 264 338 240 326 218Z"/>
        <path d="M826 238C846 258 860 276 876 292L856 298C842 276 832 256 820 242Z"/>
        <path d="M496 326C516 348 536 364 558 376L540 386C520 368 506 348 492 334Z"/>
        <path d="M170 366C194 384 216 398 240 410L222 418C198 404 182 386 162 376Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".3">
        <path d="M332 214C314 240 300 264 288 284L308 288C320 266 330 242 340 220Z"/>
        <path d="M826 238C808 262 794 284 782 300L802 304C814 280 824 256 834 244Z"/>
        <path d="M496 326C476 348 458 366 438 380L456 388C476 372 490 352 504 334Z"/>
        <path d="M170 366C148 384 130 400 110 410L128 418C148 404 162 386 180 376Z"/>
      </g>
    </svg>`;
  }

  function mountainNearSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-mountain-near)" opacity=".96"
        d="M0 540V486
          C62 478 120 452 178 440
          C238 428 282 382 342 370
          C402 358 452 420 512 430
          C572 440 622 398 682 388
          C742 378 802 420 862 450
          C908 472 936 480 960 486
          V540Z"/>
      <path fill="var(--bg-mountain-shadow)" opacity=".36"
        d="M0 540V512
          C104 506 208 510 312 502
          C424 494 536 510 648 502
          C752 494 856 502 960 510
          V540Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".22">
        <path d="M196 428C230 446 258 460 288 472L264 482C234 464 210 448 184 438Z"/>
        <path d="M570 430C598 412 624 420 652 458L628 462C606 438 586 432 564 442Z"/>
        <path d="M758 440C782 430 806 444 834 462L812 468C792 454 774 450 758 452Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".28">
        <path d="M292 450C270 466 252 474 230 476L240 488C268 484 284 470 302 460Z"/>
        <path d="M644 466C624 480 606 486 586 488L594 498C620 494 636 484 652 474Z"/>
      </g>
    </svg>`;
  }

  function treeSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-tree-color)" opacity=".86"
        d="M0 540V492c70-8 128 4 190-4 62-8 112-2 174 6 62 8 114-8 176-4 62 4 112 12 174 2 62-10 118 0 176 4 22 2 48 0 70-4V540Z"/>
      <g fill="var(--bg-tree-color)">
        <path d="M104 540v-92l-38 48h23l-32 40h25l-42 26h128l-42-26h25l-32-40h23l-38-48Z"/>
        <path d="M324 540v-74l-30 38h18l-26 32h20l-34 22h104l-34-22h20l-26-32h18l-30-38Z" opacity=".9"/>
        <path d="M742 540v-88l-34 44h20l-29 36h22l-38 24h118l-38-24h22l-29-36h20l-34-44Z" opacity=".92"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-tree-light)" opacity=".24">
        <path d="M104 448l-16 22h32Z"/>
        <path d="M742 452l-15 22h30Z"/>
        <path d="M324 466l-12 18h24Z"/>
      </g>
    </svg>`;
  }

  function foregroundSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-foreground-soft)" opacity=".8"
        d="M0 540V430c58-20 108-4 166 8 58 12 108-12 166-6 58 6 108 22 166 10 58-12 108-8 166 4 58 12 108 18 166 2 40-10 76-6 130 0V540Z"/>
      <path fill="var(--bg-grass)"
        d="M0 540V478c40-22 82-4 126 8 44 12 86-14 130-4 44 10 86 22 130 8 44-14 86-6 130 2 44 8 86 18 130 2 44-16 86-8 130 4 44 12 84 10 138-4 14-4 26-2 36 0V540Z"/>
      <path fill="var(--bg-grass-light)" opacity=".5"
        d="M0 478c40-22 82-4 126 8l-6 8c-40-12-80-26-120-6Zm260 4c44 10 86 22 130 8l-4 8c-42 12-84 0-126-8Zm260-6c44 8 86 18 130 2l-4 8c-42 14-84 6-126-2Zm260 4c44 12 84 10 138-4l4 8c-54 16-98 18-142 4Z"/>
      <path fill="var(--bg-track)" d="M0 540V518c58 4 104 0 162 6 58 6 116 0 174 2 58 2 116 6 174 2 58-4 116-6 174-4 58 2 104 4 162 0 38-2 76-2 114 0v16Z"/>
      <g fill="var(--bg-track-detail)" opacity=".34">
        <path d="M64 528l12-4 8 4-4 5-12 1Z"/>
        <path d="M254 536l10-3 8 4-5 5-11-1Z"/>
        <path d="M470 526l13-4 9 5-6 5-14-1Z"/>
        <path d="M692 534l11-4 8 4-4 5-13 0Z"/>
        <path d="M842 526l9-3 7 4-4 4-10-1Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-foreground-color)" opacity=".52">
        <path d="M26 500l10-18 8 18h-6l6 10H30l6-10Z"/>
        <path d="M338 508l9-16 8 16h-6l6 10h-18l6-10Z"/>
        <path d="M622 504l9-16 8 16h-6l6 10h-18l6-10Z"/>
        <path d="M906 500l9-17 8 17h-6l6 10h-17l6-10Z"/>
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
      '<div class="bg-layer bg-motes"></div>',
      `<div class="bg-layer bg-clouds bg-clouds--back">${track(cloudSvg)}</div>`,
      `<div class="bg-layer bg-mountains bg-mountains--far">${track(mountainFarSvg)}</div>`,
      `<div class="bg-layer bg-mountains bg-mountains--mid">${track(mountainMidSvg)}</div>`,
      `<div class="bg-layer bg-mountains bg-mountains--near">${track(mountainNearSvg)}</div>`,
      `<div class="bg-layer bg-clouds bg-clouds--front">${track((index) => cloudSvg(index + 1))}</div>`,
      `<div class="bg-layer bg-birds">${buildBirds()}</div>`,
      `<div class="bg-layer bg-trees">${track(treeSvg)}</div>`,
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
      [
        '--bg-cloud-back-shift',
        '--bg-cloud-front-shift',
        '--bg-mountain-far-shift',
        '--bg-mountain-mid-shift',
        '--bg-mountain-near-shift',
        '--bg-tree-shift',
        '--bg-foreground-shift',
      ].forEach((name) => container.style.setProperty(name, '0'));
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
    const travel = menu ? 0 : (camera / DESIGN_W) * 28;
    const cloudBackShift = mod(
      menu ? time * (TRACK_SHIFT / 40) : travel * .05 + time * .0015,
      TRACK_SHIFT,
    );
    const cloudFrontShift = mod(
      menu ? time * (TRACK_SHIFT / 28) : travel * .05 + time * .003,
      TRACK_SHIFT,
    );
    const farShift = mod(menu ? 0 : travel * .08, TRACK_SHIFT);
    const midShift = mod(menu ? 0 : travel * .15, TRACK_SHIFT);
    const nearShift = mod(menu ? 0 : travel * .3, TRACK_SHIFT);
    const treeShift = mod(menu ? 0 : travel * .6, TRACK_SHIFT);
    const foregroundShift = mod(menu ? 0 : travel, TRACK_SHIFT);

    container.style.setProperty('--bg-cloud-back-shift', cloudBackShift.toFixed(3));
    container.style.setProperty('--bg-cloud-front-shift', cloudFrontShift.toFixed(3));
    container.style.setProperty('--bg-mountain-far-shift', farShift.toFixed(3));
    container.style.setProperty('--bg-mountain-mid-shift', midShift.toFixed(3));
    container.style.setProperty('--bg-mountain-near-shift', nearShift.toFixed(3));
    container.style.setProperty('--bg-tree-shift', treeShift.toFixed(3));
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
