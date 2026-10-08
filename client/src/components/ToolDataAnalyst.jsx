import { lazy, Suspense, useState } from 'react';
import { Activity, Loader2, Sparkles, Zap } from 'lucide-react';

// Hai mô-đun nặng được nạp theo nhu cầu (Three.js/D3 chỉ tải khi mở tab tương ứng).
const AnalystGeneric = lazy(() => import('./AnalystGeneric'));
const AnalystHymetnet = lazy(() => import('./AnalystHymetnet'));

const MODES = [
  { id: 'generic', label: 'Phân tích tổng quát', hint: 'Mọi bộ dữ liệu JSON/CSV của site', icon: Sparkles },
  { id: 'hymetnet', label: 'Chuyên sâu: Dông sét (Hymetnet)', hint: 'Điểm nóng, hướng di chuyển, mô hình 3D', icon: Zap }
];

const Fallback = () => (
  <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-slate-400">
    <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> Đang tải công cụ phân tích…
  </div>
);

/**
 * Trang Phân tích dữ liệu CHUNG cho toàn site.
 * - “Phân tích tổng quát”: nhận bất kỳ bộ dữ liệu nào (file JSON/CSV hoặc dữ liệu đã lưu), tự nhận diện cột,
 *   tìm ngoại lai, xu hướng, tương quan, điểm nóng không gian và gợi ý đề tài.
 * - “Chuyên sâu: Dông sét”: mô-đun riêng cho dữ liệu sét Hymetnet (giữ nguyên các phân tích đặc thù).
 */
export default function ToolDataAnalyst() {
  const [mode, setMode] = useState('generic');

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-fuchsia-500 to-amber-500 p-2.5 text-white shadow-md shadow-fuchsia-500/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-slate-900 dark:text-slate-50">Phân tích dữ liệu</h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Công cụ chung cho toàn bộ dữ liệu của site · D3.js · Observable Plot · Three.js — tự tìm ngoại lai, xu hướng, tương quan, điểm nóng và gợi ý đề tài.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist">
            {MODES.map((m) => (
              <button
                key={m.id}
                id={`analyst-mode-${m.id}`}
                role="tab"
                aria-selected={mode === m.id}
                type="button"
                title={m.hint}
                onClick={() => setMode(m.id)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  mode === m.id
                    ? 'border-amber-500 bg-amber-500/15 text-amber-500'
                    : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Suspense fallback={<Fallback />}>{mode === 'generic' ? <AnalystGeneric /> : <AnalystHymetnet />}</Suspense>
    </div>
  );
}
