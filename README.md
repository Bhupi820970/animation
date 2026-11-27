# animation

YouTube paper-cutout story factory. A pending story in `stories.json` is turned into a 1920x1080 video on GitHub Actions: English voiceover, scene images, pan/zoom motion, then an optional YouTube upload.

This pipeline makes narrated illustrated videos (still images with camera moves). It is not the same as hand-iterated Remotion character animation.

## How a run works

1. The workflow starts three times a day (10:00 AM, 1:30 PM, and 7:00 PM IST) or when you click **Run workflow**.
2. It picks the first story with `"status": "pending"`.
3. It builds a fixed paper-cutout puppet for each main character (one sheet, reused in every scene), a voice for each scene, and a background with no people and no text.
4. Remotion composites the same character asset over the backgrounds, then renders `out/final_video.mp4` and saves it as the `youtube-ready-video` artifact. Finished films are capped at 3-4 minutes.
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
- `artStyle`: one locked visual style, repeated into every background prompt
- `characters`: an array of main characters, each with `id`, `name`, a locked `description`, a fixed integer `seed`, and an optional `palette`
- `character`: a fallback locked description if `characters` is omitted
- `voice`: an Edge-TTS voice name, optional
- 30-45 scenes for a 3-4 minute film
- optional per-scene `shot` (`wide`, `medium`, `close`, `back`, `silhouette`, `empty`, `double`, `two_shot`) and `characterId`

The factory generates each character once as a transparent puppet and composites that same asset over every scene. Close-ups zoom the puppet rather than inventing a new face. Background prompts are sanitized and always ban text, letters, typography, captions, watermarks and logos. If the total runtime would exceed four minutes, voice is sped slightly to fit.

## Local commands (on any computer with Node, ffmpeg, and edge-tts)

```bash
npm install
npm test
npm run prepare-assets
npm run render
```

Do not name a script `prepare`. That name is an npm lifecycle hook and would run during `npm install`.
