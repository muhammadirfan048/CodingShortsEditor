// Backgrounds, typefaces, motion options, scene types and templates.

export const LOOKS = [
  { id: 'sunset', name: 'Sunset', base: ['#2b0f3f', '#ff6a3d'], blobs: [[255, 92, 138], [255, 176, 32], [120, 60, 255]], fg: '#ffffff', hi: '#ffd36b', shadow: true, swatch: 'linear-gradient(160deg,#3a1452,#ff6a3d 70%,#ffb020)' },
  { id: 'ocean', name: 'Ocean', base: ['#03192e', '#0b6f8c'], blobs: [[0, 200, 200], [40, 110, 255], [0, 90, 120]], fg: '#ffffff', hi: '#7ff0e0', shadow: true, swatch: 'linear-gradient(160deg,#03192e,#0b6f8c 65%,#38d6c8)' },
  { id: 'neon', name: 'Neon', neon: true, fg: '#ffffff', hi: '#5ef2ff', shadow: true, swatch: 'linear-gradient(180deg,#0b0718 55%,#ff2fb4 56%,#0b0718 58%,#2a0b3a)' },
  { id: 'paper', name: 'Paper', paper: true, fg: '#151515', hi: '#151515', marker: true, shadow: false, swatch: 'repeating-linear-gradient(180deg,#f2eee4 0 9px,#cfdbea 9px 10px)' },
  { id: 'forest', name: 'Forest', base: ['#0c241d', '#1f5a43'], blobs: [[63, 191, 143], [200, 230, 120], [20, 90, 70]], fg: '#f4fbe9', hi: '#d9f27a', shadow: true, swatch: 'linear-gradient(160deg,#0c241d,#2f8a64 70%,#d9f27a)' },
  { id: 'studio', name: 'Studio', light: true, base: ['#f7f8fc', '#e6e9f4'], blobs: [[190, 200, 255], [255, 214, 226], [210, 240, 235]], fg: '#0f172a', hi: '#4f46e5', shadow: false, swatch: 'linear-gradient(160deg,#ffffff,#e6e9f4 60%,#c7cdf5)' },
  { id: 'charcoal', name: 'Charcoal', base: ['#111214', '#1d1f24'], blobs: [[70, 74, 84], [40, 42, 48], [90, 94, 104]], fg: '#ffffff', hi: '#ffb020', shadow: true, swatch: 'linear-gradient(160deg,#0d0e10,#2a2d33)' },
  { id: 'midnight', name: 'Midnight', base: ['#0a0e1a', '#1a2340'], blobs: [[60, 90, 200], [130, 80, 220], [20, 40, 90]], fg: '#ffffff', hi: '#82aaff', shadow: true, swatch: 'linear-gradient(160deg,#0a0e1a,#1a2340 60%,#5468c4)' },
];

export const FONTS = [
  { id: 'anton', label: 'Anton', family: 'Anton', weight: 400, upper: true, scale: 1.12, note: 'Bold & loud' },
  { id: 'brico', label: 'Bricolage', family: 'Bricolage Grotesque', weight: 800, scale: 1, note: 'Modern' },
  { id: 'fraunces', label: 'Fraunces', family: 'Fraunces', weight: 700, scale: 1, note: 'Editorial' },
  { id: 'caveat', label: 'Caveat', family: 'Caveat', weight: 700, scale: 1.3, note: 'Handwritten' },
];

export const ANIMS = [['pop', 'Pop'], ['rise', 'Rise'], ['words', 'Word by word'], ['type', 'Typewriter']];
export const POSITIONS = [['top', 'Top'], ['mid', 'Middle'], ['low', 'Lower']];
export const SCENE_TYPES = [['text', 'Text'], ['image', 'Image'], ['video', 'Video'], ['code', 'Code'], ['terminal', 'Terminal']];
export const FRAMES = [['none', 'None'], ['browser', 'Browser'], ['phone', 'Phone']];
export const TEXT_STYLES = [['plain', 'Plain'], ['box', 'Caption box']];

export const LANGS = [
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['jsx', 'React (JSX)'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['csharp', 'C#'],
  ['go', 'Go'],
  ['bash', 'Terminal'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['sql', 'SQL'],
  ['plain', 'Plain text'],
];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newScene(type = 'text') {
  if (type === 'code')
    return { id: uid(), type, text: 'Here’s the trick', dur: 8, lang: 'javascript', filename: 'index.js', typing: true, code: 'console.log("Hello, Shorts!");' };
  if (type === 'terminal')
    return { id: uid(), type, text: 'Output', dur: 4, title: 'Terminal', command: 'node index.js', output: 'Hello, Shorts!', typing: true };
  if (type === 'image') return { id: uid(), type, text: 'Look at this', dur: 4, imageName: '', frame: 'none', url: '' };
  if (type === 'video') return { id: uid(), type, text: '', dur: 6, videoName: '', frame: 'none', url: '', rate: 1, trimStart: 0, videoAudio: true, videoVol: 100 };
  return { id: uid(), type: 'text', text: 'New scene', dur: 3 };
}

const BASE = {
  look: 'midnight', font: 'brico', anim: 'words', size: 100, pos: 'mid', textStyle: 'plain',
  handle: '@yourbrand', safe: false, progress: true,
  brandColor: '#4f46e5', useBrand: false,
  music: 'lofi', musicVol: 50, sfxVol: 70, sfxTyping: true, sfxWhoosh: true,
  sceneVol: 100, duck: true, ttsAuto: false, ttsVoice: 'af_heart', ttsSpeed: 1,
};

const T = (type, extra) => ({ ...newScene(type), ...extra, id: uid() });

/** Starting points. Each returns a fresh project (new ids every time). */
export const TEMPLATES = [
  {
    id: 'product', name: 'Product demo', note: 'Hook, screenshots, a screen recording and a call to action',
    make: () => ({
      ...BASE, look: 'studio', font: 'brico', anim: 'rise', handle: '@yourbrand', useBrand: true, brandColor: '#4f46e5', music: 'upbeat', textStyle: 'plain',
      scenes: [
        T('text', { text: 'Stop juggling *5 different tools*', dur: 3 }),
        T('image', { text: 'Plan your whole week *in one view*', dur: 4, frame: 'browser', url: 'yourproduct.com' }),
        T('video', { text: 'See it in action', dur: 6, frame: 'browser', url: 'yourproduct.com/app' }),
        T('image', { text: 'Works on your *phone* too', dur: 4, frame: 'phone' }),
        T('text', { text: 'Try it free at *yourproduct.com*', dur: 3 }),
      ],
    }),
  },
  {
    id: 'website', name: 'Website showcase', note: 'Show off a site, page by page',
    make: () => ({
      ...BASE, look: 'charcoal', font: 'fraunces', anim: 'pop', handle: '@studio.design', useBrand: true, brandColor: '#ffb020', music: 'ambient',
      scenes: [
        T('text', { text: 'We redesigned *this website*', dur: 3 }),
        T('image', { text: 'The new *homepage*', dur: 3.5, frame: 'browser', url: 'clientsite.com' }),
        T('image', { text: 'Clear *pricing*', dur: 3.5, frame: 'browser', url: 'clientsite.com/pricing' }),
        T('image', { text: 'And it’s *mobile first*', dur: 3.5, frame: 'phone' }),
        T('text', { text: 'Need one? *Link in bio*', dur: 3 }),
      ],
    }),
  },
  {
    id: 'promo', name: 'App promo', note: 'Full-screen clips with bold captions',
    make: () => ({
      ...BASE, look: 'sunset', font: 'anton', anim: 'pop', textStyle: 'box', handle: '@yourapp', music: 'upbeat',
      scenes: [
        T('video', { text: 'POV: you found the *perfect app*', dur: 4, layout: { media: { x: 0, y: 0, w: 1080, h: 1920 }, caption: { cx: 540, cy: 1180, w: 900, s: 0.75 } } }),
        T('image', { text: 'Everything in *one tap*', dur: 3.5, frame: 'phone' }),
        T('video', { text: 'Download it *today*', dur: 4, layout: { media: { x: 0, y: 0, w: 1080, h: 1920 }, caption: { cx: 540, cy: 1180, w: 900, s: 0.75 } } }),
      ],
    }),
  },
  {
    id: 'coding', name: 'Coding tip', note: 'Code, terminal output and a hook, for developers',
    make: () => ({
      ...BASE, look: 'midnight', handle: '@codewithme', music: 'lofi', ttsAuto: true,
      scenes: [
        T('text', { text: 'Stop writing *for loops* for this', dur: 3 }),
        T('code', { text: 'The old way', dur: 7, filename: 'loop.js', code: 'const words = ["react", "vite", "canvas"];\n\n// uppercase every word\nconst upper = [];\nfor (let i = 0; i < words.length; i++) {\n  upper.push(words[i].toUpperCase());\n}' }),
        T('code', { text: 'The *clean* way', dur: 5, filename: 'map.js', code: 'const words = ["react", "vite", "canvas"];\n\nconst upper = words.map(w => w.toUpperCase());\n// ["REACT", "VITE", "CANVAS"]' }),
        T('terminal', { text: 'Run it', dur: 4, command: 'node map.js', output: "[ 'REACT', 'VITE', 'CANVAS' ]" }),
        T('text', { text: 'Same result. *Half the code.*', dur: 3 }),
        T('text', { text: 'Follow for daily *coding tips*', dur: 2.5 }),
      ],
    }),
  },
  {
    id: 'blank', name: 'Blank', note: 'One text scene, your choices',
    make: () => ({ ...BASE, look: 'studio', handle: '', scenes: [T('text', { text: 'Your *hook* goes here', dur: 3 })] }),
  },
];

export const SAMPLE_PROJECT = TEMPLATES[0].make();
export const DEFAULTS = BASE;
