import { useEffect, useRef } from 'react';
import { init, use as registerCharts } from 'echarts/core';
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
registerCharts([BarChart, CustomChart, LineChart, ScatterChart, AriaComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

const chartDefaults = {
  animationDuration: 360,
  textStyle: { fontFamily: 'Inter Variable, sans-serif', color: '#e2e6f6', fontSize: 11 },
  grid: { left: 48, right: 23, top: 21, bottom: 52, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
  tooltip: {
    renderMode: 'richText', backgroundColor: '#121727', borderColor: '#343d59',
    textStyle: { color: '#eef1fc', fontSize: 12 }, confine: true, trigger: 'item',
  },
};
export default function ChartEngine({ option, height = 290, label, onClick }) {
  const element = useRef(null);
  const liveChart = useRef(null);
  const click = useRef(onClick);
  useEffect(() => { click.current = onClick; }, [onClick]);
  useEffect(() => {
    const target = element.current;
    const chart = init(target, null, { renderer: 'canvas', useDirtyRect: true });
    liveChart.current = chart;
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(target);
    chart.on('click', event => click.current?.(event));
    return () => { resize.disconnect(); chart.dispose(); liveChart.current = null; };
  }, []);
  useEffect(() => {
    liveChart.current?.setOption({ ...chartDefaults, ...option,
      aria: { enabled: true, label: { description: label } },
      animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      tooltip: { ...chartDefaults.tooltip, ...option.tooltip },
    }, { notMerge: true });
  }, [label, option]);
  return <div ref={element} className="chart" role="img" aria-label={label} style={{ height }} />;
}
