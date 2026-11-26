#!/usr/bin/env python3
"""Upload out/final_video.mp4 to YouTube when OAuth secrets are present."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

VIDEO = Path("out/final_video.mp4")
META = Path("public/current_video.json")
TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"


def env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    data = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL,
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Do not print the response body; it can contain sensitive details.
        print(f"YouTube token refresh failed with HTTP {exc.code}", file=sys.stderr)
        raise SystemExit(1) from exc
    token = payload.get("access_token")
    if not token:
        print("YouTube token refresh returned no access token", file=sys.stderr)
        raise SystemExit(1)
    return token


def upload(access_token: str, video_path: Path, title: str, description: str, privacy: str) -> None:
    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:4900],
            "categoryId": "24",
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }
    start = urllib.request.Request(
        UPLOAD_URL,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": str(video_path.stat().st_size),
        },
    )
    try:
        with urllib.request.urlopen(start, timeout=60) as res:
            upload_url = res.headers.get("Location")
    except urllib.error.HTTPError as exc:
        print(f"YouTube upload session failed with HTTP {exc.code}", file=sys.stderr)
        raise SystemExit(1) from exc
    if not upload_url:
        print("YouTube did not return an upload URL", file=sys.stderr)
        raise SystemExit(1)

    video_bytes = video_path.read_bytes()
    put = urllib.request.Request(
        upload_url,
        data=video_bytes,
        method="PUT",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "video/mp4",
            "Content-Length": str(len(video_bytes)),
        },
    )
    try:
        with urllib.request.urlopen(put, timeout=600) as res:
            result = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print(f"YouTube video upload failed with HTTP {exc.code}", file=sys.stderr)
        raise SystemExit(1) from exc

    video_id = result.get("id")
    if not video_id:
        print("YouTube upload finished but no video id was returned", file=sys.stderr)
        raise SystemExit(1)
    print(f"Uploaded to YouTube as https://www.youtube.com/watch?v={video_id} ({privacy})")


def main() -> int:
    client_id = env("YOUTUBE_CLIENT_ID")
    client_secret = env("YOUTUBE_CLIENT_SECRET")
    refresh_token = env("YOUTUBE_REFRESH_TOKEN")
    privacy = env("YOUTUBE_PRIVACY") or "private"
    if privacy not in {"private", "unlisted", "public"}:
        privacy = "private"

    if not (client_id and client_secret and refresh_token):
        print("YouTube secrets not set; skipping upload.")
        return 0
    if not VIDEO.is_file():
        print("No rendered video found at out/final_video.mp4", file=sys.stderr)
        return 1

    title = "New story"
    description = ""
    if META.is_file():
        data = json.loads(META.read_text(encoding="utf-8"))
        title = data.get("title") or title
        description = data.get("description") or ""

    token = refresh_access_token(client_id, client_secret, refresh_token)
    upload(token, VIDEO, title, description, privacy)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
