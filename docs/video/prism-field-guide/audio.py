"""Generate narration, captions and one mixed soundtrack per delivery."""
import json
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent
CACHE = Path(sys.argv[1])
MODELS = Path(sys.argv[2])
RATE = 48000
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def ffmpeg(*args, **kwargs):
    return subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args], check=True, **kwargs)


def decode(path, *args):
    result = ffmpeg("-i", str(path), *args, "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-", stdout=subprocess.PIPE)
    return np.frombuffer(result.stdout, dtype=np.float32).copy()


def wave_file(path, samples):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(np.clip(samples * 32767, -32767, 32767).astype("<i2").tobytes())


def spoken(text):
    for before, after in [
        ("PHILRADS", "Phil Rads"), ("PRISM", "Prism"), ("IMS", "I M S"),
        ("PDM", "P D M"), ("XP", "X P"), ("PDF", "P D F"), ("Tala", "Tah-lah"), ("Jori", "Jory"),
    ]:
        text = text.replace(before, after)
    return text


def voice_file(directory, voice_id, speech):
    digest = hashlib.sha256(spoken(speech).encode("utf-8")).hexdigest()[:12]
    return directory / f"{voice_id}-{digest}.wav"


def caption_chunks(text):
    words = text.split()
    chunks, line = [], []
    for word in words:
        line.append(word)
        if (len(line) >= 8 or sum(len(w) + 1 for w in line) >= 44
                or (len(line) >= 4 and word[-1] in ".?!")):
            chunks.append(" ".join(line))
            line = []
    if line:
        if chunks and len(line) < 3 and len(chunks[-1]) < 46:
            chunks[-1] += " " + " ".join(line)
        else:
            chunks.append(" ".join(line))
    return chunks


def theme_loop(theme, length):
    # Overlap the ends by a second for a continuous bed in the long versions.
    fade = RATE
    output = np.zeros(length + len(theme), dtype=np.float32)
    for start in range(0, length, len(theme) - fade):
        layer = theme.copy()
        if start:
            layer[:fade] *= np.linspace(0, 1, fade)
        layer[-fade:] *= np.linspace(1, 0, fade)
        output[start:start + len(theme)] += layer
    return output[:length]


def add_at(track, samples, seconds, gain=1):
    begin = round(seconds * RATE)
    count = min(len(samples), len(track) - begin)
    if count > 0:
        track[begin:begin + count] += samples[:count] * gain


def main():
    os.environ.setdefault("OMP_NUM_THREADS", "3")
    plan = json.loads((CACHE / "plan.json").read_text(encoding="utf-8"))
    source = CACHE / "voices"
    source.mkdir(exist_ok=True)
    voice = None
    for voice_id, speech in plan["voices"]:
        path = voice_file(source, voice_id, speech)
        if path.exists():
            continue
        if voice is None:
            voice = Kokoro(str(MODELS / "kokoro-v1.0.int8.onnx"), str(MODELS / "voices-v1.0.bin"))
        samples, rate = voice.create(spoken(speech), voice="af_heart", speed=1.04, lang="en-us")
        assert rate == 24000
        wave_file(path, np.interp(np.arange(len(samples) * 2) / 2, np.arange(len(samples)), samples))
        print("Voice", voice_id, round(len(samples) / rate, 2), flush=True)

    theme = decode(ROOT / "assets/prism-launch.mp3")
    chime = decode(ROOT / "assets/notification.mp3", "-t", "1.0")
    error = decode(ROOT / "assets/error.mp3", "-t", "0.4")
    t = np.arange(round(0.075 * RATE)) / RATE
    tap = (np.sin(2 * np.pi * 680 * t) * np.exp(-t * 68) * np.minimum(1, t * 700)).astype(np.float32)
    caption_plans = {}
    for key, video in [("main", plan["main"]), *plan["clips"].items()]:
        length = round(video["seconds"] * RATE)
        mix = np.zeros(length, dtype=np.float32)
        gain = np.full(length, 0.12, dtype=np.float32)
        gain[:round(RATE * 2.2)] = np.linspace(0.32, 0.12, round(RATE * 2.2))
        captions = {}
        for chapter in video["chapters"]:
            for beat in chapter["beats"]:
                voice_path = voice_file(source, beat["id"], beat["speech"])
                with wave.open(str(voice_path), "rb") as audio:
                    source_duration = audio.getnframes() / audio.getframerate()
                lead = 1.0 if beat["effect"] == "prism" else 0.25
                duration = beat["seconds"] - lead - 0.20
                speed = max(1, source_duration / duration)
                if speed > 1.28:
                    print(f"Fast line {key}/{beat['id']}: {speed:.2f}×", flush=True)
                voice_audio = decode(voice_path, "-af", f"atempo={speed:.6f}", "-t", str(duration))
                peak = np.max(np.abs(voice_audio))
                voice_audio *= min(1.4, 0.74 / peak)
                voice_audio[-240:] *= np.linspace(1, 0, 240)
                start = chapter["start"] + beat["start"]
                add_at(mix, voice_audio, start + lead, 0.85)
                fade_from = round((start + lead - 0.14) * RATE)
                fade_to = round((start + lead + len(voice_audio) / RATE + 0.14) * RATE)
                fade_count = round(RATE * 0.14)
                gain[fade_from:fade_from + fade_count] *= np.linspace(1, 0.37, fade_count)
                gain[fade_from + fade_count:fade_to - fade_count] *= 0.37
                gain[fade_to - fade_count:fade_to] *= np.linspace(0.37, 1, fade_count)
                if beat["effect"] != "prism":
                    add_at(mix, tap, start + 0.78, 0.062)
                if beat["effect"] == "chime":
                    add_at(mix, chime, start + 0.08, 0.22)
                elif beat["effect"] == "error":
                    add_at(mix, error, start + 0.81, 0.12)
                chunks = caption_chunks(beat["speech"])
                weights = [len(chunk) + 5 for chunk in chunks]
                total = sum(weights)
                span = min(beat["seconds"] - lead, len(voice_audio) / RATE + 0.26)
                offsets = np.cumsum([0, *weights]) * (span / total) + lead
                captions[beat["id"]] = [[round(float(a), 3), round(float(b), 3), chunk]
                    for a, b, chunk in zip(offsets, offsets[1:], chunks)]
        mix += theme_loop(theme, length) * gain
        mix[-RATE:] *= np.linspace(1, 0, RATE)
        wave_file(CACHE / f"{key}.wav", mix)
        caption_plans[key] = captions
    (CACHE / "captions.json").write_text(json.dumps(caption_plans, ensure_ascii=False), encoding="utf-8")
    print("Soundtracks and caption timing ready.", flush=True)


if __name__ == "__main__":
    main()
