import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : path.join(directory, entry.name),
      ),
    )
  ).flat();
}
const official = JSON.parse(await readFile('lib/server/official.json', 'utf8'));
const canonical = JSON.parse(
  await readFile('../docs/evaluation/source.json', 'utf8'),
);
assert.deepEqual(
  official,
  canonical,
  'Server source data has diverged from the reviewed source',
);
const publicFiles = await files('dist/client');
assert.ok(
  !publicFiles.some((file) => /official\.json|\.pdf$|\.map$|\.env/.test(file)),
  'Internal sources must not be public',
);
const contents = (
  await Promise.all(
    publicFiles
      .filter((file) => /\.(js|html|json)$/.test(file))
      .map((file) => readFile(file, 'utf8')),
  )
).join('\n');
const compact = (value) => value.normalize('NFC').replace(/\s/g, '');
for (const example of [...official.examples, ...official.mock.examples]) {
  assert.ok(
    !compact(contents).includes(compact(example).slice(0, 70)),
    'Official example leaked into the browser bundle',
  );
}
for (const internal of [
  'OPENAI_API_KEY',
  'ANALYSIS_RETENTION_CONFIRMED',
  'internalExample',
  'fake-test-key',
])
  assert.ok(
    !contents.includes(internal),
    'Internal runtime material reached the browser',
  );
await readFile('dist/server/index.js');
await readFile('dist/.openai/hosting.json');
assert.ok(publicFiles.some((file) => file.endsWith('/og.png')));
console.log(
  `Build boundary verified: ${publicFiles.length} public assets, canonical sources match, no official examples or credential settings in client output.`,
);
