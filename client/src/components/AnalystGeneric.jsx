import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Upload,
  FileJson,
  Loader2,
  Lightbulb,
  Download,
  Database,
  CloudRain,
  Zap,
  X,
  AlertTriangle,
  Info,
  Table2,
  BarChart3,
  LineChart,
  Map as MapIcon,
  GitCompare,
  LayoutList,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ChevronDown,
  Mountain
} from 'lucide-react';
import VrainRainMap from './VrainRainMap';
import { HistogramChart, GroupBarChart, TimeSeriesChart, ScatterChart, CorrHeatmap, colorScale } from './AnalystGenericCharts';
import {
  parseFileContent,
  findRecordSets,
  buildDataset,
  buildInsights,
  groupAggregate,
  timeBuckets,
  correlationMatrix,
  geoPoints,
  fmtNum,
  formatDateTime
} from '../services/genericAnalyzer';
import { getVrainLatestData, getVrainHistoryTimeline, getVrainSnapshotData } from '../services/vrainClientService';
import { getHymetnetHistoryTimeline } from '../services/hymetnetClientService';
import { getTimelineFromSupabase } from '../services/supabaseClient';

const SEVERITY = {
  high: { label: 'Đáng chú ý', cls: 'border-rose-500/50 bg-rose-500/10', chip: 'bg-rose-500 text-white', icon: AlertTriangle, iconCls: 'text-rose-400' },
  medium: { label: 'Cần theo dõi', cls: 'border-amber-500/40 bg-amber-500/10', chip: 'bg-amber-500 text-white', icon: Zap, iconCls: 'text-amber-400' },
  info: { label: 'Thông tin', cls: 'border-slate-600/50 bg-slate-800/40', chip: 'bg-slate-600 text-white', icon: Info, iconCls: 'text-sky-400' }
};

const TYPE_STYLE = {
  number: 'bg-amber-500/20 text-amber-300',
  date: 'bg-sky-500/20 text-sky-300',
  category: 'bg-violet-500/20 text-violet-300',
  text: 'bg-slate-600/40 text-slate-300',
  id: 'bg-slate-600/40 text-slate-400',
  empty: 'bg-slate-700/40 text-slate-500'
};
const TYPE_LABEL = { number: 'số', date: 'thời gian', category: 'nhóm', text: 'văn bản', id: 'mã', empty: 'rỗng' };

const SELECT =
  'cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800';

const AGG_LABEL = { mean: 'Trung bình', sum: 'Tổng', max: 'Lớn nhất', count: 'Số dòng' };

const tick = () => new Promise((r) => setTimeout(r, 30));

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

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-400">
      {label}
      {children}
    </label>
  );
}

function ColSelect({ value, onChange, options, id }) {
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className={SELECT}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function downloadFile(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function AnalystGeneric() {
  const [datasets, setDatasets] = useState([]); // { id, name, sets, path, ds }
  const [activeId, setActiveId] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState('overview');
  const [sel, setSel] = useState({});
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [tableLimit, setTableLimit] = useState(100);
  const [sort, setSort] = useState({ col: null, dir: 'desc' });
  const [showReloadMenu, setShowReloadMenu] = useState(false);
  const fileRef = useRef(null);
  const reloadMenuRef = useRef(null);
  const idRef = useRef(1);

  const active = datasets.find((d) => d.id === activeId) || null;
  const ds = active?.ds || null;

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleOutside = (e) => {
      if (reloadMenuRef.current && !reloadMenuRef.current.contains(e.target)) {
        setShowReloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Reset lựa chọn khi đổi dataset
  useEffect(() => {
    setSel({});
    setTab('overview');
    setTableLimit(100);
    setSort({ col: null, dir: 'desc' });
    setShowAllInsights(false);
  }, [activeId, active?.path]);

  const addDataset = useCallback(async (name, sets, preferPath, sourceKind = null, replaceId = null) => {
    if (!sets.length) throw new Error('Không tìm thấy bảng dữ liệu (mảng bản ghi) trong nguồn này.');
    const chosen = (preferPath && sets.find((s) => s.path === preferPath)) || sets[0];
    await tick();
    const built = buildDataset(`${name}${sets.length > 1 ? ` › ${chosen.path}` : ''}`, chosen.rows);

    if (replaceId) {
      setDatasets((prev) =>
        prev.map((d) => (d.id === replaceId ? { ...d, name, sets, path: chosen.path, ds: built, sourceKind, loadedAt: new Date().toLocaleTimeString('vi-VN') } : d))
      );
      setActiveId(replaceId);
      return built;
    }

    const id = idRef.current++;
    setDatasets((prev) => [...prev, { id, name, sets, path: chosen.path, ds: built, sourceKind, loadedAt: new Date().toLocaleTimeString('vi-VN') }]);
    setActiveId(id);
    return built;
  }, []);

  const switchPath = async (path) => {
    if (!active) return;
    const set = active.sets.find((s) => s.path === path);
    if (!set) return;
    setBusy('switch');
    await tick();
    const built = buildDataset(`${active.name} › ${set.path}`, set.rows);
    setDatasets((prev) => prev.map((d) => (d.id === active.id ? { ...d, path, ds: built } : d)));
    setBusy('');
  };

  const removeDataset = (id) => {
    setDatasets((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (id === activeId) setActiveId(next.length ? next[next.length - 1].id : null);
      return next;
    });
  };

  /* ------------------------------------------------------------- nguồn: file */

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => /\.(json|ndjson|csv|tsv|txt)$/i.test(f.name) || f.type === 'application/json' || f.type === 'text/csv');
    if (!files.length) {
      setMessage({ type: 'err', text: 'Hãy chọn file .json, .csv hoặc .ndjson.' });
      return;
    }
    setBusy('file');
    const notes = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const sets = parseFileContent(file.name, text);
        const built = await addDataset(file.name, sets);
        notes.push(`${file.name}: ${fmtNum(built.nRows)} dòng × ${built.columns.length} cột`);
      } catch (e) {
        notes.push(`${file.name}: ${e.message}${file.size > 200e6 ? ' (file rất lớn — hãy chia nhỏ)' : ''}`);
      }
    }
    setBusy('');
    setMessage({ type: 'ok', text: notes.join(' · ') });
  };

  /* ---------------------------------------------------------- nguồn: có sẵn */

  const loadBuiltin = async (kind, replaceId = null) => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'vrain-stations' || kind === 'vrain-cities') {
        const res = await getVrainLatestData();
        if (!res.success) throw new Error(res.message || 'Không tải được dữ liệu Vrain');
        const label = res.data.vnTime || res.data.snapshotId || '';
        const sets = findRecordSets(res.data);
        await addDataset(
          `Vrain ${label}`,
          sets,
          kind === 'vrain-stations' ? 'stations' : 'cities',
          kind,
          replaceId
        );
      } else if (kind === 'vrain-timeline') {
        const res = await getVrainHistoryTimeline(2000);
        if (!res.success || !res.data.length) throw new Error('Chưa có timeline Vrain.');
        await addDataset('Vrain · timeline theo giờ', [{ path: '(timeline)', rows: res.data, count: res.data.length }], '(timeline)', kind, replaceId);
      } else if (kind === 'vrain-all') {
        const tl = await getVrainHistoryTimeline(2000);
        if (!tl.success || !tl.data.length) throw new Error('Chưa có timeline Vrain.');
        const ids = tl.data.slice(-48).map((t) => t.snapshotId);
        const snaps = [];
        let cursor = 0;
        const worker = async () => {
          while (cursor < ids.length) {
            const id = ids[cursor++];
            const r = await getVrainSnapshotData(id);
            if (r.success && r.data) snaps.push(r.data);
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker));
        if (!snaps.length) throw new Error('Không nạp được snapshot nào.');
        snaps.sort((a, b) => (a.snapshotId || '').localeCompare(b.snapshotId || ''));
        const sets = findRecordSets({ snapshots: snaps });
        await addDataset(`Vrain · ${snaps.length} mốc gần nhất`, sets, 'snapshots[*].stations', kind, replaceId);
      } else if (kind === 'hymetnet-timeline') {
        const res = await getHymetnetHistoryTimeline(2000);
        if (!res.success || !res.data.length) throw new Error('Chưa có timeline Hymetnet trên database.');
        await addDataset('Hymetnet · timeline theo giờ', [{ path: '(timeline)', rows: res.data, count: res.data.length }], '(timeline)', kind, replaceId);
      } else if (kind === 'luquet-satlo-timeline') {
        const res = await getTimelineFromSupabase('luquet_satlo', 2000);
        if (!res.success || !res.data.length) throw new Error('Chưa có timeline NCHMF Lũ quét sạt lở trên database.');
        await addDataset('NCHMF · Lũ quét & Sạt lở timeline', [{ path: '(timeline)', rows: res.data, count: res.data.length }], '(timeline)', kind, replaceId);
      }
      setMessage({ type: 'ok', text: `✅ Đã ${replaceId ? 'làm mới' : 'nạp'} thành công dữ liệu lúc ${new Date().toLocaleTimeString('vi-VN')}!` });
    } catch (e) {
      setMessage({ type: 'err', text: e.message || 'Không nạp được nguồn dữ liệu' });
    } finally {
      setBusy('');
      setShowReloadMenu(false);
    }
  };

  /* ------------------------------------------------------------- phân tích */

  const insights = useMemo(() => (ds ? buildInsights(ds) : []), [ds]);
  const visibleInsights = showAllInsights ? insights : insights.slice(0, 6);

  const colOpts = useMemo(() => {
    if (!ds) return null;
    const mk = (names) => names.map((n) => ({ value: n, label: n }));
    return {
      num: mk(ds.numCols),
      cat: mk([...ds.catCols, ...ds.textCols]),
      date: mk(ds.dateCols),
      metric: [{ value: '', label: '(đếm số dòng)' }, ...mk(ds.numCols)]
    };
  }, [ds]);

  const pick = (key, options, fallback = '') => {
    const v = sel[key];
    if (v !== undefined && (v === '' || options.some((o) => o.value === v))) return v;
    return fallback;
  };
  const setSelKey = (key) => (value) => setSel((s) => ({ ...s, [key]: value }));

  const availableTabs = useMemo(() => {
    if (!ds) return [];
    const t = [{ id: 'overview', label: 'Tổng quan', icon: LayoutList }];
    if (ds.numCols.length) t.push({ id: 'distribution', label: 'Phân bố', icon: BarChart3 });
    if (ds.catCols.length || ds.textCols.length) t.push({ id: 'groups', label: 'Theo nhóm', icon: Database });
    if (ds.dateCols.length) t.push({ id: 'time', label: 'Theo thời gian', icon: LineChart });
    if (ds.numCols.length >= 2) t.push({ id: 'relations', label: 'Tương quan', icon: GitCompare });
    if (ds.geo) t.push({ id: 'map', label: 'Bản đồ', icon: MapIcon });
    t.push({ id: 'table', label: 'Bảng dữ liệu', icon: Table2 });
    return t;
  }, [ds]);

  // Phân bố
  const distCol = ds ? pick('distCol', colOpts.num, ds.numCols[0]) : '';
  const distMeta = ds?.columns.find((c) => c.name === distCol);
  // Nhóm
  const groupCol = ds ? pick('groupCol', colOpts.cat, colOpts.cat[0]?.value) : '';
  const groupMetric = ds ? pick('groupMetric', colOpts.metric, '') : '';
  const groupAgg = groupMetric ? pick('groupAgg', [{ value: 'mean' }, { value: 'sum' }, { value: 'max' }], 'mean') : 'count';
  const groupRows = useMemo(() => (ds && groupCol ? groupAggregate(ds, groupCol, groupMetric || null, groupAgg, 15) : []), [ds, groupCol, groupMetric, groupAgg]);
  // Thời gian
  const timeCol = ds ? pick('timeCol', colOpts.date, ds.dateCols[0]) : '';
  const timeMetric = ds ? pick('timeMetric', colOpts.metric, '') : '';
  const timeAgg = timeMetric ? pick('timeAgg', [{ value: 'mean' }, { value: 'sum' }, { value: 'max' }], 'mean') : 'count';
  const timeData = useMemo(() => (ds && timeCol ? timeBuckets(ds, timeCol, timeMetric || null, timeAgg) : { gran: 'day', rows: [] }), [ds, timeCol, timeMetric, timeAgg]);
  // Tương quan
  const scatterX = ds ? pick('scatterX', colOpts.num, ds.numCols[0]) : '';
  const scatterY = ds ? pick('scatterY', colOpts.num, ds.numCols[1] || ds.numCols[0]) : '';
  const corr = useMemo(() => (tab === 'relations' && ds ? correlationMatrix(ds, ds.numCols.slice(0, 14)) : null), [tab, ds]);
  // Bản đồ
  const mapSize = ds ? pick('mapSize', colOpts.metric, ds.numCols.find((c) => /^(d|depth|value|mm|rain|luong)/i.test(c)) || '') : '';
  const mapStations = useMemo(() => {
    if (tab !== 'map' || !ds?.geo) return [];
    const pts = geoPoints(ds, { sizeCol: mapSize || null });
    if (!mapSize) return pts.map((p) => ({ n: p.label || '', lt: p.lt, lg: p.lg, d: 40, v: 1, l: '', c: '#38bdf8' }));
    let mn = Infinity;
    let mx = -Infinity;
    pts.forEach((p) => {
      if (p.v !== null) { if (p.v < mn) mn = p.v; if (p.v > mx) mx = p.v; }
    });
    const color = colorScale(mn, mx);
    return pts
      .filter((p) => p.v !== null)
      .map((p) => ({ n: p.label || '', lt: p.lt, lg: p.lg, d: mx > mn ? ((p.v - mn) / (mx - mn)) * 250 : 40, v: p.v, l: '', c: color(p.v) }));
  }, [tab, ds, mapSize]);
  // Bảng
  const tableCols = useMemo(() => (ds ? ds.columns.map((c) => c.name).slice(0, 14) : []), [ds]);
  const tableOrder = useMemo(() => {
    if (tab !== 'table' || !ds) return [];
    const idx = Array.from({ length: Math.min(ds.nRows, 200000) }, (_, i) => i);
    if (sort.col) {
      const vals = ds.cols[sort.col];
      const dir = sort.dir === 'asc' ? 1 : -1;
      idx.sort((a, b) => {
        const x = vals[a];
        const y = vals[b];
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'vi')) * dir;
      });
    }
    return idx;
  }, [tab, ds, sort]);

  const exportReport = () => {
    if (!ds) return;
    const lines = [
      `# Gợi ý insight — ${ds.name}`,
      '',
      `- ${fmtNum(ds.nRows)} dòng × ${ds.columns.length} cột`,
      `- Tạo lúc: ${new Date().toLocaleString('vi-VN')}`,
      '',
      ...insights.flatMap((i) => [`## [${SEVERITY[i.severity].label}] ${i.title}`, `*${i.category}*`, '', i.detail, '', `> Gợi ý: ${i.suggestion}`, ''])
    ];
    downloadFile(lines.join('\n'), `insights_${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown');
  };

  const exportCsv = () => {
    if (!ds) return;
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const names = ds.columns.map((c) => c.name);
    const rows = [names.map(esc).join(',')];
    ds.rows.forEach((r) => rows.push(names.map((n) => esc(r[n])).join(',')));
    downloadFile(`\uFEFF${rows.join('\n')}`, `${ds.name.replace(/[^\w.-]+/g, '_').slice(0, 60)}.csv`, 'text/csv');
  };

  const BUILTIN = [
    { id: 'vrain-stations', label: 'Vrain · trạm có mưa (mới nhất)', icon: CloudRain },
    { id: 'vrain-cities', label: 'Vrain · tỉnh/thành', icon: CloudRain },
    { id: 'vrain-all', label: 'Vrain · trạm × 48 mốc gần nhất', icon: CloudRain },
    { id: 'vrain-timeline', label: 'Vrain · timeline giờ', icon: CloudRain },
    { id: 'hymetnet-timeline', label: 'Hymetnet · timeline giờ', icon: Zap },
    { id: 'luquet-satlo-timeline', label: 'NCHMF · Lũ quét & Sạt lở', icon: Mountain }
  ];

  return (
    <div className="space-y-5 text-slate-800 dark:text-slate-100">
      {/* Nguồn dữ liệu */}
      <Panel
        title="1. Chọn nguồn dữ liệu"
        subtitle="Nhập file JSON/CSV bất kỳ (xử lý hoàn toàn trên máy, không tải lên đâu) hoặc nạp dữ liệu đã lưu của site."
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-xs transition ${dragOver ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700'}`}
        >
          <FileJson className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-[200px] flex-1 text-slate-400">
            Kéo thả file <b>.json · .csv · .ndjson</b> vào đây — mọi nguồn trong site (Hymetnet, Vrain, NCHMF, UVTU, NSO…) đều xuất được JSON để phân tích.
          </div>
          <div className="flex items-center gap-2">
            <button
              id="analyst-import"
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy === 'file'}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-yellow-700 disabled:opacity-60"
            >
              {busy === 'file' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Chọn file
            </button>

            {/* Menu Chọn tải lại data */}
            <div className="relative" ref={reloadMenuRef}>
              <button
                id="analyst-reload-menu-btn"
                type="button"
                onClick={() => setShowReloadMenu((prev) => !prev)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/25 transition shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                <span>Chọn tải lại data</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showReloadMenu ? 'rotate-180' : ''}`} />
              </button>

              {showReloadMenu && (
                <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl border border-slate-700 bg-slate-900/95 p-2.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/40">
                  {/* Nếu đang có bộ dữ liệu active */}
                  {active && (
                    <div className="mb-2 border-b border-slate-800 pb-2">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Bộ dữ liệu đang xem</div>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => {
                          if (active.sourceKind) {
                            loadBuiltin(active.sourceKind, active.id);
                          } else {
                            fileRef.current?.click();
                          }
                          setShowReloadMenu(false);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-amber-500/15 transition"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${busy ? 'animate-spin' : ''}`} />
                          <span className="truncate">Làm mới: {active.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-1">{active.loadedAt || 'vừa nạp'}</span>
                      </button>
                    </div>
                  )}

                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Chọn nguồn tải lại / nạp mới</div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    {BUILTIN.map((b) => {
                      const isViewing = active && active.sourceKind === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          disabled={!!busy}
                          onClick={() => {
                            // Tải lại và thay thế bộ dữ liệu đang xem nếu cùng nguồn, hoặc thêm mới
                            loadBuiltin(b.id, isViewing ? active.id : null);
                            setShowReloadMenu(false);
                          }}
                          className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 transition"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <b.icon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                            <span className="truncate">{b.label}</span>
                          </div>
                          {isViewing && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 shrink-0 ml-1">đang xem</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 border-t border-slate-800 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        fileRef.current?.click();
                        setShowReloadMenu(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 transition"
                    >
                      <Upload className="h-3.5 w-3.5 text-slate-400" />
                      <span>Nạp lại từ file máy tính (.json, .csv)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".json,.csv,.tsv,.ndjson,.txt,application/json,text/csv" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400">Dữ liệu đã lưu trên site:</span>
          {BUILTIN.map((b) => (
            <button
              key={b.id}
              id={`analyst-src-${b.id}`}
              type="button"
              disabled={!!busy}
              onClick={() => loadBuiltin(b.id)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-amber-500 hover:text-amber-300 disabled:opacity-50"
            >
              {busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <b.icon className="h-3.5 w-3.5" />} {b.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${message.type === 'ok' ? 'bg-slate-800 text-slate-300' : 'bg-rose-500/10 text-rose-400'}`} role="status">
            {message.text}
          </div>
        )}

        {datasets.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Bộ dữ liệu:</span>
            {datasets.map((d) => (
              <span
                key={d.id}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${d.id === activeId ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}
              >
                <button type="button" onClick={() => setActiveId(d.id)} className="cursor-pointer">
                  {d.name} · {fmtNum(d.ds.nRows)} dòng
                </button>
                {d.sourceKind && (
                  <button
                    type="button"
                    title={`Tải lại dữ liệu ${d.name} (cập nhật lúc ${d.loadedAt || 'vừa nạp'})`}
                    disabled={!!busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      loadBuiltin(d.sourceKind, d.id);
                    }}
                    className="cursor-pointer text-amber-400/80 hover:text-amber-300 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${busy === d.sourceKind && activeId === d.id ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button type="button" aria-label={`Xóa ${d.name}`} onClick={() => removeDataset(d.id)} className="cursor-pointer text-slate-500 hover:text-rose-400">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Panel>

      {!ds ? (
        <div className="rounded-2xl border border-slate-800 p-10 text-center text-sm text-slate-500">
          Chưa có dữ liệu. Hãy nhập một file hoặc chọn một nguồn ở trên để bắt đầu phân tích.
        </div>
      ) : (
        <>
          {/* Chọn bảng trong file + KPI */}
          <div className="flex flex-wrap items-center gap-3">
            {active.sets.length > 1 && (
              <Field label="Bảng dữ liệu trong nguồn">
                <select id="analyst-path" value={active.path} onChange={(e) => switchPath(e.target.value)} className={SELECT} disabled={busy === 'switch'}>
                  {active.sets.map((s) => (
                    <option key={s.path} value={s.path}>{s.path} ({fmtNum(s.count)} dòng)</option>
                  ))}
                </select>
              </Field>
            )}
            {busy === 'switch' && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}

            <div className="ml-auto flex items-center gap-2">
              {active.sourceKind && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => loadBuiltin(active.sourceKind, active.id)}
                  title={`Tải lại dữ liệu mới nhất cho bộ này (đã nạp: ${active.loadedAt || 'vừa xong'})`}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Tải lại dữ liệu này
                </button>
              )}
              <button type="button" onClick={exportCsv} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700">
                <Download className="h-3.5 w-3.5" /> Xuất bảng CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { k: 'Số dòng', v: fmtNum(ds.nRows), s: ds.truncated ? 'đã cắt bớt' : 'bản ghi' },
              { k: 'Số cột', v: fmtNum(ds.columns.length), s: `${ds.numCols.length} số · ${ds.catCols.length + ds.textCols.length} chữ` },
              { k: 'Cột thời gian', v: fmtNum(ds.dateCols.length), s: ds.dateCols[0] ? (() => { const m = ds.columns.find((c) => c.name === ds.dateCols[0]); return `${formatDateTime(m.min)} → ${formatDateTime(m.max)}`; })() : 'không có' },
              { k: 'Thiếu dữ liệu', v: `${((ds.columns.reduce((s, c) => s + c.missingPct, 0) / (ds.columns.length || 1)) * 100).toFixed(1)}%`, s: 'trung bình mỗi cột' },
              { k: 'Toạ độ', v: ds.geo ? 'Có' : 'Không', s: ds.geo ? `${ds.geo.latCol}, ${ds.geo.lngCol}` : 'không có bản đồ' }
            ].map((c) => (
              <div key={c.k} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.k}</div>
                <div className="mt-1 text-2xl font-bold text-amber-500">{c.v}</div>
                <div className="truncate text-[11px] text-slate-400" title={c.s}>{c.s}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {availableTabs.map((t) => (
              <button
                key={t.id}
                id={`analyst-tab-${t.id}`}
                role="tab"
                aria-selected={tab === t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tab === t.id ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'}`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <Panel
                title="Gợi ý insight tự động"
                subtitle={`${insights.length} phát hiện từ ${fmtNum(ds.nRows)} dòng của “${ds.name}”`}
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

              <Panel title="Hồ sơ các cột" subtitle="Kiểu dữ liệu tự nhận diện, tỷ lệ thiếu và tóm tắt giá trị.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[11px] text-slate-300">
                    <thead className="text-slate-500">
                      <tr><th className="py-1 pr-3">Cột</th><th className="pr-3">Kiểu</th><th className="pr-3 text-right">Thiếu</th><th className="pr-3 text-right">Khác nhau</th><th>Tóm tắt</th></tr>
                    </thead>
                    <tbody>
                      {ds.columns.map((c) => (
                        <tr key={c.name} className="border-t border-slate-800">
                          <td className="py-1.5 pr-3 font-mono text-slate-200">{c.name}</td>
                          <td className="pr-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_STYLE[c.type]}`}>{TYPE_LABEL[c.type]}</span></td>
                          <td className="pr-3 text-right">{(c.missingPct * 100).toFixed(0)}%</td>
                          <td className="pr-3 text-right">{fmtNum(c.distinct)}</td>
                          <td className="text-slate-400">
                            {c.type === 'number' && c.stats && `${fmtNum(c.stats.min)} – ${fmtNum(c.stats.max)} · TB ${fmtNum(c.stats.mean)} · trung vị ${fmtNum(c.stats.median)}`}
                            {c.type === 'date' && `${formatDateTime(c.min)} → ${formatDateTime(c.max)}`}
                            {(c.type === 'category' || c.type === 'text') && c.top && c.top.slice(0, 3).map((t) => `${t.value} (${fmtNum(t.count)})`).join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}

          {tab === 'distribution' && distCol && (
            <Panel
              title="Phân bố giá trị"
              subtitle="Histogram: các giá trị tập trung ở đâu, có đuôi dài/ngoại lai không."
              actions={<ColSelect id="analyst-dist-col" value={distCol} onChange={setSelKey('distCol')} options={colOpts.num} />}
            >
              <HistogramChart values={ds.cols[distCol]} label={distCol} />
              {distMeta?.stats && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 lg:grid-cols-8">
                  {[['Nhỏ nhất', distMeta.stats.min], ['Phân vị 25%', distMeta.stats.q1], ['Trung vị', distMeta.stats.median], ['Trung bình', distMeta.stats.mean], ['Phân vị 75%', distMeta.stats.q3], ['Phân vị 95%', distMeta.stats.p95], ['Lớn nhất', distMeta.stats.max], ['Ngoại lai', distMeta.stats.outliers]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-800/60 px-2.5 py-2">
                      <div className="text-slate-500">{k}</div>
                      <div className="mt-0.5 text-sm font-bold text-amber-400">{fmtNum(v)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === 'groups' && groupCol && (
            <Panel
              title="So sánh theo nhóm"
              subtitle="Top 15 nhóm theo chỉ số đã chọn."
              actions={
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Nhóm theo"><ColSelect id="analyst-group-col" value={groupCol} onChange={setSelKey('groupCol')} options={colOpts.cat} /></Field>
                  <Field label="Chỉ số"><ColSelect id="analyst-group-metric" value={groupMetric} onChange={setSelKey('groupMetric')} options={colOpts.metric} /></Field>
                  {groupMetric && (
                    <Field label="Cách tính">
                      <ColSelect id="analyst-group-agg" value={groupAgg} onChange={setSelKey('groupAgg')} options={[{ value: 'mean', label: 'Trung bình' }, { value: 'sum', label: 'Tổng' }, { value: 'max', label: 'Lớn nhất' }]} />
                    </Field>
                  )}
                </div>
              }
            >
              <GroupBarChart rows={groupRows} label={groupMetric ? `${AGG_LABEL[groupAgg]} ${groupMetric}` : 'Số dòng'} />
            </Panel>
          )}

          {tab === 'time' && timeCol && (
            <Panel
              title="Diễn biến theo thời gian"
              subtitle={`Gộp theo ${timeData.gran === 'hour' ? 'giờ' : timeData.gran === 'day' ? 'ngày' : 'tháng'} (giờ Việt Nam).`}
              actions={
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Cột thời gian"><ColSelect id="analyst-time-col" value={timeCol} onChange={setSelKey('timeCol')} options={colOpts.date} /></Field>
                  <Field label="Chỉ số"><ColSelect id="analyst-time-metric" value={timeMetric} onChange={setSelKey('timeMetric')} options={colOpts.metric} /></Field>
                  {timeMetric && (
                    <Field label="Cách tính">
                      <ColSelect id="analyst-time-agg" value={timeAgg} onChange={setSelKey('timeAgg')} options={[{ value: 'mean', label: 'Trung bình' }, { value: 'sum', label: 'Tổng' }, { value: 'max', label: 'Lớn nhất' }]} />
                    </Field>
                  )}
                </div>
              }
            >
              <TimeSeriesChart rows={timeData.rows} gran={timeData.gran} label={timeMetric ? `${AGG_LABEL[timeAgg]} ${timeMetric}` : 'Số dòng'} />
            </Panel>
          )}

          {tab === 'relations' && (
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Ma trận tương quan" subtitle="Màu đỏ: tăng cùng nhau · xanh: ngược chiều (tối đa 14 cột số).">
                {corr && <CorrHeatmap names={corr.names} matrix={corr.matrix} />}
              </Panel>
              <Panel
                title="Biểu đồ phân tán"
                subtitle="Mỗi chấm là một dòng; đường cam là xu hướng tuyến tính."
                actions={
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Trục X"><ColSelect id="analyst-scatter-x" value={scatterX} onChange={setSelKey('scatterX')} options={colOpts.num} /></Field>
                    <Field label="Trục Y"><ColSelect id="analyst-scatter-y" value={scatterY} onChange={setSelKey('scatterY')} options={colOpts.num} /></Field>
                  </div>
                }
              >
                <ScatterChart xs={ds.cols[scatterX]} ys={ds.cols[scatterY]} xLabel={scatterX} yLabel={scatterY} />
              </Panel>
            </div>
          )}

          {tab === 'map' && ds.geo && (
            <Panel
              title="Bản đồ điểm dữ liệu"
              subtitle={`${fmtNum(mapStations.length)} điểm${mapSize ? ` · kích thước & màu theo “${mapSize}”` : ''}. Bấm một điểm để xem chi tiết.`}
              actions={<Field label="Kích thước/màu theo"><ColSelect id="analyst-map-size" value={mapSize} onChange={setSelKey('mapSize')} options={colOpts.metric.map((o) => (o.value === '' ? { value: '', label: '(không, chỉ vị trí)' } : o))} /></Field>}
            >
              <div className="h-[520px]">
                <VrainRainMap stations={mapStations} unit={mapSize || 'điểm'} />
              </div>
            </Panel>
          )}

          {tab === 'table' && (
            <Panel title="Bảng dữ liệu" subtitle={`Hiển thị ${Math.min(tableLimit, tableOrder.length)}/${fmtNum(ds.nRows)} dòng · bấm tiêu đề cột để sắp xếp.`}>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[640px] text-left text-[11px] text-slate-300">
                  <thead className="sticky top-0 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      {tableCols.map((c) => (
                        <th key={c} className="cursor-pointer whitespace-nowrap px-2 py-1.5 hover:text-amber-300" onClick={() => setSort((s) => ({ col: c, dir: s.col === c && s.dir === 'desc' ? 'asc' : 'desc' }))}>
                          <span className="inline-flex items-center gap-1">
                            {c}
                            {sort.col === c && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableOrder.slice(0, tableLimit).map((ri, k) => (
                      <tr key={ri} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-2 py-1 text-slate-500">{k + 1}</td>
                        {tableCols.map((c) => {
                          const v = ds.rows[ri][c];
                          return <td key={c} className="max-w-[240px] truncate px-2 py-1" title={v === null || v === undefined ? '' : String(v)}>{v === null || v === undefined ? '—' : String(v)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tableLimit < tableOrder.length && (
                <button type="button" onClick={() => setTableLimit((l) => l + 200)} className="mt-3 cursor-pointer text-[11px] font-semibold text-amber-400 hover:underline">
                  Xem thêm 200 dòng
                </button>
              )}
            </Panel>
          )}

          <p className="px-1 text-[11px] leading-relaxed text-slate-500">
            Cách tính: ngoại lai theo quy tắc IQR (ngoài Q1−1,5·IQR / Q3+1,5·IQR); tương quan là hệ số Pearson trên các dòng có đủ cả hai giá trị; đỉnh và xu hướng so từng mốc với trung bình
            (và so ⅓ đầu với ⅓ cuối); điểm nóng không gian gom theo ô lưới 0,25° (~28 km). Kết quả chỉ mang tính gợi ý thống kê, cần kiểm chứng trước khi đưa tin.
          </p>
        </>
      )}
    </div>
  );
}
