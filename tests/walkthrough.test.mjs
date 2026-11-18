import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapters, exampleSearch, findStep, matchesExample, steps } from '../src/walkthrough/chapters.mjs';

test('Walkthrough step IDs and chapter links resolve to distinct live scenes', () => {
  assert.equal(chapters.length, 6);
  assert.equal(new Set(steps.map(step => step.id)).size, steps.length);
  for (const chapter of chapters) {
    assert.equal(steps[findStep(chapter.id)].id, chapter.steps[0].id);
    for (const step of chapter.steps) {
      assert.equal(steps[findStep(step.id)].path, step.path);
      assert.ok(step.path.startsWith('/') && step.title && step.target && step.text && step.instruction);
    }
  }
  assert.equal(findStep('invalid-chapter'), -1);
});

test('Restoring an example sets only its controlled parameters and preserves unrelated filters', () => {
  const step = steps[findStep('chase')];
  const search = exampleSearch(step, '?domain=T20I&S=100&unrelated=retained&tour=opening');
  const query = new URLSearchParams(search);
  assert.equal(query.get('tour'), 'chase');
  assert.equal(query.get('unrelated'), 'retained');
  assert.equal(query.get('domain'), 'IPL');
  assert.equal(query.get('S'), '168');
  assert.equal(matchesExample(step, search), true);
  query.set('S', 120);
  assert.equal(matchesExample(step, query), false);
  const ranking = steps[findStep('frozen-order')];
  assert.equal(new URLSearchParams(exampleSearch(ranking, '?q=Kishan&tier=2')).has('q'), false);
});
