"""Composite captured PRISM pixels into a kinetic, captioned tutorial."""
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from html import unescape
from pathlib import Path
import json
import math
import os
import subprocess
import sys
import zipfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / "prism-field-guide" / "assets"
REPO = ROOT.parents[2]
EXPORTS = ROOT / "exports"
CACHE = Path(os.environ["TEMP"]) / "prism-video-tools" / "native-render"
FFMPEG = Path(sys.argv[1])
PLAN = json.loads((ROOT / "native-plan.json").read_text(encoding="utf8"))
INK, SOFT, AMBER = "#fff4ed", "#cbbab9", "#ffb759"
WINDIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"


@lru_cache(maxsize=96)
def font(size, heavy=False):
    path = ROOT / ("archivo.ttf" if heavy else "montserrat.ttf")
    fallback = WINDIR / ("arialbd.ttf" if heavy else "arial.ttf")
    return ImageFont.truetype(str(path if path.exists() else fallback), size)


def wrap(draw, value, family, width):
    lines = [""]
    for word in value.split():
        candidate = " ".join(filter(None, (lines[-1], word)))
        if lines[-1] and draw.textlength(candidate, font=family) > width:
            lines.append(word)
        else:
            lines[-1] = candidate
    return lines


@lru_cache(maxsize=4)
def background(width, height):
    yy, xx = np.ogrid[0:1:complex(height), 0:1:complex(width)]
    red = np.exp(-((xx - .81) ** 2 / .16 + (yy - .23) ** 2 / .12))
    amber = np.exp(-((xx - .2) ** 2 / .125 + (yy - .79) ** 2 / .12))
    haze = np.exp(-abs((yy - .48) + (xx - .55) * .37) * 9)
    rgb = np.stack([12 + red * 60 + amber * 29 + haze * 8,
                    12 + red * 13 + amber * 12 + haze * 4,
                    17 + red * 16 + amber * 6 + haze * 6], axis=-1)
    rng = np.random.default_rng(197)
    rgb += rng.normal(0, .55, (height, width, 1))
    base = Image.fromarray(np.uint8(rgb.clip(0, 255)), "RGB").convert("RGBA")
    detail = Image.new("RGBA", base.size)
    d = ImageDraw.Draw(detail)
    for i in range(3):
        d.line([(0, int(height * (.84 + i * .019))), (width, int(height * (.37 + i * .024)))],
               fill=[(252, 105, 98, 44), (238, 144, 52, 64), (253, 219, 148, 51)][i], width=2)
    for i in range(7):
        x, y = int(width * (.21 + .116 * i)), int(height * (.188 + .111 * ((i * 3) % 5)))
        d.line([(x - 5, y), (x + 5, y)], fill=(250, 194, 141, 65))
        d.line([(x, y - 5), (x, y + 5)], fill=(250, 194, 141, 65))
    return Image.alpha_composite(base, detail)


def title(draw, text, x, y, max_width, initial, max_lines=2):
    size = initial
    while size > 35:
        family = font(size, True)
        lines = wrap(draw, unescape(text), family, max_width)
        if len(lines) <= max_lines:
            break
        size -= 3
    for i, line in enumerate(lines):
        draw.text((x, y + i * (size + 2)), line, font=family, fill=INK, anchor="lt")
    return y + len(lines) * (size + 2)


def pulse_outline(draw, rect, width=3):
    x0, y0, x1, y1 = rect
    length = min(24, (x1 - x0) / 2, (y1 - y0) / 2)
    for x, y, dx, dy in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        draw.line([(x + dx * length, y), (x, y), (x, y + dy * length)], fill=AMBER, width=width)


def frame_ui(canvas, box, shot, detail):
    x, y, w, h = box
    image = Image.open(ROOT / shot["file"]).convert("RGB")
    sx, sy = image.width / 412, image.height / 840
    target = shot["target"]
    cx = cy = 0
    cw, ch = 412, 840
    if target and detail:
        left, top, bw, bh = target
        center = (left + bw * .5, top + bh * .5)
        aspect = 412 / 840
        ch = min(840, max(694, (bw + 42) / aspect, bh + 96))
        cw = ch * aspect
        cx = min(max(0, center[0] - cw * .5), 412 - cw)
        cy = min(max(0, center[1] - ch * .43), 840 - ch)
    source_rect = (round(cx * sx), round(cy * sy), round((cx + cw) * sx), round((cy + ch) * sy))
    image = image.crop(source_rect).resize((w, h), Image.Resampling.LANCZOS).convert("RGBA")
    border = 9
    shadow = Image.new("RGBA", canvas.size)
    ImageDraw.Draw(shadow).rounded_rectangle((x - 20, y - 10, x + w + 23, y + h + 28), 49, fill=(0, 0, 0, 225))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((x - border, y - border, x + w + border, y + h + border), 33,
                           fill="#16141a", outline="#7a5555", width=2)
    mask = Image.new("L", (w, h))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), 25, fill=255)
    canvas.paste(image, (x, y), mask)
    draw.line((x + 56, y - 8, x + w * .62, y - 8), fill="#e8a57d", width=2)
    if not target:
        return None
    left, top, tw, th = target
    if top + th < cy or top >= cy + ch:
        return None
    rx0 = max(x + 8, x + (left - cx) * w / cw - 5)
    ry0 = max(y + 8, y + (top - cy) * h / ch - 5)
    rx1 = min(x + w - 8, x + (left + tw - cx) * w / cw + 5)
    ry1 = min(y + h - 8, y + (top + th - cy) * h / ch + 5)
    if rx1 <= rx0 or ry1 <= ry0:
        return None
    pulse_outline(draw, (rx0, ry0, rx1, ry1))
    return round(rx1 - 4), round(ry0 + (ry1 - ry0) * .5)


def plate(path, wide, chapter, beat, shot, number, phase):
    width, height = (1920, 1080) if wide else (1080, 1920)
    canvas = background(width, height).copy()
    d = ImageDraw.Draw(canvas)
    left = 126 if wide else 92
    right = width - left
    logo = Image.open(REPO / "public/pwa-512x512.png").convert("RGBA")
    small = logo.resize((42, 42), Image.Resampling.LANCZOS)
    canvas.alpha_composite(small, (left, 74))
    d.text((left + 60, 95), "PHILRADS   /   FIELD GUIDE", fill=INK, font=font(24, True), anchor="lm")
    d.text((right, 95), "PRISM 1.9.7", fill="#d9b5ad", font=font(19), anchor="rm")
    d.line((left, 125, right, 125), fill="#795454", width=1)
    cue = unescape((shot or {}).get("cue") or beat["cue"])
    if beat["brand"]:
        lx, ly, ls = (1220, 254, 375) if wide else (317, 436, 446)
        canvas.alpha_composite(logo.resize((ls, ls), Image.Resampling.LANCZOS), (lx, ly))
        title(d, "PRISM", left if wide else 253, 347 if wide else 981, 755, 182, 1)
        d.text((left if wide else 540, 532 if wide else 1187), "B Y   P H I L R A D S",
               font=font(29, True), fill=AMBER, anchor="lt" if wide else "mt")
        d.text((left if wide else 540, 603 if wide else 1280), "Response  /  Inventory  /  Staff",
               font=font(32), fill=SOFT, anchor="lt" if wide else "mt")
        target = None
    elif shot:
        label_y = 226 if wide else 156
        d.text((left, label_y), f"{number:02d}  /  {chapter['id'].replace('-', ' ').upper()}",
               font=font(18, True), fill=AMBER, anchor="lt")
        chapter_title = chapter["title"] if chapter["id"] != "projects-resources-statistics" else "Projects, resources and stats"
        if wide:
            box = (1113, 151, 415, 846)
            end = title(d, chapter_title, left, 278, 850, 84)
            d.line((left, end + 39, left + 82, end + 39), fill=AMBER, width=4)
            cue_font = font(36, True)
            for n, line in enumerate(wrap(d, cue, cue_font, 825)):
                d.text((left, end + 85 + n * 46), line, fill=INK, font=cue_font, anchor="lt")
            d.text((left, 952), "PRISM SCREEN CAPTURE   /   DEMO DATA", font=font(17), fill=SOFT, anchor="lt")
        else:
            box = (210, 327, 660, 1346)
            title(d, chapter_title, left, 204, 905, 60, 1)
            d.line((left, 279, left + 95, 279), fill=AMBER, width=4)
            cue_font = font(32, True)
            for n, line in enumerate(wrap(d, cue, cue_font, 880)[:2]):
                d.text((left + 32, 1699 + n * 38), line, fill=INK, font=cue_font, anchor="lt")
            d.ellipse((left + 3, 1705, left + 14, 1716), fill=AMBER)
        target = frame_ui(canvas, box, shot, phase > 0 or len(beat["shots"]) == 1)
    else:
        title(d, chapter["title"], left, 300, 860, 78)
        d.text((left, 495), cue, font=font(29), fill=SOFT)
        target = None
    d = ImageDraw.Draw(canvas)
    d.text((right, 1013 if wide else 1864), "PHILRADS  ·  TRAINING", font=font(15), fill=SOFT, anchor="rm")
    canvas.convert("RGB").save(path, quality=95, subsampling=0)
    return target


def stamp(seconds):
    n = round(max(0, seconds) * 100)
    return f"{n // 360000}:{n // 6000 % 60:02}:{n // 100 % 60:02}.{n % 100:02}"


def subtitle_file(path, wide, captions, a, b, target, brand=False):
    w, h = (1920, 1080) if wide else (1080, 1920)
    subtitle = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,{43 if wide else 40},&H00FFFFFF,&H000000FF,&H00201923,&H80201923,-1,0,0,0,100,100,0,0,1,4,3,{7 if wide else 2},{126 if wide else 90},{1010 if wide else 90},{732 if wide else 92},1
Style: Pulse,Arial,24,&H0061BEFF,&H0061BEFF,&H0061BEFF,&H00000000,0,0,0,0,100,100,0,0,1,2,0,7,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    for start, end, text in captions or []:
        t0, t1 = max(a, start) - a, min(b, end) - a
        if t1 <= t0:
            continue
        text = text.replace("{", "").replace("}", "")
        subtitle += f"Dialogue: 1,{stamp(t0)},{stamp(t1)},Caption,,0,0,0,,{{\\fad(45,50)}}{text}\n"
    if target:
        x, y = target
        circle = "m 22 2 b 33 2 42 11 42 22 b 42 33 33 42 22 42 b 11 42 2 33 2 22 b 2 11 11 2 22 2"
        duration = min(.92, b - a)
        effect = f"{{\\an7\\pos({x - 20},{y - 20})\\1a&HFF&\\bord2\\fad(50,340)\\fscx64\\fscy64\\t(0,600,\\fscx140\\fscy140)\\p1}}{circle}"
        subtitle += f"Dialogue: 2,0:00:00.00,{stamp(duration)},Pulse,,0,0,0,,{effect}\n"
    if brand:
        lx, ly, size = (1220, 254, 375) if wide else (317, 436, 446)
        center = ly + round(size * .46)
        rays = [(lx - 155, center, lx - 5, center, "E3F0FF", 80)]
        for dy, color, offset in [(-73, "D6EFFF", 610), (0, "46B4FF", 720), (73, "625AFF", 830)]:
            rays.append((lx + size, center, min(w - 50, lx + size + 147), center + dy, color, offset))
        for x0, y0, x1, y1, color, delay in rays:
            shape = f"m 0 0 l {x1-x0} {y1-y0} {x1-x0} {y1-y0+4} 0 4"
            effect = (f"{{\\an7\\pos({x0},{y0})\\bord0\\blur1.2\\1c&H{color}&"
                      f"\\clip(0,0,{x0},{h})\\t({delay},{delay+640},\\clip(0,0,{x1+8},{h}))"
                      f"\\fad(180,440)\\p1}}{shape}")
            subtitle += f"Dialogue: 2,0:00:00.00,{stamp(min(4.2, b-a))},Pulse,,0,0,0,,{effect}\n"
    path.write_text(subtitle, encoding="utf8")


def ff(*args, cwd=None):
    return subprocess.run([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", *map(str, args)],
                          check=True, cwd=cwd)


def shot_video(folder, idx, wide, clip, chapter, beat, shot, number, phase, start_frame, end_frame):
    frames = end_frame - start_frame
    target = plate(folder / f"{idx}.jpg", wide, chapter, beat, shot, number, phase)
    subtitle_file(folder / f"{idx}.ass", wide, beat["captions"], start_frame / 30, end_frame / 30, target, beat["brand"])
    path = folder / f"{idx}.mp4"
    w, h = (1920, 1080) if wide else (1080, 1920)
    # Ease into a small push on each native screen. Use the whole frame as a
    # camera plate, then composite the timing-dependent titles and tap pulse.
    z = f"1.002+0.036*(1-exp(-on/15))+0.006*on/{frames}"
    vf = f"zoompan=z='{z}':x='(iw-iw/zoom)*(0.4+0.13*(1-exp(-on/22)))':y='(ih-ih/zoom)*0.47':d={frames}:s={w}x{h}:fps=30,ass={idx}.ass"
    if idx == 0:
        vf += ",fade=t=in:s=0:n=8:color=0x190e18"
    if clip:
        vf += ",scale=720:1280"
    vf += ",format=yuv420p"
    ff("-i", f"{idx}.jpg", "-filter_threads", "2", "-vf", vf, "-an", "-frames:v", frames,
       "-c:v", "libx264", "-threads", "2", "-preset", "superfast", "-crf", "22",
       "-video_track_timescale", "30000", path.name, cwd=folder)
    return path


def render(cut, wide=False):
    is_clip = cut != "main"
    plan = PLAN["clips"][cut] if is_clip else PLAN["main"]
    variant = cut if is_clip else "wide" if wide else "vertical"
    folder = CACHE / variant
    folder.mkdir(parents=True, exist_ok=True)
    idx, files = 0, []
    for num, chapter in enumerate(plan["chapters"], 1):
        if is_clip:
            num = list(PLAN["clips"]).index(cut) + 1
        for beat in chapter["beats"]:
            shots = beat["shots"] or [None]
            for phase, shot in enumerate(shots):
                a = 0 if phase == 0 else round(shot["at"] * beat["seconds"] * 30)
                b = round(shots[phase + 1]["at"] * beat["seconds"] * 30) if phase + 1 < len(shots) else round(beat["seconds"] * 30)
                if b <= a:
                    continue
                files.append(shot_video(folder, idx, wide, is_clip, chapter, beat, shot, num, phase, a, b))
                idx += 1
        print(f"{variant}: {chapter['id']}", flush=True)
    (folder / "shots.ffconcat").write_text("ffconcat version 1.0\n" +
                                          "".join(f"file '{p.name}'\n" for p in files), encoding="utf8")
    if is_clip:
        order = list(PLAN["clips"]).index(cut) + 1
        output = EXPORTS / "clips" / f"{order:02d}-PRISM-{cut}.mp4"
        audio = OLD / "clip-mixes" / f"{cut}.m4a"
        if (ROOT / "audio" / f"{cut}.m4a").exists():
            audio = ROOT / "audio" / f"{cut}.m4a"
    else:
        output = EXPORTS / ("PRISM-Actual-App-16x9.mp4" if wide else "PRISM-Actual-App-9x16.mp4")
        audio = OLD / "main-mix.m4a"
        if (ROOT / "audio" / "main.m4a").exists():
            audio = ROOT / "audio" / "main.m4a"
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(".part.mp4")
    ff("-f", "concat", "-safe", "0", "-i", "shots.ffconcat", "-i", audio, "-map", "0:v:0",
       "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", temp, cwd=folder)
    temp.replace(output)
    print(f"Exported {output.name}", flush=True)
    return output


if __name__ == "__main__":
    selected = sys.argv[2:]
    if selected == ["all"]:
        with ThreadPoolExecutor(max_workers=3) as pool:
            vertical = pool.submit(render, "main")
            wide = pool.submit(render, "main", True)
            clips = [pool.submit(render, cut) for cut in PLAN["clips"]]
            vertical.result()
            wide.result()
            with zipfile.ZipFile(EXPORTS / "PRISM-Actual-App-Sharing-Clips.zip", "w") as archive:
                for future in clips:
                    path = future.result()
                    archive.write(path, path.name)
    else:
        for cut in selected:
            render("main", cut == "wide") if cut in {"wide", "vertical"} else render(cut)
