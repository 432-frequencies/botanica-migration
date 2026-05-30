# BirdNET Remote Service

Deployable BirdNET HTTP service for W1LD audio identification.

## What it exposes

- `GET /health`
- `POST /analyze`

`POST /analyze` expects:

- multipart field `audio` or `file`
- multipart field `meta` containing JSON

Example `meta`:

```json
{
  "lat": 48.8566,
  "lon": 2.3522,
  "week": 10,
  "num_results": 5,
  "min_conf": 0.0,
  "locale": "fr"
}
```

## Recommended environment variables

- `BIRDNET_SERVER_TOKEN`
- `BIRDNET_MAX_UPLOAD_MB`
- `BIRDNET_APP_DATA`
- `BIRDNET_MODEL_VERSION`
- `BIRDNET_DEFAULT_LOCALE`

## Docker build

```bash
docker build -f services/birdnet-api/Dockerfile -t w1ld-birdnet .
```

## Docker run

```bash
docker run --rm -p 8080:8080 \
  -e BIRDNET_SERVER_TOKEN=change-me \
  -e BIRDNET_APP_DATA=/var/lib/birdnet \
  w1ld-birdnet
```

Then set the main app env:

```bash
BIRDNET_API_URL=https://your-birdnet-host.example.com/analyze
BIRDNET_API_TOKEN=change-me
```

## Notes

- This service is intended for a separate runtime, not for Vercel Functions.
- W1LD keeps Gemini as fallback when BirdNET is unavailable or too uncertain.
- BirdNET source code is MIT, but BirdNET model licensing must be reviewed separately before commercial rollout.
