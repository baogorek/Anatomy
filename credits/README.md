# Public credits

The canonical citation catalog is `catalog.json`; verified publication metadata is `publications.json`. `npm run credits` builds `public/credits/index.html`, the RIS bibliography, exact source/version record and preserved notices. The page is plain HTML/CSS and works without JavaScript or the OpenSim service. `--check` compares generated output byte for byte without writing.

Publication titles, DOIs, journal details and author lists were checked against the linked papers and PubMed/Europe PMC records on September 18, 2026. Publication records include their verification URLs. Saul et al. is cited as the 2015 journal issue, despite its 2014 online publication date; the repeated Velisar author in the retrieved index was deduplicated against the paper and author notice. Lai et al. uses DOI `10.1007/s10439-017-1920-7`, matching PMID 28900782.

Source papers establish the models’ provenance. They do not validate the app’s longest-path solver, arbitrary slider combinations or safe stretching. The catalog identifies local adaptations separately and distinguishes source-project terms from researcher mirrors. No new license is inferred for the unresolved hip meshes.

## Preserved notices

Model notices are copied directly from the existing pinned `biomechanics/models` files, including the neck mirror notice and ECRL adaptation patch. They are not edited or replaced. Browser-library notices come from the exact installed packages during the build and include React, React DOM, Scheduler, Three.js, Lucide and Draco.

The four OpenSim/Simbody/spdlog snapshots in `notices/` were extracted unchanged from the wheel identified in `biomechanics/runtime-manifest.json`:

| Snapshot | Wheel member |
| --- | --- |
| opensim-LICENSE.txt | opensim/LICENSE.txt |
| opensim-NOTICE.txt | opensim/NOTICE |
| simbody-LICENSE.txt | opensim/SIMBODY-LICENSE.txt |
| spdlog-LICENSE.txt | opensim/SPDLOG-LICENSE.txt |

The wheel SHA-256 is `74f1cdc7eac3fb853eeae1f3285e3354ffec23e8bfd09da325e09f5c0f442fbd`. `numpy-LICENSE.txt` was copied from the installed NumPy 2.5.3 distribution’s `numpy-2.5.3.dist-info/licenses/LICENSE.txt`, including its bundled-component notices. Refresh these snapshots when replacing native dependencies; do not rebrand upstream authors or their version identifiers.

The generated provenance file includes notice hashes, native model/geometry pins, model checksums, the native runtime identity and atlas identity. It includes metadata only; this generator does not publish the local hip VTP files.

The Gunicorn 26.2.0 and Packaging 26.0 notices are unmodified snapshots from each installed distribution’s `dist-info/licenses` directory. Their versions are pinned in `biomechanics/requirements-production.txt`.

## Maintenance

1. Update the catalog when adding a source, changing a reference or adapting a model. Every model in the pinned manifest must have a credits entry; generation fails otherwise.
2. Preserve the original licenses, copyrights and required citations. A link to a paper is not a replacement for its model’s license notice.
3. Regenerate with `npm run credits` and review the generated page and provenance diff.
4. Run `npx playwright test tests/credits.spec.ts` to check the public page, local links, license bytes, source pins and mobile accessibility.

No network lookup is required to build or view the bundled notices. External publications and upstream repositories require internet access. Font projects link to their upstream authors and notices because the interface currently loads those fonts from Google Fonts rather than distributing local font files.
