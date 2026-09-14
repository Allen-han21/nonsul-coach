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
const publicQuestions = JSON.parse(
  await readFile('lib/question-content.json', 'utf8'),
);
const canonical = JSON.parse(
  await readFile('../docs/evaluation/source.json', 'utf8'),
);
assert.deepEqual(
  official,
  canonical,
  'Server source data has diverged from the reviewed source',
);
assert.deepEqual(Object.keys(publicQuestions).sort(), [
  'actual',
  'actual2',
  'mock',
  'source',
]);
assert.deepEqual(publicQuestions.actual.instructions, official.instructions);
assert.deepEqual(publicQuestions.actual.passages, official.passages);
assert.deepEqual(publicQuestions.actual.questions, official.questions);
assert.deepEqual(
  publicQuestions.actual2.instructions,
  official.actual2.instructions,
);
assert.deepEqual(publicQuestions.actual2.passages, official.actual2.passages);
assert.deepEqual(publicQuestions.actual2.questions, official.actual2.questions);
assert.deepEqual(publicQuestions.mock.instructions, official.mock.instructions);
assert.deepEqual(publicQuestions.mock.passages, official.mock.passages);
assert.deepEqual(publicQuestions.mock.questions, official.mock.questions);
for (const internalKey of ['examples', 'rubricText', 'commentary', 'intent'])
  assert.ok(
    !Object.hasOwn(publicQuestions.actual, internalKey) &&
      !Object.hasOwn(publicQuestions.actual2, internalKey) &&
      !Object.hasOwn(publicQuestions.mock, internalKey),
    'Internal key ' + internalKey + ' must not be exposed as question content',
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
for (const example of [
  ...official.examples,
  ...official.actual2.examples,
  ...official.mock.examples,
]) {
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
assert.ok(
  publicFiles.some((file) =>
    file.endsWith('/official/sungshin-2026-population-board-000.jpg'),
  ),
  'Official population figure is missing from the client build',
);
console.log(
  `Build boundary verified: ${publicFiles.length} public assets, public questions match the canonical source, and no official examples or credential settings reached the client.`,
);
