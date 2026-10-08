import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Activity,
  Upload,
  Loader2,
  Lightbulb,
  Compass,
  Box,
  Calendar,
  AlertTriangle,
  Info,
  RefreshCw,
  Zap,
  FileJson,
  Download
} from 'lucide-react';
import { getHymetnetHistoryTimeline, getHymetnetSnapshotData } from '../services/hymetnetClientService';
import {
  normalizeEntry,
  mergeSeries,
  extractSpatial,
  mergeSpatial,
  findHotspots,
  estimateMovement,
  buildSeriesInsights,
  buildSpatialInsights,
  sortInsights
} from '../services/analystEngine';
import { TimelineChart, DensityMap, HourDayHeatmap, ProvinceBars, Strike3D } from './AnalystCharts';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

const SEVERITY = {
  high: { label: 'Đáng chú ý', cls: 'border-rose-500/50 bg-rose-500/10', chip: 'bg-rose-500 text-white', icon: AlertTriangle, iconCls: 'text-rose-400' },
  medium: { label: 'Cần theo dõi', cls: 'border-amber-500/40 bg-amber-500/10', chip: 'bg-amber-500 text-white', icon: Zap, iconCls: 'text-amber-400' },
  info: { label: 'Thông tin', cls: 'border-slate-600/50 bg-slate-800/40', chip: 'bg-slate-600 text-white', icon: Info, iconCls: 'text-sky-400' }
};

function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
        active ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function AnalystHymetnet() {
  const [timeline, setTimeline] = useState([]);
  const [imported, setImported] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [dateFilter, setDateFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [spatialMode, setSpatialMode] = useState('single'); // 'single' | 'merged'
  const [spLoading, setSpLoading] = useState(false);
  const [batch, setBatch] = useState(null); // { done, total }
  const [dragOver, setDragOver] = useState(false);

  const [layers, setLayers] = useState({ points: true, density: true, alerts: true, rain: false, hotspots: true, movement: true });
  const [colorMode, setColorMode] = useState('type');
  const [autoRotate, setAutoRotate] = useState(true);
  const [showAllInsights, setShowAllInsights] = useState(false);

  const cacheRef = useRef(new Map()); // snapshotId -> spatial
  const [cacheVer, setCacheVer] = useState(0);
  const fileRef = useRef(null);

  /* ----------------------------------------------------------------- load */

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHymetnetHistoryTimeline(2000);
      if (res.success) setTimeline((res.data || []).map(normalizeEntry).filter(Boolean));
      else setError(res.error || 'Không tải được timeline');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const allSeries = useMemo(() => mergeSeries(timeline, imported), [timeline, imported]);
  const dates = useMemo(() => Array.from(new Set(allSeries.map((s) => s.date))).sort().reverse(), [allSeries]);
  const series = useMemo(() => (dateFilter === 'all' ? allSeries : allSeries.filter((s) => s.date === dateFilter)), [allSeries, dateFilter]);

  // Tự chọn mốc cuối cùng nếu mốc đang chọn không còn trong phạm vi
  useEffect(() => {
    if (!series.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !series.some((s) => s.id === selectedId)) setSelectedId(series[series.length - 1].id);
  }, [series, selectedId]);

  // Nạp chi tiết 1 mốc
  useEffect(() => {
    if (!selectedId || cacheRef.current.has(selectedId)) return undefined;
    let alive = true;
    setSpLoading(true);
    getHymetnetSnapshotData(selectedId)
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          cacheRef.current.set(selectedId, extractSpatial({ ...res.data, snapshotId: res.data.snapshotId || selectedId }));
          setCacheVer((v) => v + 1);
        } else {
          setMessage(`Không nạp được chi tiết mốc ${selectedId}: ${res.message || 'không có dữ liệu'}`);
        }
      })
      .catch((e) => alive && setMessage(`Lỗi nạp mốc ${selectedId}: ${e.message}`))
      .finally(() => alive && setSpLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedId]);

  // Nạp chi tiết N mốc gần nhất (phục vụ chế độ cộng dồn)
  const loadRecent = async (n) => {
    const targets = series.filter((s) => !cacheRef.current.has(s.id)).slice(-n);
    if (!targets.length) {
      setMessage('Các mốc trong phạm vi đã được nạp chi tiết.');
      return;
    }
    setBatch({ done: 0, total: targets.length });
    let done = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const t = targets[cursor++];
        try {
          const res = await getHymetnetSnapshotData(t.id);
          if (res.success && res.data) cacheRef.current.set(t.id, extractSpatial({ ...res.data, snapshotId: res.data.snapshotId || t.id }));
        } catch {
          /* bỏ qua mốc lỗi */
        }
        done++;
        setBatch({ done, total: targets.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker));
    setCacheVer((v) => v + 1);
    setBatch(null);
  };

  /* --------------------------------------------------------- import files */

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
    if (!files.length) {
      setMessage('Hãy chọn file .json đã xuất từ trang Hymetnet.');
      return;
    }
    const entries = [];
    const problems = [];
    for (const file of files) {
      try {
        const obj = JSON.parse(await file.text());
        const snaps = Array.isArray(obj) ? obj : Array.isArray(obj.snapshots) ? obj.snapshots : obj.layers ? [obj] : [];
        if (!snaps.length) {
          problems.push(`${file.name}: không nhận ra định dạng`);
          continue;
        }
        snaps.forEach((snap) => {
          const e = normalizeEntry(snap);
          if (!e) return;
          cacheRef.current.set(e.id, extractSpatial({ ...snap, snapshotId: e.id }));
          entries.push(e);
        });
      } catch (err) {
        problems.push(`${file.name}: ${err.message}${file.size > 200e6 ? ' (file rất lớn — hãy xuất theo từng ngày)' : ''}`);
      }
    }
    if (entries.length) {
      setImported((prev) => mergeSeries(prev, entries));
      setCacheVer((v) => v + 1);
    }
    setMessage(`Đã nhập ${entries.length} mốc từ ${files.length} file.${problems.length ? ` Lỗi: ${problems.join('; ')}` : ''}`);
  };

  /* -------------------------------------------------------------- analysis */

  const spatial = useMemo(() => {
    if (spatialMode === 'single') return selectedId ? cacheRef.current.get(selectedId) || null : null;
    const list = series.map((s) => cacheRef.current.get(s.id)).filter(Boolean);
    return list.length ? mergeSpatial(list) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spatialMode, selectedId, series, cacheVer]);

  const hotspots = useMemo(() => findHotspots(spatial), [spatial]);
  const movement = useMemo(() => estimateMovement(spatial, hotspots), [spatial, hotspots]);

  const insights = useMemo(
    () => sortInsights([...buildSpatialInsights(spatial, hotspots, movement), ...buildSeriesInsights(series)]),
    [spatial, hotspots, movement, series]
  );

  const kpi = useMemo(() => {
    if (!series.length) return null;
    const totalStrikes = series.reduce((s, e) => s + e.strikes, 0);
    const totalCG = series.reduce((s, e) => s + e.cg, 0);
    const totalCC = series.reduce((s, e) => s + e.cc, 0);
    const peak = series.reduce((a, b) => (b.strikes > a.strikes ? b : a), series[0]);
    return {
      snapshots: series.length,
      totalStrikes,
      avg: Math.round(totalStrikes / series.length),
      peak,
      cgShare: totalCG + totalCC > 0 ? totalCG / (totalCG + totalCC) : 0,
      maxAlerts: Math.max(...series.map((e) => e.dongSet))
    };
  }, [series]);

  const selected = series.find((s) => s.id === selectedId) || null;
  const visibleInsights = showAllInsights ? insights : insights.slice(0, 6);
  const cachedCount = series.filter((s) => cacheRef.current.has(s.id)).length;

  const exportReport = () => {
    const lines = [
      `# Gợi ý insight Hymetnet`,
      ``,
      `- Phạm vi: ${dateFilter === 'all' ? 'tất cả ngày' : dateFilter} · ${series.length} mốc`,
      `- Tạo lúc: ${new Date().toLocaleString('vi-VN')}`,
      ``,
      ...insights.flatMap((i) => [`## [${SEVERITY[i.severity].label}] ${i.title}`, `*${i.category}*`, ``, i.detail, ``, `> Gợi ý: ${i.suggestion}`, ``])
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hymetnet_insights_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  /* ------------------------------------------------------------------ UI */

  return (
    <div className="space-y-5 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-fuchsia-500 to-amber-500 p-2.5 text-white shadow-md shadow-fuchsia-500/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-slate-900 dark:text-slate-50">Chuyên sâu: Dông sét &amp; Radar (Hymetnet)</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Mô-đun riêng cho dữ liệu sét: D3.js · Observable Plot · Three.js — tìm điểm nóng, đột biến, hướng di chuyển và gợi ý đề tài.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">📅 Tất cả ngày ({dates.length})</option>
              {dates.map((d) => (
                <option key={d} value={d}>📅 {d.slice(8, 10)}/{d.slice(5, 7)}/{d.slice(0, 4)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadTimeline}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Tải lại
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-yellow-700"
            >
              <Upload className="h-4 w-4" /> Nhập file JSON
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`mt-4 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-xs transition ${
            dragOver ? 'border-amber-500 bg-amber-500/10' : 'border-slate-300 dark:border-slate-700'
          }`}
        >
          <FileJson className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="text-slate-500 dark:text-slate-400">
            Kéo thả các file <b>.json đã xuất</b> từ trang Hymetnet vào đây để phân tích cả dữ liệu cũ đã xóa khỏi database (xử lý hoàn toàn trên máy, không tải lên đâu).
            {imported.length > 0 && <span className="ml-1 font-semibold text-emerald-500">Đã nhập {imported.length} mốc.</span>}
          </div>
        </div>
        {message && <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800" role="status">{message}</div>}
        {error && <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</div>}
      </div>

      {loading && !series.length ? (
        <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> Đang tải dữ liệu…
        </div>
      ) : !series.length ? (
        <div className="rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-slate-800">
          Chưa có dữ liệu trên database. Hãy nhập các file JSON đã xuất để bắt đầu phân tích.
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { k: 'Số mốc phân tích', v: fmt(kpi.snapshots), s: `${dates.length} ngày` },
              { k: 'Tổng cú sét', v: fmt(kpi.totalStrikes), s: `TB ${fmt(kpi.avg)} / mốc` },
              { k: 'Đỉnh sét', v: fmt(kpi.peak.strikes), s: kpi.peak.label },
              { k: 'Sét mây–đất (CG)', v: `${(kpi.cgShare * 100).toFixed(0)}%`, s: 'trên tổng số cú' },
              { k: 'Cảnh báo dông tối đa', v: fmt(kpi.maxAlerts), s: 'xã/phường / mốc' }
            ].map((c) => (
              <div key={c.k} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.k}</div>
                <div className="mt-1 text-2xl font-bold text-amber-500">{c.v}</div>
                <div className="text-[11px] text-slate-400">{c.s}</div>
              </div>
            ))}
          </div>

          {/* Insights */}
          <Panel
            title="Gợi ý insight tự động"
            subtitle={`${insights.length} phát hiện từ ${series.length} mốc${selected ? ` · mốc đang chọn ${selected.label}` : ''}`}
            actions={
              <button type="button" onClick={exportReport} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700">
                <Download className="h-3.5 w-3.5" /> Tải báo cáo .md
              </button>
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              {visibleInsights.map((i) => {
                const sev = SEVERITY[i.severity];
                const Icon = sev.icon;
                return (
                  <article key={i.id} className={`rounded-xl border p-3.5 ${sev.cls}`}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${sev.iconCls}`} />
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sev.chip}`}>{sev.label}</span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">{i.category}</span>
                    </div>
                    <h3 className="text-[13px] font-bold leading-snug text-slate-100">{i.title}</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{i.detail}</p>
                    <p className="mt-2 flex gap-1.5 text-[11px] text-amber-300">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{i.suggestion}</span>
                    </p>
                  </article>
                );
              })}
            </div>
            {insights.length > 6 && (
              <button type="button" onClick={() => setShowAllInsights((v) => !v)} className="mt-3 cursor-pointer text-[11px] font-semibold text-amber-400 hover:underline">
                {showAllInsights ? 'Thu gọn' : `Xem thêm ${insights.length - 6} phát hiện`}
              </button>
            )}
          </Panel>

          {/* Timeline */}
          <Panel title="Diễn biến theo thời gian" subtitle="Bấm vào một cột để phân tích chi tiết không gian của mốc đó.">
            <TimelineChart series={series} selectedId={selectedId} onSelect={setSelectedId} />
          </Panel>

          {/* Spatial */}
          <Panel
            title="Phân tích không gian"
            subtitle={
              spatialMode === 'single'
                ? `Mốc ${selected?.label || '—'}${spatial ? ` · ${fmt(spatial.n)} cú sét` : ''}`
                : `Cộng dồn ${spatial?.mergedCount || 0}/${series.length} mốc đã nạp chi tiết${spatial ? ` · ${fmt(spatial.n)} cú sét` : ''}`
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-full border border-slate-700 text-[11px] font-semibold">
                  <button type="button" onClick={() => setSpatialMode('single')} className={`cursor-pointer px-3 py-1 ${spatialMode === 'single' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}>Một mốc</button>
                  <button type="button" onClick={() => setSpatialMode('merged')} className={`cursor-pointer px-3 py-1 ${spatialMode === 'merged' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}>Cộng dồn</button>
                </div>
                {spLoading && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
              </div>
            }
          >
            {spatialMode === 'merged' && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-[11px] text-slate-300">
                <span>Đã nạp chi tiết {cachedCount}/{series.length} mốc.</span>
                {[6, 12, 24].map((n) => (
                  <button key={n} type="button" disabled={!!batch} onClick={() => loadRecent(n)} className="cursor-pointer rounded-md border border-slate-600 px-2 py-0.5 hover:bg-slate-700 disabled:opacity-50">
                    Nạp {n} mốc gần nhất
                  </button>
                ))}
                {batch && <span className="text-amber-400">Đang nạp {batch.done}/{batch.total}…</span>}
                <span className="text-slate-500">(mỗi mốc ~2 MB)</span>
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 flex items-center gap-1 text-[11px] text-slate-400"><Compass className="h-3.5 w-3.5" /> Lớp bản đồ:</span>
              {[['points', 'Tia sét'], ['density', 'Mật độ'], ['hotspots', 'Điểm nóng'], ['alerts', 'Cảnh báo dông'], ['rain', 'Mưa lớn'], ['movement', 'Hướng di chuyển']].map(([k, label]) => (
                <Toggle key={k} active={layers[k]} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}>{label}</Toggle>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11px] font-semibold text-slate-400">Bản đồ mật độ (D3 contour density)</div>
                <DensityMap spatial={spatial} hotspots={hotspots} movement={movement} layers={layers} />
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Box className="h-3.5 w-3.5" /> Mô hình 3D (Three.js): vị trí × thời gian</span>
                  <div className="flex items-center gap-1.5">
                    <Toggle active={colorMode === 'type'} onClick={() => setColorMode('type')}>Màu theo loại</Toggle>
                    <Toggle active={colorMode === 'time'} onClick={() => setColorMode('time')}>Màu theo thời gian</Toggle>
                    <Toggle active={autoRotate} onClick={() => setAutoRotate((v) => !v)}>Tự xoay</Toggle>
                  </div>
                </div>
                <Strike3D spatial={spatial} hotspots={hotspots} colorMode={colorMode} autoRotate={autoRotate} />
              </div>
            </div>

            {hotspots.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[11px] text-slate-300">
                  <thead className="text-slate-500">
                    <tr><th className="py-1 pr-3">#</th><th className="pr-3">Khu vực gần nhất</th><th className="pr-3">Toạ độ</th><th className="pr-3 text-right">Số cú sét</th><th className="pr-3 text-right">Tỷ trọng</th><th className="text-right">CG</th></tr>
                  </thead>
                  <tbody>
                    {hotspots.map((h) => (
                      <tr key={h.rank} className="border-t border-slate-800">
                        <td className="py-1.5 pr-3 font-bold text-rose-400">{h.rank}</td>
                        <td className="pr-3">{h.place ? `${h.place.name}${h.place.province ? ` — ${h.place.province}` : ''}` : '—'}{h.place && h.place.distKm > 3 ? <span className="text-slate-500"> (~{Math.round(h.place.distKm)} km)</span> : null}</td>
                        <td className="pr-3 font-mono">{h.lat.toFixed(2)}, {h.lng.toFixed(2)}</td>
                        <td className="pr-3 text-right">{fmt(h.count)}</td>
                        <td className="pr-3 text-right">{(h.share * 100).toFixed(1)}%</td>
                        <td className="text-right">{(h.cgShare * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Plot charts */}
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Bản đồ nhiệt: giờ × ngày" subtitle="Quy luật hoạt động sét theo khung giờ (Observable Plot)">
              <HourDayHeatmap series={series} />
            </Panel>
            <div className="grid gap-5">
              <Panel title="Tỉnh/thành bị cảnh báo dông nhiều nhất" subtitle="Cộng dồn số xã/phường cảnh báo qua các mốc">
                <ProvinceBars series={series} kind="dongset" />
              </Panel>
              <Panel title="Tỉnh/thành có nhiều điểm mưa lớn" subtitle="Cộng dồn số điểm mưa lớn qua các mốc">
                <ProvinceBars series={series} kind="rain" />
              </Panel>
            </div>
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-slate-500">
            Cách tính: đột biến dựa trên z-score/tỷ lệ so với trung bình các mốc trước; điểm nóng gom tia sét theo ô lưới 0,25° (~28 km); hướng di chuyển
            suy ra bằng hồi quy tuyến tính của tâm cụm sét theo thời gian; “độ trúng cảnh báo” so khớp cảnh báo dông với tia sét trong bán kính ~15 km.
            Kết quả chỉ mang tính gợi ý thống kê, không thay thế dự báo chính thức.
          </p>
        </>
      )}
    </div>
  );
}
