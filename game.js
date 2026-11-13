/* ============================================================
   SUPER MARIO RUN — game logic
   Everything is drawn by hand on a canvas; no external assets.
   ============================================================ */

(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const DESIGN_W = 960;
  const DESIGN_H = 540;
  const GROUND_Y = 430;

  const PLAYER_W = 36;
  const PLAYER_H = 76;
  const PLAYER_SCREEN_X = 248;

  const GRAVITY = 2420;
  const HOLD_GRAVITY = 1640;
  const MAX_FALL = 1180;
  const JUMP_V = -765;
  const DOUBLE_JUMP_V = -690;

  const INK = '#19243b';
  const CREAM = '#fff9e9';

  const STORAGE = {
    best: 'mario-run-best-v1',
    bests: 'mario-run-best-v2',
    bestsV3: 'mario-run-best-v3',
    mode: 'mario-run-mode-v1',
    avatar: 'mario-run-avatar-v1',
    custom: 'mario-run-custom-v1',
    muted: 'mario-run-muted-v1',
    musicVolume: 'mario-run-music-volume-v1',
    sfxVolume: 'mario-run-sfx-volume-v1',
    version: 'mario-run-version-v1',
    difficulty: 'mario-run-difficulty-v1',
    board: 'mario-run-board-v1',
    achievements: 'mario-run-achievements-v1',
    achievementsV2: 'mario-run-achievements-v2',
    nickname: 'mario-run-nickname-v1',
    nicknameChanges: 'mario-run-nickname-changes-v1',
    boardReset: 'mario-run-board-reset-v1',
    avatarImports: 'mario-run-avatar-imports-v1',
    playerId: 'mario-run-player-id-v1',
    pendingScores: 'mario-run-pending-scores-v1',
  };

  const ONLINE = Object.freeze({
    url: 'https://jwhfpixplrltncxeoydb.supabase.co',
    key: 'sb_publishable_cGTEJNDDMo5rN9wha6EJ2w_Iao0DV1y',
    table: 'scores',
    timeout: 15000,
    limit: 100,
    epoch: '2026-11-07T02:45:30Z',
  });

  const BOARD_LIMIT = 300;
  const MIN_LEADERBOARD_DISTANCE = 100;
  const STOMP_MIN_VY = 180;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const mod = (n, m) => ((n % m) + m) % m;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const padScore = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));

  function readStore(key, fallback = null) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function seedRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function getOnlinePlayerId() {
    let id = readStore(STORAGE.playerId, '');
    if (!isUuid(id)) {
      id = makeUuid();
      writeStore(STORAGE.playerId, id);
    }
    return id;
  }

  async function fetchWithTimeout(url, options = {}, timeout = ONLINE.timeout) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawImageCover(ctx, img, x, y, w, h, focusY = 0.5) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) * focusY;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ==========================================================
     Characters
     ========================================================== */

  const PALETTES = {
    mario: {
      skin: '#ffcb94', shade: '#e7a263', hair: '#5c301b',
      cap: '#ec4245', capShade: '#b31f2e', shirt: '#ec4245',
      overalls: '#2c60c5', overallShade: '#1c4594', shoes: '#60341f',
      shoeSole: '#352116', glove: '#fffaf0', accent: '#ffd23f',
    },
    luigi: {
      skin: '#ffd19d', shade: '#e4a96c', hair: '#57301b',
      cap: '#32b653', capShade: '#187d35', shirt: '#32b653',
      overalls: '#2c60c5', overallShade: '#1c4594', shoes: '#57301d',
      shoeSole: '#332015', glove: '#fffaf0', accent: '#ffd23f',
    },
    peach: {
      skin: '#ffdcc7', shade: '#eeb79e', hair: '#ffd45d',
      hairShade: '#e3ad28', cap: '#f47ca8', capShade: '#cf4e7d',
      shirt: '#f47ca8', overalls: '#f8b4cc', overallShade: '#d9678c',
      shoes: '#f06292', shoeSole: '#b53d67', glove: '#fff9f2',
      accent: '#5cc8ff',
    },
    toad: {
      skin: '#ffe3bd', shade: '#e8c18d', hair: '#eec48d',
      cap: '#f7f0df', capShade: '#d9c9aa', shirt: '#5788df',
      overalls: '#f4ead2', overallShade: '#c9baa2', shoes: '#6f4c39',
      shoeSole: '#3e2c22', glove: '#fffaf0', accent: '#ef4a4d',
    },
    custom: {
      skin: '#ffce9c', shade: '#e8a163', hair: '#5c301b',
      cap: '#7659ff', capShade: '#4e38be', shirt: '#7659ff',
      overalls: '#222f63', overallShade: '#161f46', shoes: '#2d2635',
      shoeSole: '#17141d', glove: '#fffaf0', accent: '#ffd23f',
    },
  };

  const DEFAULT_AVATAR = {
    id: 'default', name: '默认头像', head: 'image',
    file: 'default.svg', src: 'avatars/default.svg',
    portrait: ['#e8f6df', '#8fd6a6'], accent: '#2f9e50', image: null,
  };

  const CUSTOM_AVATAR = {
    id: 'custom', name: '上传照片', head: 'custom', letter: '＋',
    portrait: ['#eee7ff', '#b398f4'], accent: '#e14347',
  };

  let AVATARS = [DEFAULT_AVATAR, CUSTOM_AVATAR];

  const avatarById = (id) => AVATARS.find((a) => a.id === id) || AVATARS[0] || DEFAULT_AVATAR;
  const paletteFor = (id) => PALETTES[id] || PALETTES.custom;
  const paletteForAvatar = (avatar) => {
    if (avatar && avatar.head === 'image') {
      return {
        ...PALETTES.custom,
        cap: avatar.accent || PALETTES.custom.cap,
        shirt: avatar.accent || PALETTES.custom.shirt,
      };
    }
    return paletteFor(avatar && avatar.id);
  };

  function makeImageAvatar(item) {
    const file = String(item.file || '');
    const src = file.startsWith('data:') ? file : `avatars/${file}`;
    return {
      id: String(item.id || file || 'avatar'),
      name: String(item.name || '头像'),
      head: 'image',
      file,
      src,
      portrait: ['#e8f6df', item.accent || '#8fd6a6'],
      accent: item.accent || '#2f9e50',
      image: null,
    };
  }

  function readImportedAvatars() {
    try {
      const parsed = JSON.parse(readStore(STORAGE.avatarImports, '[]') || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && item.data).slice(-24);
    } catch (error) {
      return [];
    }
  }

  function buildAvatarList() {
    const list = [];
    const seen = new Set();
    const manifest = Array.isArray(window.AVATAR_MANIFEST) ? window.AVATAR_MANIFEST : [];
    for (const item of manifest) {
      if (!item || !item.file) continue;
      const avatar = makeImageAvatar(item);
      if (seen.has(avatar.id)) continue;
      seen.add(avatar.id);
      list.push(avatar);
    }
    for (const item of readImportedAvatars()) {
      const avatar = makeImageAvatar({ id: item.id, name: item.name, file: item.data, accent: '#4b87e5' });
      if (seen.has(avatar.id)) continue;
      seen.add(avatar.id);
      list.push(avatar);
    }
    if (!list.length) {
      list.push(makeImageAvatar({ id: 'default', name: '默认头像', file: 'default.svg' }));
    }
    list.push(CUSTOM_AVATAR);
    return list;
  }

  function loadAvatarImage(avatar) {
    if (!avatar || avatar.head !== 'image' || !avatar.src || avatar.image) return;
    const image = new Image();
    image.onload = () => {
      avatar.image = image;
      if (selectedAvatar().id === avatar.id) {
        refreshAvatarUI();
        drawHudAvatar(avatar);
      }
    };
    image.onerror = () => {
      avatar.image = null;
    };
    image.src = avatar.src;
  }

  function loadAllAvatarImages(list = AVATARS) {
    for (const avatar of list) loadAvatarImage(avatar);
  }

  function loadCustomImageData(data) {
    state.customData = data;
    state.customImage = null;
    if (!data) {
      refreshAvatarUI();
      return;
    }
    const image = new Image();
    image.onload = () => {
      state.customImage = image;
      refreshAvatarUI();
      drawHudAvatar(selectedAvatar());
    };
    image.onerror = () => {
      state.customImage = null;
      if (state.selected === 'custom') {
        state.selected = (AVATARS[0] && AVATARS[0].id) || 'default';
        writeStore(STORAGE.avatar, state.selected);
      }
      refreshAvatarUI();
    };
    image.src = data;
  }

  function applyAvatarFromStorage() {
    const stored = readStore(STORAGE.avatar, null);
    const custom = readStore(STORAGE.custom, null);
    AVATARS = buildAvatarList();
    loadAllAvatarImages();
    state.selected = AVATARS.some((avatar) => avatar.id === stored) ? stored : ((AVATARS[0] && AVATARS[0].id) || 'default');
    if (state.selected === 'custom' && !custom) state.selected = (AVATARS[0] && AVATARS[0].id) || 'default';
    if (custom !== state.customData || (custom && !state.customImage)) loadCustomImageData(custom);
    refreshAvatarUI();
  }

  /* ==========================================================
     Game rules: easy / normal / hard / extreme
     ========================================================== */

  const BLOCK_PRIZE = Object.freeze({ heartChance: .25, score: [1000, 5000] });

  const MODE_RULES = Object.freeze({
    easy: Object.freeze({
      key: 'easy',
      label: '简单',
      tagline: '570 极速 · 20 币回心 · 跳跃 100%',
      stompBase: 1000,
      comboMultiply: true,
      blockPrize: BLOCK_PRIZE,
      coinsPerHeart: 20,
      maxSpeed: 570,
      jumpHeightScale: 1,
      hurtInvincible: 1.75,
      pitInvincible: 2.1,
      pitRescue: true,
      maxHearts: 3,
      heal: true,
      heartPrize: true,
      enemies: false,
      flyers: false,
      spikes: false,
      groundSpeed: 1.5,
    }),
    normal: Object.freeze({
      key: 'normal',
      label: '普通',
      tagline: '700 极速 · 30 币回心 · 跳跃 95%',
      stompBase: 1000,
      comboMultiply: true,
      blockPrize: BLOCK_PRIZE,
      coinsPerHeart: 30,
      maxSpeed: 700,
      jumpHeightScale: .95,
      hurtInvincible: 1.225,
      pitInvincible: 1.47,
      pitRescue: true,
      maxHearts: 3,
      heal: true,
      heartPrize: true,
      flyers: false,
      groundSpeed: 2,
    }),
    hard: Object.freeze({
      key: 'hard',
      label: '困难',
      tagline: '805 极速 · 60 币回心 · 跳跃 92.15%',
      stompBase: 1000,
      comboMultiply: true,
      blockPrize: BLOCK_PRIZE,
      coinsPerHeart: 60,
      maxSpeed: 805,
      jumpHeightScale: .9215,
      hurtInvincible: .8,
      pitInvincible: .8,
      pitRescue: true,
      maxHearts: 3,
      heal: true,
      heartPrize: true,
      groundSpeed: 2.5,
    }),
    extreme: Object.freeze({
      key: 'extreme',
      label: '极限',
      tagline: '一颗心 · 无法回血 · 805 极速 · 跳跃 92.15%',
      stompBase: 1000,
      comboMultiply: true,
      blockPrize: BLOCK_PRIZE,
      coinsPerHeart: 60,
      maxSpeed: 805,
      jumpHeightScale: .9215,
      hurtInvincible: .8,
      pitInvincible: .8,
      pitRescue: true,
      maxHearts: 1,
      heal: false,
      heartPrize: true,
      groundSpeed: 2.5,
    }),
  });

  const LEGACY_RULES = Object.freeze({ key: 'legacy', label: '旧版' });
  const RULES_BY_KEY = {
    easy: MODE_RULES.easy,
    normal: MODE_RULES.normal,
    hard: MODE_RULES.hard,
    extreme: MODE_RULES.extreme,
    legacy: LEGACY_RULES,
  };

  const rulesFor = (difficulty) => MODE_RULES[difficulty] || MODE_RULES.normal;
  const modeKeyFor = (difficulty) => (MODE_RULES[difficulty] ? difficulty : 'normal');
  const isModeKey = (value) => Object.prototype.hasOwnProperty.call(MODE_RULES, value);

  const formatNumber = (value) => String(Math.max(0, Math.floor(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function formatBoardDate(timestamp) {
    const date = new Date(timestamp);
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const MILESTONES = Object.freeze([
    { id: 's50k', type: 'score', score: 50000, title: '小试牛刀', label: '50,000 分' },
    { id: 's100k', type: 'score', score: 100000, title: '十万分', label: '100,000 分' },
    { id: 's500k', type: 'score', score: 500000, title: '一骑绝尘', label: '500,000 分' },
    { id: 's1m', type: 'score', score: 1000000, title: '登峰造极', label: '1,000,000 分' },
    { id: 'c3', type: 'combo', combo: 1, title: '见鬼去吧', label: '连续踩中 1 只小怪' },
    { id: 'c5', type: 'combo', combo: 5, title: '五连绝世', label: '连续踩中 5 只小怪' },
    { id: 'c10', type: 'combo', combo: 10, title: '天赐良机', label: '连续踩中 10 只小怪' },
    { id: 'b4900', type: 'blockScore', blockScore: 4900, title: '幸运暴击', label: '问号砖单次获得 4,900+ 分' },
    { id: 'heartPrize', type: 'heartPrize', title: '物超所值', label: '在问号砖里获得回一颗心的奖励' },
    { id: 'dmg3', type: 'tripleDamage', title: '天煞孤星', label: '4 秒内连续受到 3 次伤害' },
    { id: 'secondDown', type: 'secondHeartDown', title: '超越生死', label: '1 心回到 2 心后 1 秒内又掉一颗心' },
    { id: 'offscreen', type: 'offscreen', title: '这上面的风景不错', label: '身体完全超出屏幕外' },
    { id: 'offscreenPit', type: 'offscreenPit', title: '上天入地', label: '离屏后掉入深坑死亡' },
    { id: 'm21k', type: 'distance', meters: 21000, title: '半马选手', label: '半程马拉松 · 21 公里' },
    { id: 'm42k', type: 'distance', meters: 42000, title: '新的全马世界纪录!', label: '全程马拉松 · 42 公里' },
    { id: 'm100k', type: 'distance', meters: 100000, title: '热门景点', label: '100 公里' },
  ]);

  const ACHIEVEMENT_BRANCHES = Object.freeze([
    { id: 'score', label: '分数', color: '#d79b26', ids: ['s50k', 's100k', 's500k', 's1m'] },
    { id: 'distance', label: '距离', color: '#2f9e72', ids: ['m21k', 'm42k', 'm100k'] },
    { id: 'combo', label: '连击', color: '#4b87e5', ids: ['c3', 'c5', 'c10'] },
    { id: 'luck', label: '幸运', color: '#c56aa3', ids: ['b4900', 'heartPrize'] },
    { id: 'survival', label: '生存', color: '#d95745', ids: ['dmg3', 'secondDown', 'offscreen', 'offscreenPit'] },
  ]);

  const HIDDEN_ACHIEVEMENTS = new Set(['c10', 'm100k', 'offscreenPit']);

  const ACHIEVEMENT_ICONS = Object.freeze({
    star: '<path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.6Z"/>',
    coins: '<circle cx="9" cy="9" r="4.2"/><circle cx="15" cy="15" r="4.2" opacity=".72"/><path d="M9 6.8v4.4M7.7 8.2h2.6M14.6 12.8v4.4M13.4 14.2h2.4" fill="none" stroke="#3b2a15" stroke-width="1.1" stroke-linecap="round"/>',
    crown: '<path d="M3 18.2 4.6 7.8l4.2 3.2L12 5.1l3.2 5.9 4.2-3.2L21 18.2H3Z"/>',
    trophy: '<path d="M7 4h10v4.2a5 5 0 0 1-10 0V4Zm-2.3 1.2h2.5v3.1H4.7V5.2Zm12.1 0h2.5v3.1h-2.5V5.2ZM10.4 13.3h3.2v3.1h-3.2v-3.1ZM7.6 19.5h8.8V21H7.6v-1.5Z"/>',
    boot: '<path d="M6 3.8h5.2v8.1c1.8.7 3.2 2.2 3.2 4.4V19H5.5v-5.6H6V3.8Zm9.6 11.6c1.8.9 2.9 2.1 2.9 3.6H15v-3.6h.6Z"/>',
    flame: '<path d="M12.2 2.6c1 3.3-.6 4.8-2.2 6.7-1.4 1.7-2.7 3.2-2.7 5.3a4.7 4.7 0 0 0 9.4 0c0-2.6-1.5-4.4-3.1-6.5-.6 1.2-1.2 1.8-2 2.3.4-2.7.9-5.2.6-7.8Z"/>',
    comet: '<circle cx="8.2" cy="15.8" r="4.2"/><path d="M13.2 10.8 21 3M15 13l4.4-1M11 6l1-4.4M17 15l-1 4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    dice: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="9" cy="15" r="1.2"/><circle cx="15" cy="15" r="1.2"/>',
    heart: '<path d="M12 21S3.4 15.4 3.4 9.2A4.9 4.9 0 0 1 12 5.5a4.9 4.9 0 0 1 8.6 3.7C20.6 15.4 12 21 12 21Z"/>',
    skull: '<path d="M12 3a7.3 7.3 0 0 0-7.3 7.3c0 2.5 1.2 4.5 3.3 5.7V19h8v-3c2.1-1.2 3.3-3.2 3.3-5.7A7.3 7.3 0 0 0 12 3Zm-3 8.3a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Zm6 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM10.7 20.5v1.8h2.6v-1.8h-2.6Z"/>',
    brokenHeart: '<path d="M12 21S3.4 15.4 3.4 9.2A4.9 4.9 0 0 1 12 5.5a4.9 4.9 0 0 1 8.6 3.7C20.6 15.4 12 21 12 21Z"/><path d="m12 6.3-1.7 4.1 2.8 2.1-2 5.5" fill="none" stroke="#fff9e9" stroke-width="1.6" stroke-linejoin="round"/>',
    rocket: '<path d="M14.7 3.2c2.5.3 4.4 2.2 5 4.7-2.5.3-4.5-.4-6.2-1.2L9 11.4l3.6 3.6 4.7-4.5c.8 1.7 1.5 3.7 1.2 6.2-2.5-.6-4.4-2.5-4.7-5L8.9 16l-1 4.8-2.8-2.8L9.9 17l4.8-5.9c-.6-2.5.3-5.1-1.7-7.1l1.7-.8Z"/><circle cx="15.5" cy="7.1" r="1.5" fill="#fff9e9"/>',
    flag: '<path d="M5.5 21V3.2h2v17.8h-2Zm3 0V4.2h10.8l-2.4 4.1 2.4 4.1H8.5v8.6Z"/>',
    medal: '<path d="m8.1 3 2.1 6.1-2.8 2.2L4.5 3h3.6Zm7.8 0h3.6l-2.9 8.3-2.8-2.2L16 3Z"/><circle cx="12" cy="15.2" r="5.2"/><path d="m12 12.2.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3.9-1.8Z" fill="#fff9e9"/>',
    mountain: '<path d="M2.8 20 9 8.2 12.3 15l1.9-3.1L21.2 20H2.8Z"/><circle cx="17.5" cy="6.2" r="2.4"/>',
    parachute: '<path d="M12 3a7.6 7.6 0 0 0-7.6 7.6h15.2A7.6 7.6 0 0 0 12 3Z"/><path d="M4.4 10.6c2.5.8 5 1.2 7.6 1.2s5.1-.4 7.6-1.2M7.7 10.6 10 21h4l2.3-10.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  });

  const ACHIEVEMENT_META = Object.freeze({
    s50k: { icon: 'star', description: '单局得分达到 50,000 分。' },
    s100k: { icon: 'coins', description: '单局得分达到 100,000 分。' },
    s500k: { icon: 'crown', description: '单局得分达到 500,000 分。' },
    s1m: { icon: 'trophy', description: '单局得分达到 1,000,000 分，登峰造极。' },
    c3: { icon: 'boot', description: '连续踩中 1 只小怪。' },
    c5: { icon: 'flame', description: '连续踩中 5 只小怪。' },
    c10: { icon: 'comet', description: '连续踩中 10 只小怪，触发隐藏成就。' },
    b4900: { icon: 'dice', description: '问号砖单次获得 4,900 分及以上。' },
    heartPrize: { icon: 'heart', description: '在问号砖的奖励中获得回一颗心。' },
    dmg3: { icon: 'skull', description: '4 秒内连续受到 3 次伤害，第三次致命也算。' },
    secondDown: { icon: 'brokenHeart', description: '1 颗心时回到 2 颗心，随后 1 秒内又掉一颗心。' },
    offscreen: { icon: 'rocket', description: '角色身体完全超出屏幕顶部，看看上面的风景。' },
    offscreenPit: { icon: 'parachute', description: '先完全离屏，再直接掉入深坑死亡。' },
    m21k: { icon: 'flag', description: '单局距离达到 21 公里。' },
    m42k: { icon: 'medal', description: '单局距离达到 42 公里，新的全马世界纪录!。' },
    m100k: { icon: 'mountain', description: '单局距离达到 100 公里，抵达隐藏的热门景点。' },
  });

  const CHALLENGE_ACHIEVEMENTS = new Set([
    's1m', 'c10', 'm42k', 'm100k', 'dmg3', 'secondDown', 'offscreen', 'offscreenPit',
  ]);

  function achievementBranch(id) {
    return ACHIEVEMENT_BRANCHES.find((branch) => branch.ids.includes(id)) || ACHIEVEMENT_BRANCHES[0];
  }

  function achievementColor(id) {
    return achievementBranch(id).color;
  }

  function achievementIconMarkup(id) {
    const meta = ACHIEVEMENT_META[id] || ACHIEVEMENT_META.s50k;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ACHIEVEMENT_ICONS[meta.icon] || ACHIEVEMENT_ICONS.star}</svg>`;
  }

  function achievementDescription(id) {
    return (ACHIEVEMENT_META[id] && ACHIEVEMENT_META[id].description) || '';
  }

  function isChallengeAchievement(id) {
    return CHALLENGE_ACHIEVEMENTS.has(id);
  }

  const ACHIEVEMENT_MAP = Object.freeze({
    width: 900,
    height: 450,
    rowTop: 28,
    rowGap: 82,
    nodeW: 138,
    nodeH: 56,
    nodeX: 240,
    nodeStep: 164,
    categoryX: 142,
    categoryW: 76,
    categoryH: 44,
    trunkX: 126,
    rootX: 16,
    rootW: 96,
    rootH: 60,
  });

  function formatAchievementDate(timestamp) {
    const date = new Date(timestamp);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function drawBlinkEye(ctx, x, y, rx, ry, blink, irisColor = '#7a4a28') {
    if (blink) {
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.66, y + 1);
      ctx.quadraticCurveTo(x, y + ry * 0.36, x + rx * 0.66, y + 1);
      ctx.strokeStyle = '#3b2a28';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.stroke();
      return;
    }
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = '#fffdf7';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(43,33,35,.52)';
    ctx.stroke();
    // iris
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.08, y + ry * 0.13, rx * 0.57, ry * 0.66, 0, 0, TAU);
    ctx.fillStyle = irisColor;
    ctx.fill();
    // pupil
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.08, y + ry * 0.14, rx * 0.29, ry * 0.39, 0, 0, TAU);
    ctx.fillStyle = '#252032';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + rx * 0.3, y - ry * 0.18, Math.max(0.65, rx * 0.2), 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function drawMarioHead(ctx, avatar, opts) {
    const p = paletteFor(avatar.id);
    const isLuigi = avatar.head === 'luigi';
    const blink = opts.blink;
    const hurt = opts.expression === 'hurt';

    // neck
    ctx.fillStyle = p.shade;
    roundedRectPath(ctx, -7, 17, 14, 10, 4);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // ears and sideburn backing
    ctx.beginPath();
    ctx.ellipse(-19, 4, 6.5, 8.5, -0.16, 0, TAU);
    ctx.fillStyle = p.skin;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(19, 4, 6.5, 8.5, 0.16, 0, TAU);
    ctx.fillStyle = p.skin;
    ctx.fill();
    ctx.stroke();

    // hair behind face
    ctx.beginPath();
    ctx.moveTo(-20, -12);
    ctx.bezierCurveTo(-30, -9, -29, 15, -19, 20);
    ctx.bezierCurveTo(-24, 11, -22, -2, -16, -5);
    ctx.closePath();
    ctx.fillStyle = p.hair;
    ctx.fill();

    // face
    ctx.beginPath();
    ctx.ellipse(0, 3, 21, 19.5, 0, 0, TAU);
    ctx.fillStyle = p.skin;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // sideburns
    ctx.beginPath();
    ctx.moveTo(-19, 1);
    ctx.quadraticCurveTo(-16, 12, -21, 15);
    ctx.quadraticCurveTo(-24, 5, -20, -2);
    ctx.closePath();
    ctx.fillStyle = p.hair;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(19, 1);
    ctx.quadraticCurveTo(17, 11, 21, 15);
    ctx.quadraticCurveTo(23, 5, 20, -2);
    ctx.closePath();
    ctx.fill();

    // eyes
    if (hurt) {
      ctx.strokeStyle = '#3b2a28';
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -1);
      ctx.lineTo(-4, 4);
      ctx.moveTo(-4, -1);
      ctx.lineTo(-10, 4);
      ctx.moveTo(4, -1);
      ctx.lineTo(10, 4);
      ctx.moveTo(10, -1);
      ctx.lineTo(4, 4);
      ctx.stroke();
    } else {
      drawBlinkEye(ctx, -7.2, 1.6, 4.4, 5.1, blink);
      drawBlinkEye(ctx, 7.2, 1.6, 4.4, 5.1, blink);
    }

    // cheeks
    ctx.fillStyle = 'rgba(239,107,86,.18)';
    ctx.beginPath();
    ctx.ellipse(-14, 11, 4.8, 2.7, 0, 0, TAU);
    ctx.ellipse(14, 11, 4.8, 2.7, 0, 0, TAU);
    ctx.fill();

    // nose
    ctx.beginPath();
    ctx.ellipse(0, 8, 7.8, 6.2, 0, 0, TAU);
    ctx.fillStyle = p.shade;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-2.2, 6, 1.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    ctx.fill();

    // mustache
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.moveTo(-1, 10.4);
    ctx.bezierCurveTo(-8, 9.2, -15, 10.5, -15.5, 13.3);
    ctx.bezierCurveTo(-13.5, 16.3, -5, 16, -1, 13.1);
    ctx.bezierCurveTo(3, 16, 13.5, 16.3, 15.5, 13.3);
    ctx.bezierCurveTo(15, 10.5, 8, 9.2, 1, 10.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a2116';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // mouth
    if (hurt) {
      ctx.beginPath();
      ctx.ellipse(0, 19.4, 4.3, 2.8, 0, 0, TAU);
      ctx.fillStyle = '#7b3b38';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-4.2, 18.3);
      ctx.quadraticCurveTo(0, 21.2, 4.2, 18.3);
      ctx.strokeStyle = '#6e3a31';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // cap brim
    ctx.beginPath();
    ctx.moveTo(-23, -13.2);
    ctx.quadraticCurveTo(-2, -9.4, 23, -13.2);
    ctx.quadraticCurveTo(27, -10.3, 20.5, -7.4);
    ctx.quadraticCurveTo(2, -3.7, -20.5, -7.8);
    ctx.quadraticCurveTo(-27, -9.7, -23, -13.2);
    ctx.closePath();
    ctx.fillStyle = p.capShade;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.1;
    ctx.stroke();

    // cap dome
    ctx.beginPath();
    ctx.moveTo(-23, -12.5);
    ctx.bezierCurveTo(-26, -26, -14, -31, 0, -31);
    ctx.bezierCurveTo(14, -31, 26, -26, 23, -12.5);
    ctx.quadraticCurveTo(9, -8.2, 0, -8.4);
    ctx.quadraticCurveTo(-10, -8.2, -23, -12.5);
    ctx.closePath();
    ctx.fillStyle = p.cap;
    ctx.fill();
    ctx.lineWidth = 2.3;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // cap highlight
    ctx.beginPath();
    ctx.moveTo(-15, -21);
    ctx.quadraticCurveTo(-9, -27, 2, -27.8);
    ctx.strokeStyle = 'rgba(255,255,255,.38)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // emblem
    ctx.beginPath();
    ctx.arc(-2, -19, 6.7, 0, TAU);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = isLuigi ? '#2b9c47' : '#e43d40';
    ctx.font = '900 9px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(avatar.letter, -2, -18.6);

    // subtle cap shine
    ctx.beginPath();
    ctx.ellipse(8.5, -23.5, 5.2, 2.1, -0.45, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fill();
  }

  function drawPeachHead(ctx, avatar, opts) {
    const p = paletteFor('peach');
    const blink = opts.blink;
    const hurt = opts.expression === 'hurt';

    // back hair
    ctx.beginPath();
    ctx.moveTo(-26, -7);
    ctx.bezierCurveTo(-36, 2, -31, 24, -24, 27);
    ctx.bezierCurveTo(-18, 22, -20, 13, -16, 7);
    ctx.bezierCurveTo(16, 7, 20, 13, 24, 27);
    ctx.bezierCurveTo(32, 24, 36, 2, 26, -7);
    ctx.bezierCurveTo(21, -27, -20, -27, -26, -7);
    ctx.closePath();
    ctx.fillStyle = p.hair;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // neck
    ctx.fillStyle = p.shade;
    roundedRectPath(ctx, -6.5, 17, 13, 10, 4);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // earrings
    ctx.strokeStyle = '#d8a318';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(-21, 11, 3.1, 0, TAU);
    ctx.moveTo(24, 8);
    ctx.arc(21, 11, 3.1, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-21, 14.3, 1.5, 0, TAU);
    ctx.arc(21, 14.3, 1.5, 0, TAU);
    ctx.fillStyle = '#6dd4ff';
    ctx.fill();

    // face
    ctx.beginPath();
    ctx.ellipse(0, 3.5, 19, 19, 0, 0, TAU);
    ctx.fillStyle = p.skin;
    ctx.fill();
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // cheek blush
    ctx.fillStyle = 'rgba(250,127,159,.28)';
    ctx.beginPath();
    ctx.ellipse(-13, 9, 4.6, 2.7, 0, 0, TAU);
    ctx.ellipse(13, 9, 4.6, 2.7, 0, 0, TAU);
    ctx.fill();

    // bangs
    ctx.beginPath();
    ctx.moveTo(-25, -6);
    ctx.bezierCurveTo(-21, -20, 4, -27, 24, -10);
    ctx.bezierCurveTo(15, -11, 10, -6, 6, -1);
    ctx.bezierCurveTo(2, -8, -8, -7, -12, 0);
    ctx.bezierCurveTo(-15, -8, -21, -8, -25, -6);
    ctx.closePath();
    ctx.fillStyle = p.hair;
    ctx.fill();
    ctx.strokeStyle = 'rgba(112,74,13,.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // eyebrows
    ctx.strokeStyle = '#9b6b1b';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11.5, -5.5);
    ctx.quadraticCurveTo(-7.5, -7.4, -3.2, -5.7);
    ctx.moveTo(3.2, -5.7);
    ctx.quadraticCurveTo(7.5, -7.4, 11.5, -5.5);
    ctx.stroke();

    // eyes
    if (hurt) {
      ctx.strokeStyle = '#4b3751';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(-10, -1);
      ctx.lineTo(-4, 3);
      ctx.moveTo(-4, -1);
      ctx.lineTo(-10, 3);
      ctx.moveTo(4, -1);
      ctx.lineTo(10, 3);
      ctx.moveTo(10, -1);
      ctx.lineTo(4, 3);
      ctx.stroke();
    } else {
      drawBlinkEye(ctx, -7, 1.5, 3.8, 4.6, blink, '#2b7aa8');
      drawBlinkEye(ctx, 7, 1.5, 3.8, 4.6, blink, '#2b7aa8');
      // lashes
      ctx.strokeStyle = '#7b4b4b';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-10.3, -1.5);
      ctx.lineTo(-12.2, -3.2);
      ctx.moveTo(10.3, -1.5);
      ctx.lineTo(12.2, -3.2);
      ctx.stroke();
    }

    // nose
    ctx.beginPath();
    ctx.moveTo(0, 7.5);
    ctx.quadraticCurveTo(2.2, 9.4, 0.4, 10.2);
    ctx.strokeStyle = 'rgba(160,96,80,.65)';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // lips
    ctx.beginPath();
    if (hurt) {
      ctx.ellipse(0, 15, 3.5, 3, 0, 0, TAU);
      ctx.fillStyle = '#a94b62';
      ctx.fill();
    } else {
      ctx.moveTo(-4, 14);
      ctx.quadraticCurveTo(0, 17, 4, 14);
      ctx.quadraticCurveTo(0, 12.5, -4, 14);
      ctx.fillStyle = '#ef6d8e';
      ctx.fill();
      ctx.strokeStyle = 'rgba(114,41,57,.5)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    // crown
    ctx.beginPath();
    ctx.moveTo(-13, -22);
    ctx.lineTo(-16, -32);
    ctx.lineTo(-6, -27);
    ctx.lineTo(0, -35);
    ctx.lineTo(6, -27);
    ctx.lineTo(16, -32);
    ctx.lineTo(13, -21);
    ctx.quadraticCurveTo(0, -17, -13, -22);
    ctx.closePath();
    ctx.fillStyle = '#ffd64e';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -27, 2.1, 0, TAU);
    ctx.fillStyle = '#63c8ff';
    ctx.fill();
    ctx.strokeStyle = '#a97100';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // little hair shine
    ctx.beginPath();
    ctx.moveTo(-20, -11);
    ctx.quadraticCurveTo(-17, -19, -7, -22);
    ctx.strokeStyle = 'rgba(255,255,255,.38)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawToadHead(ctx, avatar, opts) {
    const p = paletteFor('toad');
    const blink = opts.blink;
    const hurt = opts.expression === 'hurt';

    // neck / body top
    ctx.fillStyle = '#f4e7d0';
    roundedRectPath(ctx, -9, 17, 18, 12, 6);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // mushroom cap
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.bezierCurveTo(-29, -24, -14, -33, 0, -33);
    ctx.bezierCurveTo(14, -33, 29, -24, 28, -6);
    ctx.bezierCurveTo(24, -1, 19, 1, 17, -2);
    ctx.bezierCurveTo(12, 1, 7, 1, 3, -2);
    ctx.bezierCurveTo(-2, 1, -8, 1, -13, -2);
    ctx.bezierCurveTo(-18, 1, -24, 0, -28, -6);
    ctx.closePath();
    ctx.fillStyle = p.cap;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // red spots, clipped to cap
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.bezierCurveTo(-29, -24, -14, -33, 0, -33);
    ctx.bezierCurveTo(14, -33, 29, -24, 28, -6);
    ctx.bezierCurveTo(20, 1, -20, 1, -28, -6);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.ellipse(-17, -17, 10, 8.5, -0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12, -22, 8, 7, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2, -9, 5.6, 4.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // face
    ctx.beginPath();
    ctx.ellipse(0, 7, 17, 15.5, 0, 0, TAU);
    ctx.fillStyle = p.skin;
    ctx.fill();
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // eyes
    if (hurt) {
      ctx.strokeStyle = '#4c392d';
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9, 3);
      ctx.lineTo(-4, 7);
      ctx.moveTo(-4, 3);
      ctx.lineTo(-9, 7);
      ctx.moveTo(4, 3);
      ctx.lineTo(9, 7);
      ctx.moveTo(9, 3);
      ctx.lineTo(4, 7);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#2a2432';
      ctx.beginPath();
      ctx.ellipse(-6, 4, 3.4, 4.7, 0, 0, TAU);
      ctx.ellipse(6, 4, 3.4, 4.7, 0, 0, TAU);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-7.1, 2.5, 1.1, 0, TAU);
        ctx.arc(4.9, 2.5, 1.1, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = p.skin;
        ctx.beginPath();
        ctx.ellipse(-6, 4, 3.7, 2.6, 0, 0, TAU);
        ctx.ellipse(6, 4, 3.7, 2.6, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#4c392d';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-9, 4.6);
        ctx.quadraticCurveTo(-6, 5.8, -3, 4.6);
        ctx.moveTo(3, 4.6);
        ctx.quadraticCurveTo(6, 5.8, 9, 4.6);
        ctx.stroke();
      }
    }

    // cheeks
    ctx.fillStyle = 'rgba(240,119,105,.2)';
    ctx.beginPath();
    ctx.ellipse(-11, 11.5, 3.5, 2, 0, 0, TAU);
    ctx.ellipse(11, 11.5, 3.5, 2, 0, 0, TAU);
    ctx.fill();

    // mouth
    ctx.beginPath();
    if (hurt) {
      ctx.ellipse(0, 16, 3.7, 3, 0, 0, TAU);
      ctx.fillStyle = '#833b38';
      ctx.fill();
    } else {
      ctx.arc(0, 13, 4.1, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#6b4437';
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function drawCustomHead(ctx, opts) {
    const image = state.customImage;
    const blink = opts.blink;
    const hurt = opts.expression === 'hurt';

    // small drop shadow
    ctx.beginPath();
    ctx.arc(0, 1, 24.5, 0, TAU);
    ctx.fillStyle = 'rgba(25,36,59,.22)';
    ctx.fill();

    // image clipped into a badge
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 23.2, 0, TAU);
    ctx.clip();
    if (image) {
      ctx.fillStyle = '#f4dfb7';
      ctx.fillRect(-24, -24, 48, 48);
      drawImageCover(ctx, image, -23.2, -23.2, 46.4, 46.4, 0.46);
      const vignette = ctx.createLinearGradient(0, 9, 0, 23);
      vignette.addColorStop(0, 'rgba(12,22,36,0)');
      vignette.addColorStop(1, 'rgba(12,22,36,.20)');
      ctx.fillStyle = vignette;
      ctx.fillRect(-24, 9, 48, 15);
    } else {
      ctx.fillStyle = '#fff1ca';
      ctx.fillRect(-24, -24, 48, 48);
      ctx.fillStyle = '#e35345';
      ctx.font = '900 25px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', 0, 1);
    }
    ctx.restore();

    // badge rings
    ctx.beginPath();
    ctx.arc(0, 0, 23.2, 0, TAU);
    ctx.strokeStyle = '#fff9e9';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 25.2, 0, TAU);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // little sparkle badge
    ctx.beginPath();
    ctx.arc(16.5, 16.5, 6.2, 0, TAU);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#e43d40';
    ctx.font = '900 9px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 16.5, 16.8);

    if (hurt) {
      ctx.strokeStyle = 'rgba(255,255,255,.88)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, -8);
      ctx.lineTo(11, -3);
      ctx.moveTo(11, -8);
      ctx.lineTo(6, -3);
      ctx.stroke();
    } else if (blink) {
      // photo-appropriate blink: a tiny camera flash sparkle
      ctx.fillStyle = 'rgba(255,255,255,.78)';
      ctx.beginPath();
      ctx.arc(15, -13, 1.5, 0, TAU);
      ctx.fill();
    }
  }

  function drawImageHead(ctx, avatar) {
    const image = avatar.image;
    ctx.beginPath();
    ctx.arc(0, 1, 24.5, 0, TAU);
    ctx.fillStyle = 'rgba(25,36,59,.22)';
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 23.2, 0, TAU);
    ctx.clip();
    ctx.fillStyle = avatar.accent || '#8fd6a6';
    ctx.fillRect(-24, -24, 48, 48);
    if (image) {
      drawImageCover(ctx, image, -23.2, -23.2, 46.4, 46.4, 0.44);
    } else {
      ctx.fillStyle = '#fff9e9';
      ctx.font = '900 20px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((avatar.name || '?').slice(0, 1), 0, 1);
    }
    const vignette = ctx.createLinearGradient(0, 9, 0, 23);
    vignette.addColorStop(0, 'rgba(12,22,36,0)');
    vignette.addColorStop(1, 'rgba(12,22,36,.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(-24, 9, 48, 15);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, 23.2, 0, TAU);
    ctx.strokeStyle = '#fff9e9';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 25.2, 0, TAU);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  function drawAvatarHead(ctx, avatar, cx, cy, size, opts = {}) {
    const k = size / 56;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    if (avatar.head === 'image') {
      drawImageHead(ctx, avatar);
    } else if (avatar.head === 'custom') {
      drawCustomHead(ctx, opts);
    } else if (avatar.head === 'peach') {
      drawPeachHead(ctx, avatar, opts);
    } else if (avatar.head === 'toad') {
      drawToadHead(ctx, avatar, opts);
    } else {
      drawMarioHead(ctx, avatar, opts);
    }
    ctx.restore();
  }

  /* ==========================================================
     Runner body
     ========================================================== */

  function drawShoe(ctx, x, y, angle, p, scaleX = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scaleX, 1);
    ctx.beginPath();
    ctx.ellipse(2.5, 0, 10, 5.2, 0, 0, TAU);
    ctx.fillStyle = p.shoes;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(3, 3.3, 8.4, 2.1, 0, 0, TAU);
    ctx.fillStyle = p.shoeSole;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, -2.4);
    ctx.quadraticCurveTo(2, -3.5, 7, -1.7);
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawLeg(ctx, p, hipX, angle, back = false) {
    ctx.save();
    ctx.translate(hipX, -28);
    ctx.rotate(angle);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = back ? p.overallShade : p.overalls;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 17);
    ctx.stroke();
    ctx.strokeStyle = back ? p.overallShade : p.overalls;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 17);
    ctx.lineTo(1, 24);
    ctx.stroke();
    drawShoe(ctx, 1, 25, 0.04 + angle * .16, p, back ? .9 : 1);
    ctx.restore();
  }

  function drawArm(ctx, p, shoulderX, angle, back = false) {
    ctx.save();
    ctx.translate(shoulderX, -45);
    ctx.rotate(angle);
    ctx.lineCap = 'round';
    ctx.strokeStyle = back ? p.capShade : p.shirt;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0, 11, 0, 18);
    ctx.stroke();
    // glove
    ctx.beginPath();
    ctx.arc(0, 20, 5.2, 0, TAU);
    ctx.fillStyle = p.glove;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8.2, 20.2, 3.2, -1.2, 1.2);
    ctx.strokeStyle = p.glove;
    ctx.lineWidth = 3.1;
    ctx.stroke();
    ctx.restore();
  }

  function drawTorso(ctx, p, avatar, hurt) {
    if (avatar.head === 'peach') {
      // dress
      ctx.beginPath();
      ctx.moveTo(-11, -49);
      ctx.quadraticCurveTo(0, -55, 11, -49);
      ctx.lineTo(13, -34);
      ctx.quadraticCurveTo(22, -27, 24, -17);
      ctx.quadraticCurveTo(0, -12, -24, -17);
      ctx.quadraticCurveTo(-22, -27, -13, -34);
      ctx.closePath();
      ctx.fillStyle = p.shirt;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.3;
      ctx.stroke();
      // dress highlights and hem
      ctx.beginPath();
      ctx.moveTo(-15, -22);
      ctx.quadraticCurveTo(0, -17, 15, -22);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-8, -36, 1.8, 0, TAU);
      ctx.arc(8, -36, 1.8, 0, TAU);
      ctx.fillStyle = p.accent;
      ctx.fill();
      // midsection sash
      ctx.beginPath();
      ctx.moveTo(-11, -35);
      ctx.quadraticCurveTo(0, -31, 11, -35);
      ctx.strokeStyle = p.overallShade;
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (avatar.head === 'toad') {
      // small round body / vest
      ctx.beginPath();
      ctx.ellipse(0, -37, 18, 15, 0, 0, TAU);
      ctx.fillStyle = p.overallShade;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-15, -43);
      ctx.quadraticCurveTo(0, -36, 15, -43);
      ctx.lineTo(12, -28);
      ctx.quadraticCurveTo(0, -23, -12, -28);
      ctx.closePath();
      ctx.fillStyle = p.shirt;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -36, 2.4, 0, TAU);
      ctx.fillStyle = p.accent;
      ctx.fill();
    } else {
      // shirt
      ctx.beginPath();
      ctx.moveTo(-14, -48);
      ctx.quadraticCurveTo(0, -55, 14, -48);
      ctx.lineTo(17, -30);
      ctx.quadraticCurveTo(0, -24, -17, -30);
      ctx.closePath();
      ctx.fillStyle = p.shirt;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.3;
      ctx.stroke();

      // overalls
      ctx.beginPath();
      ctx.moveTo(-14, -34);
      ctx.quadraticCurveTo(0, -28.5, 14, -34);
      ctx.lineTo(15, -26);
      ctx.quadraticCurveTo(0, -20.5, -15, -26);
      ctx.closePath();
      ctx.fillStyle = p.overalls;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();

      // bib
      ctx.beginPath();
      ctx.moveTo(-8, -46);
      ctx.lineTo(-7, -34);
      ctx.quadraticCurveTo(0, -30.5, 7, -34);
      ctx.lineTo(8, -46);
      ctx.quadraticCurveTo(0, -43, -8, -46);
      ctx.closePath();
      ctx.fillStyle = p.overalls;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // straps
      ctx.strokeStyle = p.overalls;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-13, -47);
      ctx.lineTo(-8.5, -43);
      ctx.moveTo(13, -47);
      ctx.lineTo(8.5, -43);
      ctx.stroke();

      // buttons
      ctx.beginPath();
      ctx.arc(-8, -36.5, 2, 0, TAU);
      ctx.arc(8, -36.5, 2, 0, TAU);
      ctx.fillStyle = p.accent;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();

      // shirt highlight
      ctx.beginPath();
      ctx.moveTo(-10, -46);
      ctx.quadraticCurveTo(0, -50, 10, -46);
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }

    if (avatar.id === 'custom') {
      // custom hero chest badge
      ctx.beginPath();
      ctx.arc(0, -41, 4, 0, TAU);
      ctx.fillStyle = p.accent;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = '900 6px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, -40.6);
    }

    if (hurt) {
      // little dizzy stars around the body
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(-20 + i * 20, -70 + Math.sin(i * 2) * 4);
        ctx.rotate(i * 1.2);
        ctx.beginPath();
        ctx.moveTo(0, -3.3);
        ctx.lineTo(1, -1);
        ctx.lineTo(3.4, -.7);
        ctx.lineTo(1.6, 1);
        ctx.lineTo(2.1, 3.5);
        ctx.lineTo(0, 2.1);
        ctx.lineTo(-2.1, 3.5);
        ctx.lineTo(-1.6, 1);
        ctx.lineTo(-3.4, -.7);
        ctx.lineTo(-1, -1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawRunner(ctx, avatar, x, feetY, options = {}) {
    const p = paletteForAvatar(avatar);
    const runPhase = options.runPhase || 0;
    const grounded = !!options.grounded;
    const vy = options.vy || 0;
    const mode = options.mode || 'run';
    const hurt = options.hurt;
    const blink = options.blink;
    const airTime = options.airTime || 0;

    let bob = 0;
    let legFront = 0;
    let legBack = 0;
    let armFront = 0;
    let armBack = 0;
    let bodyTilt = 0;

    if (grounded) {
      bob = Math.abs(Math.sin(runPhase * 2)) * -2.1;
      legFront = Math.sin(runPhase) * .72;
      legBack = -legFront;
      armFront = -legFront * .8;
      armBack = -armFront;
      bodyTilt = -.035;
    } else if (mode === 'jump' || vy < -40) {
      bob = -2;
      legFront = -.58 - clamp(airTime * .5, 0, .25);
      legBack = .42;
      armFront = -1.75;
      armBack = 1.3;
      bodyTilt = -.08;
    } else {
      bob = 1.5;
      legFront = .3;
      legBack = -.35;
      armFront = -.9;
      armBack = .95;
      bodyTilt = .03;
    }

    ctx.save();
    ctx.translate(x, feetY);
    if (options.artScale && options.artScale !== 1) {
      ctx.scale(options.artScale, options.artScale);
    }
    if (mode === 'dying') {
      ctx.rotate(options.spin || 0);
    }
    ctx.translate(0, bob);
    ctx.rotate(bodyTilt);

    const headCenterY = avatar.head === 'toad' ? -58 : -63;
    const headSize = avatar.head === 'toad' ? 55 : (avatar.head === 'custom' || avatar.head === 'image') ? 47 : 49;

    // back arm
    drawArm(ctx, p, -12, armBack, true);

    // legs
    drawLeg(ctx, p, 6, legBack, true);
    drawLeg(ctx, p, -5, legFront, false);

    // torso
    drawTorso(ctx, p, avatar, hurt);

    // neck shadow
    ctx.beginPath();
    ctx.ellipse(0, -50, 7, 4.5, 0, 0, TAU);
    ctx.fillStyle = 'rgba(128,75,42,.18)';
    ctx.fill();

    // head
    ctx.save();
    ctx.translate(0, headCenterY);
    ctx.rotate(grounded ? Math.sin(runPhase) * .035 : -.035);
    drawAvatarHead(ctx, avatar, 0, 0, headSize, {
      expression: hurt ? 'hurt' : 'normal',
      blink,
    });
    ctx.restore();

    // front arm
    drawArm(ctx, p, 12, armFront, false);

    // speed swoosh / sparkle on jump
    if (!grounded && options.doubleJumped) {
      ctx.strokeStyle = 'rgba(255,246,203,.75)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = .45 + i * .28;
        ctx.beginPath();
        ctx.arc(0, -18, 27 + i * 4, Math.PI * (1.02 + a * .05), Math.PI * (1.38 + a * .05));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawPortrait(canvas, avatar) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, w * .485, 0, TAU);
    ctx.clip();

    if (avatar.head === 'image' && avatar.image) {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, avatar.portrait[0]);
      bg.addColorStop(1, avatar.portrait[1]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      drawImageCover(ctx, avatar.image, 0, 0, w, h, 0.44);
      const shade = ctx.createLinearGradient(0, h * .55, 0, h);
      shade.addColorStop(0, 'rgba(13,25,40,0)');
      shade.addColorStop(1, 'rgba(13,25,40,.24)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,249,233,.8)';
      ctx.lineWidth = w * .012;
      ctx.setLineDash([w * .035, w * .025]);
      ctx.beginPath();
      ctx.arc(cx, cy, w * .43, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (avatar.head === 'custom' && state.customImage) {
      ctx.fillStyle = '#f4dfb7';
      ctx.fillRect(0, 0, w, h);
      drawImageCover(ctx, state.customImage, 0, 0, w, h, 0.46);
      const shade = ctx.createLinearGradient(0, h * .55, 0, h);
      shade.addColorStop(0, 'rgba(13,25,40,0)');
      shade.addColorStop(1, 'rgba(13,25,40,.24)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);
      // little photo edges / stickers
      ctx.strokeStyle = 'rgba(255,249,233,.75)';
      ctx.lineWidth = w * .012;
      ctx.setLineDash([w * .035, w * .025]);
      ctx.beginPath();
      ctx.arc(cx, cy, w * .43, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const bg = ctx.createLinearGradient(w * .1, 0, w * .9, h);
      bg.addColorStop(0, avatar.portrait[0]);
      bg.addColorStop(1, avatar.portrait[1]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // halftone dots
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const px = 12 + x * 24 + (y % 2) * 10;
          const py = 12 + y * 24;
          if (Math.hypot(px - cx, py - cy) < w * .47) {
            ctx.beginPath();
            ctx.arc(px, py, 1.6, 0, TAU);
            ctx.fill();
          }
        }
      }

      // accent sunburst
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = .16;
      ctx.fillStyle = '#fffdf2';
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w * .55, -w * .12);
        ctx.lineTo(w * .55, w * .12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // shoulders
      const p = paletteForAvatar(avatar);
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.ellipse(cx, h + 7, w * .39, h * .28, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = w * .013;
      ctx.stroke();
      ctx.fillStyle = avatar.head === 'peach' ? p.overalls : p.overalls;
      ctx.beginPath();
      ctx.ellipse(cx, h + h * .06, w * .18, h * .1, 0, Math.PI, TAU);
      ctx.fill();
      if (avatar.head !== 'peach') {
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.arc(cx - w * .095, h * .89, w * .012, 0, TAU);
        ctx.arc(cx + w * .095, h * .89, w * .012, 0, TAU);
        ctx.fill();
      }

      drawAvatarHead(ctx, avatar, cx, h * .53, w * .64, {
        expression: 'normal',
        blink: false,
      });
    }

    // inner vignette
    const vignette = ctx.createRadialGradient(cx, cy, w * .2, cx, cy, w * .53);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(15,28,37,.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();

    // rim
    ctx.beginPath();
    ctx.arc(cx, cy, w * .485, 0, TAU);
    ctx.strokeStyle = 'rgba(25,36,59,.18)';
    ctx.lineWidth = w * .018;
    ctx.stroke();
  }

  /* ==========================================================
     Audio
     ========================================================== */

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.sfxBus = null;
      this.route = 'sfx';
      this.muted = false;
      this.musicVolume = clamp(Number(readStore(STORAGE.musicVolume, '1')) || 0, 0, 1);
      this.sfxVolume = clamp(Number(readStore(STORAGE.sfxVolume, '1')) || 0, 0, 1);
      this.musicTimer = null;
      this.musicWanted = false;
      this.stepAt = 0;
      this.noteIndex = 0;
      this.noiseBuffer = null;
      this.compressor = null;
    }

    init() {
      if (this.ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = .56;
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.sfxBus.gain.value = this.sfxVolume;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 16;
        this.compressor.ratio.value = 5;
        this.compressor.attack.value = .004;
        this.compressor.release.value = .18;
        this.master.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      } catch (error) {
        this.ctx = null;
      }
    }

    async unlock() {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (error) { /* no-op */ }
      }
    }

    setMusicVolume(value) {
      this.musicVolume = clamp(Number(value) || 0, 0, 1);
      writeStore(STORAGE.musicVolume, String(this.musicVolume));
      if (this.musicBus && this.ctx) {
        const now = this.ctx.currentTime;
        this.musicBus.gain.cancelScheduledValues(now);
        this.musicBus.gain.setTargetAtTime(this.musicVolume, now, .025);
      }
    }

    setSfxVolume(value) {
      this.sfxVolume = clamp(Number(value) || 0, 0, 1);
      writeStore(STORAGE.sfxVolume, String(this.sfxVolume));
      if (this.sfxBus && this.ctx) {
        const now = this.ctx.currentTime;
        this.sfxBus.gain.cancelScheduledValues(now);
        this.sfxBus.gain.setTargetAtTime(this.sfxVolume, now, .025);
      }
    }

    tone(freq, duration, type = 'square', volume = .08, slideTo = null, when = null) {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const ctx = this.ctx;
      const start = when === null ? ctx.currentTime : when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), start);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
      }
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      osc.connect(gain);
      gain.connect(this.route === 'music' && this.musicBus ? this.musicBus : (this.sfxBus || this.master));
      osc.start(start);
      osc.stop(start + duration + .03);
    }

    noise(duration = .08, volume = .035, highpass = 900, when = null) {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const ctx = this.ctx;
      const start = when === null ? ctx.currentTime : when;
      if (!this.noiseBuffer) {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * .4, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
      }
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.route === 'music' && this.musicBus ? this.musicBus : (this.sfxBus || this.master));
      source.start(start);
      source.stop(start + duration + .01);
    }

    sfx(name) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      switch (name) {
        case 'jump':
          this.tone(290, .16, 'square', .06, 540, t);
          this.tone(580, .08, 'triangle', .025, 760, t + .02);
          break;
        case 'double':
          this.tone(520, .2, 'triangle', .07, 1040, t);
          this.tone(780, .12, 'square', .028, 1250, t + .03);
          break;
        case 'coin':
          this.tone(1046, .08, 'square', .04, null, t);
          this.tone(1568, .18, 'square', .045, null, t + .07);
          break;
        case 'stomp':
          this.tone(155, .13, 'square', .09, 74, t);
          this.noise(.09, .04, 450, t);
          this.tone(420, .12, 'triangle', .04, 620, t + .045);
          break;
        case 'block':
          this.tone(210, .09, 'square', .055, 150, t);
          this.tone(640, .18, 'triangle', .035, 840, t + .045);
          break;
        case 'hurt':
          this.tone(300, .3, 'sawtooth', .07, 92, t);
          this.noise(.2, .04, 260, t);
          break;
        case 'gameover':
          [523, 440, 349, 262].forEach((freq, i) => {
            this.tone(freq, .3, 'square', .055, null, t + i * .16);
          });
          break;
        case 'achievement':
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            this.tone(freq, .2, 'triangle', .05, null, t + i * .085);
          });
          this.tone(1567.98, .34, 'sine', .028, null, t + .34);
          this.noise(.08, .015, 4200, t + .32);
          break;
        case 'achievementChallenge':
          // 低音鼓点 + 号角和弦 + 上行辉煌旋律
          this.tone(65.41, .55, 'sine', .12, 43.65, t);
          this.noise(.22, .055, 150, t);
          [261.63, 329.63, 392, 523.25].forEach((freq) => {
            this.tone(freq, .95, 'sawtooth', .035, null, t + .08);
            this.tone(freq, .95, 'triangle', .045, null, t + .08);
          });
          this.tone(130.81, 1.15, 'triangle', .085, null, t + .08);
          [523.25, 659.25, 783.99, 1046.5, 1308.13, 1567.98].forEach((freq, i) => {
            this.tone(freq, .34, 'triangle', .06, null, t + .38 + i * .13);
            this.tone(freq / 2, .36, 'sawtooth', .022, null, t + .38 + i * .13);
          });
          this.tone(1046.5, 1.25, 'triangle', .05, null, t + 1.3);
          this.noise(.34, .045, 180, t + 1.25);
          break;
        case 'record':
          [523, 659, 784, 1046, 1318].forEach((freq, i) => {
            this.tone(freq, .35, 'triangle', .045, null, t + .3 + i * .11);
          });
          break;
        case 'click':
          this.tone(660, .045, 'triangle', .035, 820, t);
          break;
        case 'pause':
          this.tone(440, .08, 'triangle', .035, 330, t);
          break;
        case 'resume':
          this.tone(330, .08, 'triangle', .035, 520, t);
          break;
        case 'heart':
          this.tone(523, .1, 'triangle', .05, null, t);
          this.tone(784, .16, 'triangle', .045, null, t + .1);
          break;
        default:
          break;
      }
    }

    // A small original bouncy loop. Short, bright, and deliberately low volume.
    startMusic() {
      this.musicWanted = true;
      if (!this.ctx || this.muted) return;
      if (this.musicTimer) return;
      this.noteIndex = 0;
      this.bassIndex = 0;
      this.stepAt = this.ctx.currentTime + .08;
      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 80);
    }

    stopMusic() {
      this.musicWanted = false;
      if (this.musicTimer) {
        window.clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    }

    scheduleMusic() {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const eighth = 60 / 136 / 2;
      const melody = [
        [76, 1], [79, 1], [84, 1], [0, 1], [79, 1], [84, 1], [88, 1], [0, 1],
        [81, 1], [84, 1], [88, 1], [0, 1], [84, 1], [81, 1], [79, 1], [0, 1],
        [77, 1], [81, 1], [84, 1], [0, 1], [86, 1], [84, 1], [81, 1], [77, 1],
        [79, 1], [83, 1], [86, 1], [0, 1], [88, 2], [0, 2],
      ];
      const bass = [48, 45, 41, 43, 48, 45, 41, 43];
      const now = this.ctx.currentTime;
      const lookAhead = .22;
      const previousRoute = this.route;
      this.route = 'music';
      try {
        while (this.stepAt < now + lookAhead) {
          const [midi, duration] = melody[this.noteIndex % melody.length];
          if (midi) {
            const freq = 440 * Math.pow(2, (midi - 69) / 12);
            this.tone(freq, eighth * .78, 'square', .019, null, this.stepAt);
            this.tone(freq * 2, eighth * .3, 'triangle', .006, null, this.stepAt);
          }
          if (this.noteIndex % 2 === 0) {
            this.noise(.018, .007, 5000, this.stepAt);
          }
          if (this.noteIndex % 4 === 0) {
            const b = bass[this.bassIndex % bass.length];
            const bf = 440 * Math.pow(2, (b - 69) / 12);
            this.tone(bf, eighth * 3.4, 'triangle', .036, null, this.stepAt);
            this.bassIndex++;
            if (this.noteIndex % 8 === 0) this.noise(.055, .012, 110, this.stepAt);
          }
          this.stepAt += eighth * duration;
          this.noteIndex++;
        }
      } finally {
        this.route = previousRoute;
      }
    }
  }

  const audio = new AudioEngine();

  /* ==========================================================
     DOM references
     ========================================================== */

  const dom = {
    shell: document.getElementById('gameShell'),
    canvas: document.getElementById('gameCanvas'),
    hud: document.getElementById('hud'),
    hudAvatar: document.getElementById('hudAvatar'),
    hudAvatarCanvas: document.getElementById('hudAvatarCanvas'),
    score: document.getElementById('scoreValue'),
    coins: document.getElementById('coinValue'),
    distance: document.getElementById('distanceValue'),
    hearts: document.getElementById('hearts'),
    combo: document.getElementById('comboBadge'),
    comboValue: document.getElementById('comboValue'),
    startScreen: document.getElementById('startScreen'),
    helpScreen: document.getElementById('helpScreen'),
    helpButton: document.getElementById('helpButton'),
    helpCloseButton: document.getElementById('helpCloseButton'),
    helpDoneButton: document.getElementById('helpDoneButton'),
    settingsScreen: document.getElementById('settingsScreen'),
    settingsButton: document.getElementById('settingsButton'),
    hudSettingsButton: document.getElementById('hudSettingsButton'),
    pauseSettingsButton: document.getElementById('pauseSettingsButton'),
    settingsCloseButton: document.getElementById('settingsCloseButton'),
    settingsDoneButton: document.getElementById('settingsDoneButton'),
    musicVolume: document.getElementById('musicVolume'),
    musicVolumeValue: document.getElementById('musicVolumeValue'),
    sfxVolume: document.getElementById('sfxVolume'),
    sfxVolumeValue: document.getElementById('sfxVolumeValue'),
    clearLocalBoardButton: document.getElementById('clearLocalBoardButton'),
    clearAchievementsButton: document.getElementById('clearAchievementsButton'),
    clearBestsButton: document.getElementById('clearBestsButton'),
    nicknameScreen: document.getElementById('nicknameScreen'),
    nicknameButton: document.getElementById('nicknameButton'),
    nicknameText: document.getElementById('nicknameText'),
    nicknameInput: document.getElementById('nicknameInput'),
    nicknameWarning: document.getElementById('nicknameWarning'),
    nicknameConfirmButton: document.getElementById('nicknameConfirmButton'),
    nicknameCancelButton: document.getElementById('nicknameCancelButton'),
    nicknameTitle: document.getElementById('nicknameTitle'),
    pauseScreen: document.getElementById('pauseScreen'),
    gameOverScreen: document.getElementById('gameOverScreen'),
    boardScreen: document.getElementById('boardScreen'),
    boardButton: document.getElementById('boardButton'),
    boardCloseButton: document.getElementById('boardCloseButton'),
    boardFilters: document.getElementById('boardFilters'),
    boardSources: document.getElementById('boardSources'),
    boardStatus: document.getElementById('boardStatus'),
    boardRefreshButton: document.getElementById('boardRefreshButton'),
    boardTable: document.getElementById('boardTable'),
    boardBody: document.getElementById('boardBody'),
    boardEmpty: document.getElementById('boardEmpty'),
    boardEmptyText: document.getElementById('boardEmptyText'),
    boardCount: document.getElementById('boardCount'),
    boardCurrent: document.getElementById('boardCurrent'),
    boardCurrentNote: document.getElementById('boardCurrentNote'),
    boardCurrentRow: document.getElementById('boardCurrentRow'),
    boardClearButton: document.getElementById('boardClearButton'),
    achievementScreen: document.getElementById('achievementScreen'),
    achievementButton: document.getElementById('achievementButton'),
    achievementCount: document.getElementById('achievementCount'),
    achievementMeter: document.getElementById('achievementMeter'),
    achievementCloseButton: document.getElementById('achievementCloseButton'),
    achievementList: document.getElementById('achievementList'),
    achievementProgress: document.getElementById('achievementProgress'),
    achievementToast: document.getElementById('achievementToast'),
    achievementToastIcon: document.getElementById('achievementToastIcon'),
    achievementToastTitle: document.getElementById('achievementToastTitle'),
    achievementTooltip: document.getElementById('achievementTooltip'),
    achievementTooltipIcon: document.getElementById('achievementTooltipIcon'),
    achievementTooltipTitle: document.getElementById('achievementTooltipTitle'),
    achievementTooltipText: document.getElementById('achievementTooltipText'),
    achievementTooltipMeta: document.getElementById('achievementTooltipMeta'),
    difficultySwitch: document.getElementById('difficultySwitch'),
    pauseMode: document.getElementById('pauseMode'),
    overKicker: document.getElementById('overKicker'),
    finalRank: document.getElementById('finalRank'),
    overBoardButton: document.getElementById('overBoardButton'),
    startButton: document.getElementById('startButton'),
    pauseButton: document.getElementById('pauseButton'),
    resumeButton: document.getElementById('resumeButton'),
    restartButton: document.getElementById('restartButton'),
    homeButton: document.getElementById('homeButton'),
    retryButton: document.getElementById('retryButton'),
    changeAvatarButton: document.getElementById('changeAvatarButton'),
    overHomeButton: document.getElementById('overHomeButton'),
    startAvatarGrid: document.getElementById('startAvatarGrid'),
    pauseAvatarGrid: document.getElementById('pauseAvatarGrid'),
    menuAvatarCanvas: document.getElementById('menuAvatarCanvas'),
    menuAvatarName: document.getElementById('menuAvatarName'),
    openAvatarButton: document.getElementById('openAvatarButton'),
    pauseAvatarButton: document.getElementById('pauseAvatarButton'),
    menuBestLabel: document.getElementById('menuBestLabel'),
    menuBest: document.getElementById('menuBest'),
    pauseScore: document.getElementById('pauseScore'),
    pauseDistance: document.getElementById('pauseDistance'),
    pauseCoins: document.getElementById('pauseCoins'),
    finalScore: document.getElementById('finalScore'),
    finalCoins: document.getElementById('finalCoins'),
    finalDistance: document.getElementById('finalDistance'),
    finalBest: document.getElementById('finalBest'),
    finalMeters: document.getElementById('finalMeters'),
    overTitle: document.getElementById('overTitle'),
    overSubtitle: document.getElementById('overSubtitle'),
    recordBadge: document.getElementById('recordBadge'),
    resultAvatarCanvas: document.getElementById('resultAvatarCanvas'),
    jumpButton: document.getElementById('jumpButton'),
    uploadInput: document.getElementById('avatarUpload'),
    toast: document.getElementById('toast'),
    flash: document.getElementById('screenFlash'),
  };

  function loadBests() {
    const bests = { easy: 0, normal: 0, hard: 0, extreme: 0 };
    const raw = readStore(STORAGE.bestsV3, null);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        for (const key of Object.keys(bests)) {
          const value = Number(parsed && parsed[key]);
          if (Number.isFinite(value) && value > bests[key]) bests[key] = Math.floor(value);
        }
      } catch (error) {
        // corrupted bests: keep defaults
      }
    }
    // 旧版：原来的“困难”就是现在的“普通”，原来的“简单”就是现在的“简单”
    const oldRaw = readStore(STORAGE.bests, null);
    if (oldRaw) {
      try {
        const old = JSON.parse(oldRaw);
        bests.normal = Math.max(bests.normal, Math.floor(Number(old.hard) || 0));
        bests.easy = Math.max(bests.easy, Math.floor(Number(old.easy) || 0));
      } catch (error) {
        // ignore
      }
    }
    return bests;
  }

  function saveBests() {
    writeStore(STORAGE.bestsV3, JSON.stringify(state.bests));
  }

  function normalizeBoardEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const score = Number(entry.score);
    if (!Number.isFinite(score)) return null;
    const isV2 = Number(entry.v) === 2;
    let mode = entry.mode;
    if (!isV2) {
      // 旧数据：原困难 = 普通；原简单 = 简单；原怀旧版归入“旧版”
      mode = mode === 'hard' ? 'normal' : mode === 'easy' ? 'easy' : 'legacy';
    } else if (!MODE_RULES[mode] && mode !== 'legacy') {
      mode = 'normal';
    }
    return {
      v: 2,
      id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      nickname: String(entry.nickname || entry.name || '').slice(0, 12),
      score: Math.max(0, Math.floor(score)),
      coins: Math.max(0, Math.floor(Number(entry.coins) || 0)),
      distance: Math.max(0, Math.floor(Number(entry.distance) || 0)),
      seconds: Math.max(0, Math.round(Number(entry.seconds) || 0)),
      mode,
      date: Number(entry.date) || Date.now(),
    };
  }

  function loadBoard() {
    try {
      const parsed = JSON.parse(readStore(STORAGE.board, '[]') || '[]');
      if (!Array.isArray(parsed)) return [];
      let migrated = false;
      const list = parsed.map((entry) => {
        if (Number(entry && entry.v) !== 2) migrated = true;
        return normalizeBoardEntry(entry);
      }).filter(Boolean).slice(-BOARD_LIMIT);
      if (migrated) writeStore(STORAGE.board, JSON.stringify(list));
      return list;
    } catch (error) {
      return [];
    }
  }

  function readAchievementBucket(parsed) {
    const result = {};
    for (const milestone of MILESTONES) {
      const value = Number(parsed && parsed[milestone.id]);
      if (Number.isFinite(value) && value > 0) result[milestone.id] = value;
    }
    return result;
  }

  function loadAchievements() {
    const result = {};
    try {
      const rawV2 = readStore(STORAGE.achievementsV2, null);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        const hasModeBuckets = Object.keys(MODE_RULES).some((mode) => parsed && typeof parsed[mode] === 'object');
        if (hasModeBuckets) {
          // 旧版四套独立成就：合并成一套通用成就，保留最早解锁时间。
          for (const mode of Object.keys(MODE_RULES)) {
            const bucket = readAchievementBucket(parsed && parsed[mode]);
            for (const [id, timestamp] of Object.entries(bucket)) {
              result[id] = result[id] ? Math.min(result[id], timestamp) : timestamp;
            }
          }
        } else {
          Object.assign(result, readAchievementBucket(parsed));
        }
        return result;
      }
      // 更早的全局成就：直接作为通用成就。
      const oldRaw = readStore(STORAGE.achievements, null);
      if (oldRaw) Object.assign(result, readAchievementBucket(JSON.parse(oldRaw)));
    } catch (error) {
      // keep empty achievements
    }
    return result;
  }

  function saveAchievements() {
    writeStore(STORAGE.achievementsV2, JSON.stringify(state.achievements));
  }

  const NICKNAME_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  const NICKNAME_CHANGE_LIMIT = 2;

  function loadNicknameChanges() {
    try {
      const parsed = JSON.parse(readStore(STORAGE.nicknameChanges, '[]') || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b).slice(-20);
    } catch (error) {
      return [];
    }
  }

  function nicknameChangeInfo() {
    const now = Date.now();
    const recent = state.nicknameChanges.filter((timestamp) => now - timestamp < NICKNAME_WINDOW_MS);
    state.nicknameChanges = recent;
    writeStore(STORAGE.nicknameChanges, JSON.stringify(recent));
    return {
      used: recent.length,
      remaining: Math.max(0, NICKNAME_CHANGE_LIMIT - recent.length),
      nextAvailable: recent.length >= NICKNAME_CHANGE_LIMIT ? recent[0] + NICKNAME_WINDOW_MS : 0,
    };
  }

  const state = {
    mode: 'menu',
    selected: 'mario',
    customImage: null,
    customData: null,
    pendingCustomSelection: false,
    difficulty: isModeKey(readStore(STORAGE.mode, '')) ? readStore(STORAGE.mode, 'normal') : 'normal',
    nickname: (readStore(STORAGE.nickname, '') || '').trim().slice(0, 12),
    nicknameChanges: loadNicknameChanges(),
    nicknamePromptOpen: false,
    bests: loadBests(),
    achievements: loadAchievements(),
    achievementQueue: [],
    achievementTimer: 0,
    achievementOpen: false,
    achievementReturn: 'start',
    settingsOpen: false,
    settingsReturn: 'start',
    settingsClearArmed: '',
    settingsClearTimer: 0,
    helpOpen: false,
    board: loadBoard(),
    boardFilter: 'normal',
    boardSource: 'global',
    onlineBoard: [],
    onlineLoading: false,
    onlineError: '',
    onlineFetchedAt: 0,
    onlineRunRank: null,
    onlineRankLoading: false,
    pendingSyncing: false,
    boardReturn: 'start',
    boardOpen: false,
    lastRunId: '',
    clearArmedAt: 0,
    avatarCards: [],
    menuTime: 0,
    menuCamera: 0,
    toastTimer: 0,
    lastTime: 0,
    accumulator: 0,
    run: null,
    heartNodes: [],
    lastHud: { score: '', coins: '', distance: '', hearts: -1 },
  };

  const ctx = dom.canvas.getContext('2d');
  let dpr = 1;
  let scaleX = 1;
  let scaleY = 1;

  function resizeCanvas() {
    const rect = dom.canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    dom.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    dom.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scaleX = dom.canvas.width / DESIGN_W;
    scaleY = dom.canvas.height / DESIGN_H;
  }

  function clearCanvas() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  /* ==========================================================
     Avatar UI
     ========================================================== */

  function selectedAvatar() {
    const found = AVATARS.find((avatar) => avatar.id === state.selected);
    if (state.selected === 'custom') {
      return state.customImage ? (found || avatarById('custom')) : (AVATARS[0] || DEFAULT_AVATAR);
    }
    return found || AVATARS[0] || DEFAULT_AVATAR;
  }

  function buildAvatarGrid(container) {
    container.innerHTML = '';
    for (const avatar of AVATARS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'avatar-card';
      card.dataset.avatar = avatar.id;
      card.setAttribute('aria-label', avatar.id === 'custom' ? '上传或选择我的头像' : `选择${avatar.name}`);
      card.title = avatar.id === 'custom'
        ? '上传一张照片作为主角头像'
        : `换成${avatar.name}`;

      const disc = document.createElement('span');
      disc.className = 'avatar-disc';

      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      disc.appendChild(canvas);

      const check = document.createElement('span');
      check.className = 'avatar-check';
      check.textContent = '✓';
      disc.appendChild(check);

      if (avatar.id === 'custom') {
        const edit = document.createElement('span');
        edit.className = 'custom-edit';
        edit.innerHTML = '<svg class="icon"><use href="#i-camera"></use></svg>';
        disc.appendChild(edit);
      }

      const name = document.createElement('span');
      name.className = 'avatar-card__name';
      name.textContent = avatar.name;

      card.appendChild(disc);
      card.appendChild(name);
      card.addEventListener('click', () => onAvatarCardClick(avatar.id));
      container.appendChild(card);

      state.avatarCards.push({ id: avatar.id, card, canvas, disc });
      paintPortrait(canvas, avatar);
    }
  }

  function paintPortrait(canvas, avatar) {
    if (avatar.id === 'custom' && !state.customImage) {
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    drawPortrait(canvas, avatar);
  }

  function refreshAvatarUI() {
    const chosen = selectedAvatar();
    if (dom.menuAvatarCanvas) drawPortrait(dom.menuAvatarCanvas, chosen);
    if (dom.menuAvatarName) {
      dom.menuAvatarName.textContent = chosen.id === 'custom'
        ? (state.customImage ? '我的照片' : '上传照片')
        : chosen.name;
    }
    drawHudAvatar(chosen);
    if (state.mode === 'gameover') drawResultAvatar();
    updateMenuBest();
  }

  function drawHudAvatar(avatar) {
    const c = dom.hudAvatarCanvas.getContext('2d');
    c.clearRect(0, 0, 96, 96);
    c.save();
    c.beginPath();
    c.arc(48, 48, 46, 0, TAU);
    c.clip();
    if (avatar.head === 'image' && avatar.image) {
      drawImageCover(c, avatar.image, 0, 0, 96, 96, .44);
    } else if (avatar.id === 'custom' && state.customImage) {
      drawImageCover(c, state.customImage, 0, 0, 96, 96, .46);
    } else {
      const grad = c.createLinearGradient(0, 0, 96, 96);
      grad.addColorStop(0, avatar.portrait[0]);
      grad.addColorStop(1, avatar.portrait[1]);
      c.fillStyle = grad;
      c.fillRect(0, 0, 96, 96);
      drawAvatarHead(c, avatar, 48, 53, 70, { blink: false });
    }
    c.restore();
  }

  function drawResultAvatar() {
    drawPortrait(dom.resultAvatarCanvas, selectedAvatar());
  }

  function selectAvatar(id, options = {}) {
    if (id === 'custom' && !state.customImage) {
      openUploadDialog();
      return;
    }
    if (state.selected === id && !options.force) {
      refreshAvatarUI();
      return;
    }
    state.selected = id;
    writeStore(STORAGE.avatar, id);
    refreshAvatarUI();
    if (!options.silent) {
      const av = selectedAvatar();
      showToast(`已切换为 <strong>${av.name}</strong>${state.mode === 'paused' ? ' · 继续游戏即可看到' : ''}`);
    }
  }

  function onAvatarCardClick(id) {
    audio.unlock();
    audio.sfx('click');
    if (id === 'custom') {
      if (!state.customImage) {
        openUploadDialog();
        return;
      }
      if (state.selected === 'custom') {
        openUploadDialog();
        return;
      }
      selectAvatar('custom');
      showToast('已换上你的头像 · 再次点击可更换照片');
      return;
    }
    selectAvatar(id);
  }

  function openUploadDialog() {
    try {
      dom.uploadInput.value = '';
      dom.uploadInput.click();
    } catch (error) {
      showToast('浏览器没有允许打开文件选择器');
    }
  }

  function markCustomUploading(isUploading) {
    for (const ref of state.avatarCards) {
      if (ref.id === 'custom') ref.card.classList.toggle('is-uploading', isUploading);
    }
  }

  function handleAvatarFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择一张图片（PNG / JPG / WebP）');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast('图片有点大，请选择 12MB 以内的照片');
      return;
    }

    markCustomUploading(true);
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const size = 320;
        const offscreen = document.createElement('canvas');
        offscreen.width = size;
        offscreen.height = size;
        const octx = offscreen.getContext('2d');
        octx.fillStyle = '#f4dfb7';
        octx.fillRect(0, 0, size, size);
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const cover = Math.max(size / iw, size / ih);
        const dw = iw * cover;
        const dh = ih * cover;
        octx.drawImage(img, (size - dw) / 2, (size - dh) * .46, dw, dh);
        const dataUrl = offscreen.toDataURL('image/jpeg', .86);

        const finalImage = new Image();
        finalImage.onload = () => {
          state.customImage = finalImage;
          state.customData = dataUrl;
          state.selected = 'custom';
          const saved = writeStore(STORAGE.custom, dataUrl);
          writeStore(STORAGE.avatar, 'custom');
          markCustomUploading(false);
          URL.revokeObjectURL(objectUrl);
          refreshAvatarUI();
          if (!saved) showToast('头像已应用，但浏览器没有足够空间保存它');
          else showToast('照片已贴到主角脸上 <strong>★</strong>');
          audio.sfx('coin');
        };
        finalImage.onerror = () => {
          markCustomUploading(false);
          URL.revokeObjectURL(objectUrl);
          showToast('照片应用失败，请换一张试试');
        };
        finalImage.src = dataUrl;
      } catch (error) {
        markCustomUploading(false);
        URL.revokeObjectURL(objectUrl);
        showToast('照片处理失败，请换一张试试');
      }
    };
    img.onerror = () => {
      markCustomUploading(false);
      URL.revokeObjectURL(objectUrl);
      showToast('无法读取这张图片，请换一张试试');
    };
    img.src = objectUrl;
  }

  function showToast(html, duration = 2200) {
    dom.toast.innerHTML = html;
    dom.toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      dom.toast.classList.remove('is-visible');
    }, duration);
  }

  function flashScreen(color = '#fff8e6') {
    dom.flash.style.background = color;
    dom.flash.classList.remove('is-active');
    // restart animation
    void dom.flash.offsetWidth;
    dom.flash.classList.add('is-active');
  }

  /* ==========================================================
     Game state helpers
     ========================================================== */

  const emptyRun = () => ({
    player: {
      x: 0, y: 0, w: PLAYER_W, h: PLAYER_H,
      vy: 0, prevX: 0, prevY: 0, onGround: true,
      jumps: 0, coyote: 0, jumpBuffer: 0, jumpHeld: false,
      airTime: 0, doubleJumped: false,
    },
    startX: 0,
    cameraX: 0,
    speed: 330,
    playTime: 0,
    rules: MODE_RULES.normal,
    hearts: 3,
    maxHearts: 3,
    coins: 0,
    scoreFloat: 0,
    runDistance: 0,
    distance: 0,
    combo: 0,
    maxCombo: 0,
    maxBlockScore: 0,
    gotHeartPrize: false,
    damageTimes: [],
    gotTripleDamage: false,
    secondHeartAt: 0,
    gotSecondHeartDown: false,
    wentOffscreen: false,
    gotOffscreenPit: false,
    healCoins: 0,
    comboTimer: 0,
    invincible: 0,
    shake: 0,
    time: 0,
    goTimer: .9,
    deathTimer: 0,
    deathStarted: false,
    dead: false,
    grounds: [],
    pipes: [],
    blocks: [],
    spikes: [],
    coinsArr: [],
    enemies: [],
    particles: [],
    popups: [],
    confetti: [],
    nextSpawnX: 1400,
    patternIndex: 0,
    rng: Math.random,
    runPhase: 0,
    dustTimer: 0,
    blockCoins: [],
  });

  function resetRun() {
    const run = emptyRun();
    run.rules = currentRules();
    run.maxHearts = run.rules.maxHearts || 3;
    run.hearts = run.maxHearts;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    run.rng = seedRandom(seed);
    run.player.x = PLAYER_SCREEN_X;
    run.player.y = GROUND_Y - PLAYER_H;
    run.player.prevX = run.player.x;
    run.player.prevY = run.player.y;
    run.startX = run.player.x;
    run.cameraX = 0;
    addGround(run, 0, 1450);
    run.nextSpawnX = 1450;
    run.patternIndex = 0;

    // a soft opening: a trail of coins, then the first friend
    addCoinLine(run, 520, 342, 5, 38);
    addCoinArc(run, 760, 5, 36, 76);
    addGoomba(run, 1080);
    addPipe(run, 1220, 63);
    addCoinLine(run, 1205, 315, 4, 32);

    generateWorldAhead(run, run.player.x + 2200);

    state.run = run;
    state.lastHud = { score: '', coins: '', distance: '', hearts: -1 };
    return run;
  }

  function addGround(run, x, w) {
    if (w <= 0) return;
    const last = run.grounds[run.grounds.length - 1];
    if (last && Math.abs(last.x + last.w - x) < 1.5) {
      last.w += w;
      return last;
    }
    const ground = { x, w, top: GROUND_Y };
    run.grounds.push(ground);
    return ground;
  }

  function addCoin(run, x, y) {
    run.coinsArr.push({
      x, y,
      r: 12,
      phase: run.rng() * TAU,
      collected: false,
    });
  }

  function addCoinLine(run, x, y, count, spacing) {
    for (let i = 0; i < count; i++) addCoin(run, x + i * spacing, y);
  }

  function addCoinArc(run, centerX, count, spacing, height) {
    const start = centerX - (count - 1) * spacing / 2;
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0 : i / (count - 1);
      addCoin(run, start + i * spacing, GROUND_Y - 75 - Math.sin(t * Math.PI) * height);
    }
  }

  function addPipe(run, x, height) {
    run.pipes.push({ x, y: GROUND_Y - height, w: 58, h: height, capW: 72 });
  }

  function addBlock(run, x, y, type = 'brick') {
    run.blocks.push({
      x, y, w: 34, h: 34, type,
      used: false, bump: 0, hits: 0,
    });
  }

  function addBlockRow(run, x, y, types) {
    for (let i = 0; i < types.length; i++) {
      addBlock(run, x + i * 34, y, types[i]);
    }
  }

  function addGoomba(run, x) {
    const rules = run.rules || MODE_RULES.normal;
    if (rules.enemies === false) return;
    const speedScale = rules.groundSpeed || 1;
    const direction = run.rng() < .5 ? -1 : 1;
    const speed = (18 + run.rng() * 12) * speedScale;
    run.enemies.push({
      x, y: GROUND_Y - 38, w: 41, h: 38,
      vx: direction * speed,
      dead: false,
      squash: 0,
      walkPhase: run.rng() * TAU,
    });
  }

  function addFlyer(run, x) {
    const rules = run.rules || MODE_RULES.normal;
    if (rules.flyers === false) return;
    // 只保留一半的飞行小怪生成量
    if (run.rng() < .5) return;
    const baseY = GROUND_Y - 115 - run.rng() * 35;
    run.enemies.push({
      x, y: baseY, baseY, w: 38, h: 30,
      vx: -28 - run.rng() * 10,
      dead: false,
      squash: 0,
      walkPhase: run.rng() * TAU,
      flying: true,
      phase: run.rng() * TAU,
      amp: 12 + run.rng() * 16,
    });
  }

  function addSpikes(run, x, count = 2) {
    const rules = run.rules || MODE_RULES.normal;
    if (rules.spikes === false) return;
    for (let i = 0; i < count; i++) {
      run.spikes.push({
        x: x + i * 25,
        y: GROUND_Y - 19,
        w: 22,
        h: 19,
      });
    }
  }

  function groundAt(run, x) {
    for (const g of run.grounds) {
      if (x >= g.x && x <= g.x + g.w) return g;
    }
    return null;
  }

  function enemyHitsObstacle(run, enemy, nextX) {
    const left = nextX - enemy.w / 2;
    const right = nextX + enemy.w / 2;
    const top = enemy.y + 2;
    const bottom = enemy.y + enemy.h - 2;
    for (const pipe of run.pipes) {
      const capW = pipe.capW || pipe.w;
      const pipeLeft = pipe.x - (capW - pipe.w) / 2;
      if (right > pipeLeft && left < pipeLeft + capW && bottom > pipe.y + 2 && top < pipe.y + pipe.h) {
        return true;
      }
    }
    for (const spike of run.spikes) {
      if (right > spike.x + 2 && left < spike.x + spike.w - 2 && bottom > spike.y + 2 && top < spike.y + spike.h) {
        return true;
      }
    }
    return false;
  }

  function generateWorldAhead(run, untilX) {
    let guard = 0;
    while (run.nextSpawnX < untilX && guard < 24) {
      createPattern(run, run.nextSpawnX);
      run.patternIndex++;
      guard++;
    }
  }

  function createPattern(run, x) {
    const progress = clamp((x - 1450) / 15000, 0, 1);
    let type;
    if (run.patternIndex === 0) type = 'coins';
    else if (run.patternIndex === 1) type = 'gap';
    else if (run.patternIndex === 2) type = 'blocks';
    else {
      const r = run.rng();
      if (progress < .18) {
        type = r < .24 ? 'gap' : r < .48 ? 'pipe' : r < .7 ? 'goomba' : r < .88 ? 'blocks' : 'spikes';
      } else if (progress < .42) {
        type = r < .18 ? 'gap' : r < .34 ? 'doublegap' : r < .52 ? 'pipe' : r < .65 ? 'blocks' : r < .78 ? 'goomba' : r < .9 ? 'spikes' : 'coins';
      } else {
        type = r < .16 ? 'gap' : r < .3 ? 'doublegap' : r < .45 ? 'pipe' : r < .57 ? 'pipePair' : r < .69 ? 'blocks' : r < .81 ? 'goomba' : r < .92 ? 'spikes' : 'coins';
      }
    }
    buildPattern(run, type, x, progress);
  }

  function buildPattern(run, type, x, progress) {
    const rng = run.rng;
    switch (type) {
      case 'coins': {
        const w = 480 + rng() * 90;
        addGround(run, x, w);
        const baseY = 330 - rng() * 28;
        if (rng() < .5) addCoinLine(run, x + 150, baseY, 6, 34);
        else addCoinArc(run, x + w / 2, 7, 36, 58);
        if (progress > .28 && rng() < .45) addGoomba(run, x + w - 105);
        run.nextSpawnX = x + w;
        break;
      }
      case 'goomba': {
        const w = 540 + rng() * 80;
        addGround(run, x, w);
        const y = 320;
        addCoinLine(run, x + 180, y, 5, 36);
        addGoomba(run, x + 220 + rng() * 60);
        if (progress > .16) addGoomba(run, x + 390 + rng() * 80);
        if (progress > .22 && rng() < .42) addFlyer(run, x + w - 145);
        run.nextSpawnX = x + w;
        break;
      }
      case 'spikes': {
        const w = 500 + rng() * 70;
        addGround(run, x, w);
        const count = 2 + Math.floor(rng() * 2);
        addSpikes(run, x + 250, count);
        addCoinArc(run, x + 250 + count * 12, 4, 34, 70);
        if (progress > .28 && rng() < .5) addFlyer(run, x + w - 120);
        run.nextSpawnX = x + w;
        break;
      }
      case 'pipe': {
        const w = 500 + rng() * 80;
        addGround(run, x, w);
        const height = 58 + progress * 22 + rng() * 12;
        const pipeX = x + 230;
        addPipe(run, pipeX, height);
        addCoinArc(run, pipeX + 29, 4, 36, height + 58);
        if (rng() < .55) addGoomba(run, x + w - 90);
        if (progress > .32 && rng() < .38) addFlyer(run, x + 120);
        run.nextSpawnX = x + w;
        break;
      }
      case 'pipePair': {
        const w = 590 + rng() * 60;
        addGround(run, x, w);
        const h1 = 52 + progress * 12;
        const h2 = 78 + progress * 18;
        addPipe(run, x + 210, h1);
        addPipe(run, x + 355, h2);
        addCoinArc(run, x + 345, 4, 34, h2 + 62);
        run.nextSpawnX = x + w;
        break;
      }
      case 'blocks': {
        const w = 560 + rng() * 60;
        addGround(run, x, w);
        const rowY = 300 - rng() * 22;
        const types = rng() < .5 ? ['brick', 'question', 'brick', 'question'] : ['question', 'brick', 'brick', 'question'];
        addBlockRow(run, x + 235, rowY, types);
        addCoinLine(run, x + 244, rowY - 54, 4, 34);
        if (progress > .3 && rng() < .58) addGoomba(run, x + 440);
        run.nextSpawnX = x + w;
        break;
      }
      case 'gap': {
        const w1 = 250 + rng() * 45;
        const gap = 105 + progress * 48 + rng() * 22;
        const w2 = 350 + rng() * 40;
        addGround(run, x, w1);
        addCoinArc(run, x + w1 + gap / 2, 5, 38, 80);
        addGround(run, x + w1 + gap, w2);
        if (progress > .12) addGoomba(run, x + w1 + gap + w2 - 110);
        run.nextSpawnX = x + w1 + gap + w2;
        break;
      }
      case 'doublegap': {
        const w1 = 220;
        const gap1 = 92 + progress * 25;
        const mid = 165;
        const gap2 = 105 + progress * 35;
        const w2 = 300;
        addGround(run, x, w1);
        addCoinArc(run, x + w1 + gap1 / 2, 3, 31, 56);
        addGround(run, x + w1 + gap1, mid);
        addCoinArc(run, x + w1 + gap1 + mid + gap2 / 2, 3, 31, 56);
        addGround(run, x + w1 + gap1 + mid + gap2, w2);
        if (progress > .5 && rng() < .55) addGoomba(run, x + w1 + gap1 + mid + gap2 + 210);
        run.nextSpawnX = x + w1 + gap1 + mid + gap2 + w2;
        break;
      }
      default:
        run.nextSpawnX = x + 500;
    }
  }

  /* ==========================================================
     Run lifecycle / screens
     ========================================================== */

  function setHudVisible(visible) {
    dom.hud.classList.toggle('is-hidden', !visible);
    dom.hud.setAttribute('aria-hidden', visible ? 'false' : 'true');
    dom.hud.inert = !visible;
  }

  function showScreen(name) {
    const mapping = {
      start: dom.startScreen,
      pause: dom.pauseScreen,
      over: dom.gameOverScreen,
      board: dom.boardScreen,
      achievements: dom.achievementScreen,
      nickname: dom.nicknameScreen,
      settings: dom.settingsScreen,
      help: dom.helpScreen,
    };
    for (const [key, node] of Object.entries(mapping)) {
      const active = key === name;
      node.classList.toggle('is-visible', active);
      node.setAttribute('aria-hidden', active ? 'false' : 'true');
      node.inert = !active;
    }
  }

  const SETTINGS_CLEAR_LABELS = {
    board: '清空本机排行榜',
    achievements: '清空成就',
    bests: '清空最高分',
  };

  function settingsVolumePercent(value) {
    return `${Math.round(clamp(Number(value) || 0, 0, 1) * 100)}%`;
  }

  function syncSettingsUI() {
    const music = Math.round(audio.musicVolume * 100);
    const sfx = Math.round(audio.sfxVolume * 100);
    dom.musicVolume.value = String(music);
    dom.sfxVolume.value = String(sfx);
    dom.musicVolumeValue.textContent = `${music}%`;
    dom.sfxVolumeValue.textContent = `${sfx}%`;
  }

  function resetSettingsClearButtons() {
    if (state.settingsClearTimer) {
      window.clearTimeout(state.settingsClearTimer);
      state.settingsClearTimer = 0;
    }
    state.settingsClearArmed = '';
    dom.settingsScreen.querySelectorAll('[data-clear]').forEach((button) => {
      button.classList.remove('is-armed');
      button.textContent = SETTINGS_CLEAR_LABELS[button.dataset.clear] || '清空';
    });
  }

  function clearLocalScores() {
    state.board = [];
    state.lastRunId = '';
    state.onlineRunRank = null;
    saveBoard();
    updateMenuBest();
    showToast('本机排行榜已清空');
  }

  function clearAchievementsData() {
    state.achievements = {};
    state.achievementQueue = [];
    if (state.achievementTimer) {
      window.clearTimeout(state.achievementTimer);
      state.achievementTimer = 0;
    }
    dom.achievementToast.classList.remove('is-visible');
    saveAchievements();
    updateAchievementBadge();
    if (state.achievementOpen) renderAchievements();
    showToast('成就已清空');
  }

  function clearBestScores() {
    state.bests = { easy: 0, normal: 0, hard: 0, extreme: 0 };
    saveBests();
    updateMenuBest();
    showToast('最高分已清空');
  }

  function handleSettingsClear(action, button) {
    if (state.settingsClearArmed !== action) {
      resetSettingsClearButtons();
      state.settingsClearArmed = action;
      button.classList.add('is-armed');
      button.textContent = '再次点击确认';
      state.settingsClearTimer = window.setTimeout(resetSettingsClearButtons, 3200);
      return;
    }
    resetSettingsClearButtons();
    if (action === 'board') clearLocalScores();
    else if (action === 'achievements') clearAchievementsData();
    else if (action === 'bests') clearBestScores();
  }

  function openSettings() {
    if (state.mode === 'playing') pauseRun();
    state.settingsReturn = state.mode === 'paused' ? 'pause' : state.mode === 'gameover' ? 'over' : 'start';
    state.settingsOpen = true;
    audio.unlock();
    audio.sfx('click');
    syncSettingsUI();
    resetSettingsClearButtons();
    showScreen('settings');
    window.setTimeout(() => {
      dom.settingsCloseButton.focus({ preventScroll: true });
    }, 80);
  }

  function closeSettings() {
    if (!state.settingsOpen) return;
    state.settingsOpen = false;
    resetSettingsClearButtons();
    audio.sfx('click');
    showScreen(state.settingsReturn === 'pause' ? 'pause' : state.settingsReturn === 'over' ? 'over' : 'start');
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  }

  function openHelp() {
    state.helpOpen = true;
    audio.unlock();
    audio.sfx('click');
    showScreen('help');
    window.setTimeout(() => {
      dom.helpCloseButton.focus({ preventScroll: true });
    }, 80);
  }

  function closeHelp() {
    if (!state.helpOpen) return;
    state.helpOpen = false;
    audio.sfx('click');
    showScreen('start');
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  }

  function updateNicknameUI() {
    dom.nicknameText.textContent = state.nickname || '未设置';
    dom.nicknameButton.classList.toggle('is-set', Boolean(state.nickname));
    dom.nicknameButton.setAttribute('aria-label', state.nickname ? `修改昵称：${state.nickname}` : '设置昵称');
  }

  function updateNicknameWarning() {
    const editing = Boolean(state.nickname);
    const info = nicknameChangeInfo();
    const blocked = editing && info.remaining <= 0;
    if (!editing) {
      dom.nicknameWarning.textContent = '⚠️ 首次设置不占用修改次数；之后 30 天内最多修改 2 次。';
    } else if (blocked) {
      dom.nicknameWarning.textContent = `⛔ 本周期 2 次修改已用完，${formatAchievementDate(info.nextAvailable)} 后可再修改。`;
    } else {
      dom.nicknameWarning.textContent = `⚠️ 昵称 30 天内最多修改 2 次，本周期还可修改 ${info.remaining} 次。`;
    }
    dom.nicknameWarning.classList.toggle('is-error', blocked);
    dom.nicknameInput.disabled = blocked;
    dom.nicknameConfirmButton.disabled = blocked;
    return blocked;
  }

  function openNicknamePrompt() {
    state.nicknamePromptOpen = true;
    const editing = Boolean(state.nickname);
    dom.nicknameTitle.textContent = editing ? '修改昵称' : '先起一个昵称';
    dom.nicknameCancelButton.hidden = !editing;
    dom.nicknameConfirmButton.textContent = editing ? '保存昵称' : '进入游戏';
    dom.nicknameInput.value = state.nickname || '';
    dom.nicknameInput.classList.remove('is-invalid');
    updateNicknameWarning();
    showScreen('nickname');
    window.setTimeout(() => {
      if (!dom.nicknameInput.disabled) {
        dom.nicknameInput.focus({ preventScroll: true });
        dom.nicknameInput.select();
      }
    }, 80);
  }

  function saveNickname() {
    const value = dom.nicknameInput.value.trim().slice(0, 12);
    if (!value) {
      dom.nicknameInput.classList.add('is-invalid');
      dom.nicknameInput.focus({ preventScroll: true });
      return;
    }
    const previous = state.nickname;
    if (previous && value === previous) {
      state.nicknamePromptOpen = false;
      showScreen('start');
      return;
    }
    let remaining = NICKNAME_CHANGE_LIMIT;
    if (previous) {
      const info = nicknameChangeInfo();
      if (info.remaining <= 0) {
        updateNicknameWarning();
        return;
      }
      state.nicknameChanges.push(Date.now());
      writeStore(STORAGE.nicknameChanges, JSON.stringify(state.nicknameChanges));
      remaining = info.remaining - 1;
    }
    state.nickname = value;
    writeStore(STORAGE.nickname, value);
    state.nicknamePromptOpen = false;
    dom.nicknameInput.classList.remove('is-invalid');
    updateNicknameUI();
    showScreen('start');
    if (previous) {
      showToast(`昵称已修改，30 天内还可修改 ${remaining} 次`);
    } else {
      showToast(`昵称已设为 <strong>${escapeHtml(value)}</strong>，30 天内还可修改 2 次`);
    }
  }

  function cancelNickname() {
    state.nicknamePromptOpen = false;
    showScreen('start');
  }

  function updateHearts(animate = false) {
    const run = state.run;
    if (!run) return;
    const count = Math.max(1, run.maxHearts || 3);
    if (state.heartNodes.length !== count) {
      dom.hearts.innerHTML = '';
      state.heartNodes = [];
      for (let i = 0; i < count; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart';
        heart.innerHTML = '<svg class="icon"><use href="#i-heart"></use></svg>';
        dom.hearts.appendChild(heart);
        state.heartNodes.push(heart);
      }
    }
    state.heartNodes.forEach((node, index) => {
      const empty = index >= run.hearts;
      const wasEmpty = node.classList.contains('is-empty');
      node.classList.toggle('is-empty', empty);
      if (animate && empty && !wasEmpty) {
        node.classList.remove('is-popping');
        void node.offsetWidth;
        node.classList.add('is-popping');
      }
    });
    dom.hearts.setAttribute('aria-label', `剩余生命 ${run.hearts}`);
    state.lastHud.hearts = run.hearts;
  }

  function updateHud(force = false) {
    const run = state.run;
    if (!run) return;
    const score = padScore(run.scoreFloat);
    if (force || score !== state.lastHud.score) {
      dom.score.textContent = score;
      state.lastHud.score = score;
    }
    const coinsText = String(run.coins);
    if (force || coinsText !== state.lastHud.coins) {
      dom.coins.textContent = coinsText;
      state.lastHud.coins = coinsText;
    }
    const distanceText = String(run.distance);
    if (force || distanceText !== state.lastHud.distance) {
      dom.distance.textContent = distanceText;
      state.lastHud.distance = distanceText;
    }
    if (force || state.lastHud.hearts !== run.hearts) updateHearts(false);
  }

  function updateComboBadge() {
    const run = state.run;
    if (!run) {
      dom.combo.hidden = true;
      return;
    }
    if (run.combo >= 2 && run.comboTimer > 0) {
      dom.combo.hidden = false;
      dom.comboValue.textContent = `×${run.combo}`;
    } else {
      dom.combo.hidden = true;
    }
  }

  function updateMenuBest() {
    dom.menuBest.textContent = padScore(bestForMode());
    if (dom.menuBestLabel) dom.menuBestLabel.textContent = `最高分 · ${modeLabelFor(currentModeKey())}`;
  }

  function currentRules() {
    return rulesFor(state.difficulty);
  }

  function currentModeKey() {
    return modeKeyFor(state.difficulty);
  }

  function bestForMode() {
    return state.bests[currentModeKey()] || 0;
  }

  function modeLabelFor(key) {
    return (RULES_BY_KEY[key] || MODE_RULES.normal).label;
  }

  function refreshModeUI() {
    const rules = currentRules();
    dom.difficultySwitch.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === state.difficulty;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    dom.pauseMode.textContent = `当前模式 · ${rules.label}`;
    dom.startButton.dataset.mode = state.difficulty;
    updateAchievementBadge();
    updateMenuBest();
  }

  function setMode(mode) {
    const next = isModeKey(mode) ? mode : 'normal';
    if (state.difficulty === next) return;
    state.difficulty = next;
    writeStore(STORAGE.mode, next);
    audio.sfx('click');
    refreshModeUI();
  }

  function startRun() {
    audio.unlock();
    audio.sfx('click');
    audio.stopMusic();
    const run = resetRun();
    state.mode = 'playing';
    state.accumulator = 0;
    state.lastTime = performance.now();
    dom.pauseMode.textContent = `当前模式 · ${run.rules.label}`;
    showScreen(null);
    setHudVisible(true);
    updateHud(true);
    updateComboBadge();
    dom.shell.classList.add('is-playing');
    dom.shell.classList.remove('is-paused');
    dom.startButton.blur();
    try { dom.jumpButton.blur(); } catch (error) { /* no-op */ }
    audio.startMusic();
    run.goTimer = .85;
    // ensure a crisp first frame
    renderScene(performance.now() / 1000);
  }

  function openMenu(options = {}) {
    audio.stopMusic();
    state.mode = 'menu';
    state.accumulator = 0;
    setHudVisible(false);
    dom.shell.classList.remove('is-playing');
    dom.shell.classList.remove('is-paused');
    showScreen('start');
    updateMenuBest();
    if (state.run) updateHearts(false);
    if (options.highlightAvatar) {
      const target = state.avatarCards.find((ref) => ref.card.parentElement === dom.startAvatarGrid);
      if (target) {
        window.setTimeout(() => {
          target.card.focus({ preventScroll: true });
          const panel = dom.startAvatarGrid.closest('.selector-panel');
          if (panel) {
            panel.animate(
              [
                { transform: 'rotate(.55deg) scale(1)' },
                { transform: 'rotate(-1deg) scale(1.025)' },
                { transform: 'rotate(.55deg) scale(1)' },
              ],
              { duration: 520, easing: 'ease-out' }
            );
          }
        }, 80);
      }
      showToast('挑一个喜欢的新头像吧');
    }
  }

  function pauseRun() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.accumulator = 0;
    audio.stopMusic();
    audio.sfx('pause');
    setHudVisible(false);
    dom.shell.classList.remove('is-playing');
    dom.shell.classList.add('is-paused');
    dom.pauseScore.textContent = String(Math.floor(state.run.scoreFloat));
    dom.pauseDistance.textContent = String(state.run.distance);
    dom.pauseCoins.textContent = String(state.run.coins);
    showScreen('pause');
    window.setTimeout(() => {
      dom.resumeButton.focus({ preventScroll: true });
    }, 80);
  }

  function resumeRun() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    state.accumulator = 0;
    state.lastTime = performance.now();
    audio.unlock();
    audio.sfx('resume');
    audio.startMusic();
    showScreen(null);
    setHudVisible(true);
    dom.shell.classList.add('is-playing');
    dom.shell.classList.remove('is-paused');
    dom.resumeButton.blur();
  }

  function goHomeFromPause() {
    if (state.mode === 'paused') {
      openMenu();
    }
  }

  function finishGameOver() {
    const run = state.run;
    if (!run) return;
    const rules = run.rules || MODE_RULES.normal;
    state.boardFilter = isModeKey(rules.key) ? rules.key : 'normal';
    state.mode = 'gameover';
    state.accumulator = 0;
    audio.stopMusic();
    dom.shell.classList.remove('is-playing');
    setHudVisible(false);
    updateComboBadge();
    const score = Math.floor(run.scoreFloat);
    const qualified = run.distance >= MIN_LEADERBOARD_DISTANCE;
    const isRecord = qualified && score > (state.bests[rules.key] || 0);
    if (isRecord) {
      state.bests[rules.key] = score;
      saveBests();
    }
    const entry = qualified ? recordRun(run, score, rules.key) : null;
    if (!qualified) {
      state.lastRunId = '';
      state.onlineRunRank = null;
    }
    const rank = rankOfEntry(entry ? entry.id : '');
    updateMenuBest();
    dom.overKicker.textContent = `RUN COMPLETE · ${rules.label}`;
    dom.finalScore.textContent = formatNumber(score);
    dom.finalCoins.textContent = formatNumber(run.coins);
    dom.finalDistance.textContent = String(run.distance);
    dom.finalMeters.textContent = `跑了 ${run.distance} 米 · 用时 ${formatDuration(run.playTime)}`;
    dom.finalBest.textContent = formatNumber(state.bests[rules.key] || 0);
    dom.recordBadge.hidden = !isRecord || score === 0;
    if (!qualified) {
      dom.finalRank.textContent = `不足 ${MIN_LEADERBOARD_DISTANCE} 米 · 本局未计入排行榜`;
      dom.finalRank.hidden = false;
    } else if (rank > 0) {
      dom.finalRank.innerHTML = `本局排名 <b>#${rank}</b> · 共 ${sortedBoardEntries('all').length} 条记录`;
      dom.finalRank.hidden = false;
    } else {
      dom.finalRank.hidden = true;
    }
    if (!qualified) {
      dom.overTitle.textContent = '本局未计入排行榜';
      dom.overSubtitle.textContent = `只跑了 ${run.distance} 米；达到 ${MIN_LEADERBOARD_DISTANCE} 米后才会记录成绩。`;
    } else if (isRecord) {
      dom.overTitle.textContent = '新的最高纪录！';
      dom.overSubtitle.textContent = '这一趟跑得漂亮，下次再刷新它。';
    } else {
      dom.overTitle.textContent = '哎呀，被追上了！';
      dom.overSubtitle.textContent = '金币会记得你，蘑菇王国也会。';
    }
    drawResultAvatar();
    showScreen('over');
    audio.sfx('gameover');
    if (qualified && isRecord && score > 0) {
      audio.sfx('record');
      spawnConfetti();
    }
    window.setTimeout(() => {
      dom.retryButton.focus({ preventScroll: true });
    }, 120);
  }

  /* ==========================================================
     Leaderboard
     ========================================================== */

  function saveBoard() {
    writeStore(STORAGE.board, JSON.stringify(state.board));
  }

  function clearLeaderboardOnce() {
    if (readStore(STORAGE.boardReset, '')) return;
    state.board = [];
    state.lastRunId = '';
    state.onlineBoard = [];
    state.onlineFetchedAt = 0;
    state.onlineRunRank = null;
    state.onlineRankLoading = false;
    state.bests = { easy: 0, normal: 0, hard: 0, extreme: 0 };
    saveBoard();
    saveBests();
    writeStore(STORAGE.pendingScores, '[]');
    writeStore(STORAGE.boardReset, '1');
  }

  function recordRun(run, score, modeKey) {
    if (Math.floor(run.distance) < MIN_LEADERBOARD_DISTANCE) return null;
    const entry = {
      v: 2,
      id: makeUuid(),
      nickname: state.nickname || '匿名',
      score: Math.max(0, Math.floor(score)),
      coins: Math.max(0, Math.floor(run.coins)),
      distance: Math.max(0, Math.floor(run.distance)),
      seconds: Math.max(0, Math.round(run.playTime)),
      mode: isModeKey(modeKey) ? modeKey : 'normal',
      date: Date.now(),
    };
    state.board.push(entry);
    if (state.board.length > BOARD_LIMIT) state.board = state.board.slice(-BOARD_LIMIT);
    saveBoard();
    state.lastRunId = entry.id;
    state.onlineRunRank = null;
    state.onlineFetchedAt = 0;
    queueScoreUpload(entry);
    return entry;
  }

  function sortedBoardEntries(filter = 'all') {
    const list = (filter === 'all'
      ? state.board.slice()
      : state.board.filter((entry) => entry.mode === filter))
      .filter((entry) => entry.distance >= MIN_LEADERBOARD_DISTANCE);
    return list.sort((a, b) => b.score - a.score || a.seconds - b.seconds || b.date - a.date);
  }

  function rankOfEntry(id) {
    if (!id) return 0;
    return sortedBoardEntries('all').findIndex((entry) => entry.id === id) + 1;
  }

  function buildBoardRow(entry, rank) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.setAttribute('role', 'listitem');
    if (entry.id === state.lastRunId) row.classList.add('is-current');

    const rankCell = document.createElement('span');
    rankCell.className = 'board-rank';
    if (rank <= 3) rankCell.classList.add(`board-rank--${rank}`);
    rankCell.textContent = String(rank);

    const playerCell = document.createElement('span');
    playerCell.className = 'board-player-cell';
    const playerNickname = document.createElement('strong');
    playerNickname.textContent = String(entry.nickname || '匿名').trim() || '匿名';
    playerCell.appendChild(playerNickname);

    const modeCell = document.createElement('span');
    modeCell.className = 'board-mode-cell';
    const chip = document.createElement('span');
    chip.className = `board-mode-chip mode--${entry.mode}`;
    chip.textContent = RULES_BY_KEY[entry.mode] ? RULES_BY_KEY[entry.mode].label : '旧版';
    modeCell.appendChild(chip);

    const scoreCell = document.createElement('span');
    scoreCell.className = 'board-score';
    scoreCell.textContent = formatNumber(entry.score);

    const timeCell = document.createElement('span');
    timeCell.className = 'board-time';
    timeCell.textContent = formatDuration(entry.seconds);

    const distanceCell = document.createElement('span');
    distanceCell.className = 'board-time board-cell--distance';
    distanceCell.textContent = `${entry.distance} m`;

    const dateCell = document.createElement('span');
    dateCell.className = 'board-date board-cell--date';
    dateCell.textContent = formatBoardDate(entry.date);

    row.append(rankCell, playerCell, modeCell, scoreCell, timeCell, distanceCell, dateCell);
    return row;
  }

  function currentBoardRunInfo(online) {
    const entry = currentRunEntry();
    if (!entry || state.boardFilter !== entry.mode) return null;
    if (online) {
      const ranked = state.onlineRunRank && state.onlineRunRank.id === entry.id ? state.onlineRunRank : null;
      return {
        entry,
        mode: entry.mode,
        rank: ranked ? ranked.rank : 0,
        loading: !ranked && (state.onlineRankLoading || state.onlineLoading),
      };
    }
    const index = sortedBoardEntries(entry.mode).findIndex((item) => item.id === entry.id);
    return { entry, mode: entry.mode, rank: index >= 0 ? index + 1 : 0, loading: false };
  }

  function currentRunNote(info) {
    const modeLabel = RULES_BY_KEY[info.mode] ? RULES_BY_KEY[info.mode].label : '本模式';
    if (!info.rank) return info.loading ? `正在同步本局${modeLabel}榜排名…` : `本局${modeLabel}榜排名暂不可用`;
    if (info.rank > ONLINE.limit) {
      return `仅显示前 ${ONLINE.limit} 名 · 本局${modeLabel}榜第 ${info.rank} 名`;
    }
    return `本局${modeLabel}榜排名`;
  }

  function renderBoard() {
    const online = state.boardSource === 'global';
    const entries = online
      ? sortedOnlineEntries(state.boardFilter)
      : sortedBoardEntries(state.boardFilter);
    const currentInfo = currentBoardRunInfo(online);
    dom.boardBody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    entries.forEach((entry, index) => fragment.appendChild(buildBoardRow(entry, index + 1)));
    dom.boardBody.appendChild(fragment);
    const hasRows = entries.length > 0;
    dom.boardTable.hidden = !hasRows;
    dom.boardEmpty.hidden = hasRows || Boolean(currentInfo);

    if (currentInfo) {
      dom.boardCurrentNote.textContent = currentRunNote(currentInfo);
      dom.boardCurrentRow.innerHTML = '';
      const currentRow = buildBoardRow(currentInfo.entry, currentInfo.rank || '—');
      currentRow.classList.add('is-current');
      dom.boardCurrentRow.appendChild(currentRow);
      dom.boardCurrent.hidden = false;
    } else {
      dom.boardCurrent.hidden = true;
      dom.boardCurrentRow.innerHTML = '';
    }

    if (online) {
      if (state.onlineLoading) {
        dom.boardEmptyText.textContent = '正在加载全球排行榜…';
        dom.boardStatus.textContent = '正在连接全球排行榜…';
        dom.boardStatus.className = 'board-status is-loading';
      } else if (state.onlineError) {
        dom.boardEmptyText.textContent = '暂时连不上全球排行榜，可以切换「本机」查看本地成绩。';
        dom.boardStatus.textContent = `全球排行榜${state.onlineError}，点击刷新重试`;
        dom.boardStatus.className = 'board-status is-error';
      } else if (!state.onlineBoard.length) {
        dom.boardEmptyText.textContent = '全球排行榜还没有记录，跑一局来抢第一。';
        dom.boardStatus.textContent = '全球排行榜已连接 · 暂无记录';
        dom.boardStatus.className = 'board-status is-ok';
      } else {
        dom.boardEmptyText.textContent = '这个筛选下还没有记录。';
        dom.boardStatus.textContent = `全球排行榜 · 每档显示前 ${ONLINE.limit} 名`;
        dom.boardStatus.className = 'board-status is-ok';
      }
    } else {
      dom.boardEmptyText.textContent = state.board.length === 0
        ? '本机还没有记录，跑一局就会出现在这里。'
        : '这个筛选下还没有记录。';
      dom.boardStatus.textContent = '本机排行榜 · 只保存在这台设备';
      dom.boardStatus.className = 'board-status';
    }

    dom.boardCount.textContent = online
      ? (entries.length
        ? `${RULES_BY_KEY[state.boardFilter]?.label || ''}难度前 ${ONLINE.limit} 名 · 最高 ${formatNumber(entries[0].score)}`
        : '暂无记录')
      : (entries.length
        ? `共 ${entries.length} 条记录 · 最高 ${formatNumber(entries[0].score)}`
        : '共 0 条记录');
    dom.boardFilters.querySelectorAll('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === state.boardFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    dom.boardSources.querySelectorAll('[data-source]').forEach((button) => {
      const active = button.dataset.source === state.boardSource;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    dom.boardRefreshButton.hidden = !online;
    dom.boardRefreshButton.disabled = online && state.onlineLoading;
    dom.boardClearButton.hidden = online || state.board.length === 0;
    dom.boardClearButton.textContent = '清空本机记录';
  }

  function openBoard() {
    state.boardReturn = state.mode === 'gameover' ? 'over' : 'start';
    state.boardOpen = true;
    audio.unlock();
    audio.sfx('click');
    renderBoard();
    showScreen('board');
    if (state.boardSource === 'global') {
      flushPendingScores();
      fetchOnlineScores({ force: !state.onlineFetchedAt });
    }
    window.setTimeout(() => {
      dom.boardCloseButton.focus({ preventScroll: true });
    }, 80);
  }

  function closeBoard() {
    if (!state.boardOpen) return;
    state.boardOpen = false;
    audio.sfx('click');
    showScreen(state.boardReturn === 'over' ? 'over' : 'start');
    if (state.boardReturn === 'start') updateMenuBest();
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  }

  function setBoardFilter(filter) {
    const valid = Object.keys(MODE_RULES);
    state.boardFilter = valid.includes(filter) ? filter : (isModeKey(state.difficulty) ? state.difficulty : 'normal');
    state.clearArmedAt = 0;
    renderBoard();
  }

  function setBoardSource(source) {
    state.boardSource = source === 'local' ? 'local' : 'global';
    state.clearArmedAt = 0;
    renderBoard();
    if (state.boardSource === 'global') {
      flushPendingScores();
      fetchOnlineScores();
    }
  }

  function clearBoard() {
    const now = performance.now();
    if (now - state.clearArmedAt > 3200) {
      state.clearArmedAt = now;
      dom.boardClearButton.textContent = '再点一次清空';
      return;
    }
    state.clearArmedAt = 0;
    state.board = [];
    state.lastRunId = '';
    state.onlineRunRank = null;
    saveBoard();
    renderBoard();
    showToast('本机排行榜已清空');
  }

  /* ==========================================================
     Online leaderboard (Supabase)
     ========================================================== */

  function onlineHeaders(extra = {}) {
    const headers = { apikey: ONLINE.key };
    // Legacy JWT anon keys also need the Authorization header. The new
    // sb_publishable_ keys are not JWTs and use the apikey header only.
    if (/^eyJ/.test(ONLINE.key)) headers.Authorization = `Bearer ${ONLINE.key}`;
    return {
      ...headers,
      ...extra,
    };
  }

  function mapRemoteScore(row) {
    const score = Number(row && row.score);
    if (!Number.isFinite(score)) return null;
    const mode = isModeKey(row.mode) ? row.mode : 'normal';
    const date = Date.parse(row.created_at);
    return {
      v: 2,
      id: String(row.id || ''),
      remote: true,
      nickname: String(row.player_name || row.nickname || '匿名').trim().slice(0, 12) || '匿名',
      score: Math.max(0, Math.floor(score)),
      coins: Math.max(0, Math.floor(Number(row.coins) || 0)),
      distance: Math.max(0, Math.floor(Number(row.distance) || 0)),
      seconds: Math.max(0, Math.round(Number(row.seconds) || 0)),
      mode,
      date: Number.isFinite(date) ? date : Date.now(),
    };
  }

  function sortedOnlineEntries(filter = 'all') {
    const list = (filter === 'all'
      ? state.onlineBoard.slice()
      : state.onlineBoard.filter((entry) => entry.mode === filter))
      .filter((entry) => entry.distance >= MIN_LEADERBOARD_DISTANCE);
    return list.sort((a, b) => b.score - a.score || a.seconds - b.seconds || b.date - a.date).slice(0, ONLINE.limit);
  }

  function currentRunEntry() {
    if (!state.lastRunId) return null;
    return state.board.find((entry) => entry.id === state.lastRunId && entry.distance >= MIN_LEADERBOARD_DISTANCE) || null;
  }

  function onlineCountParams(filters, extraCreatedAt = '') {
    const params = new URLSearchParams();
    params.set('select', 'id');
    params.set('limit', '1');
    if (extraCreatedAt) {
      params.append('and', `(created_at.gte.${ONLINE.epoch},created_at.${extraCreatedAt})`);
    } else {
      params.append('created_at', `gte.${ONLINE.epoch}`);
    }
    params.append('distance', `gte.${MIN_LEADERBOARD_DISTANCE}`);
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'created_at') params.append('created_at', value);
      else params.set(key, value);
    });
    return params;
  }

  async function countOnlineRows(filters, extraCreatedAt = '') {
    const params = onlineCountParams(filters, extraCreatedAt);
    const response = await fetchWithTimeout(`${ONLINE.url}/rest/v1/${ONLINE.table}?${params.toString()}`, {
      headers: onlineHeaders({
        Accept: 'application/json',
        Prefer: 'count=exact',
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentRange = response.headers.get('content-range') || '';
    const total = Number(contentRange.split('/')[1]);
    if (!Number.isFinite(total)) throw new Error('Missing count');
    return total;
  }

  async function computeOnlineRunRank(entry) {
    const createdAt = new Date(Number(entry.date) || Date.now()).toISOString();
    const base = { mode: `eq.${entry.mode}` };
    const [betterScore, betterTime, sameTimeLater] = await Promise.all([
      countOnlineRows({ ...base, score: `gt.${entry.score}` }),
      countOnlineRows({ ...base, score: `eq.${entry.score}`, seconds: `lt.${entry.seconds}` }),
      countOnlineRows(
        { ...base, score: `eq.${entry.score}`, seconds: `eq.${entry.seconds}` },
        `gt.${createdAt}`,
      ),
    ]);
    return 1 + betterScore + betterTime + sameTimeLater;
  }

  async function refreshOnlineRunRank() {
    state.onlineRunRank = null;
    const entry = currentRunEntry();
    if (!entry) return;
    state.onlineRankLoading = true;
    try {
      const modeEntries = sortedOnlineEntries(entry.mode);
      const index = modeEntries.findIndex((item) => item.id === entry.id);
      const rank = index >= 0 ? index + 1 : await computeOnlineRunRank(entry);
      state.onlineRunRank = {
        id: entry.id,
        entry,
        rank,
        mode: entry.mode,
      };
    } catch (error) {
      state.onlineRunRank = null;
    } finally {
      state.onlineRankLoading = false;
      if (state.boardOpen && state.boardSource === 'global') renderBoard();
    }
  }

  async function fetchOnlineScores(options = {}) {
    if (state.onlineLoading) return;
    if (!options.force && state.onlineFetchedAt && Date.now() - state.onlineFetchedAt < 20000) return;
    state.onlineLoading = true;
    state.onlineError = '';
    state.onlineRunRank = null;
    if (state.boardOpen && state.boardSource === 'global') renderBoard();
    try {
      const select = 'id,player_name,mode,score,coins,distance,seconds,created_at';
      const modes = Object.keys(MODE_RULES);
      const responses = await Promise.all(modes.map((mode) => {
        const params = new URLSearchParams({
          select,
          order: 'score.desc,seconds.asc,created_at.asc',
          limit: String(ONLINE.limit),
          created_at: `gte.${ONLINE.epoch}`,
          distance: `gte.${MIN_LEADERBOARD_DISTANCE}`,
          mode: `eq.${mode}`,
        });
        return fetchWithTimeout(`${ONLINE.url}/rest/v1/${ONLINE.table}?${params.toString()}`, {
          headers: onlineHeaders({ Accept: 'application/json' }),
        });
      }));
      const rows = [];
      for (const response of responses) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const part = await response.json();
        if (Array.isArray(part)) rows.push(...part);
      }
      const unique = new Map();
      rows.map(mapRemoteScore).filter(Boolean).forEach((entry) => unique.set(entry.id, entry));
      state.onlineBoard = Array.from(unique.values());
      state.onlineFetchedAt = Date.now();
      state.onlineError = '';
      await refreshOnlineRunRank();
    } catch (error) {
      state.onlineError = error && error.name === 'AbortError' ? '连接超时' : '连接失败';
    } finally {
      state.onlineLoading = false;
      if (state.boardOpen && state.boardSource === 'global') renderBoard();
    }
  }

  function readPendingScores() {
    try {
      const parsed = JSON.parse(readStore(STORAGE.pendingScores, '[]') || '[]');
      if (!Array.isArray(parsed)) return [];
      const seen = new Set();
      return parsed.filter((entry) => {
        if (!entry || !isUuid(entry.id) || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      }).slice(-50);
    } catch (error) {
      return [];
    }
  }

  function writePendingScores(list) {
    writeStore(STORAGE.pendingScores, JSON.stringify(list.slice(-50)));
  }

  function addPendingScore(entry) {
    if (!isUuid(entry.id)) return;
    const pending = readPendingScores();
    if (pending.some((item) => item.id === entry.id)) return;
    pending.push({
      id: entry.id,
      nickname: String(entry.nickname || state.nickname || '匿名').slice(0, 12),
      score: entry.score,
      coins: entry.coins,
      distance: entry.distance,
      seconds: entry.seconds,
      mode: entry.mode,
    });
    writePendingScores(pending);
  }

  async function uploadRemoteScore(entry) {
    if (!isUuid(entry.id)) return false;
    const nickname = String(entry.nickname || state.nickname || '匿名').trim().slice(0, 12) || '匿名';
    const payload = {
      id: entry.id,
      player_id: getOnlinePlayerId(),
      player_name: nickname,
      mode: isModeKey(entry.mode) ? entry.mode : 'normal',
      score: Math.max(0, Math.floor(Number(entry.score) || 0)),
      coins: Math.max(0, Math.floor(Number(entry.coins) || 0)),
      distance: Math.max(0, Math.floor(Number(entry.distance) || 0)),
      seconds: Math.max(0, Math.round(Number(entry.seconds) || 0)),
    };
    const response = await fetchWithTimeout(`${ONLINE.url}/rest/v1/${ONLINE.table}`, {
      method: 'POST',
      headers: onlineHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify(payload),
    });
    // 409 means this exact run was already uploaded.
    if (response.ok || response.status === 409) return true;
    throw new Error(`HTTP ${response.status}`);
  }

  function queueScoreUpload(entry) {
    if (!isUuid(entry.id)) return;
    uploadRemoteScore(entry).then(() => {
      state.onlineFetchedAt = 0;
      state.onlineRunRank = null;
      if (state.boardOpen && state.boardSource === 'global') fetchOnlineScores({ force: true });
    }).catch(() => {
      addPendingScore(entry);
    });
  }

  async function flushPendingScores() {
    if (state.pendingSyncing) return;
    const pending = readPendingScores();
    if (!pending.length) return;
    state.pendingSyncing = true;
    const left = [];
    try {
      for (const entry of pending) {
        try {
          await uploadRemoteScore(entry);
        } catch (error) {
          left.push(entry);
        }
      }
      writePendingScores(left);
      if (left.length < pending.length) {
        state.onlineFetchedAt = 0;
        if (state.boardOpen && state.boardSource === 'global') fetchOnlineScores({ force: true });
      }
    } finally {
      state.pendingSyncing = false;
    }
  }

  function achievementBucket() {
    return state.achievements || {};
  }

  function updateAchievementBadge() {
    const count = Object.keys(achievementBucket()).length;
    dom.achievementCount.textContent = `${count}/${MILESTONES.length}`;
    if (dom.achievementMeter) {
      dom.achievementMeter.style.width = `${Math.min(100, count / MILESTONES.length * 100)}%`;
    }
  }

  function hideAchievementTooltip() {
    if (!dom.achievementTooltip) return;
    dom.achievementTooltip.hidden = true;
    delete dom.achievementTooltip.dataset.node;
  }

  function showAchievementTooltip(node, milestone, unlockedAt) {
    const shellRect = dom.shell.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    dom.achievementTooltipIcon.innerHTML = achievementIconMarkup(milestone.id);
    dom.achievementTooltipTitle.textContent = milestone.title;
    dom.achievementTooltipTitle.hidden = !unlockedAt;
    dom.achievementTooltipText.textContent = achievementDescription(milestone.id);
    dom.achievementTooltipMeta.textContent = unlockedAt
      ? `已解锁 · ${formatAchievementDate(unlockedAt)}`
      : '未解锁';
    dom.achievementTooltip.style.setProperty('--achievement-color', achievementColor(milestone.id));
    dom.achievementTooltip.hidden = false;
    dom.achievementTooltip.dataset.node = milestone.id;
    const tooltipWidth = dom.achievementTooltip.offsetWidth;
    const tooltipHeight = dom.achievementTooltip.offsetHeight;
    const left = clamp(
      nodeRect.left - shellRect.left + nodeRect.width / 2 - tooltipWidth / 2,
      8,
      shellRect.width - tooltipWidth - 8,
    );
    let top = nodeRect.top - shellRect.top - tooltipHeight - 8;
    if (top < 8) top = nodeRect.bottom - shellRect.top + 8;
    dom.achievementTooltip.style.left = `${left}px`;
    dom.achievementTooltip.style.top = `${top}px`;
  }

  function renderAchievements() {
    hideAchievementTooltip();
    const bucket = achievementBucket();
    const count = Object.keys(bucket).length;
    const previousLeft = dom.achievementList.scrollLeft;
    const previousTop = dom.achievementList.scrollTop;
    dom.achievementList.innerHTML = '';
    dom.achievementList.setAttribute('aria-label', `成就思维导图，已解锁 ${count} / ${MILESTONES.length}`);

    const canvas = document.createElement('div');
    canvas.className = 'achievement-map__canvas';
    canvas.style.width = `${ACHIEVEMENT_MAP.width}px`;
    canvas.style.height = `${ACHIEVEMENT_MAP.height}px`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('achievement-map__links');
    svg.setAttribute('viewBox', `0 0 ${ACHIEVEMENT_MAP.width} ${ACHIEVEMENT_MAP.height}`);
    svg.setAttribute('aria-hidden', 'true');
    const addPath = (d, color, dashed = false) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', dashed ? '1.6' : '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', dashed ? '.45' : '.82');
      if (dashed) path.setAttribute('stroke-dasharray', '4 5');
      svg.appendChild(path);
    };

    const branchCount = ACHIEVEMENT_BRANCHES.length;
    const rowCenter = (index) => ACHIEVEMENT_MAP.rowTop + index * ACHIEVEMENT_MAP.rowGap + ACHIEVEMENT_MAP.nodeH / 2;
    const firstCenter = rowCenter(0);
    const lastCenter = rowCenter(branchCount - 1);
    const rootCenter = (firstCenter + lastCenter) / 2;

    addPath(
      `M ${ACHIEVEMENT_MAP.rootX + ACHIEVEMENT_MAP.rootW} ${rootCenter} H ${ACHIEVEMENT_MAP.trunkX}`,
      'rgba(23,36,59,.55)',
    );
    addPath(
      `M ${ACHIEVEMENT_MAP.trunkX} ${firstCenter} V ${lastCenter}`,
      'rgba(23,36,59,.45)',
    );

    const root = document.createElement('div');
    root.className = 'achievement-root';
    root.style.left = `${ACHIEVEMENT_MAP.rootX}px`;
    root.style.top = `${rootCenter - ACHIEVEMENT_MAP.rootH / 2}px`;
    root.style.width = `${ACHIEVEMENT_MAP.rootW}px`;
    root.style.height = `${ACHIEVEMENT_MAP.rootH}px`;
    const rootIcon = document.createElement('span');
    rootIcon.className = 'achievement-root__icon';
    rootIcon.textContent = '✦';
    const rootTitle = document.createElement('strong');
    rootTitle.textContent = '成就';
    const rootCount = document.createElement('small');
    rootCount.textContent = `${count} / ${MILESTONES.length}`;
    root.append(rootIcon, rootTitle, rootCount);
    canvas.appendChild(root);

    const milestoneById = new Map(MILESTONES.map((item) => [item.id, item]));

    ACHIEVEMENT_BRANCHES.forEach((branch, row) => {
      const center = rowCenter(row);
      addPath(
        `M ${ACHIEVEMENT_MAP.trunkX} ${center} H ${ACHIEVEMENT_MAP.categoryX}`,
        branch.color,
      );

      const category = document.createElement('div');
      category.className = 'achievement-branch';
      category.style.left = `${ACHIEVEMENT_MAP.categoryX}px`;
      category.style.top = `${center - ACHIEVEMENT_MAP.categoryH / 2}px`;
      category.style.width = `${ACHIEVEMENT_MAP.categoryW}px`;
      category.style.height = `${ACHIEVEMENT_MAP.categoryH}px`;
      category.style.setProperty('--branch-color', branch.color);
      const categoryDot = document.createElement('span');
      categoryDot.setAttribute('aria-hidden', 'true');
      const categoryLabel = document.createElement('strong');
      categoryLabel.textContent = branch.label;
      category.append(categoryDot, categoryLabel);
      canvas.appendChild(category);

      const visibleIds = branch.ids.filter((id) => !HIDDEN_ACHIEVEMENTS.has(id) || bucket[id]);
      let previousRight = ACHIEVEMENT_MAP.categoryX + ACHIEVEMENT_MAP.categoryW;
      visibleIds.forEach((id, index) => {
        const milestone = milestoneById.get(id);
        if (!milestone) return;
        const unlockedAt = bucket[id];
        const left = ACHIEVEMENT_MAP.nodeX + index * ACHIEVEMENT_MAP.nodeStep;
        addPath(`M ${previousRight} ${center} H ${left}`, branch.color, !unlockedAt);

        const node = document.createElement('div');
        node.className = `achievement-node ${unlockedAt ? 'is-unlocked' : 'is-locked'}`;
        node.style.left = `${left}px`;
        node.style.top = `${center - ACHIEVEMENT_MAP.nodeH / 2}px`;
        node.style.width = `${ACHIEVEMENT_MAP.nodeW}px`;
        node.style.height = `${ACHIEVEMENT_MAP.nodeH}px`;
        node.style.setProperty('--branch-color', branch.color);
        node.style.setProperty('--achievement-color', achievementColor(id));
        node.tabIndex = 0;
        node.setAttribute('role', 'note');
        node.setAttribute(
          'aria-label',
          unlockedAt
            ? `${milestone.title}，已解锁。${achievementDescription(id)}`
            : `未解锁成就。${achievementDescription(id)}`,
        );

        const icon = document.createElement('span');
        icon.className = 'achievement-node__icon';
        icon.innerHTML = achievementIconMarkup(id);
        node.appendChild(icon);
        if (unlockedAt) {
          const info = document.createElement('span');
          info.className = 'achievement-node__info';
          const title = document.createElement('strong');
          title.textContent = milestone.title;
          const meta = document.createElement('small');
          meta.textContent = formatAchievementDate(unlockedAt);
          info.append(title, meta);
          node.appendChild(info);
        }
        const showTooltip = () => showAchievementTooltip(node, milestone, unlockedAt);
        node.addEventListener('mouseenter', showTooltip);
        node.addEventListener('focus', showTooltip);
        node.addEventListener('click', showTooltip);
        node.addEventListener('mouseleave', hideAchievementTooltip);
        node.addEventListener('blur', hideAchievementTooltip);
        canvas.appendChild(node);
        previousRight = left + ACHIEVEMENT_MAP.nodeW;
      });
    });

    canvas.insertBefore(svg, canvas.firstChild);
    dom.achievementList.appendChild(canvas);
    dom.achievementProgress.textContent = `已解锁 ${count} / ${MILESTONES.length}`;
    dom.achievementList.scrollLeft = previousLeft;
    dom.achievementList.scrollTop = previousTop;
    updateAchievementBadge();
  }

  function openAchievements() {
    state.achievementReturn = state.mode === 'gameover' ? 'over' : state.mode === 'paused' ? 'pause' : 'start';
    state.achievementOpen = true;
    audio.unlock();
    audio.sfx('click');
    renderAchievements();
    showScreen('achievements');
    window.setTimeout(() => {
      dom.achievementCloseButton.focus({ preventScroll: true });
    }, 80);
  }

  function closeAchievements() {
    if (!state.achievementOpen) return;
    state.achievementOpen = false;
    hideAchievementTooltip();
    audio.sfx('click');
    showScreen(state.achievementReturn === 'over' ? 'over' : state.achievementReturn === 'pause' ? 'pause' : 'start');
    updateAchievementBadge();
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  }

  function showNextAchievement() {
    if (state.achievementTimer || !state.achievementQueue.length) return;
    const milestone = state.achievementQueue.shift();
    const challenge = isChallengeAchievement(milestone.id);
    const color = achievementColor(milestone.id);
    dom.achievementToast.style.setProperty('--achievement-color', color);
    dom.achievementToast.classList.toggle('is-challenge', challenge);
    dom.achievementToastIcon.innerHTML = achievementIconMarkup(milestone.id);
    dom.achievementToastTitle.textContent = milestone.title;
    dom.achievementToast.classList.add('is-visible');
    audio.sfx(challenge ? 'achievementChallenge' : 'achievement');
    state.achievementTimer = window.setTimeout(() => {
      dom.achievementToast.classList.remove('is-visible');
      state.achievementTimer = window.setTimeout(() => {
        state.achievementTimer = 0;
        showNextAchievement();
      }, 280);
    }, challenge ? 3200 : 2600);
  }

  function checkAchievements(run) {
    const bucket = state.achievements;
    let unlocked = false;
    for (const milestone of MILESTONES) {
      if (bucket[milestone.id]) continue;
      let reached = false;
      if (milestone.type === 'score') reached = run.scoreFloat >= milestone.score;
      else if (milestone.type === 'distance') reached = run.distance >= milestone.meters;
      else if (milestone.type === 'combo') reached = (run.maxCombo || 0) >= milestone.combo;
      else if (milestone.type === 'blockScore') reached = (run.maxBlockScore || 0) >= milestone.blockScore;
      else if (milestone.type === 'heartPrize') reached = Boolean(run.gotHeartPrize);
      else if (milestone.type === 'tripleDamage') reached = Boolean(run.gotTripleDamage);
      else if (milestone.type === 'secondHeartDown') reached = Boolean(run.gotSecondHeartDown);
      else if (milestone.type === 'offscreen') reached = Boolean(run.wentOffscreen);
      else if (milestone.type === 'offscreenPit') reached = Boolean(run.gotOffscreenPit);
      if (!reached) continue;
      bucket[milestone.id] = Date.now();
      state.achievementQueue.push(milestone);
      unlocked = true;
    }
    if (!unlocked) return;
    saveAchievements();
    updateAchievementBadge();
    if (state.achievementOpen) renderAchievements();
    showNextAchievement();
  }

  function spawnConfetti() {
    const colors = ['#ffd23f', '#ef4245', '#2c60c5', '#32b653', '#ff8fb8', '#fff9e9'];
    for (let i = 0; i < 70; i++) {
      state.run.confetti.push({
        x: 50 + Math.random() * 860,
        y: -20 - Math.random() * 300,
        vx: (Math.random() - .5) * 90,
        vy: 90 + Math.random() * 170,
        w: 5 + Math.random() * 7,
        h: 8 + Math.random() * 9,
        rot: Math.random() * TAU,
        vrot: (Math.random() - .5) * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        sway: Math.random() * TAU,
      });
    }
  }

  function triggerDeath() {
    const run = state.run;
    if (!run || run.deathStarted) return;
    run.deathStarted = true;
    run.dead = true;
    state.mode = 'dying';
    run.deathTimer = 0;
    run.player.vy = -620;
    run.player.onGround = false;
    audio.stopMusic();
    audio.sfx('hurt');
    dom.shell.classList.remove('is-playing');
    setHudVisible(false);
  }

  /* ==========================================================
     World update
     ========================================================== */

  function rescueFromPit(run) {
    generateWorldAhead(run, run.player.x + 2600);
    const oldX = run.player.x;
    let target = run.grounds.find((g) => g.x > oldX + 30);
    if (!target) {
      addGround(run, oldX + 600, 460);
      target = run.grounds[run.grounds.length - 1];
    }
    run.player.x = target.x + 78;
    run.player.y = GROUND_Y - PLAYER_H;
    run.player.prevX = run.player.x;
    run.player.prevY = run.player.y;
    run.player.vy = 0;
    run.player.onGround = true;
    run.player.jumps = 0;
    run.cameraX = run.player.x - PLAYER_SCREEN_X;
  }

  function restoreHeart(run) {
    const before = run.hearts;
    if (before >= run.maxHearts) return false;
    run.hearts = Math.min(run.maxHearts, before + 1);
    if (before === 1 && run.hearts === 2) {
      run.secondHeartAt = run.playTime;
    } else if (before === 2) {
      run.secondHeartAt = 0;
    }
    return true;
  }

  function loseHeart(run, reason = 'hit') {
    if (run.dead) return;
    const rules = run.rules || MODE_RULES.normal;

    if (run.invincible > 0) {
      // 重制版：无敌期掉坑直接回地面，不扣血、不刷新无敌时间；怀旧版保留原 bug
      if (reason === 'pit' && rules.pitRescue) {
        rescueFromPit(run);
        showToast('掉进深坑！<strong>回到安全地面</strong>');
      }
      return;
    }

    const previousHearts = run.hearts;
    run.hearts = Math.max(0, run.hearts - 1);
    run.healCoins = 0;
    const damageTimes = (run.damageTimes || []).filter((time) => run.playTime - time <= 4);
    damageTimes.push(run.playTime);
    run.damageTimes = damageTimes;
    if (damageTimes.length >= 3) run.gotTripleDamage = true;
    if (previousHearts === 2) {
      if (run.secondHeartAt > 0 && run.playTime - run.secondHeartAt <= 1) {
        run.gotSecondHeartDown = true;
      }
      run.secondHeartAt = 0;
    }
    run.invincible = rules.hurtInvincible || 1.75;
    run.shake = .34;
    run.combo = 0;
    run.comboTimer = 0;
    updateComboBadge();
    updateHearts(true);
    flashScreen('#fff1d2');
    audio.sfx('hurt');
    spawnBurst(run, run.player.x + PLAYER_W / 2, run.player.y + 26, '#ffd23f', 14, 210);
    if (run.hearts <= 0) {
      if (reason === 'pit' && run.wentOffscreen) run.gotOffscreenPit = true;
      checkAchievements(run);
      triggerDeath();
      return true;
    }

    if (reason === 'pit') {
      rescueFromPit(run);
      run.invincible = rules.pitInvincible || 2.1;
      showToast('掉进深坑！<strong>消耗一颗心</strong>，回到安全地面');
      audio.sfx('heart');
    } else {
      showToast('小心！<strong>消耗一颗心</strong>');
    }
    checkAchievements(run);
    return false;
  }

  function hurtByEnemy(run, enemy) {
    if (run.dead || run.invincible > 0) return;
    enemy.dead = true;
    enemy.squash = -.2;
    spawnBurst(run, enemy.x, enemy.y + 20, '#b6784d', 10, 160);
    loseHeart(run, 'enemy');
  }

  function bumpBlock(run, block) {
    if (block.bump > 0) return;
    block.bump = .24;
    block.hits++;
    const rules = run.rules || MODE_RULES.normal;
    if (block.type === 'question' && !block.used) {
      block.used = true;
      const cx = block.x + block.w / 2;
      const prize = rules.blockPrize;

      if (prize && rules.heartPrize !== false && Math.random() < prize.heartChance && run.hearts < run.maxHearts) {
        // 一等奖：回一颗心
        run.gotHeartPrize = true;
        restoreHeart(run);
        updateHearts(false);
        audio.sfx('heart');
        popup(run, cx, block.y - 20, '+1 ♥', '#ff8fb8');
        spawnBurst(run, cx, block.y - 6, '#ff8fb8', 12, 170);
      } else {
        // 二等奖：1000~5000 随机分；满血抽到一等奖也转成这个
        let gained;
        if (prize) {
          gained = Math.floor(rand(prize.score[0], prize.score[1] + 1));
        } else {
          gained = 120;
          run.coins++;
        }
        run.scoreFloat += gained;
        run.maxBlockScore = Math.max(run.maxBlockScore || 0, gained);
        run.blockCoins.push({
          x: cx,
          y: block.y - 10,
          vy: -390,
          life: 1.1,
          maxLife: 1.1,
          rotation: 0,
        });
        soundBlockCoin();
        popup(run, cx, block.y - 20, `+${formatNumber(gained)}`, '#ffe476');
        spawnBurst(run, cx, block.y - 6, '#ffd23f', 9, 150);
      }
    } else {
      audio.sfx('block');
      run.shake = Math.max(run.shake, .08);
      spawnBurst(run, block.x + block.w / 2, block.y + 2, '#e2c58b', 5, 80);
    }
  }

  let lastBlockCoinAt = 0;
  function soundBlockCoin() {
    const now = performance.now();
    if (now - lastBlockCoinAt < 35) return;
    lastBlockCoinAt = now;
    audio.sfx('block');
  }

  function popup(run, x, y, text, color = '#fff9e9') {
    run.popups.push({ x, y, text, color, life: .85, maxLife: .85 });
  }

  function spawnBurst(run, x, y, color, count = 8, speed = 150) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.4;
      const velocity = speed * (.45 + Math.random() * .75);
      run.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        gravity: 720,
        drag: .985,
        size: 2 + Math.random() * 4,
        color,
        life: .45 + Math.random() * .4,
        maxLife: .85,
        shape: Math.random() < .25 ? 'star' : 'circle',
        rotation: Math.random() * TAU,
        vrot: (Math.random() - .5) * 8,
      });
    }
  }

  function spawnDust(run) {
    const p = run.player;
    const count = 2;
    for (let i = 0; i < count; i++) {
      run.particles.push({
        x: p.x + 12 + Math.random() * 12,
        y: p.y + PLAYER_H - 3,
        vx: -55 - Math.random() * 55,
        vy: -30 - Math.random() * 40,
        gravity: -10,
        drag: .96,
        size: 3 + Math.random() * 4,
        color: 'rgba(232,207,154,.72)',
        life: .25 + Math.random() * .2,
        maxLife: .45,
        shape: 'circle',
        rotation: 0,
        vrot: 0,
      });
    }
  }

  function collectCoin(run, coin) {
    coin.collected = true;
    run.coins++;
    run.scoreFloat += 100;
    audio.sfx('coin');
    spawnBurst(run, coin.x, coin.y, '#ffe24e', 8, 130);
    const perHeart = (run.rules && run.rules.coinsPerHeart) || 30;
    const canHeal = !run.rules || run.rules.heal !== false;
    if (canHeal && !run.dead && run.hearts < run.maxHearts) {
      run.healCoins = (run.healCoins || 0) + 1;
      if (run.healCoins >= perHeart) {
        run.healCoins = 0;
        restoreHeart(run);
        updateHearts(false);
        showToast(`收集 ${perHeart} 枚金币，<strong>恢复一颗心！</strong>`);
        audio.sfx('heart');
      }
    }
  }

  function processJumpInput(run) {
    if (run.player.jumpBuffer <= 0) return;
    const p = run.player;
    const jumpScale = Math.sqrt((run.rules && run.rules.jumpHeightScale) || 1);
    const canGroundJump = p.onGround || p.coyote > 0;
    if (canGroundJump) {
      p.vy = JUMP_V * jumpScale;
      p.onGround = false;
      p.coyote = 0;
      p.jumps = 1;
      p.airTime = 0;
      p.doubleJumped = false;
      p.jumpBuffer = 0;
      p.jumpHeld = true;
      audio.sfx('jump');
      spawnBurst(run, p.x + PLAYER_W / 2, p.y + PLAYER_H, 'rgba(245,226,177,.8)', 6, 90);
      return;
    }
    if (p.jumps < 2) {
      p.vy = DOUBLE_JUMP_V * jumpScale;
      p.jumps = 2;
      p.doubleJumped = true;
      p.airTime = 0;
      p.jumpBuffer = 0;
      p.jumpHeld = true;
      audio.sfx('double');
      spawnBurst(run, p.x + PLAYER_W / 2, p.y + PLAYER_H + 4, '#fff0b8', 10, 120);
      p.doubleJumpedAt = run.time;
    }
  }

  function updatePlaying(dt) {
    const run = state.run;
    if (!run) return;
    const p = run.player;

    run.time += dt;
    run.playTime += dt;
    run.goTimer = Math.max(0, run.goTimer - dt);
    run.invincible = Math.max(0, run.invincible - dt);
    run.shake = Math.max(0, run.shake - dt * 2.3);
    run.comboTimer = Math.max(0, run.comboTimer - dt);
    if (run.comboTimer <= 0 && run.combo > 0) {
      run.combo = 0;
      updateComboBadge();
    }

    run.speed = Math.min(run.rules.maxSpeed, 330 + (p.x - run.startX) * .012 + run.time * 1.2);
    run.runDistance += run.speed * dt;
    run.distance = Math.floor(run.runDistance / 20);
    checkAchievements(run);
    run.scoreFloat += run.speed * dt * .55;
    run.runPhase += dt * (7.8 + run.speed / 90);

    p.prevX = p.x;
    p.prevY = p.y;
    p.x += run.speed * dt;

    p.airTime += dt;
    p.coyote = Math.max(0, p.coyote - dt);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

    const gravity = p.jumpHeld && p.vy < 0 ? HOLD_GRAVITY : GRAVITY;
    p.vy = Math.min(MAX_FALL, p.vy + gravity * dt);
    p.y += p.vy * dt;
    p.onGround = false;

    // landing surfaces: ground, pipes, blocks
    let landingTop = null;
    const prevBottom = p.prevY + p.h;
    const nextBottom = p.y + p.h;
    const overlappingX = (x, w) => p.x + p.w > x + 2 && p.x < x + w - 2;

    if (p.vy >= 0) {
      for (const ground of run.grounds) {
        if (!overlappingX(ground.x, ground.w)) continue;
        if (prevBottom <= ground.top + 1 && nextBottom >= ground.top) {
          if (landingTop === null || ground.top < landingTop) landingTop = ground.top;
        }
      }
      for (const pipe of run.pipes) {
        if (!overlappingX(pipe.x, pipe.w)) continue;
        if (prevBottom <= pipe.y + 1 && nextBottom >= pipe.y) {
          if (landingTop === null || pipe.y < landingTop) landingTop = pipe.y;
        }
      }
      for (const block of run.blocks) {
        if (!overlappingX(block.x, block.w)) continue;
        if (prevBottom <= block.y + 1 && nextBottom >= block.y) {
          if (landingTop === null || block.y < landingTop) landingTop = block.y;
        }
      }
      if (landingTop !== null) {
        if (p.vy > 470) {
          spawnBurst(run, p.x + p.w / 2, landingTop, 'rgba(244,226,178,.8)', 5, 70);
        }
        p.y = landingTop - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumps = 0;
        p.coyote = .09;
        p.doubleJumped = false;
        p.jumpBuffer = Math.max(p.jumpBuffer, p.jumpBuffer);
      }
    }

    // head bonks on floating blocks
    if (p.vy < 0) {
      for (const block of run.blocks) {
        if (!overlappingX(block.x, block.w)) continue;
        const prevTop = p.prevY;
        const nextTop = p.y;
        if (prevTop >= block.y + block.h - 2 && nextTop <= block.y + block.h) {
          p.y = block.y + block.h;
          p.vy = 0;
          bumpBlock(run, block);
          run.shake = Math.max(run.shake, .06);
          break;
        }
      }
    }

    // 空中砖块侧面碰撞：重心在砖块上半部分 → 上方，否则 → 下方
    for (const block of run.blocks) {
      const overlapX = p.x + p.w > block.x + 1 && p.x < block.x + block.w - 1;
      const overlapY = p.y + p.h > block.y + 1 && p.y < block.y + block.h - 1;
      if (!overlapX || !overlapY) continue;

      const playerCenterY = p.y + p.h / 2;
      const blockCenterY = block.y + block.h / 2;
      if (playerCenterY < blockCenterY) {
        p.y = block.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumps = 0;
        p.doubleJumped = false;
        p.coyote = .09;
      } else {
        p.y = block.y + block.h;
        if (p.vy < 0) {
          p.vy = 0;
          bumpBlock(run, block);
          run.shake = Math.max(run.shake, .06);
        }
      }
      break;
    }

    // side collisions with pipes
    if (!run.invincible) {
      for (const pipe of run.pipes) {
        const overlap = p.x + p.w > pipe.x && p.x < pipe.x + pipe.w &&
          p.y + p.h > pipe.y + 5 && p.y < pipe.y + pipe.h;
        if (!overlap) continue;
        // land on top if feet are at or above pipe top; otherwise take the hit
        p.y = pipe.y - p.h;
        p.vy = -420;
        p.onGround = true;
        p.jumps = 0;
        loseHeart(run, 'pipe');
        spawnBurst(run, p.x + p.w, pipe.y + 14, '#8ce48a', 10, 130);
        break;
      }
    }

    // coyote and jump input
    if (p.onGround) {
      p.coyote = .09;
      p.jumps = 0;
      p.airTime = 0;
    }
    processJumpInput(run);

    // variable jump height
    if (!p.jumpHeld && p.vy < -290) {
      p.vy = Math.max(p.vy, -290);
    }

    // body fully above the visible screen
    if (!run.dead && p.y + p.h < 0) {
      if (!run.wentOffscreen) {
        run.wentOffscreen = true;
        checkAchievements(run);
      }
    }

    // gap / rescue
    if (p.y > DESIGN_H + 90) {
      if (!run.dead) {
        const gameOver = loseHeart(run, 'pit');
        if (gameOver) return;
      }
    }

    // progress generation and cleanup
    generateWorldAhead(run, p.x + 1800);
    run.cameraX = p.x - PLAYER_SCREEN_X;
    cleanupWorld(run);

    // enemies
    const canStompByVelocity = p.vy >= STOMP_MIN_VY;
    let stompedThisFrame = false;
    for (const enemy of run.enemies) {
      if (enemy.dead) {
        enemy.squash += dt;
        continue;
      }
      if (enemy.flying) {
        enemy.x += enemy.vx * dt;
        enemy.phase += dt * 2.4;
        enemy.y = enemy.baseY + Math.sin(enemy.phase) * enemy.amp;
      } else {
        const dir = Math.sign(enemy.vx) || 1;
        const nextX = enemy.x + enemy.vx * dt;
        const probeX = nextX + dir * (enemy.w / 2 + 8);
        if (!groundAt(run, probeX) || enemyHitsObstacle(run, enemy, nextX)) {
          enemy.vx *= -1;
        } else {
          enemy.x = nextX;
        }
      }
      enemy.walkPhase += dt * 7;
      const overlap = p.x + p.w > enemy.x - enemy.w / 2 &&
        p.x < enemy.x + enemy.w / 2 &&
        p.y + p.h > enemy.y + 5 &&
        p.y < enemy.y + enemy.h;
      if (!overlap) continue;
      const stomped = canStompByVelocity && (stompedThisFrame || p.prevY + p.h <= enemy.y + 17);
      if (stomped) {
        stompedThisFrame = true;
        enemy.dead = true;
        enemy.squash = 0;
        p.vy = -520;
        p.onGround = false;
        p.jumps = 1;
        p.doubleJumped = false;
        run.combo = run.comboTimer > 0 ? run.combo + 1 : 1;
        run.maxCombo = Math.max(run.maxCombo || 0, run.combo);
        run.comboTimer = 4.05;
        const rules = run.rules || MODE_RULES.normal;
        const stompBase = enemy.flying ? 5000 : (rules.stompBase || 1000);
        const points = rules.comboMultiply
          ? stompBase * Math.max(1, run.combo)
          : 160 + 90 * Math.max(1, run.combo);
        run.scoreFloat += points;
        updateComboBadge();
        audio.sfx('stomp');
        spawnBurst(run, enemy.x, enemy.y + 17, '#ffd66b', 12, 190);
        popup(run, enemy.x, enemy.y - 10, `+${formatNumber(points)}`, '#fff3a8');
        run.shake = Math.max(run.shake, .12);
      } else if (run.invincible <= 0) {
        hurtByEnemy(run, enemy);
        p.vy = -380;
        p.onGround = false;
        p.y = Math.min(p.y, enemy.y - p.h + 4);
      }
    }

    // spikes
    if (!run.invincible) {
      for (const spike of run.spikes) {
        const overlap = p.x + p.w > spike.x + 3 &&
          p.x < spike.x + spike.w - 3 &&
          p.y + p.h > spike.y + 4 &&
          p.y < spike.y + spike.h;
        if (!overlap) continue;
        p.vy = -380;
        p.onGround = false;
        loseHeart(run, 'spike');
        spawnBurst(run, spike.x + spike.w / 2, spike.y + 4, '#d9e6ef', 10, 150);
        break;
      }
    }

    // coins
    for (const coin of run.coinsArr) {
      if (coin.collected) continue;
      if (Math.abs(coin.x - (p.x + p.w / 2)) > 82) continue;
      const closestX = clamp(coin.x, p.x, p.x + p.w);
      const closestY = clamp(coin.y, p.y, p.y + p.h);
      if (Math.hypot(coin.x - closestX, coin.y - closestY) < coin.r + 4) {
        collectCoin(run, coin);
      }
    }

    // block coin animations
    for (const coin of run.blockCoins) {
      coin.y += coin.vy * dt;
      coin.vy += 1250 * dt;
      coin.rotation += dt * 9;
      coin.life -= dt;
    }
    run.blockCoins = run.blockCoins.filter((coin) => coin.life > 0);

    for (const block of run.blocks) block.bump = Math.max(0, block.bump - dt);

    // dust trail
    run.dustTimer -= dt;
    if (run.dustTimer <= 0 && p.onGround) {
      run.dustTimer = .13;
      spawnDust(run);
    }

    updateParticles(run, dt);
    updateHud(false);
    if (run.deathStarted) return;
    cleanupEnemies(run);
    cleanupCoins(run);
  }

  function cleanupWorld(run) {
    const minX = run.cameraX - 700;
    run.pipes = run.pipes.filter((pipe) => pipe.x + pipe.w > minX);
    run.blocks = run.blocks.filter((block) => block.x + block.w > minX);
    run.spikes = run.spikes.filter((spike) => spike.x + spike.w > minX);
    run.enemies = run.enemies.filter((enemy) => enemy.x > minX - 200);
    run.coinsArr = run.coinsArr.filter((coin) => !coin.collected && coin.x > minX - 100);
    run.popups = run.popups.filter((popupItem) => popupItem.x > minX - 200);
    // Keep grounds used for rescue until they are well behind.
    run.grounds = run.grounds.filter((ground) => ground.x + ground.w > minX);
    while (run.grounds.length > 28) run.grounds.shift();
  }

  function cleanupEnemies(run) {
    for (const enemy of run.enemies) {
      if (enemy.dead && enemy.squash > .45) enemy.remove = true;
      if (enemy.x < run.cameraX - 400) enemy.remove = true;
    }
    run.enemies = run.enemies.filter((enemy) => !enemy.remove);
  }

  function cleanupCoins(run) {
    if (run.coinsArr.length > 240) {
      run.coinsArr = run.coinsArr.filter((coin) => !coin.collected);
    }
  }

  function updateParticles(run, dt) {
    for (const particle of run.particles) {
      particle.vy += particle.gravity * dt;
      particle.vx *= Math.pow(particle.drag, dt * 60);
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.vrot * dt;
      particle.life -= dt;
    }
    run.particles = run.particles.filter((particle) => particle.life > 0);

    for (const popupItem of run.popups) {
      popupItem.y -= 38 * dt;
      popupItem.life -= dt;
    }
    run.popups = run.popups.filter((popupItem) => popupItem.life > 0);
  }

  function updateDying(dt) {
    const run = state.run;
    if (!run) return;
    run.time += dt;
    run.deathTimer += dt;
    run.shake = Math.max(0, run.shake - dt * 1.8);
    run.player.x += 24 * dt;
    run.player.vy = Math.min(MAX_FALL, run.player.vy + 1860 * dt);
    run.player.y += run.player.vy * dt;
    run.player.spin = (run.player.spin || 0) + dt * 3.6;
    updateParticles(run, dt);
    for (const particle of run.confetti) {
      particle.vy += 45 * dt;
      particle.sway += dt * 2;
      particle.x += particle.vx * dt + Math.sin(particle.sway) * 18 * dt;
      particle.y += particle.vy * dt;
      particle.rot += particle.vrot * dt;
    }
    if (run.deathTimer > 1.25 && !run.overShown) {
      run.overShown = true;
      finishGameOver();
    }
  }

  function updateAmbient(dt) {
    if (state.mode === 'menu') {
      state.menuTime += dt;
      state.menuCamera += dt * 22;
    } else if (state.mode === 'gameover' && state.run) {
      state.run.time += dt;
      for (const particle of state.run.confetti) {
        particle.vy += 45 * dt;
        particle.sway += dt * 2;
        particle.x += particle.vx * dt + Math.sin(particle.sway) * 18 * dt;
        particle.y += particle.vy * dt;
        particle.rot += particle.vrot * dt;
      }
      state.run.confetti = state.run.confetti.filter((particle) => particle.y < DESIGN_H + 40);
    }
  }

  /* ==========================================================
     Rendering — background
     ========================================================== */

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
    sky.addColorStop(0, '#64d2f4');
    sky.addColorStop(.46, '#a8ebf8');
    sky.addColorStop(.72, '#dff8ee');
    sky.addColorStop(1, '#f5f3c9');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // soft sun glow
    const sunX = 790;
    const sunY = 92;
    const glow = ctx.createRadialGradient(sunX, sunY, 18, sunX, sunY, 160);
    glow.addColorStop(0, 'rgba(255,250,197,.95)');
    glow.addColorStop(.36, 'rgba(255,242,160,.28)');
    glow.addColorStop(1, 'rgba(255,239,158,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 170, sunY - 170, 340, 340);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 38, 0, TAU);
    ctx.fillStyle = '#fff3a6';
    ctx.fill();
    ctx.strokeStyle = 'rgba(236,183,57,.22)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // decorative rings around the sun
    ctx.strokeStyle = 'rgba(255,248,192,.2)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 57, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([5, 10]);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 70, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCloud(x, y, scale, opacity = .92, variant = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fffdf1';
    ctx.beginPath();
    ctx.ellipse(-26, 4, 30, 16, -.08, 0, TAU);
    ctx.ellipse(3, -4, 28, 20, .04, 0, TAU);
    ctx.ellipse(34, 5, 32, 15, .05, 0, TAU);
    ctx.ellipse(6, 10, 52, 13, 0, 0, TAU);
    if (variant % 2 === 0) ctx.ellipse(54, -1, 18, 11, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = opacity * .36;
    ctx.fillStyle = '#a7e6f1';
    ctx.beginPath();
    ctx.ellipse(-3, 17, 44, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawClouds(camera, time) {
    const tile = 390;
    const offset = mod(camera * .085, tile);
    for (let i = -1; i < 5; i++) {
      const x = i * tile - offset + 90;
      const y = 110 + (i % 3) * 52 + Math.sin(time * .12 + i * 1.5) * 5;
      drawCloud(x, y, .72 + (i % 3) * .13, .8 - (i % 2) * .08, i);
      if (i < 3) {
        const x2 = i * tile - offset + 290;
        const y2 = 200 + (i % 2) * 25 + Math.sin(time * .1 + i) * 4;
        drawCloud(x2, y2, .4 + (i % 2) * .08, .46, i + 1);
      }
    }
  }

  function drawBirds(camera, time) {
    const offset = mod(camera * .12 + 500, 1300);
    for (let i = 0; i < 3; i++) {
      const x = 150 + i * 235 - offset * .35;
      const y = 145 + i * 42 + Math.sin(time * .6 + i) * 4;
      if (x < -30 || x > DESIGN_W + 30) continue;
      const flap = Math.sin(time * 4 + i * 1.9) * .3;
      ctx.strokeStyle = 'rgba(48,119,132,.48)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 9, y + flap * 4);
      ctx.quadraticCurveTo(x - 4, y - 4, x, y);
      ctx.quadraticCurveTo(x + 4, y - 4, x + 9, y + flap * 4);
      ctx.stroke();
    }
  }

  function drawMountainRange(camera) {
    const drawRidge = (parallax, baseY, tile, fill, stroke, snow, snowAlpha) => {
      const offset = mod(camera * parallax, tile);
      ctx.save();
      for (let i = -1; i < 4; i++) {
        const x = i * tile - offset + 100;
        ctx.beginPath();
        ctx.moveTo(x - 480, baseY);
        ctx.lineTo(x - 350, baseY - 150);
        ctx.lineTo(x - 260, baseY - 70);
        ctx.lineTo(x - 110, baseY - 235);
        ctx.lineTo(x + 30, baseY - 92);
        ctx.lineTo(x + 170, baseY - 175);
        ctx.lineTo(x + 340, baseY - 55);
        ctx.lineTo(x + 480, baseY);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // soft snow caps on the three peaks
        ctx.fillStyle = snow;
        ctx.globalAlpha = snowAlpha;
        for (const [peakX, peakY, width, height] of [
          [x - 350, baseY - 150, 38, 48],
          [x - 110, baseY - 235, 52, 68],
          [x + 170, baseY - 175, 42, 54],
        ]) {
          ctx.beginPath();
          ctx.moveTo(peakX, peakY);
          ctx.lineTo(peakX - width, peakY + height);
          ctx.lineTo(peakX - width * .28, peakY + height * .58);
          ctx.lineTo(peakX + width * .18, peakY + height * .82);
          ctx.lineTo(peakX + width, peakY + height);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    // two very distant, misty ridges
    drawRidge(.045, 412, 760, 'rgba(156, 207, 202, .55)', 'rgba(114, 174, 169, .22)', '#f5fffb', .42);
    drawRidge(.075, 425, 820, 'rgba(118, 184, 177, .36)', 'rgba(84, 150, 143, .18)', '#effcf7', .3);
  }

  function drawBalloon(camera, time) {
    const span = DESIGN_W + 220;
    const x = DESIGN_W + 110 - mod(camera * .055 + time * 7 + 800, span);
    if (x < -110 || x > DESIGN_W + 110) return;
    const fade = clamp(Math.min((x + 110) / 70, (DESIGN_W + 110 - x) / 70), 0, 1);
    const y = 112 + Math.sin(time * .45) * 5;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.scale(.52, .52);
    ctx.rotate(Math.sin(time * .3) * .035);

    // ropes
    ctx.strokeStyle = 'rgba(91, 62, 44, .55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-16, 28);
    ctx.lineTo(-8, 48);
    ctx.moveTo(16, 28);
    ctx.lineTo(8, 48);
    ctx.stroke();

    // envelope
    const balloon = ctx.createLinearGradient(-28, -35, 24, 32);
    balloon.addColorStop(0, '#ff9b83');
    balloon.addColorStop(.48, '#f25557');
    balloon.addColorStop(1, '#c9323d');
    ctx.fillStyle = balloon;
    ctx.beginPath();
    ctx.ellipse(0, -2, 29, 36, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(112, 45, 43, .35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // cream stripe
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -2, 28, 35, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 239, 193, .78)';
    ctx.beginPath();
    ctx.moveTo(-8, -38);
    ctx.quadraticCurveTo(2, -4, -4, 34);
    ctx.lineTo(9, 34);
    ctx.quadraticCurveTo(15, -4, 5, -38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // basket
    ctx.fillStyle = '#9a6133';
    roundedRectPath(ctx, -9, 43, 18, 13, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 226, 165, .42)';
    ctx.fillRect(-9, 43, 18, 3);
    ctx.restore();
  }

  function drawHillLayer(camera, time) {
    // far pale hills
    const farOffset = mod(camera * .15, 520);
    ctx.fillStyle = 'rgba(133,209,160,.55)';
    ctx.beginPath();
    for (let i = -1; i < 4; i++) {
      const x = i * 520 - farOffset + 20;
      ctx.moveTo(x - 210, GROUND_Y + 15);
      ctx.bezierCurveTo(x - 150, GROUND_Y - 125, x - 40, GROUND_Y - 130, x + 20, GROUND_Y - 22);
      ctx.bezierCurveTo(x + 80, GROUND_Y - 115, x + 190, GROUND_Y - 90, x + 260, GROUND_Y + 15);
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(77,156,107,.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // medium green hills
    const midOffset = mod(camera * .3 + 200, 420);
    for (let i = -1; i < 4; i++) {
      const x = i * 420 - midOffset + 80;
      const y = GROUND_Y + 20;
      ctx.beginPath();
      ctx.moveTo(x - 240, y);
      ctx.bezierCurveTo(x - 190, y - 130, x - 60, y - 175, x + 10, y - 60);
      ctx.bezierCurveTo(x + 80, y - 160, x + 190, y - 112, x + 250, y);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#6ec57c' : '#77cf85';
      ctx.fill();
      ctx.strokeStyle = 'rgba(57,139,79,.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // broad, soft sunlit face
      ctx.beginPath();
      ctx.moveTo(x - 150, y - 38);
      ctx.bezierCurveTo(x - 120, y - 112, x - 60, y - 132, x - 12, y - 75);
      ctx.bezierCurveTo(x - 57, y - 105, x - 104, y - 80, x - 150, y - 38);
      ctx.fillStyle = 'rgba(218,248,183,.15)';
      ctx.fill();
    }

    // distant castle
    const castleOffset = mod(camera * .22, 2400);
    for (let i = 0; i < 2; i++) {
      const x = i * 2400 - castleOffset + 1560;
      if (x > -180 && x < DESIGN_W + 180) {
        // A small hill under the castle stops it from looking suspended in the air.
        ctx.fillStyle = 'rgba(112, 183, 126, .62)';
        ctx.beginPath();
        ctx.ellipse(x, GROUND_Y + 15, 94, 55, 0, Math.PI, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(72, 148, 91, .18)';
        ctx.beginPath();
        ctx.ellipse(x, GROUND_Y + 2, 72, 16, 0, 0, TAU);
        ctx.fill();
        drawCastle(x, GROUND_Y - 6, .72);
      }
    }

    // lower valley haze
    const valley = ctx.createLinearGradient(0, GROUND_Y - 12, 0, DESIGN_H);
    valley.addColorStop(0, 'rgba(195,236,174,0)');
    valley.addColorStop(.2, 'rgba(166,222,169,.86)');
    valley.addColorStop(1, '#77bd8e');
    ctx.fillStyle = valley;
    ctx.fillRect(0, GROUND_Y - 10, DESIGN_W, DESIGN_H - GROUND_Y + 10);
  }

  function drawCastle(x, baseY, scale) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f3e6cf';
    ctx.strokeStyle = 'rgba(96,91,76,.42)';
    ctx.lineWidth = 2;
    // body
    roundedRectPath(ctx, -54, -78, 108, 78, 3);
    ctx.fill();
    ctx.stroke();
    // towers
    for (const tx of [-63, 37]) {
      roundedRectPath(ctx, tx, -104, 26, 104, 2);
      ctx.fill();
      ctx.stroke();
      // roof
      ctx.beginPath();
      ctx.moveTo(tx - 5, -104);
      ctx.lineTo(tx + 13, -132);
      ctx.lineTo(tx + 31, -104);
      ctx.closePath();
      ctx.fillStyle = '#d1615c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(96,70,60,.48)';
      ctx.stroke();
    }
    // main roof
    ctx.beginPath();
    ctx.moveTo(-40, -78);
    ctx.lineTo(0, -111);
    ctx.lineTo(40, -78);
    ctx.closePath();
    ctx.fillStyle = '#dd7269';
    ctx.fill();
    ctx.stroke();
    // windows
    ctx.fillStyle = 'rgba(81,91,88,.55)';
    for (const wx of [-42, -18, 8, 34]) {
      roundedRectPath(ctx, wx, -54, 8, 15, 4);
      ctx.fill();
    }
    // door
    roundedRectPath(ctx, -11, -30, 22, 30, 10);
    ctx.fillStyle = 'rgba(81,91,88,.55)';
    ctx.fill();
    // flag
    ctx.strokeStyle = 'rgba(96,91,76,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -111);
    ctx.lineTo(0, -152);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -151);
    ctx.lineTo(23, -143);
    ctx.lineTo(0, -135);
    ctx.closePath();
    ctx.fillStyle = '#f0d65a';
    ctx.fill();
    ctx.restore();
  }

  function drawBushes(camera) {
    const offset = mod(camera * .54 + 150, 330);
    for (let i = -1; i < 5; i++) {
      const x = i * 330 - offset;
      const y = GROUND_Y + 2;
      if (x < -110 || x > DESIGN_W + 110) continue;
      const scale = .72 + (i % 3) * .11;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#3e9655';
      ctx.beginPath();
      ctx.ellipse(-27, 0, 25, 16, 0, 0, TAU);
      ctx.ellipse(0, -10, 31, 27, 0, 0, TAU);
      ctx.ellipse(28, 0, 26, 17, 0, 0, TAU);
      ctx.ellipse(0, 7, 43, 13, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(134,216,112,.34)';
      ctx.beginPath();
      ctx.ellipse(-2, -18, 15, 8, -.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBackground(camera, time) {
    drawSky();
    drawClouds(camera, time);
    drawBirds(camera, time);
    drawBalloon(camera, time);
    drawMountainRange(camera);
    drawHillLayer(camera, time);
    drawBushes(camera);
  }

  /* ==========================================================
     Rendering — world
     ========================================================== */

  function drawGrounds(run) {
    for (const ground of run.grounds) {
      const sx = ground.x - run.cameraX;
      if (sx > DESIGN_W + 30 || sx + ground.w < -30) continue;
      const top = ground.top;
      const visibleLeft = Math.max(sx, -10);
      const visibleRight = Math.min(sx + ground.w, DESIGN_W + 10);
      const width = visibleRight - visibleLeft;
      if (width <= 0) continue;

      // dirt body
      ctx.save();
      ctx.beginPath();
      ctx.rect(visibleLeft, top + 10, width, DESIGN_H - top);
      ctx.clip();
      const dirt = ctx.createLinearGradient(0, top, 0, DESIGN_H);
      dirt.addColorStop(0, '#dca264');
      dirt.addColorStop(.48, '#c8864d');
      dirt.addColorStop(1, '#a8693d');
      ctx.fillStyle = dirt;
      ctx.fillRect(visibleLeft, top + 10, width, DESIGN_H - top);

      // soil bands
      ctx.strokeStyle = 'rgba(124,74,38,.18)';
      ctx.lineWidth = 1;
      for (let yy = top + 38; yy < DESIGN_H; yy += 30) {
        ctx.beginPath();
        const shift = mod(Math.floor(ground.x / 37) * 11, 30);
        for (let xx = visibleLeft - 20; xx < visibleRight + 30; xx += 46) {
          ctx.moveTo(xx + shift, yy + 6);
          ctx.lineTo(xx + 18 + shift, yy + 2);
        }
        ctx.stroke();
      }
      // pebbles
      const first = Math.floor(Math.max(ground.x, run.cameraX - 30) / 34) * 34;
      for (let wx = first; wx < ground.x + ground.w; wx += 34) {
        if (wx < run.cameraX - 40) continue;
        const n = Math.abs(Math.sin(wx * 12.9898) * 43758.5453);
        const px = wx - run.cameraX + 9;
        const py = top + 51 + (n % 1) * 66;
        if (py < DESIGN_H - 9 && n % 3 > .38) {
          ctx.fillStyle = n % 2 > 1 ? 'rgba(245,213,149,.24)' : 'rgba(103,60,32,.16)';
          ctx.beginPath();
          ctx.ellipse(px, py, 2.4 + (n % 1) * 2, 1.5 + (n % 1), .2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();

      // grass base
      ctx.fillStyle = '#4cab42';
      ctx.fillRect(visibleLeft, top - 1, width, 17);
      ctx.fillStyle = '#78d95b';
      ctx.fillRect(visibleLeft, top - 1, width, 8);
      ctx.fillStyle = '#a1ea73';
      ctx.fillRect(visibleLeft, top - 1, width, 3);
      ctx.strokeStyle = '#2c6d34';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(visibleLeft, top + 15);
      ctx.lineTo(visibleRight, top + 15);
      ctx.stroke();

      // grass fringe
      ctx.fillStyle = '#4cab42';
      ctx.beginPath();
      for (let xx = visibleLeft - 6; xx < visibleRight + 10; xx += 24) {
        const phase = mod(Math.floor(xx / 24) * 7, 4);
        ctx.ellipse(xx + 7, top + 18, 12, 5 + phase, 0, 0, Math.PI);
      }
      ctx.fill();

      // edge shading for pits
      if (sx > -8) {
        ctx.fillStyle = 'rgba(92,50,28,.32)';
        ctx.fillRect(sx, top + 16, 5, DESIGN_H - top);
        ctx.fillStyle = '#6fcf59';
        ctx.beginPath();
        ctx.ellipse(sx + 2, top + 1, 10, 4, 0, 0, Math.PI);
        ctx.fill();
      }
      if (sx + ground.w < DESIGN_W + 8) {
        ctx.fillStyle = 'rgba(92,50,28,.32)';
        ctx.fillRect(sx + ground.w - 5, top + 16, 5, DESIGN_H - top);
        ctx.fillStyle = '#6fcf59';
        ctx.beginPath();
        ctx.ellipse(sx + ground.w - 2, top + 1, 10, 4, 0, 0, Math.PI);
        ctx.fill();
      }

      // small grass tufts and flowers
      const firstTuft = Math.ceil((run.cameraX - ground.x) / 75) * 75;
      for (let local = firstTuft; local < ground.w; local += 75) {
        const wx = ground.x + local;
        if (wx < run.cameraX - 20 || wx > run.cameraX + DESIGN_W + 20) continue;
        const n = Math.abs(Math.sin(wx * 3.17) * 12543.7) % 1;
        if (n < .66) {
          const px = wx - run.cameraX;
          ctx.strokeStyle = '#2f8241';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px, top - 1);
          ctx.quadraticCurveTo(px - 3, top - 9, px - 5, top - 10);
          ctx.moveTo(px + 4, top - 1);
          ctx.quadraticCurveTo(px + 6, top - 8, px + 9, top - 8);
          ctx.stroke();
          if (n > .46) {
            ctx.fillStyle = '#ffd95a';
            ctx.beginPath();
            ctx.arc(px + 9, top - 9, 2.1, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
  }

  function drawPipes(run) {
    for (const pipe of run.pipes) {
      const sx = pipe.x - run.cameraX;
      if (sx > DESIGN_W + 100 || sx + pipe.w < -100) continue;
      const top = pipe.y;
      const bodyX = sx + 3;
      const bodyW = pipe.w - 6;

      // shadow
      ctx.fillStyle = 'rgba(33,88,46,.18)';
      ctx.beginPath();
      ctx.ellipse(sx + pipe.w / 2 + 8, GROUND_Y + 8, pipe.w * .72, 9, 0, 0, TAU);
      ctx.fill();

      // stem/body
      const bodyGrad = ctx.createLinearGradient(sx, 0, sx + pipe.w, 0);
      bodyGrad.addColorStop(0, '#2a9d3d');
      bodyGrad.addColorStop(.22, '#67d85b');
      bodyGrad.addColorStop(.48, '#32b64a');
      bodyGrad.addColorStop(1, '#14732f');
      ctx.fillStyle = bodyGrad;
      roundedRectPath(ctx, bodyX, top + 15, bodyW, pipe.h - 15, 3);
      ctx.fill();
      ctx.strokeStyle = '#155c2b';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // cap
      const capX = sx - 7;
      const capW = pipe.w + 14;
      ctx.beginPath();
      ctx.moveTo(capX + 9, top);
      ctx.lineTo(capX + capW - 9, top);
      ctx.quadraticCurveTo(capX + capW, top, capX + capW - 4, top + 8);
      ctx.lineTo(capX + capW - 6, top + 22);
      ctx.quadraticCurveTo(capX + capW - 10, top + 27, capX + capW - 17, top + 27);
      ctx.lineTo(capX + 17, top + 27);
      ctx.quadraticCurveTo(capX + 7, top + 27, capX + 5, top + 21);
      ctx.lineTo(capX + 2, top + 8);
      ctx.quadraticCurveTo(capX, top, capX + 9, top);
      ctx.closePath();
      const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
      capGrad.addColorStop(0, '#3fb84b');
      capGrad.addColorStop(.2, '#8aea6b');
      capGrad.addColorStop(.55, '#39bd4e');
      capGrad.addColorStop(.9, '#1f8736');
      capGrad.addColorStop(1, '#0d6327');
      ctx.fillStyle = capGrad;
      ctx.fill();
      ctx.strokeStyle = '#155c2b';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // highlight
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath();
      ctx.ellipse(sx + 18, top + 10, 6, 4, -.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(sx + 13, top + 36, 5, Math.max(0, pipe.h - 52));
      ctx.fillStyle = 'rgba(10,88,33,.16)';
      ctx.fillRect(sx + pipe.w - 18, top + 32, 8, Math.max(0, pipe.h - 43));
    }
  }

  function drawBlock(block, run) {
    const sx = block.x - run.cameraX;
    if (sx > DESIGN_W + 60 || sx + block.w < -60) return;
    const bumpOffset = block.bump > 0 ? -Math.sin((block.bump / .24) * Math.PI) * 6 : 0;
    const x = sx;
    const y = block.y + bumpOffset;
    const w = block.w;
    const h = block.h;

    ctx.save();
    if (block.type === 'question' && !block.used) {
      const gold = ctx.createLinearGradient(x, y, x, y + h);
      gold.addColorStop(0, '#ffe67a');
      gold.addColorStop(.5, '#ffc73f');
      gold.addColorStop(1, '#ea9a1f');
      roundedRectPath(ctx, x, y, w, h, 5);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.strokeStyle = '#6f441a';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      roundedRectPath(ctx, x + 4, y + 4, w - 8, 5, 2);
      ctx.fill();
      // rivets
      ctx.fillStyle = '#9b651c';
      for (const [dx, dy] of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1.3, 0, TAU);
        ctx.fill();
      }
      // question mark
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2 + 1);
      ctx.scale(Math.sin(run.time * 1.9 + block.x) * .04 + 1, 1);
      ctx.fillStyle = '#69421b';
      ctx.font = '900 24px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.font = '900 23px "Arial Black", sans-serif';
      ctx.fillText('?', -.7, -.7);
      ctx.restore();
    } else if (block.type === 'question' && block.used) {
      roundedRectPath(ctx, x, y, w, h, 5);
      ctx.fillStyle = '#b8925e';
      ctx.fill();
      ctx.strokeStyle = '#5e4327';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      roundedRectPath(ctx, x + 4, y + 4, w - 8, 5, 2);
      ctx.fill();
      ctx.fillStyle = '#725637';
      ctx.font = '900 22px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('·', x + w / 2, y + h / 2);
    } else {
      const brick = ctx.createLinearGradient(x, y, x, y + h);
      brick.addColorStop(0, '#d78951');
      brick.addColorStop(1, '#a85833');
      roundedRectPath(ctx, x, y, w, h, 4);
      ctx.fillStyle = brick;
      ctx.fill();
      ctx.strokeStyle = '#5e3522';
      ctx.lineWidth = 2.1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(87,44,25,.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 15);
      ctx.lineTo(x + w - 3, y + 15);
      ctx.moveTo(x + 15, y + 3);
      ctx.lineTo(x + 15, y + 15);
      ctx.moveTo(x + 8, y + 15);
      ctx.lineTo(x + 8, y + h - 3);
      ctx.moveTo(x + 24, y + 15);
      ctx.lineTo(x + 24, y + h - 3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,231,188,.22)';
      ctx.fillRect(x + 4, y + 4, w - 8, 3);
      ctx.fillStyle = 'rgba(87,44,25,.22)';
      ctx.fillRect(x + 3, y + h - 6, w - 6, 3);
    }
    ctx.restore();
  }

  function drawBlocks(run) {
    for (const block of run.blocks) drawBlock(block, run);
  }

  function drawCoins(run) {
    for (const coin of run.coinsArr) {
      if (coin.collected) continue;
      const sx = coin.x - run.cameraX;
      if (sx < -30 || sx > DESIGN_W + 30) continue;
      drawCoin(sx, coin.y, run.time, coin.phase, 1);
    }
  }

  function drawCoin(x, y, time, phase, scale = 1) {
    const spin = Math.cos(time * 3.4 + phase);
    const width = .25 + Math.abs(spin) * .75;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(width * scale, scale);
    // glow
    ctx.globalAlpha = .23;
    ctx.fillStyle = '#ffe66f';
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // coin
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    const grad = ctx.createLinearGradient(-9, -11, 9, 12);
    grad.addColorStop(0, '#fff5ad');
    grad.addColorStop(.42, '#ffd84b');
    grad.addColorStop(1, '#f2a51f');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#a35f13';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,202,.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 8.3, 0, TAU);
    ctx.stroke();
    // tiny star shine
    if (spin > .72) {
      ctx.fillStyle = '#fffce1';
      ctx.beginPath();
      ctx.arc(-2, -3, 2.1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // sparkle
    if (spin > .64) {
      const twinkle = (Math.sin(time * 6 + phase) + 1) / 2;
      ctx.save();
      ctx.translate(x + 14, y - 10);
      ctx.rotate(time * .8 + phase);
      ctx.globalAlpha = .35 + twinkle * .65;
      ctx.fillStyle = '#fffce2';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.quadraticCurveTo(1, -1, 5, 0);
      ctx.quadraticCurveTo(1, 1, 0, 5);
      ctx.quadraticCurveTo(-1, 1, -5, 0);
      ctx.quadraticCurveTo(-1, -1, 0, -5);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSpikes(run) {
    for (const spike of run.spikes) {
      const sx = spike.x - run.cameraX;
      if (sx > DESIGN_W + 60 || sx + spike.w < -60) continue;
      ctx.save();
      ctx.translate(sx, GROUND_Y);
      // base
      ctx.fillStyle = 'rgba(33,50,66,.28)';
      ctx.beginPath();
      ctx.ellipse(spike.w / 2, 3, spike.w * .55, 4, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 2; i++) {
        const x0 = i * 11;
        ctx.beginPath();
        ctx.moveTo(x0 + 1, 0);
        ctx.lineTo(x0 + 5.5, -spike.h);
        ctx.lineTo(x0 + 10, 0);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, -spike.h, 0, 0);
        grad.addColorStop(0, '#f2f7fb');
        grad.addColorStop(.45, '#b9c9d8');
        grad.addColorStop(1, '#6f8293');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#3d4c59';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.fillStyle = '#4b5c6b';
      ctx.fillRect(0, -2, spike.w, 4);
      ctx.restore();
    }
  }

  function drawFlyer(x, enemy, time) {
    const dead = enemy.dead;
    const flap = Math.sin(time * 11 + enemy.phase) * .55;
    ctx.save();
    ctx.translate(x, enemy.y + enemy.h / 2);
    if (dead) {
      ctx.globalAlpha = clamp(1 - enemy.squash * 1.4, 0, 1);
      ctx.rotate(enemy.squash * 3.2);
      ctx.scale(1 + enemy.squash, 1 - enemy.squash * .5);
    }
    // wings
    ctx.fillStyle = '#7b5bd6';
    ctx.strokeStyle = '#31234f';
    ctx.lineWidth = 1.8;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.scale(dir, 1);
      ctx.rotate(flap * .7);
      ctx.beginPath();
      ctx.moveTo(7, -2);
      ctx.quadraticCurveTo(24, -16, 30, -3);
      ctx.quadraticCurveTo(22, 3, 8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // body
    const bodyGrad = ctx.createLinearGradient(0, -14, 0, 12);
    bodyGrad.addColorStop(0, '#9a7bf0');
    bodyGrad.addColorStop(1, '#5b3eb5');
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 13, 0, 0, TAU);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#31234f';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // ears
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(-13, -20);
    ctx.lineTo(-3, -12);
    ctx.moveTo(10, -10);
    ctx.lineTo(13, -20);
    ctx.lineTo(3, -12);
    ctx.fillStyle = '#6d4ecb';
    ctx.fill();
    // eyes
    ctx.fillStyle = dead ? '#2a2338' : '#fff9e9';
    ctx.beginPath();
    ctx.ellipse(-5, -2, 3.4, 4.1, 0, 0, TAU);
    ctx.ellipse(5, -2, 3.4, 4.1, 0, 0, TAU);
    ctx.fill();
    if (!dead) {
      ctx.fillStyle = '#2a2338';
      ctx.beginPath();
      ctx.arc(-5, -1, 1.7, 0, TAU);
      ctx.arc(5, -1, 1.7, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#ffe14e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-7.5, -4.5); ctx.lineTo(-2.5, .5);
      ctx.moveTo(-2.5, -4.5); ctx.lineTo(-7.5, .5);
      ctx.moveTo(2.5, -4.5); ctx.lineTo(7.5, .5);
      ctx.moveTo(7.5, -4.5); ctx.lineTo(2.5, .5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemies(run) {
    for (const enemy of run.enemies) {
      const sx = enemy.x - run.cameraX;
      if (sx < -70 || sx > DESIGN_W + 70) continue;
      if (enemy.flying) drawFlyer(sx, enemy, run.time);
      else drawGoomba(sx, enemy, run.time);
    }
  }

  function drawGoomba(x, enemy, time) {
    const ground = GROUND_Y;
    const squash = enemy.dead ? clamp(enemy.squash / .18, 0, 1) : 0;
    ctx.save();
    ctx.translate(x, ground + 2);
    // shadow
    ctx.globalAlpha = .22;
    ctx.fillStyle = '#31512d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 6, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (enemy.dead) {
      ctx.globalAlpha = clamp(1 - enemy.squash * .7, 0, 1);
      ctx.scale(1 + squash * .25, .32 + squash * .15);
      ctx.translate(0, -10);
    } else {
      const bob = Math.abs(Math.sin(enemy.walkPhase)) * 2;
      ctx.translate(0, -bob);
      // feet
      const step = Math.sin(enemy.walkPhase) * 3.2;
      ctx.fillStyle = '#e9c289';
      ctx.strokeStyle = '#4e3020';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(-11 + step, -3, 9, 4.3, -.08, 0, TAU);
      ctx.ellipse(11 - step, -3, 9, 4.3, .08, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // body
      const bodyGrad = ctx.createLinearGradient(0, -46, 0, -4);
      bodyGrad.addColorStop(0, '#d58d4a');
      bodyGrad.addColorStop(.55, '#b56b36');
      bodyGrad.addColorStop(1, '#8e4e2b');
      ctx.beginPath();
      ctx.moveTo(-24, -7);
      ctx.bezierCurveTo(-27, -33, -16, -44, 0, -44);
      ctx.bezierCurveTo(16, -44, 27, -33, 24, -7);
      ctx.bezierCurveTo(15, -1, 8, -3, 0, -2);
      ctx.bezierCurveTo(-8, -3, -16, -1, -24, -7);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = '#4e3020';
      ctx.lineWidth = 2.1;
      ctx.stroke();
      // face patch
      ctx.beginPath();
      ctx.ellipse(0, -19, 16, 12, 0, 0, TAU);
      ctx.fillStyle = '#f2d8a4';
      ctx.fill();
      // eyebrows
      ctx.strokeStyle = '#56331e';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-13, -23);
      ctx.lineTo(-4, -18);
      ctx.moveTo(13, -23);
      ctx.lineTo(4, -18);
      ctx.stroke();
      // eyes
      ctx.fillStyle = '#2a1e1a';
      ctx.beginPath();
      ctx.ellipse(-6, -15, 2.8, 3.7, -.08, 0, TAU);
      ctx.ellipse(6, -15, 2.8, 3.7, .08, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-6.8, -16.5, .9, 0, TAU);
      ctx.arc(5.2, -16.5, .9, 0, TAU);
      ctx.fill();
      // mouth / fangs
      ctx.strokeStyle = '#5c3723';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, -8);
      ctx.quadraticCurveTo(0, -5, 5, -8);
      ctx.stroke();
      ctx.fillStyle = '#fff6dd';
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-1, -8);
      ctx.moveTo(6, -8);
      ctx.lineTo(3, -4);
      ctx.lineTo(1, -8);
      ctx.fill();
      // little horns/brows? no
      // body highlight
      ctx.strokeStyle = 'rgba(255,226,171,.26)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(-7, -35, 11, Math.PI * 1.12, Math.PI * 1.72);
      ctx.stroke();
    }
    ctx.restore();
  }

  function findSurfaceBelow(run, x) {
    let top = null;
    for (const ground of run.grounds) {
      if (x >= ground.x && x <= ground.x + ground.w) top = ground.top;
    }
    return top;
  }

  function drawPlayer(run) {
    const p = run.player;
    const sx = p.x - run.cameraX + p.w / 2;
    const feet = p.y + p.h + 2;
    const surface = findSurfaceBelow(run, p.x + p.w / 2);
    const distance = surface === null ? 999 : surface - (p.y + p.h);

    // shadow
    if (surface !== null && distance < 180) {
      const alpha = clamp(.25 - distance / 900, .035, .22);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#31582e';
      ctx.beginPath();
      ctx.ellipse(sx, surface + 4, 22 - clamp(distance / 24, 0, 8), 6, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (run.invincible > 0 && !run.dead && Math.floor(run.time * 16) % 2 === 0) {
      ctx.globalAlpha = .43;
    }

    // invincibility bubble
    if (run.invincible > 0 && !run.dead) {
      ctx.save();
      ctx.globalAlpha = .2 + Math.sin(run.time * 9) * .08;
      ctx.strokeStyle = '#fff4b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, p.y + p.h / 2, 34, 49, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    const blink = (run.time % 3.7) > 3.58;
    drawRunner(ctx, selectedAvatar(), sx, feet, {
      grounded: p.onGround,
      vy: p.vy,
      runPhase: run.runPhase,
      blink,
      hurt: run.dead || run.invincible > 1.1,
      mode: run.dead ? 'dying' : p.onGround ? 'run' : (p.vy < 0 ? 'jump' : 'fall'),
      airTime: p.airTime,
      spin: p.spin || 0,
      doubleJumped: p.doubleJumped && !p.onGround,
      artScale: 1.1,
    });
    ctx.globalAlpha = 1;

    const nickname = (state.nickname || '').trim();
    if (nickname && !run.dead) {
      ctx.save();
      ctx.font = '800 14px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(13,27,43,.72)';
      ctx.strokeText(nickname, sx, p.y - 15);
      ctx.fillStyle = '#fff9e9';
      ctx.fillText(nickname, sx, p.y - 15);
      ctx.restore();
    }
  }

  function drawBlockCoins(run) {
    for (const coin of run.blockCoins) {
      const alpha = clamp(coin.life / coin.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawCoin(coin.x - run.cameraX, coin.y, run.time, 0, .9);
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles(run, layer = 'all') {
    if (layer !== 'popups') {
      for (const particle of run.particles) {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        const sx = particle.x - run.cameraX;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, particle.y);
        ctx.rotate(particle.rotation);
        if (particle.shape === 'star') {
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.moveTo(0, -particle.size * 1.8);
            ctx.quadraticCurveTo(particle.size * .2, -particle.size * .2, particle.size * 1.6, 0);
            ctx.quadraticCurveTo(particle.size * .2, particle.size * .2, 0, particle.size * 1.8);
            ctx.quadraticCurveTo(-particle.size * .2, particle.size * .2, -particle.size * 1.6, 0);
            ctx.quadraticCurveTo(-particle.size * .2, -particle.size * .2, 0, -particle.size * 1.8);
          }
          ctx.fill();
        } else {
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(0, 0, particle.size, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    if (layer !== 'particles') {
      for (const item of run.popups) {
        const progress = 1 - item.life / item.maxLife;
        const alpha = clamp(item.life / item.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(item.x - run.cameraX, item.y);
        ctx.scale(1 + easeOutCubic(progress) * .14, 1 + easeOutCubic(progress) * .14);
        ctx.font = '900 16px "Arial Black", "Microsoft YaHei UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(41,34,23,.42)';
        ctx.strokeText(item.text, 0, 0);
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, 0, 0);
        ctx.restore();
      }
    }
  }

  function drawConfetti(run) {
    for (const piece of run.confetti) {
      if (piece.x < -30 || piece.x > DESIGN_W + 30 || piece.y > DESIGN_H + 20) continue;
      ctx.save();
      ctx.globalAlpha = .82;
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rot);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h * (0.4 + Math.abs(Math.sin(piece.sway)) * .6));
      ctx.restore();
    }
  }

  function drawInGameHints(run) {
    if (!run) return;
    if (run.goTimer > 0 && !run.dead) {
      const t = 1 - run.goTimer / .85;
      const alpha = run.goTimer > .2 ? 1 : run.goTimer / .2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(DESIGN_W / 2, 187);
      ctx.rotate(-.035);
      const scale = .82 + easeOutCubic(Math.min(1, t * 3)) * .28;
      ctx.scale(scale, scale);
      ctx.font = '900 55px "Arial Black", "Microsoft YaHei UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#19243b';
      ctx.strokeText('GO!', 0, 0);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#fff9e9';
      ctx.strokeText('GO!', 0, 0);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('GO!', 0, 0);
      const jumpTip = dom.shell.classList.contains('has-touch')
        ? '点击跳跃键 · 再按一次二段跳'
        : 'SPACE 跳跃 · 再按一次二段跳';
      ctx.font = '800 15px "Microsoft YaHei UI", sans-serif';
      ctx.fillStyle = 'rgba(255,250,235,.86)';
      ctx.strokeStyle = 'rgba(25,36,59,.5)';
      ctx.lineWidth = 4;
      ctx.strokeText(jumpTip, 0, 56);
      ctx.fillText(jumpTip, 0, 56);
      ctx.restore();
    }
  }

  /* ==========================================================
     Rendering — scenes
     ========================================================== */

  function drawMenuScene(time) {
    drawBackground(state.menuCamera, time);
    // A few temporary scenic props, composed directly in screen space.
    const bob = Math.sin(time * 1.8) * 3;
    // foreground meadow
    ctx.fillStyle = '#6fc95a';
    ctx.beginPath();
    ctx.moveTo(-20, 457);
    ctx.quadraticCurveTo(130, 423, 300, 436);
    ctx.quadraticCurveTo(600, 458, 980, 425);
    ctx.lineTo(980, DESIGN_H + 20);
    ctx.lineTo(-20, DESIGN_H + 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3d9b48';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#4eaa47';
    ctx.beginPath();
    ctx.moveTo(-20, 472);
    ctx.quadraticCurveTo(250, 445, 490, 463);
    ctx.quadraticCurveTo(740, 480, 980, 451);
    ctx.lineTo(980, DESIGN_H + 20);
    ctx.lineTo(-20, DESIGN_H + 20);
    ctx.closePath();
    ctx.fill();

    // rows of tiny flowers
    for (let i = 0; i < 26; i++) {
      const x = mod(i * 83 + state.menuCamera * .2, 1040) - 40;
      const y = 470 + (i % 4) * 13;
      ctx.fillStyle = i % 3 === 0 ? '#ffe080' : i % 3 === 1 ? '#fff6d9' : '#fa9f83';
      ctx.beginPath();
      ctx.arc(x, y, 2.1, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(47,130,65,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x + 1, y + 6);
      ctx.stroke();
    }

    // floating coin cluster
    const coinBaseX = 870 - mod(state.menuCamera * .35, 300) * .25;
    drawCoin(coinBaseX, 300 + bob, time, .3, .9);
    drawCoin(coinBaseX + 42, 280 + Math.sin(time * 1.6 + 1) * 4, time, 2.4, .72);
    drawCoin(coinBaseX - 35, 267 + Math.sin(time * 1.4 + 2) * 4, time, 4.1, .6);

    // ground silhouette along the bottom, dark enough to frame the title
    const floor = ctx.createLinearGradient(0, 490, 0, DESIGN_H);
    floor.addColorStop(0, '#1f7640');
    floor.addColorStop(1, '#0e4c2c');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 500, DESIGN_W, DESIGN_H - 500);
    ctx.fillStyle = '#42a34e';
    ctx.fillRect(0, 496, DESIGN_W, 10);
    ctx.fillStyle = '#7ed865';
    ctx.fillRect(0, 496, DESIGN_W, 3);
  }

  function drawGameScene(time) {
    const run = state.run;
    if (!run) return;
    let shakeX = 0;
    let shakeY = 0;
    if (run.shake > 0) {
      const strength = run.shake * 16;
      shakeX = (Math.random() - .5) * strength;
      shakeY = (Math.random() - .5) * strength;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground(run.cameraX, run.time);
    drawGrounds(run);
    drawPipes(run);
    drawSpikes(run);
    drawBlocks(run);
    drawCoins(run);
    drawBlockCoins(run);
    drawEnemies(run);
    drawParticles(run, 'particles');
    if (!run.dead || run.deathTimer < 1.4) drawPlayer(run);
    drawParticles(run, 'popups');
    ctx.restore();
    if (run.invincible > 1.8 && !run.dead) {
      // small transient white edge cue on rescue
      ctx.save();
      ctx.strokeStyle = `rgba(255,249,224,${(run.invincible - 1.8) * .55})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, DESIGN_W - 10, DESIGN_H - 10);
      ctx.restore();
    }
    drawInGameHints(run);
    if (state.mode === 'gameover') drawConfetti(run);
  }

  function drawDyingScene(time) {
    const run = state.run;
    if (!run) return;
    drawBackground(run.cameraX, run.time);
    drawGrounds(run);
    drawPipes(run);
    drawSpikes(run);
    drawBlocks(run);
    drawCoins(run);
    drawEnemies(run);
    drawParticles(run, 'particles');
    if (run.deathTimer < 1.5) drawPlayer(run);
    drawParticles(run, 'popups');
  }

  function renderScene(time) {
    clearCanvas();
    if (state.mode === 'menu') {
      drawMenuScene(state.menuTime);
    } else if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'gameover') {
      drawGameScene(time);
    } else if (state.mode === 'dying') {
      drawDyingScene(time);
    }
  }

  /* ==========================================================
     Input
     ========================================================== */

  function queueJump() {
    if (state.mode !== 'playing' || !state.run) return;
    const p = state.run.player;
    if (!p.jumpHeld) {
      p.jumpBuffer = Math.max(p.jumpBuffer, .14);
      p.jumpHeld = true;
    }
    audio.unlock();
  }

  function releaseJump() {
    if (!state.run) return;
    state.run.player.jumpHeld = false;
  }

  function handleKeyDown(event) {
    const key = event.key;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if (state.nicknamePromptOpen) return;

    if (state.settingsOpen) {
      if (event.code === 'Escape' || event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        closeSettings();
      }
      return;
    }

    if (state.helpOpen) {
      if (event.code === 'Escape' || event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        closeHelp();
      }
      return;
    }

    if (state.achievementOpen) {
      if (event.code === 'Escape' || event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        closeAchievements();
      }
      return;
    }

    if (state.boardOpen) {
      if (event.code === 'Escape' || event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        closeBoard();
      }
      return;
    }

    const onButton = target && target.closest && target.closest('button');
    if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      if (event.repeat) return;
      if (state.mode === 'menu') {
        if (event.code === 'Space' && onButton) return;
        startRun();
      } else if (state.mode === 'playing') {
        queueJump();
      } else if (state.mode === 'gameover') {
        if (event.code === 'Space' && onButton) return;
        startRun();
      } else if (state.mode === 'paused') {
        resumeRun();
      }
      return;
    }

    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (state.mode === 'playing') {
        event.preventDefault();
        pauseRun();
      } else if (state.mode === 'paused') {
        event.preventDefault();
        resumeRun();
      } else if (state.mode === 'gameover' && event.code === 'Escape') {
        openMenu();
      }
      return;
    }

  }

  function handleKeyUp(event) {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      releaseJump();
    }
  }

  function setupInput() {
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    dom.canvas.addEventListener('pointerdown', (event) => {
      if (state.mode !== 'playing') return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      queueJump();
    });
    window.addEventListener('pointerup', () => {
      if (state.mode === 'playing') releaseJump();
    });

    const jumpPress = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.mode !== 'playing') return;
      dom.jumpButton.classList.add('is-pressed');
      try { dom.jumpButton.setPointerCapture(event.pointerId); } catch (error) { /* no-op */ }
      queueJump();
    };
    const jumpRelease = (event) => {
      event.preventDefault();
      dom.jumpButton.classList.remove('is-pressed');
      releaseJump();
    };
    dom.jumpButton.addEventListener('pointerdown', jumpPress);
    dom.jumpButton.addEventListener('pointerup', jumpRelease);
    dom.jumpButton.addEventListener('pointercancel', jumpRelease);
    dom.jumpButton.addEventListener('lostpointercapture', jumpRelease);
    dom.jumpButton.addEventListener('contextmenu', (event) => event.preventDefault());

    dom.startButton.addEventListener('click', () => startRun());
    dom.nicknameButton.addEventListener('click', () => {
      audio.unlock();
      audio.sfx('click');
      openNicknamePrompt();
    });
    dom.nicknameConfirmButton.addEventListener('click', () => {
      audio.unlock();
      audio.sfx('click');
      saveNickname();
    });
    dom.nicknameCancelButton.addEventListener('click', () => {
      audio.sfx('click');
      cancelNickname();
    });
    dom.nicknameInput.addEventListener('input', () => {
      dom.nicknameInput.classList.remove('is-invalid');
    });
    dom.nicknameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveNickname();
      }
    });

    const openAvatarPicker = () => {
      audio.unlock();
      audio.sfx('click');
      window.open('avatars.html', 'avatarPicker');
    };
    dom.openAvatarButton.addEventListener('click', openAvatarPicker);
    dom.pauseAvatarButton.addEventListener('click', openAvatarPicker);
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'avatar-selected') applyAvatarFromStorage();
    });
    window.addEventListener('storage', (event) => {
      if (!event.key) return;
      if ([STORAGE.avatar, STORAGE.custom, STORAGE.avatarImports].includes(event.key)) applyAvatarFromStorage();
    });

    dom.difficultySwitch.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        audio.unlock();
        setMode(button.dataset.mode);
        button.blur();
      });
    });

    dom.boardButton.addEventListener('click', () => {
      audio.unlock();
      openBoard();
      dom.boardButton.blur();
    });
    dom.achievementButton.addEventListener('click', () => {
      audio.unlock();
      openAchievements();
      dom.achievementButton.blur();
    });
    dom.achievementCloseButton.addEventListener('click', closeAchievements);
    dom.achievementScreen.addEventListener('click', (event) => {
      if (event.target === dom.achievementScreen) closeAchievements();
    });
    dom.achievementList.addEventListener('scroll', hideAchievementTooltip, { passive: true });
    dom.settingsButton.addEventListener('click', () => openSettings());
    dom.hudSettingsButton.addEventListener('click', () => openSettings());
    dom.pauseSettingsButton.addEventListener('click', () => openSettings());
    dom.helpButton.addEventListener('click', () => openHelp());
    dom.helpCloseButton.addEventListener('click', closeHelp);
    dom.helpDoneButton.addEventListener('click', closeHelp);
    dom.helpScreen.addEventListener('click', (event) => {
      if (event.target === dom.helpScreen) closeHelp();
    });
    dom.settingsCloseButton.addEventListener('click', closeSettings);
    dom.settingsDoneButton.addEventListener('click', closeSettings);
    dom.settingsScreen.addEventListener('click', (event) => {
      if (event.target === dom.settingsScreen) closeSettings();
    });
    dom.musicVolume.addEventListener('input', () => {
      audio.setMusicVolume(Number(dom.musicVolume.value) / 100);
      dom.musicVolumeValue.textContent = settingsVolumePercent(audio.musicVolume);
    });
    dom.musicVolume.addEventListener('change', () => audio.unlock());
    dom.sfxVolume.addEventListener('input', () => {
      audio.setSfxVolume(Number(dom.sfxVolume.value) / 100);
      dom.sfxVolumeValue.textContent = settingsVolumePercent(audio.sfxVolume);
    });
    dom.sfxVolume.addEventListener('change', () => {
      audio.unlock();
      if (audio.sfxVolume > 0) audio.sfx('click');
    });
    [
      dom.clearLocalBoardButton,
      dom.clearAchievementsButton,
      dom.clearBestsButton,
    ].forEach((button) => {
      button.addEventListener('click', () => {
        audio.unlock();
        handleSettingsClear(button.dataset.clear, button);
      });
    });
    dom.overBoardButton.addEventListener('click', () => openBoard());
    dom.boardCloseButton.addEventListener('click', closeBoard);
    dom.boardScreen.addEventListener('click', (event) => {
      if (event.target === dom.boardScreen) closeBoard();
    });
    dom.boardFilters.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        audio.sfx('click');
        setBoardFilter(button.dataset.filter);
        button.blur();
      });
    });
    dom.boardSources.querySelectorAll('[data-source]').forEach((button) => {
      button.addEventListener('click', () => {
        audio.sfx('click');
        setBoardSource(button.dataset.source);
        button.blur();
      });
    });
    dom.boardRefreshButton.addEventListener('click', () => {
      if (state.boardSource !== 'global' || state.onlineLoading) return;
      audio.sfx('click');
      flushPendingScores();
      fetchOnlineScores({ force: true });
    });
    dom.boardClearButton.addEventListener('click', clearBoard);
    dom.pauseButton.addEventListener('click', () => pauseRun());
    dom.hudAvatar.addEventListener('click', () => pauseRun());
    dom.resumeButton.addEventListener('click', () => resumeRun());
    dom.restartButton.addEventListener('click', () => {
      audio.sfx('click');
      startRun();
    });
    dom.homeButton.addEventListener('click', () => {
      audio.sfx('click');
      goHomeFromPause();
    });
    dom.retryButton.addEventListener('click', () => startRun());
    dom.changeAvatarButton.addEventListener('click', () => {
      audio.sfx('click');
      openMenu();
      window.open('avatars.html', 'avatarPicker');
    });
    dom.overHomeButton.addEventListener('click', () => {
      audio.sfx('click');
      openMenu();
    });

    dom.uploadInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      handleAvatarFile(file);
    });

    // drag & drop a photo right onto either custom card
    const onDrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        handleAvatarFile(file);
      }
    };
    document.querySelectorAll('.avatar-card[data-avatar="custom"]').forEach((card) => {
      card.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      });
      card.addEventListener('drop', onDrop);
    });

    window.addEventListener('blur', () => {
      if (state.mode === 'playing') pauseRun();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.mode === 'playing') pauseRun();
    });

    window.addEventListener('resize', () => {
      resizeCanvas();
      renderScene(performance.now() / 1000);
    });
    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => {
        resizeCanvas();
        renderScene(performance.now() / 1000);
      }, 280);
    });
  }

  /* ==========================================================
     Main loop
     ========================================================== */

  const FIXED_STEP = 1 / 120;

  function frame(now) {
    const nowSeconds = now / 1000;
    const dtRaw = state.lastTime ? (now - state.lastTime) / 1000 : 1 / 60;
    state.lastTime = now;
    const dt = Math.min(.05, Math.max(0, dtRaw));

    if (state.mode === 'playing') {
      state.accumulator += dt;
      let steps = 0;
      while (state.accumulator >= FIXED_STEP && steps < 7) {
        updatePlaying(FIXED_STEP);
        state.accumulator -= FIXED_STEP;
        steps++;
        if (state.mode !== 'playing') break;
      }
      if (steps >= 7) state.accumulator = 0;
      if (state.mode === 'playing') updateHud(false);
    } else if (state.mode === 'dying') {
      state.accumulator += dt;
      let steps = 0;
      while (state.accumulator >= FIXED_STEP && steps < 7) {
        updateDying(FIXED_STEP);
        state.accumulator -= FIXED_STEP;
        steps++;
        if (state.mode !== 'dying') break;
      }
      if (steps >= 7) state.accumulator = 0;
      if (state.mode === 'dying') updateHud(false);
    } else if (state.mode === 'menu' || state.mode === 'gameover') {
      updateAmbient(dt);
    }

    // Combo badge decays visually even while paused (but not reset).
    if (state.run && state.mode === 'playing') {
      updateComboBadge();
    }

    renderScene(nowSeconds);

    window.requestAnimationFrame(frame);
  }

  /* ==========================================================
     Boot
     ========================================================== */

  function detectTouchDevice() {
    const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
    const hasTouch = coarsePointer || (noHover && (navigator.maxTouchPoints || 0) > 0);
    dom.shell.classList.toggle('has-touch', hasTouch);
  }



  function init() {
    resizeCanvas();
    detectTouchDevice();
    clearLeaderboardOnce();
    if (window.matchMedia) {
      const query = window.matchMedia('(pointer: coarse)');
      if (query.addEventListener) query.addEventListener('change', detectTouchDevice);
    }
    AVATARS = buildAvatarList();
    loadAllAvatarImages();
    const storedAvatar = readStore(STORAGE.avatar, null);
    state.selected = AVATARS.some((avatar) => avatar.id === storedAvatar) ? storedAvatar : ((AVATARS[0] && AVATARS[0].id) || 'default');
    state.customData = readStore(STORAGE.custom, null);
    if (state.selected === 'custom' && !state.customData) state.selected = (AVATARS[0] && AVATARS[0].id) || 'default';

    refreshAvatarUI();
    refreshModeUI();
    renderAchievements();
    updateMenuBest();
    state.customImage = null;
    if (state.customData) {
      loadCustomImageData(state.customData);
    }

    // Clean up initial hidden screens for accessibility and layout.
    dom.pauseScreen.inert = true;
    dom.gameOverScreen.inert = true;
    dom.hud.inert = true;
    setHudVisible(false);
    showScreen('start');
    updateHud(true);
    setupInput();
    updateNicknameUI();
    if (!state.nickname) openNicknamePrompt();
    renderScene(performance.now() / 1000);
    window.requestAnimationFrame(frame);
    window.setTimeout(() => {
      fetchOnlineScores({ force: true });
      flushPendingScores().catch(() => {});
    }, 600);
  }

  init();
})();
