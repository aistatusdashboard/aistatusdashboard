#!/usr/bin/env python3
import json

with open("artifacts/visibility_score.txt", "r", encoding="utf-8") as handle:
    data = json.load(handle)

if isinstance(data, str):
    data = json.loads(data.replace("'", '"'))

score = data.get("total", 0)
if score < 90:
    raise SystemExit(f"Score too low: {score}")
