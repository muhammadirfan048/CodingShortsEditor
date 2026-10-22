# Shortsmith

A vertical video editor that runs in your browser. Make 1080 × 1920 videos for **YouTube Shorts, Instagram Reels and TikTok** from text, screenshots, video clips, screen recordings, code and terminal scenes, with music, voiceovers and your brand.

Nothing is uploaded anywhere. Your files, recordings and exports stay on your computer.

## Run it

You need **Node.js 18 or newer** (https://nodejs.org).

```bash
cd shortsmith
npm install
npm run dev
```

The app opens at http://localhost:5173. Use **Chrome or Edge** on a computer for the best results (screen recording and export work best there).

To build a version you can host on any website:

```bash
npm run build      # output goes to dist/
npm run preview    # check the build locally
```

## Making a video

1. **Start from a template** (top bar → Templates): Product demo, Website showcase, App promo, Coding tip, or Blank. Or keep the current project.
2. **Scenes (left):** each card is one scene. Click a card to open it. Scene types:
   - **Text**: big animated words. Wrap words in `*stars*` to highlight them.
   - **Image**: a screenshot or photo. Pick a **frame**: none, a **browser window** (with your own address in the bar) or a **phone**.
   - **Video**: upload a clip (MP4, WebM, MOV) or click **Record screen**. Choose the speed (0.5× to 3×), where it starts, and whether to use its sound. **Match video length** sets the scene to the clip's length.
   - **Code**: a code editor that types itself out, with syntax colours.
   - **Terminal**: a command that types itself, then its output.
   Drop images or videos onto a card to put them in that scene, or onto the empty part of the list to add new scenes.
3. **Move and resize on the preview.** Click anything on the preview (text, caption, image, video, code box or terminal):
   - drag to move it (it snaps to the centre; hold Alt to stop snapping),
   - drag a **corner** to resize it (pictures keep their shape; hold Shift to stretch),
   - drag an **edge** to crop a picture or change a box's width or height,
   - arrow keys nudge it (Shift for bigger steps).
   The small toolbar has **Fill screen**, **Fit** (show the whole picture again), **Center** and **Reset**. To zoom into part of a screen recording, drag the video larger than the screen.
4. **Record your screen:** Add a scene → **Record screen** (or the button on a video scene).
   - Choose **An area** (default) or **Everything shared**, plus microphone and tab/system sound.
   - Pick the tab, window or screen in your browser's dialog.
   - With **An area**, a live preview opens with a **Short-size (9:16) frame**. Drag it over the part you want and resize it from the corners. Other shapes: 4:5, Square, Wide 16:9, Free, Whole.
   - Press **Start recording** and wait for the 3-2-1 countdown.
   - **Hide controls while recording** (on by default) keeps everything from Shortsmith out of your recording. Stop with your browser's **Stop sharing** button, or come back to Shortsmith and press **Esc** to show the controls (Esc or the eye button hides them again). The tab title shows "● Recording 0:12" so you know it's running.
   - With the controls showing, the recording bar has Pause, **Stop & add**, Discard and a small live view of exactly what is being captured.
   - Chrome also shows its own "sharing your screen" bar. Click **Hide** on it to keep it out of a full-screen recording.
   - The recording becomes a video scene showing only your area. A 9:16 area fills the whole video.
5. **Crop area:** any image or video scene has a **Crop area** button to show only part of the picture, with the same shapes. Nothing is deleted, so you can change it or press **Show all** any time.
6. **Right panel tabs:**
   - **Style**: background (8 looks or your own photo), typeface, text style (plain or **caption box**), motion, size, default position, story progress bar, safe zones.
   - **Audio**: built-in music (free to use) or your own file; automatic **voiceover** (switch it on in a scene) with 9 voices; typing and transition sounds (built-in or your own); volumes; lowering the music under voices and video sound.
   - **Brand**: your **logo**, handle or brand name, and **brand colour** for highlighted words.
7. **Export video** plays the whole video once in real time and records it, so keep the tab open and visible. Then **Save video** and upload it.

**Undo / Redo:** the arrows in the top bar, or Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac). Space plays and pauses.

Your project, uploaded files, recordings and generated voiceovers are saved in your browser automatically and come back after a reload.

### Voiceovers

The voices come from the free, open-source **Kokoro** model, which runs on your own computer: no account, no API key, no cost. The first time, it downloads the model (about 90 MB), so you need internet once. English voices only.

### Good to know

- Exports are MP4 in Chrome/Edge/Safari when supported, otherwise WebM. YouTube, Instagram and TikTok accept both (Instagram prefers MP4).
- Screen recording needs a desktop browser. Browsers can't draw a frame over other apps, so you pick the area on a live preview inside Shortsmith. The full screen is recorded and the area is applied in the editor, which is why you can change it later.
- A small area is enlarged to fill the video and can look soft. Zoom in on what you record (Ctrl +) and keep the area at least about 600 px wide.
- Screen recording needs a desktop browser. Some browsers only share sound from a browser tab, not the whole screen.
- Only use music, footage and logos you have the rights to.

## Project layout

```
public/
  logo.svg                 the Shortsmith logo (header and browser tab icon)
  icon-512.png             app icon for phones (Add to Home Screen)
src/
  App.jsx                  main app: state, playback, video sync, screen recording, export, undo
  renderer.js              draws every frame (backgrounds, text, images, videos, frames, code, terminal) and the layout of every scene
  media.js                 loading images and videos, and the screen recorder
  audio.js                 music, sound effects, scene audio, video sound, lowering music, audio for export
  tts.js, tts.worker.js    automatic voiceovers (Kokoro, in a background thread)
  store.js                 saves files in the browser (IndexedDB)
  highlight.js             syntax colours for code scenes
  presets.js               backgrounds, fonts, scene types, templates
  components/
    SceneCard.jsx          one scene in the list
    StageEditor.jsx        drag, resize and snap on the preview
    LookPanel.jsx          Style, Audio and Brand tabs
    TemplatesModal.jsx     template picker with live thumbnails
    ScreenRecorder.jsx     record-screen dialog, countdown and recording bar
    CropSelector.jsx       pick an area (live screen, video or image) with shape presets
    ResultModal.jsx        watch and save the export
  styles.css
```

## Ideas for changes

- **New template:** add an entry to `TEMPLATES` in `src/presets.js`.
- **New background:** add an entry to `LOOKS` in `src/presets.js`.
- **New music track:** add an entry to `SONGS` in `src/audio.js` and to `MUSIC_TRACKS`.
- **More voices:** add ids to `VOICES` in `src/tts.js`.
- **Logo colour:** change `#ffb020` in `public/logo.svg` (the header logo follows the `--accent` colour in `src/styles.css`).
- **Higher quality export:** change `videoBitsPerSecond` in `src/App.jsx`.
