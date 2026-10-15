#!/usr/bin/env python3
"""Regenerate showcase images, charts, demo video, and sync the GitHub Pages build into docs/."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = Path("/Users/studio/.homebrew/bin/ffmpeg")
EXIFTOOL = Path("/opt/homebrew/bin/exiftool")
MEDIA = ROOT / "docs" / "media"
SHOWCASE = ROOT / "showcase-media"
FRAMES = SHOWCASE / "frames"

CAPTIONS = [
    (0, 5, "Overview of three Surrey pilot areas with schematic application blocks."),
    (5, 10, "City Centre in a pitched 3D view with transit and plan overlays."),
    (10, 15, "Project detail panel with storey-based schematic height."),
    (15, 20, "Transit, amenities and plan context around City Centre."),
    (20, 25, "Fleetwood Town Centre pilot area."),
    (25, 30, "Campbell Heights pilot area."),
    (30, 36, "Phone layout with project list and detail panel."),
]

FRAME_ORDER = [
    "hero.png",
    "01-overview.png",
    "02-city-centre-3d.png",
    "03-project-panel.png",
    "04-transit-overlay.png",
    "05-fleetwood.png",
    "06-campbell-heights.png",
    "07-mobile.png",
]

FRAME_HOLD = 5


def run(cmd: list[str], **kwargs) -> None:
    subprocess.run(cmd, cwd=ROOT, check=True, **kwargs)


def approved_showcase_count() -> dict[str, int]:
    fc = json.loads((ROOT / "public/data/development_projects.geojson").read_text())
    counts: dict[str, int] = {}
    for feat in fc["features"]:
        props = feat.get("properties") or {}
        status = props.get("STATUS", "")
        if status not in ("Conditional Approval", "Final Approval", "Approved", "Issued"):
            continue
        area = props.get("pilot_area") or "unknown"
        counts[area] = counts.get(area, 0) + 1
    return counts


def write_charts() -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    MEDIA.mkdir(parents=True, exist_ok=True)
    counts = approved_showcase_count()
    labels = {
        "city_centre": "City Centre",
        "fleetwood": "Fleetwood Town Centre",
        "campbell_heights": "Campbell Heights",
    }
    keys = [k for k in labels if k in counts]
    values = [counts[k] for k in keys]
    names = [labels[k] for k in keys]

    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(names, values, color=["#2c5f8a", "#4a7c59", "#8a6b2c"])
    ax.set_ylabel("Approved applications in data")
    ax.set_title("Development applications by pilot area (bundled snapshot)")
    fig.tight_layout()
    chart1 = MEDIA / "chart-pilot-areas.png"
    fig.savefig(chart1, dpi=120)
    plt.close(fig)

    status_counts: dict[str, int] = {}
    fc = json.loads((ROOT / "public/data/development_projects.geojson").read_text())
    for feat in fc["features"]:
        st = (feat.get("properties") or {}).get("STATUS", "Unknown")
        status_counts[st] = status_counts.get(st, 0) + 1
    fig, ax = plt.subplots(figsize=(7, 4))
    items = sorted(status_counts.items(), key=lambda x: -x[1])[:8]
    ax.barh([i[0] for i in items], [i[1] for i in items], color="#5a6a7a")
    ax.set_xlabel("Application count")
    ax.set_title("Application status in bundled City snapshot")
    fig.tight_layout()
    chart2 = MEDIA / "chart-status.png"
    fig.savefig(chart2, dpi=120)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 3.5))
    ax.axis("off")
    boxes = [
        ("Public City and OSM layers", 0.05, 0.55),
        ("Rule-based showcase selection", 0.32, 0.55),
        ("Schematic heights", 0.59, 0.55),
        ("Static MapLibre site", 0.86, 0.55),
    ]
    for text, x, y in boxes:
        ax.text(
            x,
            y,
            text,
            ha="center",
            va="center",
            fontsize=10,
            bbox=dict(boxstyle="round,pad=0.4", facecolor="#e8eef4", edgecolor="#2c5f8a"),
        )
    for i in range(len(boxes) - 1):
        x1 = boxes[i][1] + 0.11
        x2 = boxes[i + 1][1] - 0.11
        ax.annotate("", xy=(x2, 0.55), xytext=(x1, 0.55), arrowprops=dict(arrowstyle="->", lw=1.5))
    ax.set_xlim(0, 1)
    ax.set_ylim(0.2, 0.9)
    arch = MEDIA / "architecture.png"
    fig.savefig(arch, dpi=120, bbox_inches="tight")
    plt.close(fig)


def _vtt_time(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    whole = int(s)
    frac = int(round((s - whole) * 1000))
    return f"{h:02d}:{m:02d}:{whole:02d}.{frac:03d}"


def write_vtt(path: Path) -> None:
    lines = ["WEBVTT", ""]
    for start, end, text in CAPTIONS:
        lines.append(f"{_vtt_time(start)} --> {_vtt_time(end)}")
        lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def build_slideshow_video() -> None:
    SHOWCASE.mkdir(parents=True, exist_ok=True)
    list_path = SHOWCASE / "frames.txt"
    lines = []
    for name in FRAME_ORDER:
        frame = FRAMES / name
        if not frame.exists():
            raise SystemExit(f"Missing frame {name}")
        lines.append(f"file '{frame.resolve()}'")
        lines.append(f"duration {FRAME_HOLD}")
    last = FRAMES / FRAME_ORDER[-1]
    if not last.exists():
        last = MEDIA / FRAME_ORDER[-1]
    lines.append(f"file '{last.resolve()}'")
    list_path.write_text("\n".join(lines), encoding="utf-8")

    raw_mp4 = SHOWCASE / "demo-raw.mp4"
    run(
        [
            str(FFMPEG),
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-vf",
            "scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "28",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-map_metadata",
            "-1",
            str(raw_mp4),
        ]
    )

    vtt = MEDIA / "demo.en.vtt"
    write_vtt(vtt)
    captioned = SHOWCASE / "demo.mp4"
    vtt_escaped = str(vtt).replace(":", "\\:")
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(raw_mp4),
            "-vf",
            f"subtitles={vtt_escaped}:force_style='FontSize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "28",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-map_metadata",
            "-1",
            str(captioned),
        ]
    )

    poster = MEDIA / "demo-poster.png"
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(captioned),
            "-frames:v",
            "1",
            "-update",
            "1",
            str(poster),
        ]
    )

    preview = MEDIA / "demo-preview.gif"
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(captioned),
            "-vf",
            "fps=8,scale=640:-1:flags=lanczos",
            "-loop",
            "0",
            str(preview),
        ]
    )


def strip_image_metadata() -> None:
    if not EXIFTOOL.exists():
        return
    for path in MEDIA.rglob("*"):
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            run([str(EXIFTOOL), "-all=", "-overwrite_original", str(path)])


def sync_pages_build() -> None:
    run(["npm", "run", "build:pages"])
    dist = ROOT / "dist-pages"
    keep = MEDIA
    pages_todo = ROOT / "docs" / "PAGES_TODO.md"
    todo_text = pages_todo.read_text(encoding="utf-8") if pages_todo.exists() else None

    for child in ROOT.joinpath("docs").iterdir():
        if child.name == "media":
            continue
        if child.is_file():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)

    for item in dist.iterdir():
        dest = ROOT / "docs" / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    if todo_text:
        pages_todo.write_text(todo_text, encoding="utf-8")


def ensure_git_exclude() -> None:
    exclude = ROOT / ".git" / "info" / "exclude"
    lines = exclude.read_text(encoding="utf-8").splitlines() if exclude.exists() else []
    for entry in ("showcase-media/", "SHOWCASE_REPORT.md", "docs/media/demo.mp4"):
        if entry not in lines:
            lines.append(entry)
    exclude.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    os.environ.setdefault("PATH", os.environ.get("PATH", ""))
    MEDIA.mkdir(parents=True, exist_ok=True)
    SHOWCASE.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)

    run(["npm", "run", "build:site"])
    run(["node", "scripts/capture-showcase-frames.mjs"])
    write_charts()
    build_slideshow_video()
    strip_image_metadata()
    ensure_git_exclude()
    sync_pages_build()

    size_mb = (SHOWCASE / "demo.mp4").stat().st_size / (1024 * 1024)
    if size_mb > 10:
        print(f"Warning: demo.mp4 is {size_mb:.1f} MB (target under 10 MB)", file=sys.stderr)


if __name__ == "__main__":
    main()
