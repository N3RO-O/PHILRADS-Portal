"""Retain unchanged narration and synthesize the lines updated for PRISM 1.9.7."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys

cache, models = map(Path, sys.argv[1:3])
root = Path(__file__).resolve().parent
source = root.parent / "prism-field-guide" / "audio.py"
spec = importlib.util.spec_from_file_location("guide_audio", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
old = models / "cache"
original = dict(json.loads((old / "plan.json").read_text(encoding="utf8"))["voices"])
updated = dict(json.loads((cache / "plan.json").read_text(encoding="utf8"))["voices"])
voices = cache / "voices"
voices.mkdir(exist_ok=True)
for id_, speech in updated.items():
    if speech == original.get(id_):
        wav = old / "voices" / f"{id_}.wav"
        if wav.exists():
            shutil.copyfile(wav, module.voice_file(voices, id_, speech))
module.main()
