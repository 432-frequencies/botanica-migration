#!/usr/bin/env python3
import json
import os
import tempfile
import time
import uuid
from pathlib import Path

os.environ.setdefault("BIRDNET_APP_DATA", "/private/tmp/w1ld-birdnet-data")

from birdnet import load
from bottle import Bottle, request, response, run

APP_VERSION = "2026.05.29"
MODEL_VERSION = os.getenv("BIRDNET_MODEL_VERSION", "2.4")
DEFAULT_LOCALE = os.getenv("BIRDNET_DEFAULT_LOCALE", "fr")
SERVER_TOKEN = os.getenv("BIRDNET_SERVER_TOKEN", "").strip()
MAX_UPLOAD_MB = max(1, int(os.getenv("BIRDNET_MAX_UPLOAD_MB", "25")))

app = Bottle()
_MODELS = {}


def json_error(status, error_code, detail=None, request_id=None, hint=None):
  response.status = status
  payload = {"msg": "error", "error": error_code}
  if detail:
    payload["detail"] = detail
  if request_id:
    payload["request_id"] = request_id
  if hint:
    payload["hint"] = hint
  return payload


def to_ordered_predictions(result, top_k=5):
  if not hasattr(result, "to_structured_array"):
    return []

  rows = result.to_structured_array()
  if rows is None or len(rows) == 0:
    return []

  per_species = {}
  for row in rows:
    species = str(row["species_name"])
    confidence = float(row["confidence"])
    per_species[species] = max(per_species.get(species, 0.0), confidence)

  ranked = sorted(per_species.items(), key=lambda item: item[1], reverse=True)
  return [(species, float(score)) for species, score in ranked[:top_k]]


def get_models(lang=DEFAULT_LOCALE):
  cache_key = f"lang:{lang}"
  if cache_key in _MODELS:
    return _MODELS[cache_key]

  acoustic = load("acoustic", MODEL_VERSION, "tf", precision="fp32", lang=lang)
  geo = load("geo", MODEL_VERSION, "tf", precision="fp32", lang=lang)
  _MODELS[cache_key] = (acoustic, geo)
  return acoustic, geo


def parse_json_meta():
  meta_raw = request.forms.get("meta", "{}")
  if not meta_raw:
    return {}
  return json.loads(meta_raw)


def resolve_upload():
  return request.files.get("audio") or request.files.get("file")


def ensure_authorized(request_id):
  if not SERVER_TOKEN:
    return None

  auth_header = request.headers.get("Authorization", "")
  expected = f"Bearer {SERVER_TOKEN}"
  if auth_header != expected:
    return json_error(401, "unauthorized", request_id=request_id)
  return None


def build_geo_whitelist(geo_model, meta):
  lat = meta.get("lat")
  lon = meta.get("lon")
  if lat in (None, "", -1) or lon in (None, "", -1):
    return None

  try:
    lat = float(lat)
    lon = float(lon)
  except Exception:
    return None

  week = meta.get("week")
  if week in (None, "", -1):
    week = None
  else:
    try:
      week = int(week)
    except Exception:
      week = None

  min_confidence = meta.get("sf_thresh", meta.get("min_conf", 0.03))
  try:
    min_confidence = float(min_confidence)
  except Exception:
    min_confidence = 0.03

  geo_result = geo_model.predict(lat, lon, week=week, min_confidence=min_confidence)
  predictions = to_ordered_predictions(geo_result, top_k=512)
  whitelist = [species for species, _score in predictions]
  return whitelist or None


def clamp_int(value, default, min_value, max_value):
  try:
    number = int(value)
  except Exception:
    return default
  return max(min_value, min(max_value, number))


def clamp_float(value, default, min_value, max_value):
  try:
    number = float(value)
  except Exception:
    return default
  return max(min_value, min(max_value, number))


@app.get("/")
def root():
  return {
    "msg": "ok",
    "provider": "birdnet",
    "version": APP_VERSION,
    "model_version": MODEL_VERSION,
    "health_path": "/health",
  }


@app.get("/health")
def health():
  return {
    "msg": "ok",
    "provider": "birdnet",
    "version": APP_VERSION,
    "model_version": MODEL_VERSION,
    "host": os.getenv("BIRDNET_HOST", "127.0.0.1"),
    "port": int(os.getenv("BIRDNET_PORT", "8787")),
    "birdnet_app_data": os.environ.get("BIRDNET_APP_DATA"),
    "max_upload_mb": MAX_UPLOAD_MB,
    "auth_required": bool(SERVER_TOKEN),
  }


@app.post("/analyze")
def analyze():
  request_id = uuid.uuid4().hex[:12]
  auth_error = ensure_authorized(request_id)
  if auth_error:
    return auth_error

  if request.content_length and request.content_length > MAX_UPLOAD_MB * 1024 * 1024:
    return json_error(
      413,
      "payload_too_large",
      request_id=request_id,
      detail=f"Upload exceeds {MAX_UPLOAD_MB} MB limit.",
    )

  try:
    meta = parse_json_meta()
  except Exception as exc:
    return json_error(400, "invalid_meta", detail=str(exc), request_id=request_id)

  upload = resolve_upload()
  if upload is None:
    return json_error(400, "missing_audio", request_id=request_id)

  locale = str(meta.get("locale") or DEFAULT_LOCALE).strip().lower()
  lang = "en_us" if locale.startswith("en") else "fr"
  acoustic_model, geo_model = get_models(lang)

  num_results = clamp_int(meta.get("num_results", 5), 5, 1, 10)
  sensitivity = clamp_float(meta.get("sensitivity", 1.0), 1.0, 0.5, 1.5)
  overlap = clamp_float(meta.get("overlap", 0.0), 0.0, 0.0, 2.9)
  default_conf = clamp_float(meta.get("min_conf", 0.1), 0.1, 0.0, 0.99)
  species_whitelist = build_geo_whitelist(geo_model, meta)

  suffix = Path(upload.filename or "clip.webm").suffix or ".webm"
  started_at = time.monotonic()
  with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
    upload.save(tmp_file)
    temp_path = tmp_file.name

  try:
    prediction_result = acoustic_model.predict(
      temp_path,
      top_k=num_results,
      overlap_duration_s=overlap,
      sigmoid_sensitivity=sensitivity,
      default_confidence_threshold=default_conf,
      custom_species_list=species_whitelist,
      device="CPU",
    )
    predictions = to_ordered_predictions(prediction_result, top_k=num_results)
  except PermissionError as exc:
    return json_error(
      503,
      "shared_memory_not_available",
      detail=str(exc),
      request_id=request_id,
      hint="BirdNET local requires POSIX shared memory on this host. Prefer a more permissive runtime or another machine.",
    )
  except Exception as exc:
    return json_error(500, "inference_failed", detail=str(exc), request_id=request_id)
  finally:
    try:
      os.remove(temp_path)
    except OSError:
      pass

  latency_ms = int((time.monotonic() - started_at) * 1000)
  return {
    "msg": "success",
    "request_id": request_id,
    "provider": "birdnet",
    "model_version": MODEL_VERSION,
    "locale": lang,
    "latency_ms": latency_ms,
    "results": [[species, score] for species, score in predictions],
    "meta": {
      "num_results": num_results,
      "sensitivity": sensitivity,
      "overlap": overlap,
      "min_conf": default_conf,
      "whitelist_size": len(species_whitelist or []),
    },
  }


def run_server():
  run(
    app=app,
    host=os.getenv("BIRDNET_HOST", "127.0.0.1"),
    port=int(os.getenv("BIRDNET_PORT", "8787")),
    debug=False,
    reloader=False,
  )


if __name__ == "__main__":
  run_server()
