/* global document, innerWidth */
// Run against an open PRISM page with playwright-cli run-code --filename tests/browser/walkthrough.js.
async page => {
  const origin = new URL(page.url()).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  const controller = page.getByRole('complementary', { name: 'Walkthrough controller' });
  const action = name => controller.getByRole('button', { name, exact: true });
  const target = name => page.locator('[data-tour="' + name + '"]');
  const highlight = name => page.locator('[data-highlighted-mark="' + name + '"]');
  const waitText = async (locator, text) => {
    await locator.filter({ hasText: text }).first().waitFor({ state: 'visible', timeout: 8000 });
  };
  async function scene(id, anchor, title) {
    await page.waitForURL(url => url.searchParams.get('tour') === id);
    await controller.getByRole('heading', { name: title }).waitFor();
    await target(anchor).waitFor({ state: 'visible' });
    const outline = page.locator('[data-spotlight="' + anchor + '"]');
    await outline.waitFor();
    await page.waitForFunction(name => {
      const spot = document.querySelector('[data-spotlight="' + name + '"]').getBoundingClientRect();
      const mobile = innerWidth <= 690 && document.querySelector('[data-tour-mobile="' + name + '"]');
      const targetBox = (mobile || document.querySelector('[data-tour="' + name + '"]')).getBoundingClientRect();
      const panel = document.querySelector('.tour-controller').getBoundingClientRect();
      const room = document.querySelector('.workspace').getBoundingClientRect();
      const separated = innerWidth >= 1200 ? room.right <= panel.left && spot.right <= panel.left
        : room.top >= panel.bottom && spot.top >= panel.bottom;
      return panel.top < 40 && panel.right > innerWidth - 32 && separated
        && Math.abs(spot.left - targetBox.left) < 10 && spot.height > 0;
    }, anchor, { timeout: 5000 }).catch(error => { throw new Error(id + ' spotlight: ' + error.message); });
  }
  const screenshot = name => page.screenshot({ path: '.playwright-cli/tour-' + name + '.png' });
  const frozen = async () => {
    const response = await page.request.get(origin + '/api/snapshot');
    return (await response.json()).finalists;
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin);
  const before = await frozen();
  const start = page.getByRole('button', { name: /Explore PRISM/ });
  await start.focus();
  await page.keyboard.press('Enter');
  await scene('opening', 'tour-opening', 'Why the same four can mean more');
  await page.waitForFunction(() => document.activeElement.id === 'tour-heading');
  await page.keyboard.press('Escape');
  await controller.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement.classList.contains('tour-entry'), null, { timeout: 5000 });
  await start.click();
  await action('Open the simulator').click();
  await scene('chase', 'pressure-controls', 'Start with 12 from 6');
  await waitText(controller.locator('.tour-instruction'), '“12 from 6”');
  await action('Show evidence').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.activeElement.dataset.tour === 'pressure-controls');
  const preset = name => page.getByRole('button', { name: new RegExp(name) });
  await preset('60 from 6').click();
  await waitText(controller, 'You’ve changed the live controls');
  await waitText(controller.locator('.tour-instruction'), 'go back to 12 from 6');
  await action('Restore example').click();
  assert(await preset('12 from 6').getAttribute('aria-pressed') === 'true', 'Restore should reapply the real preset');
  await action('Read the classification').click();
  await scene('readout', 'pressure-readout', 'Why 12 from 6 counts as pressure');
  for (const value of ['Pressure', '1.04', '2.00', '1.92', '4.62']) await waitText(target('pressure-readout'), value);
  await screenshot('pressure-desktop');
  await action('Try 60 from 6').click();
  await scene('ceiling', 'pressure-readout', 'Why 60 from 6 is treated differently');
  for (const value of ['Ordinary', '10.00', '4.62']) await waitText(target('pressure-readout'), value);
  await action('Previous step').click();
  await scene('readout', 'pressure-readout', 'Why 12 from 6 counts as pressure');
  await action('Try 60 from 6').click();
  await action('Inspect the gates').click();
  await scene('gates', 'pressure-gates', 'Which rule did the chase fail?');
  await waitText(target('pressure-gates'), 'Scoring plausibility');

  await action('Next step').click();
  await scene('pressure-four', 'russell-example', 'How much extra did Russell add?');
  await waitText(target('russell-example'), '2.28');
  await highlight('Observed').waitFor();
  await action('Switch to the ordinary four').click();
  await scene('ordinary-four', 'russell-example', 'Same four, smaller gain');
  await waitText(target('russell-example'), '2.11');
  await highlight('Expected').waitFor();
  await action('Open the original delivery').click();
  await scene('source-delivery', 'event-outcome', 'See the original ball');
  await waitText(target('event-outcome'), 'Observed 4');
  await action('See the four measures').click();
  await scene('native-units', 'components', 'How PRISM measures batting and bowling');

  await action('Next step').click();
  await scene('frozen-order', 'ranking-order', 'How PRISM ranks players');
  await action('Next step').click();
  await scene('batting-guess', 'comparison-rates', 'Who would you rank first?');
  await highlight('Raw').waitFor();
  assert(await controller.getByRole('list', { name: 'After adjustment' }).count() === 0, 'The explanation should follow the prediction');
  await action('Ishan Kishan').click();
  await scene('batting-reveal', 'comparison-rates', 'Why Russell moves ahead');
  await highlight('Shrunken').waitFor();
  const beforeOrder = controller.getByRole('list', { name: 'Before adjustment' });
  const afterOrder = controller.getByRole('list', { name: 'After adjustment' });
  await waitText(beforeOrder.getByRole('listitem').first(), 'Ishan Kishan');
  await waitText(afterOrder.getByRole('listitem').first(), 'Andre Russell');
  await waitText(beforeOrder, '+49.60');
  await waitText(afterOrder, '+31.36');
  await waitText(page.getByRole('table', { name: 'Player comparison' }), '31.36');
  await waitText(page.getByRole('table', { name: 'Player comparison' }), '18.24');
  await screenshot('comparison-desktop');
  await action('Next step').click();
  await scene('batting-exposure', 'comparison-matches', 'How many matches tell the story?');
  await action('Next step').click();
  await scene('bowling-reveal', 'comparison-rates', 'Why Bumrah moves ahead');
  await waitText(beforeOrder.getByRole('listitem').first(), 'Sunil Narine');
  await waitText(afterOrder.getByRole('listitem').first(), 'Jasprit Bumrah');
  await waitText(page.getByRole('table', { name: 'Player comparison' }), '19.91');
  await waitText(page.getByRole('table', { name: 'Player comparison' }), '11.87');
  await action('Next step').click();
  await scene('ordinary-baseline', 'comparison-uplift', 'Can a good pressure score be below your usual?');
  await highlight('Native uplift').waitFor();
  await waitText(target('comparison-uplift'), 'Mustafizur Rahman');

  await action('Next step').click();
  await scene('match-weight', 'reliability-distribution', 'One big game or several good ones?');
  await highlight('Andre Russell').waitFor();
  await screenshot('reliability-desktop');
  await action('Pause walkthrough').click();
  await page.locator('[data-spotlight]').waitFor({ state: 'hidden' });
  await action('Resume walkthrough').click();
  await page.locator('[data-spotlight]').waitFor();
  await action('Next step').click();
  await scene('best-removed', 'reliability-case', 'Take away the best game');
  await waitText(target('reliability-case'), '237');
  await action('Next step').click();
  await scene('coetzee', 'candidate-coetzee', 'Why Coetzee missed the cutoff');
  await waitText(target('candidate-coetzee'), '55 attempts');
  await action('Next step').click();
  await scene('henry', 'comparison-rates', 'How close was the last spot?');
  await waitText(page.getByRole('table', { name: 'Player comparison' }), '5.75');
  await action('Next step').click();
  await scene('threshold', 'candidate-threshold', 'Try raising the minimum');
  await page.getByRole('button', { name: 'Set ordinary attempts to 120' }).click();
  await waitText(controller, 'You’ve changed the live controls');
  await action('Apply 120 attempts').click();
  await scene('threshold-result', 'candidate-threshold', 'Who comes in, who drops out?');
  await waitText(target('candidate-threshold'), 'In: Ruturaj Gaikwad');
  await waitText(target('candidate-threshold'), 'Out: Akeal Hosein');

  await action('Next step').click();
  await scene('policies', 'policy-orders', 'What if PRISM ranked players differently?');
  await page.getByLabel('Policy', { exact: true }).selectOption('P1');
  await waitText(controller, 'You’ve changed the live controls');
  await action('Read the retrospective').click();
  await scene('retrospective', 'policy-replay', 'Which list held up in later matches?');
  await page.getByRole('img', { name: /3 Favors D.1.*0 Favors P3.*5 Inconclusive.*8 Insufficient/ }).waitFor();
  await action('Next step').click();
  await scene('findings', 'research-findings', 'Why PRISM kept the original list');
  await action('Next step').click();
  await scene('final-twenty', 'selected-twenty', 'The final twenty');
  assert(await target('selected-twenty').locator('.mini-row').count() === 20, 'All twenty finalists must be in the final scene');
  assert(await target('selected-twenty').evaluate(element =>
    element.getBoundingClientRect().right <= document.querySelector('.tour-controller').getBoundingClientRect().left),
  'The complete final ranking should sit beside the desktop panel');
  await screenshot('final-desktop');
  await action('Inspect the rankings').click();
  await page.waitForURL('**/rankings');
  await controller.waitFor({ state: 'hidden' });
  assert(JSON.stringify(await frozen()) === JSON.stringify(before), 'Tour must preserve the frozen finalists');

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(origin + '/?tour=shrinkage');
  await scene('frozen-order', 'ranking-order', 'How PRISM ranks players');
  await action('Next step').click();
  await scene('batting-guess', 'comparison-rates', 'Who would you rank first?');
  await screenshot('comparison-laptop');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin + '/pressure?tour=chase');
  await scene('chase', 'pressure-controls', 'Start with 12 from 6');
  const mobileLayout = await page.evaluate(() => {
    const shelf = document.querySelector('.tour-controller').getBoundingClientRect();
    const dock = document.querySelector('.dock').getBoundingClientRect();
    const workspace = document.querySelector('.workspace').getBoundingClientRect();
    const presetBlock = document.querySelector('[data-tour-mobile="pressure-controls"]').getBoundingClientRect();
    return shelf.bottom <= workspace.top && workspace.bottom <= dock.top && presetBlock.bottom <= workspace.bottom
      && presetBlock.top >= workspace.top
      && document.documentElement.scrollWidth <= innerWidth;
  });
  assert(mobileLayout, 'The controller, workspace and navigation must fit without overlap on mobile');
  await screenshot('pressure-mobile');
  await controller.getByLabel('Jump to chapter').selectOption('4');
  await scene('match-weight', 'reliability-distribution', 'One big game or several good ones?');
  await screenshot('reliability-mobile');
  await page.goto(origin + '/compare?tour=batting-reveal');
  await scene('batting-reveal', 'comparison-rates', 'Why Russell moves ahead');
  await waitText(afterOrder.getByRole('listitem').first(), 'Andre Russell');
  const mobileExplanationFits = await controller.locator('.tour-context').evaluate(element =>
    element.getBoundingClientRect().bottom <= element.closest('.tour-body').getBoundingClientRect().bottom);
  assert(mobileExplanationFits, 'The full ranking explanation should be visible on mobile');
  await screenshot('order-mobile');
  await action('Restart walkthrough').click();
  await scene('opening', 'tour-opening', 'Why the same four can mean more');
  await page.getByRole('link', { name: 'See the methodology' }).click();
  await waitText(controller, 'You’re exploring another page');
  await action('Return to example').click();
  await scene('opening', 'tour-opening', 'Why the same four can mean more');
  await action('Skip tour').click();
  await controller.waitFor({ state: 'hidden' });

  await page.route('**/api/research/methods', route => route.fulfill({ json: { examples: [], shrinkage: [], chronology: [] } }));
  await page.goto(origin + '/?tour=contribution');
  await waitText(controller, 'This evidence is unavailable');
  assert(await page.locator('[data-spotlight]').count() === 0, 'Missing evidence should have no spotlight');
  await action('Skip step').click();
  await page.waitForURL(url => url.searchParams.get('tour') === 'ordinary-four');
  await page.unroute('**/api/research/methods');

  await page.goto(origin + '/compare?d=batting&ids=4736,6059&custom=keep&tour=batting-reveal');
  await scene('batting-reveal', 'comparison-rates', 'Why Russell moves ahead');
  await action('Exit walkthrough').click();
  await page.waitForURL(url => url.searchParams.get('ids') === '4736,6059' && url.searchParams.get('custom') === 'keep' && !url.searchParams.has('tour'));

  await page.goto(origin + '/findings');
  await page.getByRole('button', { name: 'Open command palette' }).click();
  const search = page.getByRole('combobox', { name: 'Search pages, player names or official IDs' });
  await search.fill('take tour');
  await search.press('Enter');
  await scene('opening', 'tour-opening', 'Why the same four can mean more');
  assert(errors.length === 0, 'Unexpected browser errors: ' + errors.join(' | '));
  return 'Passed all six chapters, evidence values, highlighted marks, restoration, desktop/laptop/mobile, keyboard and missing-data checks.';
}
