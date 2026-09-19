FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN MOVEMENT_LAB_BASE=/movement-lab/ npm run build
RUN node scripts/compress-build.mjs

# Match the pinned native wheel's Ubuntu 24.04 / Python 3.12 build environment.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv libblas3 liblapack3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY biomechanics ./biomechanics
COPY scripts/verify-opensim-wheel.py scripts/fetch-hip-geometry.py ./scripts/
RUN python3.12 -m venv /opt/venv \
    && /opt/venv/bin/python scripts/verify-opensim-wheel.py \
    && /opt/venv/bin/pip install --no-cache-dir -r biomechanics/requirements-production.txt \
    && /opt/venv/bin/python scripts/fetch-hip-geometry.py \
    && /opt/venv/bin/python biomechanics/verify_assets.py \
    && /opt/venv/bin/python biomechanics/runtime.py \
    && rm -rf biomechanics/wheels
COPY --from=frontend /app/dist ./dist
COPY deploy/gunicorn.conf.py ./deploy/gunicorn.conf.py
RUN useradd --system --uid 10001 --create-home movement && chown -R movement:movement /app
USER movement
EXPOSE 8080
CMD ["/opt/venv/bin/gunicorn", "--config", "deploy/gunicorn.conf.py", "service:application"]
