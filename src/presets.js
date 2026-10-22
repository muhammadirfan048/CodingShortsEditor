// Backgrounds, typefaces, motion options and the sample project.

export const LOOKS = [
  { id: 'sunset', name: 'Sunset', base: ['#2b0f3f', '#ff6a3d'], blobs: [[255, 92, 138], [255, 176, 32], [120, 60, 255]], fg: '#ffffff', hi: '#ffd36b', shadow: true, swatch: 'linear-gradient(160deg,#3a1452,#ff6a3d 70%,#ffb020)' },
  { id: 'ocean', name: 'Ocean', base: ['#03192e', '#0b6f8c'], blobs: [[0, 200, 200], [40, 110, 255], [0, 90, 120]], fg: '#ffffff', hi: '#7ff0e0', shadow: true, swatch: 'linear-gradient(160deg,#03192e,#0b6f8c 65%,#38d6c8)' },
  { id: 'neon', name: 'Neon', neon: true, fg: '#ffffff', hi: '#5ef2ff', shadow: true, swatch: 'linear-gradient(180deg,#0b0718 55%,#ff2fb4 56%,#0b0718 58%,#2a0b3a)' },
  { id: 'paper', name: 'Paper', paper: true, fg: '#151515', hi: '#151515', marker: true, shadow: false, swatch: 'repeating-linear-gradient(180deg,#f2eee4 0 9px,#cfdbea 9px 10px)' },
  { id: 'forest', name: 'Forest', base: ['#0c241d', '#1f5a43'], blobs: [[63, 191, 143], [200, 230, 120], [20, 90, 70]], fg: '#f4fbe9', hi: '#d9f27a', shadow: true, swatch: 'linear-gradient(160deg,#0c241d,#2f8a64 70%,#d9f27a)' },
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
export const SCENE_TYPES = [['text', 'Text'], ['code', 'Code'], ['terminal', 'Terminal'], ['image', 'Screenshot']];

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
  if (type === 'image') return { id: uid(), type, text: 'Look at this', dur: 4, imageName: '' };
  return { id: uid(), type: 'text', text: 'New scene', dur: 3 };
}

export const SAMPLE_PROJECT = {
  scenes: [
    { id: uid(), type: 'text', text: 'Stop writing *for loops* for this', dur: 3 },
    {
      id: uid(), type: 'code', text: 'The old way', dur: 7, lang: 'javascript', filename: 'loop.js', typing: true,
      code: 'const words = ["react", "vite", "canvas"];\n\n// uppercase every word\nconst upper = [];\nfor (let i = 0; i < words.length; i++) {\n  upper.push(words[i].toUpperCase());\n}',
    },
    {
      id: uid(), type: 'code', text: 'The *clean* way', dur: 5, lang: 'javascript', filename: 'map.js', typing: true,
      code: 'const words = ["react", "vite", "canvas"];\n\nconst upper = words.map(w => w.toUpperCase());\n// ["REACT", "VITE", "CANVAS"]',
    },
    {
      id: uid(), type: 'terminal', text: 'Run it', dur: 4, title: 'Terminal', command: 'node map.js', typing: true,
      output: "[ 'REACT', 'VITE', 'CANVAS' ]",
    },
    {
      id: uid(), type: 'code', text: 'Same idea in *Python*', dur: 5, lang: 'python', filename: 'upper.py', typing: true,
      code: 'words = ["react", "vite", "canvas"]\n\nupper = [w.upper() for w in words]\nprint(upper)  # [\'REACT\', \'VITE\', \'CANVAS\']',
    },
    { id: uid(), type: 'text', text: 'Same result. *Half the code.*', dur: 3 },
    { id: uid(), type: 'text', text: 'Follow for daily *coding tips*', dur: 2.5 },
  ],
  look: 'midnight',
  font: 'brico',
  anim: 'words',
  size: 100,
  pos: 'mid',
  handle: '@codewithme',
  safe: false,
  music: 'lofi',
  musicVol: 60,
  sfxVol: 70,
  sfxTyping: true,
  sfxWhoosh: true,
  sceneVol: 100,
  duck: true,
  ttsAuto: true,
  ttsVoice: 'af_heart',
  ttsSpeed: 1,
};
