import { pressurePresets } from '../pressure-presets.mjs';

function historicalChase(label) {
  const { label: _label, ...state } = pressurePresets.find(preset => preset.label === label);
  return { ...state, domain: 'IPL', date: '2026-05-31' };
}

const twelve = historicalChase('12 from 6');
const sixty = historicalChase('60 from 6');
const battingPair = { d: 'batting', ids: '1318,4117' };
const russellDelivery = { d: 'batting', player: 1318, component: 'batting_runs', innings: '', state: '' };
const bowlingBoundary = { d: 'bowling', q: '', filter: 'all', page: '', minP: 60, minO: 60, minM: 5 };
const battingBoundary = { d: 'batting', q: '', filter: 'all', page: '', minP: 60, minM: 10 };

export const chapters = [
  { id: 'pressure', title: 'What does pressure really mean?', steps: [
    { id: 'opening', path: '/', target: 'tour-opening', title: 'Why the same four can mean more',
      instruction: 'Open the simulator to see a team that needs 12 runs from the last 6 balls.',
      text: 'A boundary always adds four runs. PRISM asks how valuable those four were given the score, wickets, and balls left.', next: 'Open the simulator' },
    { id: 'chase', path: '/pressure', params: twelve, target: 'pressure-controls', title: 'Start with 12 from 6',
      instruction: 'Find the selected “12 from 6” preset. Next, see why the dashboard calls it Pressure.',
      changedInstruction: 'Check the live classification for your preset. Select “Read the classification” to go back to 12 from 6.',
      text: 'The team starts on 168 for three and needs 12 runs off six balls to reach 180.', next: 'Read the classification' },
    { id: 'readout', path: '/pressure', params: twelve, target: 'pressure-readout', title: 'Why 12 from 6 counts as pressure',
      instruction: 'Find 2.00 under “Required.” The historical midpoint is 1.92 runs per ball.',
      text: 'The chase asks for a faster pace than usual and is still within what past teams have scored. PRISM labels it Pressure.', next: 'Try 60 from 6' },
    { id: 'ceiling', path: '/pressure', params: sixty, target: 'pressure-readout', title: 'Why 60 from 6 is treated differently',
      instruction: 'Compare “Required” (10.00 runs a ball) with the historical limit (4.62, labeled “99th percentile”).',
      text: 'The chase is beyond the scoring pace PRISM considers realistic. The dashboard uses “Ordinary” for this example because the pressure rule requires a realistic chase.', next: 'Inspect the gates' },
    { id: 'gates', path: '/pressure', params: sixty, target: 'pressure-gates', title: 'Which rule did the chase fail?',
      instruction: 'Find the Fail marker next to “Scoring plausibility.”',
      text: '“Scoring plausibility” asks whether the team can realistically score that fast, based on earlier matches. The 60-from-6 chase fails that check.' },
  ] },
  { id: 'contribution', title: 'What is a good performance worth?', steps: [
    { id: 'pressure-four', path: '/methodology', params: { example: 'pressure' }, target: 'russell-example', highlight: 'observed', title: 'How much extra did Russell add?',
      instruction: 'Compare the “Observed” bar (what happened) with “Expected” (what PRISM predicted before the ball).',
      text: 'Russell hit four when PRISM expected about 1.72 runs. That works out to 2.28 extra runs.', next: 'Switch to the ordinary four' },
    { id: 'ordinary-four', path: '/methodology', params: { example: 'ordinary' }, target: 'russell-example', highlight: 'expected', title: 'Same four, smaller gain',
      instruction: 'Check the subtraction below the bars.',
      text: 'Russell hit four again. This time PRISM expected about 1.89 runs, so the gain was 2.11. The same hit helped a little less here.', next: 'Open the original delivery' },
    { id: 'source-delivery', path: '/matches/20202', params: { ...russellDelivery, row: 51247 }, target: 'event-outcome', title: 'See the original ball',
      instruction: 'Look for “Residual,” the difference between what Russell scored and what PRISM expected.',
      text: 'The delivery inspector is showing the recorded ball from row 51,247 of the source file.', next: 'See the four measures' },
    { id: 'native-units', path: '/methodology', hash: '#components', target: 'components', title: 'How PRISM measures batting and bowling',
      instruction: 'The expanded section shows what PRISM counts for batters and for bowlers.',
      text: 'Batters can add runs and avoid getting out. Bowlers can save runs and take wickets. PRISM tracks runs and wickets separately.' },
  ] },
  { id: 'shrinkage', title: 'Why the order changes', steps: [
    { id: 'frozen-order', path: '/rankings', params: { d: 'batting', pool: 'finalists', tier: '', q: '' }, target: 'ranking-order', title: 'How PRISM ranks players',
      instruction: 'Find the leading batter in the rankings chart.',
      text: 'PRISM first groups players by how well their record holds up across matches. Within each group it uses a pressure score adjusted for uncertainty. The chart calls that score “Shrunken pressure.”' },
    { id: 'batting-guess', path: '/compare', params: battingPair, target: 'comparison-rates', highlight: 'raw', title: 'Who would you rank first?',
      instruction: 'Pick a player, or reveal how the order changes once PRISM weighs the evidence.',
      text: 'The raw score measures extra runs per 100 balls in pressure situations. Kishan leads with +49.60 to Russell’s +47.25.',
      choices: ['Ishan Kishan', 'Andre Russell'], next: 'Show the adjusted scores' },
    { id: 'batting-reveal', showOrder: true, path: '/compare', params: battingPair, target: 'comparison-rates', highlight: 'shrunk', title: 'Why Russell moves ahead',
      instruction: 'On the chart, “Raw” is the starting score and “Shrunken” is the adjusted score.',
      text: 'Kishan starts slightly ahead. Russell’s record spans 28 pressure matches to Kishan’s 15, and his score holds up better after the adjustment. PRISM pulls less certain scores closer to zero.' },
    { id: 'batting-exposure', path: '/compare', params: battingPair, target: 'comparison-matches', title: 'How many matches tell the story?',
      instruction: '“Independent” counts separate matches. “Effective” estimates how many evenly sampled matches would give similar evidence.',
      text: 'A player can face lots of balls in one game. Evidence from several games tells you more about what they can repeat.' },
    { id: 'bowling-reveal', showOrder: true, path: '/compare', params: { d: 'bowling', ids: '2933,781' }, target: 'comparison-rates', highlight: 'shrunk', title: 'Why Bumrah moves ahead',
      instruction: 'Compare “Raw” and “Shrunken” on the live chart to see which bowler leads at each stage.',
      text: 'Narine starts ahead on runs saved. Bumrah’s estimate loses less in the uncertainty adjustment, putting him first in this pair. These are estimates from the available matches.' },
  ] },
  { id: 'uplift', title: 'Pressure vs. usual form', steps: [
    { id: 'ordinary-baseline', path: '/compare', params: { d: 'bowling', ids: '8661,4373' }, target: 'comparison-uplift', highlight: 'uplift', title: 'Can a good pressure score be below your usual?',
      instruction: 'Compare each bowler’s “Pressure” and “Ordinary” bars. “Native uplift” is the difference between them.',
      text: 'Both bowlers save runs in pressure situations. Each saves even more in ordinary situations, so their pressure score is below their own usual level.' },
  ] },
  { id: 'evidence', title: 'How much evidence is enough?', steps: [
    { id: 'match-weight', path: '/reliability', params: { d: 'batting', player: 1318, chart: 'matches', cohort: 'all' }, highlight: 'selected-player', target: 'reliability-distribution', title: 'One big game or several good ones?',
      instruction: 'Find Russell’s dot. Compare the number of separate matches with the smaller “Effective matches” count.',
      text: 'Russell’s pressure record spans 28 matches. Some games supplied more of his chances than others. The smaller count reflects that uneven spread.' },
    { id: 'best-removed', path: '/reliability', params: { d: 'batting', player: 1318, chart: 'matches', cohort: 'all' }, target: 'reliability-case', title: 'Take away the best game',
      instruction: 'Read “Best match removed” in Russell’s case to see his pressure score with his best game left out.',
      text: 'A standout game can lift an average. Taking it out shows whether the rest of the record still looks strong.' },
    { id: 'coetzee', path: '/candidates', params: bowlingBoundary, target: 'candidate-coetzee', title: 'Why Coetzee missed the cutoff',
      instruction: 'Find Coetzee’s attempt and match counts.',
      text: 'Coetzee recorded 55 pressure attempts across seven matches. The original rules required at least 60 attempts.' },
    { id: 'henry', path: '/compare', params: { d: 'bowling', ids: '4373,3174' }, target: 'comparison-rates', highlight: 'shrunk', title: 'How close was the last spot?',
      instruction: 'Find Mustafizur and Matt Henry. Compare their highlighted scores.',
      text: 'Mustafizur took the last bowling spot. Henry finished just 0.24 runs saved per 100 attempts behind him on the adjusted pressure score.' },
    { id: 'threshold', path: '/candidates', params: { ...battingBoundary, minO: 60 }, target: 'candidate-threshold', title: 'Try raising the minimum',
      instruction: 'Select “Set ordinary attempts to 120” on the dashboard or “Apply 120 attempts” below.',
      changedInstruction: 'Check the updated exploratory table. Select “Apply 120 attempts” to see the walkthrough result.',
      text: 'The original batting rules require 60 attempts in ordinary situations. This test checks who would qualify with a higher minimum.', next: 'Apply 120 attempts' },
    { id: 'threshold-result', path: '/candidates', params: { ...battingBoundary, minO: 120 }, target: 'candidate-threshold', title: 'Who comes in, who drops out?',
      instruction: 'Look for “In” and “Out” above the trial rankings.',
      text: 'With the higher minimum, Gaikwad takes a spot and Hosein drops out of the trial top ten. The official rankings still use the original minimum.' },
  ] },
  { id: 'validation', title: 'Why keep the original list?', steps: [
    { id: 'policies', path: '/policies', params: { d: 'batting', policy: 'P3' }, target: 'policy-orders', title: 'What if PRISM ranked players differently?',
      instruction: 'Use the Policy menu to compare P1, P2, or P3 with the official list, P0.',
      changedInstruction: 'Compare the selected order with P0. Select “Read the retrospective” when you’re ready.',
      text: 'One option changes how confidence is estimated. Another also rewards improvement over a player’s usual level. A third favors scores with a stronger lower estimate.', next: 'Read the retrospective' },
    { id: 'retrospective', path: '/policies', params: { d: 'batting', policy: 'P3' }, target: 'policy-replay', title: 'Which list held up in later matches?',
      instruction: 'Read the four counts. Open “See the 16 comparisons” for the individual results.',
      text: 'Three comparisons favored the original list. None favored the conservative alternative. The other 13 were inconclusive or had too little evidence.' },
    { id: 'findings', path: '/findings', target: 'research-findings', title: 'Why PRISM kept the original list',
      instruction: 'Find “The revised estimator left selection unresolved” in the results.',
      text: 'The revision improved some predictions. The later-match results did not show that it consistently picked better players.' },
    { id: 'final-twenty', path: '/', target: 'selected-twenty', title: 'The final twenty',
      instruction: 'Open the official rankings or stay here and explore on your own.',
      text: 'PRISM asks three things. How much did a player contribute given the situation? Did they repeat it across matches? How much evidence supports the result?' },
  ] },
];

export const steps = chapters.flatMap((chapter, chapterIndex) => chapter.steps.map(step => ({ ...step, chapter, chapterIndex })));

export function findStep(value) {
  return steps.findIndex(step => step.id === value || step.chapter.id === value);
}

export function matchesExample(step, search) {
  const params = new URLSearchParams(search);
  return Object.entries(step.params || {}).every(([key, value]) => (params.get(key) ?? '') === String(value));
}

export function exampleSearch(step, search = '') {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(step.params || {})) {
    if (value === '') params.delete(key);
    else params.set(key, value);
  }
  params.set('tour', step.id);
  return '?' + params.toString();
}
