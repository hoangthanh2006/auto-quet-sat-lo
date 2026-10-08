import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudRain,
  RefreshCw,
  Download,
  ExternalLink,
  Search,
  Radio,
  Clock,
  Loader2,
  MapPin,
  Droplets,
  AlertTriangle,
  Gauge,
  Database,
  ChevronDown,
  History
} from 'lucide-react';
import VrainRainMap from './VrainRainMap';
import {
  getVrainLatestData,
  subscribeVrainRealtime,
  getVrainHistoryTimeline,
  getVrainSnapshotData,
  triggerVrainManualSync
} from '../services/vrainClientService';

const LEVELS = ['Mưa rất to', 'Mưa to', 'Mưa vừa', 'Mưa nhỏ', 'Không mưa'];
const FALLBACK_COLORS = {
  'Mưa rất to': '#D84544',
  'Mưa to': '#F29F3D',
  'Mưa vừa': '#E8D44D',
  'Mưa nhỏ': '#4CAF8E',
  'Không mưa': '#94A3B8'
};
const PAGE_SIZE = 100;

const fmt = (n, digits = 1) => (Number.isFinite(Number(n)) ? Number(n).toFixed(digits) : '—');
const fmtInt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('vi-VN') : '—');

const dayLabel = (d) => {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

function downloadBlob(parts, filename) {
  const blob = new Blob(parts, { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function KpiCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <Icon size={16} className={tone} />
      </div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</div>}
    </div>
  );
}

export default function ToolVrain() {
  const [live, setLive] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'err', text }
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState('');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [focusStation, setFocusStation] = useState(null);
  const exportRef = useRef(null);

  const loadTimeline = useCallback(async () => {
    const res = await getVrainHistoryTimeline(2000);
    if (res.success) setTimeline(res.data || []);
  }, []);

  // Tải dữ liệu ban đầu + lắng nghe realtime
  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    (async () => {
      const res = await getVrainLatestData();
      if (cancelled) return;
      if (res.success) setLive(res.data);
      else setNotice({ type: 'err', text: res.message || 'Không tải được dữ liệu Vrain' });
      setLoading(false);
      await loadTimeline();
    })();
    try {
      unsub = subscribeVrainRealtime((r) => {
        if (r.success && r.data) setLive(r.data);
      });
    } catch (e) {
      console.warn('Vrain realtime:', e);
    }
    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
    };
  }, [loadTimeline]);

  // Đóng menu export khi click ra ngoài
  useEffect(() => {
    const onDown = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Tải snapshot lịch sử khi chọn
  useEffect(() => {
    if (!selectedId) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getVrainSnapshotData(selectedId).then((res) => {
      if (cancelled) return;
      if (res.success) setSnapshot(res.data);
      else setNotice({ type: 'err', text: res.message });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const days = useMemo(() => {
    const set = new Set(timeline.map((t) => t.date).filter(Boolean));
    return [...set].sort().reverse();
  }, [timeline]);

  const daySnapshots = useMemo(
    () => timeline.filter((t) => t.date === selectedDay).sort((a, b) => a.snapshotId.localeCompare(b.snapshotId)),
    [timeline, selectedDay]
  );

  const view = selectedId ? snapshot : live;
  const isLive = !selectedId;
  const summary = view?.summary || {};
  const counts = view?.counts || {};
  const stations = view?.stations || [];
  const cities = view?.cities || [];

  const colorOf = useMemo(() => {
    const map = { ...FALLBACK_COLORS };
    stations.forEach((s) => { if (s.l && s.c) map[s.l] = s.c; });
    cities.forEach((c) => { if (c.level && c.color) map[c.level] = c.color; });
    return map;
  }, [stations, cities]);

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stations.filter((s) => (!levelFilter || s.l === levelFilter) && (!q || (s.n || '').toLowerCase().includes(q)));
  }, [stations, search, levelFilter]);

  useEffect(() => setLimit(PAGE_SIZE), [search, levelFilter, view]);

  const levelCounts = summary.levelCounts || {};
  const totalStations = summary.totalStations || counts.stations_total || 0;
  const maxCount = Math.max(1, ...LEVELS.map((l) => levelCounts[l] || 0));

  const handleSelectDay = (day) => {
    setSelectedDay(day);
    const list = timeline.filter((t) => t.date === day).sort((a, b) => a.snapshotId.localeCompare(b.snapshotId));
    if (list.length) setSelectedId(list[list.length - 1].snapshotId);
  };

  const backToLive = () => {
    setSelectedId('');
    setSelectedDay('');
  };

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    const res = await triggerVrainManualSync();
    setSyncing(false);
    if (res && res.success !== false) {
      setNotice({ type: 'ok', text: 'Đã quét và lưu dữ liệu Vrain lên Firebase.' });
      const latest = await getVrainLatestData();
      if (latest.success) setLive(latest.data);
      loadTimeline();
    } else {
      setNotice({
        type: 'err',
        text: res?.error || res?.message || 'Không thể quét dữ liệu (cần backend đang chạy). Dữ liệu vẫn được tự động lưu mỗi giờ bởi GitHub Actions.'
      });
    }
  };

  const fetchSnapshots = async (ids) => {
    const out = [];
    let idx = 0;
    const worker = async () => {
      while (idx < ids.length) {
        const id = ids[idx++];
        const res = await getVrainSnapshotData(id);
        if (res.success) out.push(res.data);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, ids.length) }, worker));
    return out.sort((a, b) => (a.snapshotId || '').localeCompare(b.snapshotId || ''));
  };

  const handleExport = async (scope) => {
    setExportOpen(false);
    setExporting(scope);
    setNotice(null);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (scope === 'current') {
        if (!view) throw new Error('Chưa có dữ liệu để xuất');
        downloadBlob([JSON.stringify({ exportedAt: new Date().toISOString(), scope, snapshots: [view] })],
          `vrain_${view.snapshotId || stamp}.json`);
      } else {
        const day = selectedDay || days[0];
        const ids = (scope === 'day' ? timeline.filter((t) => t.date === day) : timeline).map((t) => t.snapshotId);
        if (!ids.length) throw new Error('Chưa có dữ liệu lịch sử để xuất');
        const snaps = await fetchSnapshots(ids);
        const parts = [`{"exportedAt":${JSON.stringify(new Date().toISOString())},"scope":${JSON.stringify(scope)},"count":${snaps.length},"snapshots":[`];
        snaps.forEach((s, i) => parts.push((i ? ',' : '') + JSON.stringify(s)));
        parts.push(']}');
        downloadBlob(parts, scope === 'day' ? `vrain_${day}.json` : `vrain_toan_bo_${stamp}.json`);
      }
      setNotice({ type: 'ok', text: 'Đã xuất file JSON.' });
    } catch (e) {
      setNotice({ type: 'err', text: e.message || 'Xuất dữ liệu thất bại' });
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white">
              <CloudRain className="text-sky-500" size={22} /> Đo mưa chuyên dụng (Vrain)
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Lượng mưa từ mạng lưới trạm đo của{' '}
              <a href="https://vrain.vn/landing" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400 hover:underline">
                vrain.vn <ExternalLink size={12} />
              </a>
              . Dữ liệu tự động lưu mỗi giờ lên Firebase.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1">
                <Radio size={11} /> {isLive ? 'Firebase live' : 'Lịch sử'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2.5 py-1">
                <Clock size={11} /> Cron mỗi giờ
              </span>
              {view?.vnTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1">
                  Dữ liệu: {view.dataTimeLabel || view.vnTime}
                </span>
              )}
              {view?.crawledVnTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1">
                  Quét lúc: {view.crawledVnTime}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="vrain-sync-now"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 transition"
            >
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Quét &amp; Đồng bộ ngay
            </button>

            <div className="relative" ref={exportRef}>
              <button
                id="vrain-export-menu"
                onClick={() => setExportOpen((o) => !o)}
                disabled={!!exporting}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 transition"
              >
                {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Xuất JSON <ChevronDown size={14} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">
                  <button id="vrain-export-current" onClick={() => handleExport('current')} className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Bản đang xem</div>
                    <div className="text-xs text-slate-500">{view?.vnTime || 'Chưa có dữ liệu'}</div>
                  </button>
                  <button id="vrain-export-day" onClick={() => handleExport('day')} className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Theo ngày</div>
                    <div className="text-xs text-slate-500">Ngày {dayLabel(selectedDay || days[0]) || '—'} (chọn ngày ở mục Lịch sử)</div>
                  </button>
                  <button id="vrain-export-all" onClick={() => handleExport('all')} className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Toàn bộ dữ liệu</div>
                    <div className="text-xs text-slate-500">{timeline.length} mốc giờ đã lưu</div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${notice.type === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'}`}>
            {notice.text}
          </div>
        )}
      </div>

      {/* History selector */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <History size={16} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lịch sử</span>
        <select
          id="vrain-day-select"
          value={selectedDay}
          onChange={(e) => (e.target.value ? handleSelectDay(e.target.value) : backToLive())}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
        >
          <option value="">Chọn ngày…</option>
          {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
        </select>
        <select
          id="vrain-hour-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={!selectedDay}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100 disabled:opacity-50"
        >
          {!selectedDay && <option value="">Chọn giờ…</option>}
          {daySnapshots.map((t) => (
            <option key={t.snapshotId} value={t.snapshotId}>
              {t.snapshotId.slice(9, 11)}:00 · {fmtInt(t.counts?.stations_raining)} trạm mưa
            </option>
          ))}
        </select>
        {!isLive && (
          <button id="vrain-back-live" onClick={backToLive} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5">
            Về Live
          </button>
        )}
        {loading && <Loader2 size={16} className="animate-spin text-sky-500" />}
      </div>

      {!view && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500">
          Chưa có dữ liệu Vrain. Bấm “Quét &amp; Đồng bộ ngay” (cần backend) hoặc chờ GitHub Actions chạy.
        </div>
      )}

      {view && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Database} label="Tổng số trạm" value={fmtInt(totalStations)} sub={`${fmtInt(counts.cities)} tỉnh/thành`} tone="text-slate-500" />
            <KpiCard icon={Droplets} label="Trạm đang mưa" value={fmtInt(summary.rainingStations ?? counts.stations_raining)} sub={`TB ${fmt(summary.avgDepthRaining)} mm/trạm mưa`} tone="text-sky-500" />
            <KpiCard icon={AlertTriangle} label="Mưa to trở lên" value={fmtInt(summary.heavyStations ?? counts.heavy_rain_stations)} sub={`${fmtInt(counts.very_heavy_stations)} trạm mưa rất to`} tone="text-rose-500" />
            <KpiCard icon={Gauge} label="Mưa lớn nhất (mm)" value={fmt(summary.maxDepth)} sub={summary.maxStation?.name} tone="text-amber-500" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">
            Giá trị mm là “lượng mưa hiện tại theo Vrain”; Vrain không công bố rõ khoảng thời gian tích lũy nên chưa xác nhận được là 1h hay 24h.
          </p>

          {/* Map + level distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <MapPin size={15} className="text-sky-500" /> Bản đồ trạm có mưa ({fmtInt(stations.length)})
              </div>
              <div className="h-[460px]">
                <VrainRainMap stations={stations} selectedStation={focusStation} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Phân bố cấp mưa</div>
              <div className="space-y-3">
                {LEVELS.map((l) => {
                  const n = levelCounts[l] || 0;
                  return (
                    <button
                      key={l}
                      onClick={() => setLevelFilter(levelFilter === l ? '' : l)}
                      className={`w-full text-left rounded-lg p-1 transition ${levelFilter === l ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colorOf[l] }} /> {l}
                        </span>
                        <span className="text-slate-500">{fmtInt(n)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(n / maxCount) * 100}%`, background: colorOf[l] }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Top tỉnh/thành mưa lớn</div>
              <ol className="space-y-1.5">
                {(summary.topCities || []).map((c, i) => (
                  <li key={c.city} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-200">{i + 1}. {c.city} <span className="text-slate-400">· {c.station}</span></span>
                    <span className="font-bold text-slate-900 dark:text-white">{fmt(c.depth)} mm</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Stations table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-200 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Trạm có mưa ({fmtInt(filteredStations.length)})
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="vrain-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm tên trạm…"
                    className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <select
                  id="vrain-level-filter"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2 py-1.5 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Mọi cấp mưa</option>
                  {LEVELS.filter((l) => l !== 'Không mưa').map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Trạm</th>
                    <th className="text-left px-3 py-2">Cấp mưa</th>
                    <th className="text-right px-3 py-2">mm</th>
                    <th className="text-right px-3 py-2">Vĩ độ, Kinh độ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStations.slice(0, limit).map((s, i) => (
                    <tr
                      key={`${s.n}-${s.lt}-${s.lg}-${i}`}
                      onClick={() => setFocusStation({ ...s })}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-800/60 cursor-pointer"
                    >
                      <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100">{s.n}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.c }} /> {s.l}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-slate-900 dark:text-white">{fmt(s.d)}</td>
                      <td className="px-3 py-1.5 text-right text-xs text-slate-500">{fmt(s.lt, 4)}, {fmt(s.lg, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredStations.length > limit && (
              <div className="p-3 text-center border-t border-slate-200 dark:border-slate-800">
                <button
                  id="vrain-show-more"
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className="text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  Xem thêm ({fmtInt(filteredStations.length - limit)} trạm)
                </button>
              </div>
            )}
          </div>

          {/* Cities table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Trạm mưa lớn nhất theo tỉnh/thành ({cities.length})
            </div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Tỉnh/Thành</th>
                    <th className="text-left px-3 py-2">Trạm</th>
                    <th className="text-left px-3 py-2">Khu vực</th>
                    <th className="text-left px-3 py-2">Cấp mưa</th>
                    <th className="text-right px-3 py-2">mm</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c) => (
                    <tr
                      key={c.cityId}
                      onClick={() => setFocusStation({ n: c.station, lt: c.lat, lg: c.lng, d: c.depth, l: c.level, c: c.color })}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-800/60 cursor-pointer"
                    >
                      <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100">{c.city}</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{c.station}</td>
                      <td className="px-3 py-1.5 text-slate-500 text-xs">{c.area}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /> {c.level}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-slate-900 dark:text-white">{fmt(c.depth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
