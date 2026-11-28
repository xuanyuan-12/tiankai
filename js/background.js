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
      <path fill="var(--bg-mountain-far)" opacity=".58"
        d="M0 540V332
          L28 326 54 306 82 318 112 288 142 304 172 272 202 292
          L232 258 262 282 292 246 322 270 352 232 382 258
          L414 220 446 250 478 214 508 244 540 204 572 236
          L604 198 636 230 668 190 700 226 732 188 764 222
          L796 192 828 226 858 252 886 284 912 316 936 334 960 332
          V540Z"/>
      <path class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".14"
        d="M0 382 30 366 58 378 88 350 120 368 152 338 184 356
          216 326 248 346 280 314 314 334 346 300 378 322
          412 286 446 312 480 278 514 304 548 270 582 296
          616 260 650 288 686 252 718 280 752 246 786 276
          820 262 852 292 884 322 914 350 938 372 960 368
          V396 938 398 914 374 884 346 852 316 820 286
          786 300 752 270 718 304 686 276 650 312 616 284
          582 320 548 294 514 328 480 302 446 336 412 310
          378 346 346 324 314 358 280 338 248 370 216 350
          184 380 152 362 120 392 88 374 58 402 30 390 0 406Z"/>
    </svg>`;
  }

  function mountainMidSvg() {
    const snowId = nextArtId('bg-snow');
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${snowId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--bg-mountain-snow)"/>
          <stop offset=".2" style="stop-color:var(--bg-mountain-snow)"/>
          <stop offset=".34" style="stop-color:var(--bg-mountain-mid)"/>
          <stop offset="1" style="stop-color:var(--bg-mountain-mid)"/>
        </linearGradient>
      </defs>
      <path fill="url(#${snowId})"
        d="M0 540V438
          L30 436 54 410 78 430 108 392 138 416 168 374 198 400
          L230 348 262 382 294 316 326 354 356 278 388 324
          L418 252 452 300 482 224 516 276 546 190 580 248
          L610 168 644 226 674 142 708 208 738 128 770 196
          L798 154 830 218 856 272 884 326 910 378 936 420 960 438
          V540Z"/>
      <path class="mountain-detail" fill="var(--bg-mountain-haze)" opacity=".22"
        d="M0 438C80 448 160 444 240 452C320 460 400 456 480 464C560 472 640 468 720 458C800 448 880 452 960 460V488C880 480 800 476 720 486C640 496 560 500 480 492C400 484 320 488 240 480C160 472 80 476 0 466Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".2">
        <path d="M356 278 384 330 402 392 378 398 354 338 338 288Z"/>
        <path d="M674 142 704 214 724 288 700 296 670 216 650 170Z"/>
        <path d="M738 128 770 206 790 280 764 286 734 204 714 158Z"/>
        <path d="M546 190 574 250 592 310 566 316 538 252 522 216Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".28">
        <path d="M356 278 336 326 316 378 340 384 362 326 376 292Z"/>
        <path d="M674 142 650 204 630 266 654 272 680 202 696 170Z"/>
        <path d="M482 224 462 278 444 330 468 336 490 276 504 244Z"/>
        <path d="M798 154 778 222 760 286 784 292 806 220 820 184Z"/>
      </g>
    </svg>`;
  }

  function mountainNearSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-mountain-near)" opacity=".98"
        d="M0 540V486
          L34 482 62 454 92 470 124 438 156 458 188 424 220 448
          L252 414 284 438 316 402 348 430 380 396 412 424
          L444 392 476 418 508 386 540 412 572 390 604 414
          L636 392 668 418 700 400 732 428 764 412 796 440
          L828 454 858 470 888 476 920 482 960 486
          V540Z"/>
      <path fill="var(--bg-mountain-shadow)" opacity=".4"
        d="M0 540V512C80 508 160 514 240 510C320 506 400 516 480 512C560 508 640 518 720 514C800 510 880 516 960 510V540Z"/>
      <g class="mountain-detail" fill="var(--bg-mountain-light)" opacity=".18">
        <path d="M188 424 220 448 244 470 218 478 194 450 170 434Z"/>
        <path d="M380 396 412 424 438 448 412 456 386 426 362 410Z"/>
        <path d="M572 390 604 414 630 438 604 444 578 418 554 402Z"/>
        <path d="M764 412 796 440 820 462 794 468 768 442 744 424Z"/>
      </g>
      <g class="mountain-detail" fill="var(--bg-mountain-shadow)" opacity=".28">
        <path d="M188 424 166 448 146 466 162 476 184 450 202 436Z"/>
        <path d="M380 396 358 420 338 440 356 448 378 422 396 408Z"/>
        <path d="M700 400 678 424 658 444 676 452 698 426 716 412Z"/>
      </g>
    </svg>`;
  }

  function treeSvg() {
    const grove = [
      [26, 54, 16], [68, 88, 25], [118, 62, 19], [176, 104, 30],
      [238, 70, 22], [300, 118, 34], [368, 78, 24], [432, 96, 29],
      [500, 64, 20], [566, 112, 33], [636, 76, 23], [704, 126, 37],
      [776, 88, 26], [842, 108, 31], [910, 72, 22],
    ].map(([x, h, w], index) => `
      <path d="M${x} 540V${540 - h}l-${w} ${h}Z" opacity="${(0.68 + (index % 3) * 0.08).toFixed(2)}"/>
      <path d="M${x} 540V${540 - h * .78}l-${w * .72} ${h * .78}Z" opacity=".72"/>`
    ).join('');
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-tree-color)" opacity=".82"
        d="M0 540V506C80 500 160 510 240 506C320 502 400 514 480 508C560 502 640 512 720 506C800 500 880 508 960 504V540Z"/>
      <g fill="var(--bg-tree-color)">${grove}</g>
      <g class="mountain-detail" fill="var(--bg-tree-light)" opacity=".22">
        <path d="M176 540 146 540 176 436Z"/>
        <path d="M300 540 266 540 300 422Z"/>
        <path d="M704 540 667 540 704 414Z"/>
        <path d="M842 540 811 540 842 432Z"/>
      </g>
    </svg>`;
  }

  function foregroundSvg() {
    const blades = [18, 44, 78, 116, 152, 188, 226, 262, 300, 336, 374, 412, 450, 488, 526, 564, 602, 640, 678, 716, 754, 792, 830, 868, 906, 940]
      .map((x, index) => `<path d="M${x} ${500 + (index % 3) * 3}q${(index % 2 ? -1 : 1) * 4}-12 ${(index % 2 ? -1 : 1) * 10}-20"/>`)
      .join('');
    const flowers = [106, 250, 394, 536, 682, 822, 918]
      .map((x, index) => `<circle cx="${x}" cy="${492 + (index % 2) * 5}" r="2.2" opacity=".8"/><circle cx="${x + 5}" cy="${488 + (index % 3) * 4}" r="1.6" opacity=".62"/>`)
      .join('');
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-foreground-soft)" opacity=".8"
        d="M0 540V430c58-20 108-4 166 8 58 12 108-12 166-6 58 6 108 22 166 10 58-12 108-8 166 4 58 12 108 18 166 2 40-10 76-6 130 0V540Z"/>
      <path fill="var(--bg-grass)"
        d="M0 540V478c40-22 82-4 126 8 44 12 86-14 130-4 44 10 86 22 130 8 44-14 86-6 130 2 44 8 86 18 130 2 44-16 86-8 130 4 44 12 84 10 138-4 14-4 26-2 36 0V540Z"/>
      <path fill="var(--bg-grass-light)" opacity=".46"
        d="M0 478c40-22 82-4 126 8l-6 8c-40-12-80-26-120-6Zm260 4c44 10 86 22 130 8l-4 8c-42 12-84 0-126-8Zm260-6c44 8 86 18 130 2l-4 8c-42 14-84 6-126-2Zm260 4c44 12 84 10 138-4l4 8c-54 16-98 18-142 4Z"/>
      <path fill="var(--bg-track)" d="M0 540V518c58 4 104 0 162 6 58 6 116 0 174 2 58 2 116 6 174 2 58-4 116-6 174-4 58 2 104 4 162 0 38-2 76-2 114 0v16Z"/>
      <path fill="var(--bg-track-detail)" opacity=".26"
        d="M0 540V526c76 2 152 6 228 4 76-2 152-4 228-2 76 2 152 4 228 2 92-2 184-2 276 2v8Z"/>
      <g fill="none" stroke="var(--bg-grass-light)" stroke-width="2" stroke-linecap="round" opacity=".72">${blades}</g>
      <g fill="var(--bg-track-detail)" opacity=".34">
        <path d="M64 528l12-4 8 4-4 5-12 1Z"/>
        <path d="M254 536l10-3 8 4-5 5-11-1Z"/>
        <path d="M470 526l13-4 9 5-6 5-14-1Z"/>
        <path d="M692 534l11-4 8 4-4 5-13 0Z"/>
        <path d="M842 526l9-3 7 4-4 4-10-1Z"/>
        <path d="M128 534l16-3 10 4-7 4-17-1Z" opacity=".6"/>
        <path d="M578 528l14-3 9 4-6 4-15-1Z" opacity=".55"/>
      </g>
      <g fill="var(--bg-foreground-color)" opacity=".5">${flowers}</g>
      <g class="mountain-detail" fill="var(--bg-foreground-color)" opacity=".46">
        <path d="M26 500l10-18 8 18h-6l6 10H30l6-10Z"/>
        <path d="M338 508l9-16 8 16h-6l6 10h-18l6-10Z"/>
        <path d="M622 504l9-16 8 16h-6l6 10h-18l6-10Z"/>
        <path d="M906 500l9-17 8 17h-6l6 10h-17l6-10Z"/>
        <path d="M158 512l7-13 6 13h-4l4 8h-13l4-8Z"/>
        <path d="M806 508l7-12 6 12h-4l4 8h-13l4-8Z"/>
      </g>
      <g fill="var(--bg-track-detail)" opacity=".18">
        <path d="M34 532c18-4 36-4 54 0-16 4-34 5-54 0Z"/>
        <path d="M332 536c22-3 44-3 66 0-20 4-42 4-66 0Z"/>
        <path d="M708 534c18-3 36-2 54 0-16 3-34 4-54 0Z"/>
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

  function cartoonFarSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-cartoon-far)" d="M0 540V356L36 340 62 300 96 326 128 276 160 306 196 248 226 282 260 226 292 258 328 210 360 244 396 190 428 224 462 174 494 210 526 178 560 214 596 168 628 206 662 186 696 230 728 204 762 252 794 224 828 276 860 250 894 300 926 284 960 336V540Z"/>
      <path fill="var(--bg-cartoon-far-snow)" opacity=".55" d="M328 210 360 244 396 190 428 224 462 174 494 210 526 178 560 214 596 168 628 206 662 186 696 230 728 204 744 230 720 222 700 246 676 220 652 244 628 218 604 240 580 210 556 236 532 204 508 232 484 200 460 224 436 198 412 224 388 202 364 230 340 206Z"/>
      <path fill="none" stroke="var(--bg-cartoon-line)" stroke-width="1.1" opacity=".45" d="M0 356 36 340 62 300 96 326 128 276 160 306 196 248 226 282 260 226 292 258 328 210 360 244 396 190 428 224 462 174 494 210 526 178 560 214 596 168 628 206 662 186 696 230 728 204 762 252 794 224 828 276 860 250 894 300 926 284 960 336"/>
    </svg>`;
  }

  function cartoonNearSvg() {
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--bg-cartoon-near)" d="M0 540V430L40 414 70 380 104 402 132 360 166 388 198 344 228 372 260 328 292 356 328 320 362 352 398 316 434 346 468 300 500 332 536 300 570 338 604 310 638 348 672 316 706 354 742 326 776 362 812 340 848 376 884 356 920 398 944 430 960 430V540Z"/>
      <path fill="var(--bg-cartoon-near-light)" opacity=".45" d="M0 486 40 472 70 450 104 466 132 436 166 460 198 426 228 448 260 418 292 442 328 410 362 438 398 406 434 430 468 396 500 422 536 396 570 428 604 402 638 436 672 410 706 442 742 418 776 450 812 430 848 462 884 444 920 476 944 492 960 492V540H0Z"/>
      <path fill="none" stroke="var(--bg-cartoon-line)" stroke-width="1.2" opacity=".5" d="M0 430 40 414 70 380 104 402 132 360 166 388 198 344 228 372 260 328 292 356 328 320 362 352 398 316 434 346 468 300 500 332 536 300 570 338 604 310 638 348 672 316 706 354 742 326 776 362 812 340 848 376 884 356 920 398 944 430 960 430"/>
    </svg>`;
  }

  function cartoonMidSvg() {
    const clip = nextArtId('cartoon-mid');
    const body = 'M0 540V384L30 366 58 330 88 348 116 300 146 326 174 270 204 300 236 246 266 278 294 220 326 252 354 196 384 228 412 168 444 204 472 142 502 176 528 120 556 154 582 98 612 136 640 86 668 122 694 166 718 140 744 188 770 164 800 212 828 190 856 244 884 222 914 300 940 340 960 384V540Z';
    const ridge = 'M0 384 30 366 58 330 88 348 116 300 146 326 174 270 204 300 236 246 266 278 294 220 326 252 354 196 384 228 412 168 444 204 472 142 502 176 528 120 556 154 582 98 612 136 640 86 668 122 694 166 718 140 744 188 770 164 800 212 828 190 856 244 884 222 914 300 940 340 960 384';
    const snow = 'M354 196 384 228 412 168 444 204 472 142 502 176 528 120 556 154 582 98 612 136 640 86 668 122 694 166 718 140 744 188 770 164 800 212 828 190 856 244 884 222 914 300 940 340 960 384 960 350 936 320 918 352 894 318 870 348 846 306 824 340 800 300 776 336 750 298 726 330 700 292 676 326 652 288 630 320 606 282 582 316 558 278 534 312 510 276 486 308 462 270 438 302 414 266 390 298 366 270 342 300 320 270 296 300 272 270 248 300 224 266 200 296 176 264 152 294 128 266 104 296 80 270 56 300 32 278 354 196Z';
    return `<svg viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><clipPath id="${clip}"><path d="${body}"/></clipPath></defs>
      <path fill="var(--bg-cartoon-rock)" d="${body}"/>
      <g clip-path="url(#${clip})">
        <path fill="var(--bg-cartoon-sun)" opacity=".58" d="M582 98 612 136 640 86 668 122 694 166 718 140 744 188 770 164 800 212 828 190 856 244 884 222 914 300 940 340 930 400 880 360 840 300 800 270 760 230 720 210 680 180 640 155 610 170 580 140Z"/>
        <path fill="var(--bg-cartoon-shade)" opacity=".5" d="M412 168 444 204 472 142 502 176 528 120 556 154 582 98 612 136 640 86 650 185 615 205 580 190 545 225 510 205 478 215 450 180Z"/>
        <path fill="var(--bg-cartoon-sun)" opacity=".55" d="M236 246 266 278 294 220 326 252 354 196 384 228 412 168 430 190 410 245 380 265 350 235 320 260 286 245Z"/>
        <path fill="var(--bg-cartoon-snow)" opacity=".96" d="${snow}"/>
        <path fill="none" stroke="var(--bg-cartoon-ridge)" stroke-width="1.2" opacity=".7" d="M354 196 412 168 472 142 528 120 582 98 640 86 694 166 744 188 800 212 856 244 914 300 960 384"/>
      </g>
      <path fill="none" stroke="var(--bg-cartoon-line)" stroke-width="1.5" opacity=".8" d="${ridge}"/>
    </svg>`;
  }

  function track(makeSvg) {
    return `<div class="bg-track">${[0, 1, 2].map((index) => makeSvg(index)).join('')}</div>`;
  }

  function build() {
    if (!container) return;
    container.innerHTML = [
      '<div class="bg-layer bg-sky"></div>',
      '<div class="bg-layer bg-cartoon-image"><div class="bg-cartoon-photo-track"><img class="bg-cartoon-photo" src="assets/cartoon-snow-bg.webp" alt="" decoding="async"></div></div>',
      '<div class="bg-layer bg-stars"></div>',
      '<div class="bg-layer bg-motes"></div>',
      `<div class="bg-layer bg-clouds bg-clouds--back">${track(cloudSvg)}</div>`,
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
        '--bg-cartoon-shift',
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
    container.style.setProperty('--bg-cartoon-shift', midShift.toFixed(3));
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
