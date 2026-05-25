#!/usr/bin/env python3
"""Upload Android store listing metadata to Google Play using the Developer API.
"""

import json
import os
import sys
from pathlib import Path

PACKAGE_NAME = "com.iganapolsky.agentbill"
METADATA_ROOT = Path(__file__).resolve().parent.parent / "fastlane" / "metadata" / "android"

LANG_MAP = {
    "en-US": "en-US",
}


def read_metadata(lang_dir: str, filename: str) -> str:
    path = METADATA_ROOT / lang_dir / filename
    if path.exists():
        return path.read_text().strip()
    return ""


def build_edits_service(key_path: str):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_file(
        key_path,
        scopes=["https://www.googleapis.com/auth/androidpublisher"],
    )
    service = build("androidpublisher", "v3", credentials=credentials)
    return service.edits()


def commit_edit(edits, *, edit_id: str):
    return edits.commit(packageName=PACKAGE_NAME, editId=edit_id).execute()


def main():
    key_path = os.environ.get("GOOGLE_PLAY_JSON_KEY_PATH", os.path.join(os.environ.get("RUNNER_TEMP", os.getcwd()), "play-service-account.json"))
    if not os.path.exists(key_path):
        print(f"Service account key not found at {key_path}", file=sys.stderr)
        sys.exit(1)

    edits = build_edits_service(key_path)

    # Create edit
    edit = edits.insert(packageName=PACKAGE_NAME, body={}).execute()
    edit_id = edit["id"]
    print(f"Created edit: {edit_id}")

    updated = []
    skipped = []
    for local_lang, api_lang in LANG_MAP.items():
        title = read_metadata(local_lang, "title.txt")
        short_desc = read_metadata(local_lang, "short_description.txt")
        full_desc = read_metadata(local_lang, "full_description.txt")

        if not any([title, short_desc, full_desc]):
            continue

        listing = {}
        if title:
            listing["title"] = title
        if short_desc:
            listing["shortDescription"] = short_desc
        if full_desc:
            listing["fullDescription"] = full_desc

        try:
            edits.listings().update(
                packageName=PACKAGE_NAME,
                editId=edit_id,
                language=api_lang,
                body=listing,
            ).execute()
            updated.append(api_lang)
            print(f"  Updated listing for {api_lang}")
        except Exception as e:
            print(f"  Skipped {api_lang}: {e}", file=sys.stderr)

    # Upload screenshots for en-US
    screenshots_dir = METADATA_ROOT / "en-US" / "images" / "phoneScreenshots"
    screenshot_count = 0
    if screenshots_dir.is_dir():
        pngs = sorted(p for p in screenshots_dir.iterdir() if p.suffix == ".png" and not p.name.startswith("_"))
        if pngs:
            try:
                edits.images().deleteall(
                    packageName=PACKAGE_NAME,
                    editId=edit_id,
                    language="en-US",
                    imageType="phoneScreenshots",
                ).execute()
            except: pass

            for png_path in pngs:
                from googleapiclient.http import MediaFileUpload
                media = MediaFileUpload(str(png_path), mimetype="image/png")
                edits.images().upload(
                    packageName=PACKAGE_NAME,
                    editId=edit_id,
                    language="en-US",
                    imageType="phoneScreenshots",
                    media_body=media,
                ).execute()
                screenshot_count += 1
                print(f"  Uploaded screenshot: {png_path.name}")

    # Upload feature graphic
    feature_graphic = METADATA_ROOT / "en-US" / "images" / "featureGraphic" / "feature-graphic.png"
    if feature_graphic.is_file():
        from googleapiclient.http import MediaFileUpload
        try:
            edits.images().deleteall(packageName=PACKAGE_NAME, editId=edit_id, language="en-US", imageType="featureGraphic").execute()
        except: pass
        media = MediaFileUpload(str(feature_graphic), mimetype="image/png")
        edits.images().upload(packageName=PACKAGE_NAME, editId=edit_id, language="en-US", imageType="featureGraphic", media_body=media).execute()
        print("  Uploaded feature graphic")

    # Upload icon
    icon = METADATA_ROOT / "en-US" / "images" / "icon" / "icon-512.png"
    if icon.is_file():
        from googleapiclient.http import MediaFileUpload
        try:
            edits.images().deleteall(packageName=PACKAGE_NAME, editId=edit_id, language="en-US", imageType="icon").execute()
        except: pass
        media = MediaFileUpload(str(icon), mimetype="image/png")
        edits.images().upload(packageName=PACKAGE_NAME, editId=edit_id, language="en-US", imageType="icon", media_body=media).execute()
        print("  Uploaded icon")

    commit_edit(edits, edit_id=edit_id)
    print(f"Committed edit. Updated {len(updated)} languages, {screenshot_count} screenshots uploaded.")


if __name__ == "__main__":
    main()
