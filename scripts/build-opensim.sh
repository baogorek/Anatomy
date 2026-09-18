#!/usr/bin/env bash
# Build the local Linux/Python 3.12 package from pinned sources. No interposer.
set -euo pipefail
cd "$(dirname "$0")/.."
task_root="$PWD"
task_build="$task_root/.build-opensim"
task_source="$task_build/source"
task_commit="85aaf6450a2f22457dac4d1ab35adfed9d3a8e43"
mkdir -p "$task_build"
if [ ! -x "$task_build/tools/bin/python" ]; then
  uv venv --python 3.12 "$task_build/tools"
fi
uv pip install --python "$task_build/tools/bin/python" \
  cmake==3.31.6 ninja==1.11.1.4 swig==4.3.1 patchelf==0.17.2.2 wheel==0.45.1 setuptools==80.9.0 numpy==2.5.3
export PATH="$task_build/tools/bin:$PATH"
export CMAKE_BUILD_PARALLEL_LEVEL="${KINETIC_BUILD_JOBS:-4}"
if [ ! -d "$task_source/.git" ]; then
  git clone --filter=blob:none --no-checkout https://github.com/opensim-org/opensim-core.git "$task_source"
  git -C "$task_source" checkout --detach "$task_commit"
fi
test "$(git -C "$task_source" rev-parse HEAD)" = "$task_commit"
for task_patch in opensim-85aaf64-wrap-cache.patch package-version.patch; do
  task_patch_path="$task_root/biomechanics/diagnostics/wrap-cache/$task_patch"
  if git -C "$task_source" apply --check "$task_patch_path" 2>/dev/null; then
    git -C "$task_source" apply "$task_patch_path"
  else
    git -C "$task_source" apply --reverse --check "$task_patch_path"
  fi
done
cmake -S "$task_source/dependencies" -B "$task_build/dependencies-build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$task_build/dependencies" \
  -DSUPERBUILD_ezc3d=OFF -DSUPERBUILD_catch2=OFF -DOPENSIM_WITH_CASADI=OFF \
  '-DSIMBODY_EXTRA_CMAKE_ARGS=-DBUILD_VISUALIZER:BOOL=OFF'
cmake --build "$task_build/dependencies-build" --parallel "$CMAKE_BUILD_PARALLEL_LEVEL"
test "$(git -C "$task_source/dependencies/simbody" rev-parse HEAD)" = "80a3f10a6daa26c8aaf18f2c672cf385b227e62c"
test "$(git -C "$task_source/dependencies/spdlog" rev-parse HEAD)" = "6fa36017cfd5731d617e1a934f0e5ea9c4445b13"
cmake -S "$task_source" -B "$task_build/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$task_build/install" \
  -DOPENSIM_DEPENDENCIES_DIR="$task_build/dependencies" \
  -DBUILD_PYTHON_WRAPPING=ON -DBUILD_PYTHON_WHEELS=ON -DBUILD_JAVA_WRAPPING=OFF \
  -DBUILD_TESTING=OFF -DBUILD_API_ONLY=ON -DOPENSIM_WITH_CASADI=OFF \
  -DOPENSIM_INSTALL_UNIX_FHS=OFF -DOPENSIM_DISABLE_LOG_FILE=ON \
  -DOPENSIM_INSTALL_VISUALIZER=OFF \
  -DOPENSIM_DOXYGEN_USE_MATHJAX=OFF -DSWIG_DOXYGEN=OFF \
  -DPython3_EXECUTABLE="$task_build/tools/bin/python" \
  -DSWIG_EXECUTABLE="$task_build/tools/bin/swig"
cmake --build "$task_build/build" --target install --parallel "$CMAKE_BUILD_PARALLEL_LEVEL"
"$task_build/tools/bin/python" scripts/package-opensim.py
echo "Wheel built in .build-opensim/wheels. Verify it in an isolated environment before updating the bundled runtime manifest."
