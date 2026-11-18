import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { AnalysisDialog } from './instruments.jsx';
import { competitionShare, num } from './analytics.mjs';
import { playerLink } from './data.jsx';
import { Empty, fixed, percent, signed } from './ui.jsx';

export const palette = {
  batting: '#f17aaa', bowling: '#68a3f5', violet: '#be9bf7', mint: '#66d6b9', amber: '#f0ba7c',
  text: '#e2e6f6', muted: '#a0aac3', line: '#282e43', raw: '#aab6d8',
};

export const axis = {
  axisLine: { lineStyle: { color: palette.line } },
  axisTick: { show: false },
  axisLabel: { color: palette.muted },
  nameTextStyle: { color: palette.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: palette.line, type: 'dashed' } },
};

const ChartEngine = lazy(() => import('./ChartEngine.jsx'));

function ChartSurface({ height, ...props }) {
  return <Suspense fallback={<div className="skeleton" style={{ minHeight: height }} role="status" aria-label="Loading chart"><i /><i /></div>}>
    <ChartEngine height={height} {...props} />
  </Suspense>;
}

export function Chart({ height = 290, label, option, onClick }) {
  const [focused, setFocused] = useState(false);
  return <div className="chart-instrument">
    <button type="button" className="chart-focus" title="Expand chart" aria-label={'Expand chart: ' + label}
      onClick={() => setFocused(true)}><Maximize2 size={14} aria-hidden="true" /></button>
    <ChartSurface height={height} label={label} option={option} onClick={onClick} />
    {focused && <AnalysisDialog title={label} className="chart-dialog" onClose={() => setFocused(false)}>
      <ChartSurface height="min(64dvh, 680px)" label={label} option={option}
        onClick={onClick ? event => { setFocused(false); onClick(event); } : undefined} />
    </AnalysisDialog>}
  </div>;
}

export function GroupBars({ rows, fields, unit, label, onClick, height, ratio = false }) {
  const renderable = rows.filter(row => fields.some(field => num(row[field.key]) !== null));
  if (!renderable.length) return <Empty title="No plottable estimates for this selection" />;
  const chartData = renderable.map(row => row.name ?? row.player_name);
  return <Chart
    height={height || Math.max(250, renderable.length * (fields.length > 2 ? 62 : 42) + 76)}
    label={label}
    onClick={event => onClick?.(renderable[event.dataIndex])}
    option={{
      grid: { left: 9, right: 26, top: fields.length > 1 ? 32 : 12, bottom: 14, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
      legend: fields.length > 1 ? { top: 1, left: 4, textStyle: { color: palette.muted }, itemWidth: 11, itemHeight: 7 } : undefined,
      tooltip: { trigger: 'axis', formatter: entries => [entries[0]?.axisValue, ...entries.map(entry =>
        entry.seriesName + '  ' + (ratio ? percent(entry.value) : fixed(entry.value)) + ' ' + unit)].join('\n') },
      xAxis: { ...axis, type: 'value', ...(ratio ? { min: 0, max: 1, axisLabel: { ...axis.axisLabel, formatter: value => percent(value) } } : {}) },
      yAxis: { ...axis, type: 'category', inverse: true, data: chartData, axisLabel: { ...axis.axisLabel, width: 96, overflow: 'truncate' } },
      series: fields.map(field => ({ name: field.label, type: 'bar', stack: ratio ? 'coverage' : undefined, barMaxWidth: 15,
        itemStyle: { color: field.color, borderRadius: ratio ? 0 : 2 },
        data: renderable.map(row => ({ value: num(row[field.key]), pid: row.pid })) })),
    }} />;
}

export function PlayerBars({ rows, discipline, fields, label, height, unit = 'runs / 100 attempts' }) {
  const navigate = useNavigate();
  return <GroupBars rows={rows} fields={fields} unit={unit} label={label} height={height}
    onClick={row => { if (row?.pid) navigate(playerLink(row.pid, discipline)); }} />;
}

export function Scatter({ rows, discipline, x, y, xLabel, yLabel, xUnit, yUnit, height = 300 }) {
  const navigate = useNavigate();
  const renderable = rows.filter(row => num(row[x]) !== null && num(row[y]) !== null);
  if (!renderable.length) return <Empty title="No paired estimates" />;
  return <Chart label={yLabel + ' versus ' + xLabel} height={height} onClick={event => {
    if (event.data?.pid) navigate(playerLink(event.data.pid, discipline));
  }} option={{
    grid: { left: 5, right: 20, top: 17, bottom: 13, outerBoundsMode: 'same', outerBoundsContain: 'all' },
    tooltip: { formatter: ({ data }) => data.name + ' · #' + data.pid + '\n' +
      xLabel + ': ' + signed(data.value[0]) + ' ' + xUnit + '\n' + yLabel + ': ' + signed(data.value[1]) + ' ' + yUnit },
    xAxis: { ...axis, type: 'value', name: xLabel, nameLocation: 'middle', nameGap: 29, scale: true },
    yAxis: { ...axis, type: 'value', name: yLabel, nameLocation: 'middle', nameGap: 32, scale: true },
    series: [{ type: 'scatter', symbolSize: renderable.length > 80 ? 7 : 11,
      itemStyle: { color: palette[discipline], opacity: .78, borderColor: palette.text, borderWidth: .5 },
      emphasis: { scale: 1.45 },
      data: renderable.map(row => ({ value: [num(row[x]), num(row[y])], name: row.player_name, pid: row.pid })),
      markLine: { symbol: 'none', silent: true, lineStyle: { color: '#59627e', type: 'dashed' }, label: { show: false },
        data: [...(renderable.some(row => num(row[x]) <= 0) ? [{ xAxis: 0 }] : []), ...(renderable.some(row => num(row[y]) <= 0) ? [{ yAxis: 0 }] : [])] },
    }],
  }} />;
}

export function Intervals({ rows, discipline, point = 'p_pressure_quality', low = 'p_pressure_low', high = 'p_pressure_high',
  label = 'Raw pressure quality', unit = 'runs / 100 attempts' }) {
  const navigate = useNavigate();
  const observed = rows.filter(row => [point, low, high].every(key => num(row[key]) !== null));
  if (!observed.length) return <Empty title="No intervals available" detail="The selected evidence has no stored interval for this measure." />;
  return <Chart label={label + ' with uncertainty intervals'} height={Math.max(215, observed.length * 30 + 85)}
    onClick={event => { if (event.data?.pid) navigate(playerLink(event.data.pid, discipline)); }}
    option={{
      grid: { left: 10, right: 24, top: 14, bottom: 36, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
      xAxis: { ...axis, type: 'value', scale: true, name: unit, nameLocation: 'middle', nameGap: 29 },
      yAxis: { ...axis, type: 'category', inverse: true, data: observed.map(row => row.player_name),
        axisLabel: { ...axis.axisLabel, width: 99, overflow: 'truncate' } },
      tooltip: { formatter: ({ data }) => data.name + '\n' + label + ': ' + signed(data.value[3]) + '\n95% interval: ' +
        fixed(data.value[1]) + ' to ' + fixed(data.value[2]) + ' ' + unit },
      series: [{ type: 'custom', name: label, encode: { x: [1, 2, 3], y: 0 },
        renderItem: (_params, api) => {
          const y = api.value(0);
          const left = api.coord([api.value(1), y]), right = api.coord([api.value(2), y]);
          const [cx, cy] = api.coord([api.value(3), y]);
          const stroke = palette[discipline] || palette.violet;
          return { type: 'group', children: [
            { type: 'line', shape: { x1: left[0], y1: left[1], x2: right[0], y2: right[1] }, style: { stroke, lineWidth: 2 } },
            ...[left, right].map(([x, y]) => ({ type: 'line', shape: { x1: x, x2: x, y1: y - 4, y2: y + 4 }, style: { stroke, lineWidth: 2 } })),
            { type: 'circle', shape: { cx, cy, r: 5 }, style: { fill: stroke, stroke: '#fff', lineWidth: 1 } },
          ] };
        },
        data: observed.map((row, index) => ({ name: row.player_name, pid: row.pid, value: [index, num(row[low]), num(row[high]), num(row[point])] })),
      }],
    }} />;
}

export function Coverage({ rows, discipline }) {
  const navigate = useNavigate();
  return <GroupBars rows={rows.map(row => {
    const ipl = competitionShare(row);
    return { ...row, ipl, t20i: ipl === null ? null : 1 - ipl };
  })} fields={[{ key: 'ipl', color: palette[discipline], label: 'IPL' }, { key: 't20i', color: palette.violet, label: 'T20I' }]}
    ratio unit="of pressure attempts" label="Primary pressure attempts by competition"
    onClick={row => { if (row?.pid) navigate(playerLink(row.pid, discipline)); }} />;
}
