FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BIRDNET_HOST=0.0.0.0 \
    BIRDNET_PORT=8080 \
    BIRDNET_APP_DATA=/var/lib/birdnet

WORKDIR /app

COPY services/birdnet-api/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

COPY services/__init__.py /app/services/__init__.py
COPY services/birdnet_service.py /app/services/birdnet_service.py

RUN mkdir -p /var/lib/birdnet

EXPOSE 8080

CMD ["sh", "-lc", "gunicorn --workers 1 --threads 4 --bind 0.0.0.0:${PORT:-8080} services.birdnet_service:app"]
