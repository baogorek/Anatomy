# Gastrocnemius wrap-cache diagnostic

This is an isolated proof of the proposed native cache fix. It does **not** alter
the installed OpenSim library, the running app, or the source model.

To reproduce the historical comparison, use a separate environment containing the original PyPI OpenSim 4.6 wheel, NumPy 2.5.3 and `g++`. The runner deliberately rejects the corrected app package. From the repository root:

```bash
/path/to/stock-env/bin/python biomechanics/diagnostics/wrap-cache/run.py > /tmp/gastrocnemius-cache-comparison.json
```

The runner verifies both installed library checksums, compiles a temporary Linux
interposer, and starts separate stock and diagnostic Python processes. The latter
invalidates inherited Point caches immediately after each native
`PathWrapPoint::setLocation` call. The interposer uses the recorded wheel's C++ ABI;
the Component/base pointer equivalence was checked through SWIG. It is a diagnostic
instrument, not an application dependency or a portable replacement library.

The cache patch is now compiled into the app's pinned native package. `package-version.patch` labels that build, includes license/provenance files in its wheel, and permits omitting the desktop visualizer during installation. `scripts/build-opensim.sh` reproduces the build. Run `npm run test:biomechanics` to check the installed package directly, without an interposer.

`probe.py` checks 915 grid positions (61 knee angles × 5 ankle angles × 3 subtalar
angles), 100 seeded combinations of all six lower-limb controls, repeated visits,
and 72 moment-arm/finite-difference comparisons. It evaluates the two gastrocnemius
heads using the unchanged model. The recorded [results](../../reports/gastrocnemius-wrap-cache.json)
also include a separate successful run of the existing full native validation
suite under the diagnostic patch, with its output isolated in a temporary folder.

See [the explanation and proposed remedy](../../reports/GASTROCNEMIUS_CACHE.md).
