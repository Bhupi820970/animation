# animation

YouTube paper-cutout story factory. A pending story in `stories.json` is turned into a 1920x1080 video on GitHub Actions: English voiceover, scene images, pan/zoom motion, then an optional YouTube upload.

This pipeline makes narrated illustrated videos (still images with camera moves). It is not the same as hand-iterated Remotion character animation.

## How a run works

1. The workflow starts three times a day (10:00 AM, 1:30 PM, and 7:00 PM IST) or when you click **Run workflow**.
2. It picks the first story with `"status": "pending"`.
3. It generates a voice for each scene and a picture from the scene prompt.
4. Remotion renders `out/final_video.mp4` and saves it as the `youtube-ready-video` artifact.
5. If YouTube secrets are set, it uploads the video. If they are not set, upload is skipped.
6. Only after a successful render is the story marked `"done"` and committed.

If there is no pending story, the run stops cleanly and does not render.

## Story format for Grok

Add new stories to `stories.json`. Keep existing entries. Use a new unique `id`. Leave `"status"` as `"pending"`.

```json
{
  "id": "story_02",
  "status": "pending",
  "title": "The Lighthouse That Never Turned Off",
  "description": "Optional YouTube description.",
  "scenes": [
    {
      "narration": "One or two spoken sentences for this scene.",
      "visualPrompt": "2D layered paper cutout art style, dark stormy ocean, tall glowing lighthouse, cinematic lighting, no text, no watermark, no logo, no caption",
      "effect": "zoom_in"
    }
  ]
}
```

Rules:

- `effect` must be one of: `zoom_in`, `zoom_out`, `pan_right`, `pan_left`, `shake`.
- Put the same art style in every `visualPrompt` so scenes feel like one film.
- Always include `no text, no watermark, no logo, no caption` in the visual prompt.
- A 2-3 minute video needs about 15-25 scenes, not 3. A 3-scene story is only a short test.
- Do not put API keys, tokens, or passwords in this file.

## Secrets (names only)

Add these in the repo's GitHub Secrets if you want uploads and more reliable images:

| Secret name | Required? | What it is for |
|---|---|---|
| `POLLINATIONS_API_KEY` | Recommended | Image generation. From GitHub Actions the free public API often returns HTTP 402 (payment required) or a watermark. A key from https://enter.pollinations.ai is more reliable and can request no logo. |
| `GEMINI_API_KEY` | Optional fallback | Used for scene images if Pollinations fails. Add a Gemini image-capable key; do not reuse keys by putting them in the repo. |
| `YOUTUBE_CLIENT_ID` | For upload | Google Cloud OAuth client id for the YouTube Data API. |
| `YOUTUBE_CLIENT_SECRET` | For upload | Google Cloud OAuth client secret. |
| `YOUTUBE_REFRESH_TOKEN` | For upload | OAuth refresh token for the YouTube channel. |
| `YOUTUBE_PRIVACY` | Optional | `private` (default), `unlisted`, or `public`. |

Without the YouTube secrets, videos still get built and saved as workflow artifacts.

If both image APIs fail, the run still finishes using a simple local paper-cutout drawing. That fallback has no watermark, but it is much simpler than Flux or Gemini art. Add `POLLINATIONS_API_KEY` or `GEMINI_API_KEY` for better pictures.


Each full-length story should also include:

- `genre`: a short label shown on the title card
- `artStyle`: one locked visual style, repeated into every image prompt
- `character`: a locked description of the main character, used in every prompt
- `voice`: an Edge-TTS voice name, optional
- 30-45 scenes for a 3-4 minute film

The factory prepends the style and character, and always adds a ban on text, letters, typography, captions, watermarks and logos.

## Local commands (on any computer with Node, ffmpeg, and edge-tts)

```bash
npm install
npm test
npm run prepare-assets
npm run render
```

Do not name a script `prepare`. That name is an npm lifecycle hook and would run during `npm install`.
