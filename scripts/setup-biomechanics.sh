#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v uv >/dev/null 2>&1; then
  if [ ! -x .venv-opensim/bin/python ]; then uv venv --python 3.12 .venv-opensim; fi
  .venv-opensim/bin/python scripts/verify-opensim-wheel.py
  uv pip install --python .venv-opensim/bin/python --reinstall-package opensim -r biomechanics/requirements.txt
else
  python3 -m venv .venv-opensim
  .venv-opensim/bin/python scripts/verify-opensim-wheel.py
  .venv-opensim/bin/python -m pip install --force-reinstall -r biomechanics/requirements.txt
fi
.venv-opensim/bin/python scripts/fetch-hip-geometry.py
.venv-opensim/bin/python biomechanics/verify_assets.py
.venv-opensim/bin/python biomechanics/runtime.py
