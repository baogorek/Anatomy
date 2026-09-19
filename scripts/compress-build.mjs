import { readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

async function compress(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await compress(path);
    else if (/\.(?:js|css|html|json|svg|txt|md|ris|wasm|glb)$/.test(entry.name)) {
      const data = await readFile(path);
      const compressed = gzipSync(data, { level: 9 });
      if (compressed.length < data.length) await writeFile(`${path}.gz`, compressed);
    }
  }
}
await compress("dist");
