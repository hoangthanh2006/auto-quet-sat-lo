import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';
import { histogramBins, fmtNum } from '../services/genericAnalyzer';

/* Biểu đồ dùng chung cho tool Phân tích dữ liệu (D3 + Observable Plot), nền tối cố định. */

const C = { text: '#cbd5e1', muted: '#64748b', grid: '#334155', accent: '#f59e0b', cyan: '#22d3ee', violet: '#a78bfa' };
const PLOT_STYLE = { background: 'transparent', color: C.text, fontSize: '11px' };

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(Math.floor(cr.width));
    });
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function PlotBox({ build, deps, empty }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  useEffect(() => {
    const el = ref.current;
    if (!el || !width) return undefined;
    if (empty) {
      el.replaceChildren();
      return undefined;
    }
    const chart = build(width);
    el.replaceChildren(chart);
    return () => chart.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, empty, ...deps]);
  return (
    <div className="relative min-h-[120px] w-full rounded-xl bg-slate-950 p-2">
      <div ref={ref} />
      {empty && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">{empty}</div>}
    </div>
  );
}

export function HistogramChart({ values, label }) {
  const bins = histogramBins(values, 30);
  return (
    <PlotBox
      deps={[values, label]}
      empty={bins.length ? null : 'Cột này không có giá trị số.'}
      build={(width) =>
        Plot.plot({
          width,
          height: 300,
          marginLeft: 52,
          style: PLOT_STYLE,
          x: { label, grid: false },
          y: { label: 'Số dòng', grid: true },
          marks: [
            Plot.rectY(bins, { x1: 'x0', x2: 'x1', y: 'count', fill: C.accent, inset: 0.5, rx: 2, tip: true, title: (b) => `${fmtNum(b.x0)} – ${fmtNum(b.x1)}\n${fmtNum(b.count)} dòng` }),
            Plot.ruleY([0], { stroke: C.grid })
          ]
        })
      }
    />
  );
}

export function GroupBarChart({ rows, label }) {
  return (
    <PlotBox
      deps={[rows, label]}
      empty={rows.length ? null : 'Chưa có dữ liệu nhóm.'}
      build={(width) =>
        Plot.plot({
          width,
          height: Math.max(140, 44 + rows.length * 26),
          marginLeft: 150,
          marginRight: 56,
          style: PLOT_STYLE,
          x: { label, grid: true },
          y: { label: null, domain: rows.map((r) => r.key) },
          marks: [
            Plot.barX(rows, { y: 'key', x: 'value', fill: C.cyan, rx: 3, tip: true, title: (r) => `${r.key}\n${label}: ${fmtNum(r.value)}\n${fmtNum(r.n)} dòng` }),
            Plot.text(rows, { y: 'key', x: 'value', text: (r) => fmtNum(r.value), dx: 4, textAnchor: 'start', fill: C.text }),
            Plot.ruleX([0], { stroke: C.grid })
          ]
        })
      }
    />
  );
}

export function TimeSeriesChart({ rows, label, gran }) {
  const asBars = gran !== 'month' && rows.length <= 60;
  return (
    <PlotBox
      deps={[rows, label, gran]}
      empty={rows.length >= 2 ? null : 'Cần ít nhất 2 mốc thời gian để vẽ biểu đồ.'}
      build={(width) =>
        Plot.plot({
          width,
          height: 320,
          marginLeft: 56,
          marginBottom: 44,
          style: PLOT_STYLE,
          x: { type: 'band', label: null, tickRotate: -35, domain: rows.map((r) => r.label), ticks: undefined, tickFormat: (d) => d },
          y: { label, grid: true },
          marks: asBars
            ? [
                Plot.barY(rows, { x: 'label', y: 'value', fill: C.accent, rx: 2, tip: true, title: (r) => `${r.label}\n${label}: ${fmtNum(r.value)}\n${fmtNum(r.n)} dòng` }),
                Plot.ruleY([0], { stroke: C.grid })
              ]
            : [
                Plot.lineY(rows, { x: 'label', y: 'value', stroke: C.accent, strokeWidth: 2, curve: 'monotone-x' }),
                Plot.dot(rows, { x: 'label', y: 'value', fill: C.accent, r: 2.5, tip: true, title: (r) => `${r.label}\n${label}: ${fmtNum(r.value)}` }),
                Plot.ruleY([0], { stroke: C.grid })
              ]
        })
      }
    />
  );
}

export function ScatterChart({ xs, ys, xLabel, yLabel }) {
  const pts = [];
  const step = xs.length > 8000 ? Math.ceil(xs.length / 8000) : 1;
  for (let i = 0; i < xs.length; i += step) {
    if (xs[i] !== null && ys[i] !== null) pts.push({ x: xs[i], y: ys[i] });
  }
  return (
    <PlotBox
      deps={[xs, ys, xLabel, yLabel]}
      empty={pts.length >= 3 ? null : 'Không đủ dòng có đủ cả hai cột.'}
      build={(width) =>
        Plot.plot({
          width,
          height: 340,
          marginLeft: 56,
          style: PLOT_STYLE,
          x: { label: xLabel, grid: true },
          y: { label: yLabel, grid: true },
          marks: [
            Plot.dot(pts, { x: 'x', y: 'y', r: 2.6, fill: C.cyan, fillOpacity: 0.55, tip: true }),
            Plot.linearRegressionY(pts, { x: 'x', y: 'y', stroke: C.accent, ci: 0 })
          ]
        })
      }
    />
  );
}

export function CorrHeatmap({ names, matrix }) {
  const cells = [];
  names.forEach((a, i) => names.forEach((b, j) => cells.push({ a, b, r: matrix[i][j] })));
  const size = Math.max(280, names.length * 44 + 160);
  return (
    <PlotBox
      deps={[names, matrix]}
      empty={names.length >= 2 ? null : 'Cần ít nhất 2 cột số.'}
      build={(width) =>
        Plot.plot({
          width,
          height: Math.min(size, 520),
          marginLeft: 120,
          marginBottom: 90,
          style: PLOT_STYLE,
          x: { label: null, domain: names, tickRotate: -40 },
          y: { label: null, domain: names },
          color: { type: 'diverging', scheme: 'RdBu', domain: [-1, 1], legend: true, label: 'Hệ số tương quan r' },
          marks: [
            Plot.cell(cells, { x: 'a', y: 'b', fill: (d) => (d.r === null ? NaN : d.r), inset: 1, rx: 3, tip: true, title: (d) => `${d.a} × ${d.b}\nr = ${d.r === null ? 'không đủ dữ liệu' : d.r.toFixed(3)}` }),
            Plot.text(cells, { x: 'a', y: 'b', text: (d) => (d.r === null ? '' : d.r.toFixed(2)), fill: (d) => (d.r !== null && Math.abs(d.r) > 0.6 ? '#fff' : '#0f172a'), fontSize: 10 })
          ]
        })
      }
    />
  );
}

/** Bảng dữ liệu xem trước (D3 không cần, dùng DOM thuần). */
export function colorScale(min, max) {
  const s = d3.scaleSequential(d3.interpolateYlOrRd).domain([min, max || min + 1]);
  return (v) => s(v);
}
