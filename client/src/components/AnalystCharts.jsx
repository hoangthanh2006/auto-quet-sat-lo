import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VN_CITIES } from '../services/analystEngine';

/* Tất cả biểu đồ nằm trong khung nền tối cố định nên không phụ thuộc theme sáng/tối của trang. */

const C = {
  cg: '#f59e0b',
  cc: '#a78bfa',
  line: '#22d3ee',
  text: '#cbd5e1',
  muted: '#64748b',
  grid: '#334155'
};

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

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

/* ============================================================ 1. D3 timeline */

export function TimelineChart({ series, selectedId, onSelect }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const width = useWidth(wrapRef);
  const [tip, setTip] = useState(null);
  const H = 290;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!width || !series.length) return;

    const m = { t: 22, r: 48, b: 38, l: 54 };
    const iw = Math.max(10, width - m.l - m.r);
    const ih = H - m.t - m.b;
    svg.attr('width', width).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);

    const x = d3.scaleBand().domain(series.map((d) => d.id)).range([0, iw]).padding(0.16);
    const y = d3.scaleLinear().domain([0, (d3.max(series, (d) => d.strikes) || 1) * 1.08]).nice().range([ih, 0]);
    const y2 = d3.scaleLinear().domain([0, (d3.max(series, (d) => d.dongSet) || 1) * 1.15]).nice().range([ih, 0]);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(''))
      .call((s) => s.select('.domain').remove())
      .call((s) => s.selectAll('line').attr('stroke', C.grid).attr('stroke-opacity', 0.5));

    // Ngày phân cách
    series.forEach((d, i) => {
      if (i > 0 && series[i - 1].date !== d.date) {
        const gx = x(d.id) - (x.step() - x.bandwidth()) / 2;
        g.append('line').attr('x1', gx).attr('x2', gx).attr('y1', -4).attr('y2', ih).attr('stroke', C.muted).attr('stroke-dasharray', '3 3');
      }
      if (i === 0 || series[i - 1].date !== d.date) {
        g.append('text')
          .attr('x', x(d.id))
          .attr('y', -8)
          .attr('fill', C.muted)
          .attr('font-size', 10)
          .text(`${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`);
      }
    });

    // Cột chọn
    if (selectedId && x(selectedId) != null) {
      g.append('rect')
        .attr('x', x(selectedId) - 3)
        .attr('width', x.bandwidth() + 6)
        .attr('y', 0)
        .attr('height', ih)
        .attr('rx', 4)
        .attr('fill', 'rgba(245,158,11,0.14)')
        .attr('stroke', C.cg)
        .attr('stroke-opacity', 0.6);
    }

    // Cột sét CG + CC
    g.selectAll('.bar-cg')
      .data(series)
      .join('rect')
      .attr('x', (d) => x(d.id))
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.cg))
      .attr('height', (d) => ih - y(d.cg))
      .attr('fill', C.cg)
      .attr('rx', 1.5);
    g.selectAll('.bar-cc')
      .data(series)
      .join('rect')
      .attr('x', (d) => x(d.id))
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.cg + d.cc))
      .attr('height', (d) => y(d.cg) - y(d.cg + d.cc))
      .attr('fill', C.cc)
      .attr('rx', 1.5);

    // Đường cảnh báo dông (trục phải)
    const line = d3
      .line()
      .x((d) => x(d.id) + x.bandwidth() / 2)
      .y((d) => y2(d.dongSet))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(series).attr('d', line).attr('fill', 'none').attr('stroke', C.line).attr('stroke-width', 2);
    g.selectAll('.dot')
      .data(series)
      .join('circle')
      .attr('cx', (d) => x(d.id) + x.bandwidth() / 2)
      .attr('cy', (d) => y2(d.dongSet))
      .attr('r', 3)
      .attr('fill', '#0f172a')
      .attr('stroke', C.line)
      .attr('stroke-width', 1.6);

    // Trục
    const every = Math.ceil(series.length / Math.max(1, Math.floor(iw / 52)));
    g.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(series.filter((_, i) => i % every === 0).map((d) => d.id))
          .tickFormat((id) => series.find((s) => s.id === id)?.label.slice(6) || '')
          .tickSizeOuter(0)
      )
      .call((s) => s.selectAll('text').attr('fill', C.text).attr('font-size', 10))
      .call((s) => s.selectAll('line,path').attr('stroke', C.grid));
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s')))
      .call((s) => s.selectAll('text').attr('fill', C.text).attr('font-size', 10))
      .call((s) => s.select('.domain').attr('stroke', C.grid));
    g.append('g')
      .attr('transform', `translate(${iw},0)`)
      .call(d3.axisRight(y2).ticks(5))
      .call((s) => s.selectAll('text').attr('fill', C.line).attr('font-size', 10))
      .call((s) => s.select('.domain').attr('stroke', C.grid));

    // Vùng tương tác
    g.selectAll('.hit')
      .data(series)
      .join('rect')
      .attr('x', (d) => x(d.id) - (x.step() - x.bandwidth()) / 2)
      .attr('width', x.step())
      .attr('y', 0)
      .attr('height', ih)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        const [px] = d3.pointer(event, wrapRef.current);
        setTip({ x: px, d });
      })
      .on('mouseleave', () => setTip(null))
      .on('click', (_, d) => onSelect?.(d.id));
  }, [series, selectedId, width, onSelect]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg ref={svgRef} className="block" />
      {tip && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-600 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-200 shadow-xl"
          style={{ left: Math.min(Math.max(tip.x + 12, 0), Math.max(0, width - 190)) }}
        >
          <div className="mb-1 font-bold text-amber-400">{tip.d.vnTime}</div>
          <div>Sét: <b>{fmt(tip.d.strikes)}</b> (CG {fmt(tip.d.cg)} · CC {fmt(tip.d.cc)})</div>
          <div>Cảnh báo dông: <b>{fmt(tip.d.dongSet)}</b> xã/phường</div>
          <div>Điểm mưa lớn: <b>{fmt(tip.d.rain)}</b></div>
          {tip.d.maxAmp > 0 && <div>Dòng sét cực đại: <b>{fmt(tip.d.maxAmp)}</b> kA</div>}
          <div className="mt-1 text-slate-400">Bấm để phân tích mốc này</div>
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-4 px-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.cg }} />Sét mây–đất (CG)</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.cc }} />Sét trong mây (CC)</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4" style={{ background: C.line }} />Xã/phường cảnh báo dông (trục phải)</span>
      </div>
    </div>
  );
}

/* ============================================ 2. D3 density map (canvas + svg) */

export function DensityMap({ spatial, hotspots, movement, layers }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const width = useWidth(wrapRef);
  const H = 560;

  const geo = useMemo(() => {
    if (!width || !spatial) return null;
    let minLat = 8;
    let maxLat = 23.8;
    let minLng = 102;
    let maxLng = 110.5;
    if (spatial.n > 0) {
      let a = 90, b = -90, c = 180, d = -180;
      for (let i = 0; i < spatial.n; i++) {
        const la = spatial.lat[i];
        const ln = spatial.lng[i];
        if (la < a) a = la;
        if (la > b) b = la;
        if (ln < c) c = ln;
        if (ln > d) d = ln;
      }
      const padLat = Math.max(0.6, (b - a) * 0.12);
      const padLng = Math.max(0.6, (d - c) * 0.12);
      minLat = a - padLat;
      maxLat = b + padLat;
      minLng = c - padLng;
      maxLng = d + padLng;
      // đảm bảo khung tối thiểu ~3°
      if (maxLat - minLat < 3) { const mid = (maxLat + minLat) / 2; minLat = mid - 1.5; maxLat = mid + 1.5; }
      if (maxLng - minLng < 3) { const mid = (maxLng + minLng) / 2; minLng = mid - 1.5; maxLng = mid + 1.5; }
    }
    const lat0 = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const kx = Math.cos(lat0);
    const k = Math.min(width / ((maxLng - minLng) * kx), H / (maxLat - minLat));
    const ox = (width - (maxLng - minLng) * kx * k) / 2;
    const oy = (H - (maxLat - minLat) * k) / 2;
    return {
      minLat, maxLat, minLng, maxLng, k, kx,
      px: (lng) => ox + (lng - minLng) * kx * k,
      py: (lat) => oy + (maxLat - lat) * k
    };
  }, [width, spatial]);

  // Canvas: các điểm sét
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !geo || !spatial) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = H * dpr;
    cv.style.width = `${width}px`;
    cv.style.height = `${H}px`;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, H);
    if (!layers.points) return;
    const alpha = spatial.n > 20000 ? 0.35 : 0.65;
    [0, 1].forEach((type) => {
      ctx.fillStyle = type === 0 ? C.cg : C.cc;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < spatial.n; i++) {
        if (spatial.cc[i] !== type) continue;
        ctx.fillRect(geo.px(spatial.lng[i]) - 1, geo.py(spatial.lat[i]) - 1, 2, 2);
      }
    });
    ctx.globalAlpha = 1;
  }, [geo, spatial, layers.points, width]);

  // SVG: nền, density, marker, chú thích
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!geo || !spatial) return;
    svg.attr('width', width).attr('height', H);

    // Graticule
    const step = geo.maxLat - geo.minLat > 8 ? 2 : 1;
    const gl = svg.append('g').attr('stroke', C.grid).attr('stroke-opacity', 0.45).attr('font-size', 9).attr('fill', C.muted);
    for (let la = Math.ceil(geo.minLat / step) * step; la <= geo.maxLat; la += step) {
      gl.append('line').attr('x1', 0).attr('x2', width).attr('y1', geo.py(la)).attr('y2', geo.py(la));
      gl.append('text').attr('x', 4).attr('y', geo.py(la) - 2).attr('stroke', 'none').text(`${la}°N`);
    }
    for (let ln = Math.ceil(geo.minLng / step) * step; ln <= geo.maxLng; ln += step) {
      gl.append('line').attr('y1', 0).attr('y2', H).attr('x1', geo.px(ln)).attr('x2', geo.px(ln));
      gl.append('text').attr('y', H - 4).attr('x', geo.px(ln) + 3).attr('stroke', 'none').text(`${ln}°E`);
    }

    // Density contours
    if (layers.density && spatial.n > 0) {
      const stride = Math.max(1, Math.floor(spatial.n / 20000));
      const pts = [];
      for (let i = 0; i < spatial.n; i += stride) pts.push([geo.px(spatial.lng[i]), geo.py(spatial.lat[i])]);
      const contours = d3
        .contourDensity()
        .x((d) => d[0])
        .y((d) => d[1])
        .size([width, H])
        .bandwidth(Math.max(8, width / 55))
        .thresholds(14)(pts);
      const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, d3.max(contours, (c) => c.value) || 1]);
      svg
        .append('g')
        .selectAll('path')
        .data(contours)
        .join('path')
        .attr('d', d3.geoPath())
        .attr('fill', (d) => color(d.value))
        .attr('fill-opacity', 0.22)
        .attr('stroke', (d) => color(d.value))
        .attr('stroke-opacity', 0.55)
        .attr('stroke-width', 0.7);
    }

    // Thành phố tham chiếu
    const cityG = svg.append('g');
    VN_CITIES.filter((c) => c.lat > geo.minLat && c.lat < geo.maxLat && c.lng > geo.minLng && c.lng < geo.maxLng).forEach((c) => {
      cityG.append('circle').attr('cx', geo.px(c.lng)).attr('cy', geo.py(c.lat)).attr('r', 2.5).attr('fill', '#e2e8f0');
      cityG.append('text').attr('x', geo.px(c.lng) + 5).attr('y', geo.py(c.lat) + 3).attr('font-size', 10).attr('fill', '#e2e8f0').attr('paint-order', 'stroke').attr('stroke', '#0f172a').attr('stroke-width', 3).text(c.name);
    });

    // Cảnh báo dông
    if (layers.alerts) {
      svg
        .append('g')
        .selectAll('path')
        .data(spatial.alerts)
        .join('path')
        .attr('transform', (d) => `translate(${geo.px(d.lng)},${geo.py(d.lat)})`)
        .attr('d', d3.symbol().type(d3.symbolDiamond).size(46)())
        .attr('fill', 'none')
        .attr('stroke', '#fde047')
        .attr('stroke-width', 1.4)
        .append('title')
        .text((d) => `${d.commune} — ${d.province} (+${d.forecastMinutes} phút)`);
    }

    // Mưa lớn
    if (layers.rain) {
      svg
        .append('g')
        .selectAll('path')
        .data(spatial.rain)
        .join('path')
        .attr('transform', (d) => `translate(${geo.px(d.lng)},${geo.py(d.lat)})`)
        .attr('d', d3.symbol().type(d3.symbolTriangle).size(70)())
        .attr('fill', '#22d3ee')
        .attr('fill-opacity', 0.85)
        .attr('stroke', '#0f172a')
        .append('title')
        .text((d) => `Mưa lớn: ${d.district} — ${d.province}`);
    }

    // Hướng di chuyển
    if (layers.movement && movement) {
      const defs = svg.append('defs');
      defs.append('marker').attr('id', 'mv-arrow').attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto-start-reverse')
        .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', '#f43f5e');
      const trackLine = d3.line().x((d) => geo.px(d.lng)).y((d) => geo.py(d.lat));
      svg.append('path').datum(movement.track).attr('d', trackLine).attr('fill', 'none').attr('stroke', '#fb7185').attr('stroke-width', 1.5).attr('stroke-opacity', 0.7);
      svg.append('line')
        .attr('x1', geo.px(movement.centroidEnd.lng)).attr('y1', geo.py(movement.centroidEnd.lat))
        .attr('x2', geo.px(movement.projected1h.lng)).attr('y2', geo.py(movement.projected1h.lat))
        .attr('stroke', '#f43f5e').attr('stroke-width', 2.5).attr('stroke-dasharray', '6 4').attr('marker-end', 'url(#mv-arrow)');
    }

    // Hotspots
    if (layers.hotspots) {
      const hg = svg.append('g');
      hotspots.forEach((h) => {
        const r = 8 + Math.sqrt(h.share) * 44;
        hg.append('circle').attr('cx', geo.px(h.lng)).attr('cy', geo.py(h.lat)).attr('r', r).attr('fill', 'none').attr('stroke', '#ffffff').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3');
        hg.append('circle').attr('cx', geo.px(h.lng)).attr('cy', geo.py(h.lat)).attr('r', 9).attr('fill', '#ef4444');
        hg.append('text').attr('x', geo.px(h.lng)).attr('y', geo.py(h.lat) + 3.5).attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 700).attr('fill', '#fff').text(h.rank);
        hg.append('title').text(`#${h.rank}: ${fmt(h.count)} cú sét (${(h.share * 100).toFixed(1)}%)`);
      });
    }
  }, [geo, spatial, hotspots, movement, layers, width]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl bg-slate-950" style={{ height: H }}>
      <canvas ref={canvasRef} className="absolute left-0 top-0" />
      <svg ref={svgRef} className="absolute left-0 top-0" />
      {(!spatial || spatial.n === 0) && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Chưa có dữ liệu không gian — chọn một mốc để nạp chi tiết.</div>
      )}
    </div>
  );
}

/* ============================================ 3. Observable Plot — heatmap, bars */

function PlotHost({ build, deps, className }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  useEffect(() => {
    const el = ref.current;
    if (!el || !width) return undefined;
    const chart = build(width);
    el.replaceChildren(chart);
    return () => chart.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, ...deps]);
  return <div ref={ref} className={className} />;
}

const PLOT_STYLE = { background: 'transparent', color: C.text, fontSize: '11px' };

export function HourDayHeatmap({ series }) {
  return (
    <PlotHost
      deps={[series]}
      build={(width) => {
        const dates = Array.from(new Set(series.map((s) => s.date))).sort();
        return Plot.plot({
          width,
          height: Math.max(130, 56 + dates.length * 26),
          marginLeft: 48,
          style: PLOT_STYLE,
          x: { label: 'Giờ trong ngày', domain: d3.range(24), tickFormat: (d) => String(d).padStart(2, '0') },
          y: { label: null, domain: dates, tickFormat: (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}` },
          color: { type: 'sqrt', scheme: 'YlOrRd', label: 'Số cú sét', legend: true },
          marks: [
            Plot.cell(series, { x: 'hour', y: 'date', fill: 'strikes', inset: 1.5, rx: 3, tip: true, title: (d) => `${d.vnTime}\n${fmt(d.strikes)} cú sét · ${fmt(d.dongSet)} xã/phường cảnh báo` })
          ]
        });
      }}
    />
  );
}

export function ProvinceBars({ series, kind }) {
  return (
    <PlotHost
      deps={[series, kind]}
      build={(width) => {
        const agg = new Map();
        series.forEach((e) => {
          if (kind === 'dongset') {
            e.topProvinces.forEach((p) => agg.set(p.province, (agg.get(p.province) || 0) + (p.communeCount || 0)));
          } else {
            e.rainProvinces.forEach((p) => agg.set(p.province, (agg.get(p.province) || 0) + (p.count || 0)));
          }
        });
        const rows = Array.from(agg, ([province, value]) => ({ province, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
        return Plot.plot({
          width,
          height: Math.max(120, 40 + rows.length * 26),
          marginLeft: 130,
          style: PLOT_STYLE,
          x: { label: kind === 'dongset' ? 'Tổng lượt xã/phường cảnh báo' : 'Tổng lượt điểm mưa lớn', grid: true },
          y: { label: null, domain: rows.map((r) => r.province) },
          marks: [
            Plot.barX(rows, { y: 'province', x: 'value', fill: kind === 'dongset' ? C.cg : '#22d3ee', rx: 3, tip: true }),
            Plot.text(rows, { y: 'province', x: 'value', text: (d) => fmt(d.value), dx: 4, textAnchor: 'start', fill: C.text }),
            Plot.ruleX([0], { stroke: C.grid })
          ]
        });
      }}
    />
  );
}

/* ============================================================== 4. Three.js */

function makeLabel(text, color = '#e2e8f0', size = 22) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(cv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(26, 6.5, 1);
  return sprite;
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

export function Strike3D({ spatial, hotspots, colorMode, autoRotate }) {
  const wrapRef = useRef(null);
  const ctxRef = useRef(null);
  const [error, setError] = useState(null);
  const H = 520;

  // Khởi tạo renderer (một lần)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      setError('Trình duyệt không hỗ trợ WebGL nên không thể hiển thị mô hình 3D.');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(el.clientWidth, H);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / H, 0.1, 2000);
    camera.position.set(95, 85, 115);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 22, 0);
    controls.autoRotateSpeed = 0.8;
    const group = new THREE.Group();
    scene.add(group);
    const ctx = { renderer, scene, camera, controls, group, raf: 0 };
    ctxRef.current = ctx;

    const loop = () => {
      ctx.raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (!w) return;
      renderer.setSize(w, H);
      camera.aspect = w / H;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(ctx.raf);
      ro.disconnect();
      controls.dispose();
      disposeGroup(group);
      renderer.dispose();
      renderer.domElement.remove();
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ctxRef.current) ctxRef.current.controls.autoRotate = !!autoRotate;
  }, [autoRotate]);

  // Dựng lại nội dung khi dữ liệu thay đổi
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { group } = ctx;
    disposeGroup(group);
    group.clear();
    if (!spatial || spatial.n === 0) return;

    // Khung bao
    let a = 90, b = -90, c = 180, d = -180;
    for (let i = 0; i < spatial.n; i++) {
      const la = spatial.lat[i];
      const ln = spatial.lng[i];
      if (la < a) a = la;
      if (la > b) b = la;
      if (ln < c) c = ln;
      if (ln > d) d = ln;
    }
    const cLat = (a + b) / 2;
    const cLng = (c + d) / 2;
    const cos0 = Math.cos((cLat * Math.PI) / 180);
    const spanX = Math.max(1, (d - c) * cos0);
    const spanZ = Math.max(1, b - a);
    const u = 110 / Math.max(spanX, spanZ);
    const T = 60;
    const toX = (lng) => (lng - cLng) * cos0 * u;
    const toZ = (lat) => -(lat - cLat) * u;
    const fmax = Math.max(1, spatial.frameCount - 1);

    // Nền: lưới + khung
    const gridSize = Math.ceil((Math.max(spanX, spanZ) * u * 1.15) / 10) * 10;
    const grid = new THREE.GridHelper(gridSize, gridSize / 5, 0x475569, 0x1e293b);
    group.add(grid);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(spanX * u, T, spanZ * u)),
      new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.7 })
    );
    frame.position.set(toX(cLng), T / 2, toZ(cLat));
    group.add(frame);

    // Nhãn trục
    const tl = makeLabel('Thời gian ↑ (mới nhất ở trên)', '#fbbf24', 20);
    tl.position.set(-spanX * u * 0.5, T + 6, -spanZ * u * 0.5);
    group.add(tl);
    const north = makeLabel('Bắc ↑', '#94a3b8', 22);
    north.position.set(0, 0.5, -spanZ * u * 0.5 - 6);
    group.add(north);

    // Thành phố
    VN_CITIES.filter((ct) => ct.lat > a - 0.3 && ct.lat < b + 0.3 && ct.lng > c - 0.3 && ct.lng < d + 0.3).forEach((ct) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
      m.position.set(toX(ct.lng), 0.9, toZ(ct.lat));
      group.add(m);
      const l = makeLabel(ct.name, '#e2e8f0', 20);
      l.position.set(toX(ct.lng), 6, toZ(ct.lat));
      group.add(l);
    });

    // Cột hotspot
    const maxCount = Math.max(1, ...hotspots.map((h) => h.count));
    hotspots.slice(0, 5).forEach((h) => {
      const hh = 8 + (h.count / maxCount) * T;
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, hh, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      cyl.position.set(toX(h.lng), hh / 2, toZ(h.lat));
      group.add(cyl);
      const l = makeLabel(`#${h.rank}`, '#fca5a5', 24);
      l.position.set(toX(h.lng), hh + 4, toZ(h.lat));
      group.add(l);
    });

    // Điểm sét
    const stride = Math.max(1, Math.ceil(spatial.n / 70000));
    const count = Math.ceil(spatial.n / stride);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cg = new THREE.Color(0xf59e0b);
    const cc = new THREE.Color(0xa78bfa);
    const tmp = new THREE.Color();
    let k = 0;
    for (let i = 0; i < spatial.n; i += stride) {
      const fn = spatial.frame[i] / fmax;
      pos[k * 3] = toX(spatial.lng[i]);
      pos[k * 3 + 1] = fn * T;
      pos[k * 3 + 2] = toZ(spatial.lat[i]);
      if (colorMode === 'time') {
        const rgb = d3.color(d3.interpolateTurbo(fn));
        tmp.setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255);
      } else {
        tmp.copy(spatial.cc[i] ? cc : cg);
      }
      col[k * 3] = tmp.r;
      col[k * 3 + 1] = tmp.g;
      col[k * 3 + 2] = tmp.b;
      k++;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(
      geom,
      new THREE.PointsMaterial({ size: 1.3, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true })
    );
    group.add(pts);
  }, [spatial, hotspots, colorMode]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height: H, background: 'radial-gradient(ellipse at 50% 30%, #1e293b 0%, #020617 75%)' }}>
      <div ref={wrapRef} className="h-full w-full" />
      {error && <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-rose-300">{error}</div>}
      {!error && (!spatial || spatial.n === 0) && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Chưa có dữ liệu để dựng mô hình 3D.</div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-slate-500">Kéo để xoay · cuộn để phóng to · chuột phải để di chuyển</div>
    </div>
  );
}
