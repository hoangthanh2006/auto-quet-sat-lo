import { useState, useMemo } from 'react';
import {
  Zap,
  Car,
  Bike,
  Sliders,
  TrendingDown,
  Info,
  Layers,
  Leaf,
  Factory,
  Battery,
  Flame,
  Gauge,
  Sparkles,
  Download,
  RotateCcw
} from 'lucide-react';

const VEHICLE_CLASSES = {
  car_c: {
    name: 'Ô tô C-Segment / Crossover (VF e34, VF 7 vs CX-5, Corolla Cross)',
    type: 'car',
    defaultDistance: 150000,
    bev: { mfg: 7200, batterySize: 60, consumption: 16.5, batteryType: 'lfp' },
    phev: { mfg: 7600, batterySize: 18, elecShare: 0.65, elecCons: 15.0, fuelCons: 3.8 },
    hev: { mfg: 7400, batterySize: 2.0, fuelCons: 4.6 },
    icev: { mfg: 6800, fuelCons: 7.8 },
  },
  car_b: {
    name: 'Ô tô B-Segment Đô thị (VF 5, VF 6 vs Vios, City, Creta)',
    type: 'car',
    defaultDistance: 150000,
    bev: { mfg: 5800, batterySize: 42, consumption: 13.5, batteryType: 'lfp' },
    phev: { mfg: 6200, batterySize: 13, elecShare: 0.65, elecCons: 12.5, fuelCons: 3.2 },
    hev: { mfg: 6000, batterySize: 1.5, fuelCons: 3.9 },
    icev: { mfg: 5400, fuelCons: 6.2 },
  },
  car_d: {
    name: 'Ô tô D/E-Segment SUV (VF 8, VF 9 vs Santa Fe, Everest, Explorer)',
    type: 'car',
    defaultDistance: 180000,
    bev: { mfg: 9000, batterySize: 88, consumption: 21.0, batteryType: 'nmc' },
    phev: { mfg: 9400, batterySize: 25, elecShare: 0.60, elecCons: 19.5, fuelCons: 4.8 },
    hev: { mfg: 9100, batterySize: 3.0, fuelCons: 6.2 },
    icev: { mfg: 8200, fuelCons: 10.5 },
  },
  moto: {
    name: 'Xe Máy Hai Bánh (Xe máy điện LFP vs Honda Vision / Air Blade 125-150cc)',
    type: 'moto',
    defaultDistance: 60000,
    bev: { mfg: 320, batterySize: 2.5, consumption: 3.2, batteryType: 'lfp' },
    phev: null,
    hev: null,
    icev: { mfg: 280, fuelCons: 2.2 },
  },
};

const GRID_SCENARIOS = [
  { id: 'grid_current', label: 'Hiện tại 2024 (Than ~48%)', value: 610, desc: 'Lưới điện hiện hành Việt Nam ~610 g CO₂/kWh' },
  { id: 'grid_pdp8_2030', label: 'Quy hoạch VIII 2030 (Tái tạo tăng)', value: 380, desc: 'Mục tiêu chuyển đổi năng lượng 2030 ~380 g CO₂/kWh' },
  { id: 'grid_netzero_2050', label: 'Net Zero 2050 (Xanh hóa)', value: 90, desc: 'Lưới điện phát thải cực thấp ~90 g CO₂/kWh' },
];

export default function ToolEvLcaCalculator() {
  const [selectedClass, setSelectedClass] = useState('car_c');
  const [distanceKm, setDistanceKm] = useState(150000);
  const [gridCi, setGridCi] = useState(610); // g CO2/kWh
  const [batteryCiLfp, setBatteryCiLfp] = useState(65); // kg CO2/kWh
  const [batteryCiNmc, setBatteryCiNmc] = useState(85); // kg CO2/kWh

  const vClass = VEHICLE_CLASSES[selectedClass];

  // Tính toán phát thải vòng đời 4 giai đoạn
  const results = useMemo(() => {
    const wttFuelPerLiter = 0.58; // kg CO2e / lít
    const ttwGasoline = 2.31; // kg CO2e / lít
    const ttwDiesel = 2.68;
    const gridLoss = 1.08; // 8% tổn thất truyền tải

    const calcEmission = (powertrainKey) => {
      const config = vClass[powertrainKey];
      if (!config) return null;

      let mfgVehicle = config.mfg || 0;
      let mfgBattery = 0;
      let wtt = 0;
      let ttw = 0;

      if (powertrainKey === 'bev') {
        const bCi = config.batteryType === 'nmc' ? batteryCiNmc : batteryCiLfp;
        mfgBattery = config.batterySize * bCi;
        const totalKwh = (distanceKm * config.consumption) / 100;
        wtt = (totalKwh * (gridCi / 1000)) * gridLoss;
        ttw = 0;
      } else if (powertrainKey === 'phev') {
        mfgBattery = config.batterySize * batteryCiNmc;
        const elecDist = distanceKm * config.elecShare;
        const fuelDist = distanceKm * (1 - config.elecShare);

        const totalKwh = (elecDist * config.elecCons) / 100;
        const totalLiters = (fuelDist * config.fuelCons) / 100;

        wtt = (totalKwh * (gridCi / 1000) * gridLoss) + (totalLiters * wttFuelPerLiter);
        ttw = totalLiters * ttwGasoline;
      } else if (powertrainKey === 'hev') {
        mfgBattery = config.batterySize * batteryCiNmc;
        const totalLiters = (distanceKm * config.fuelCons) / 100;
        wtt = totalLiters * wttFuelPerLiter;
        ttw = totalLiters * ttwGasoline;
      } else if (powertrainKey === 'icev') {
        mfgBattery = 0;
        const totalLiters = (distanceKm * config.fuelCons) / 100;
        wtt = totalLiters * wttFuelPerLiter;
        ttw = totalLiters * ttwGasoline;
      }

      const totalKg = mfgVehicle + mfgBattery + wtt + ttw;
      const gPerKm = (totalKg / distanceKm) * 1000;

      return {
        key: powertrainKey,
        mfgVehicle: Math.round(mfgVehicle),
        mfgBattery: Math.round(mfgBattery),
        wtt: Math.round(wtt),
        ttw: Math.round(ttw),
        totalKg: Math.round(totalKg),
        totalTons: (totalKg / 1000).toFixed(2),
        gPerKm: Math.round(gPerKm),
      };
    };

    const bev = calcEmission('bev');
    const phev = calcEmission('phev');
    const hev = calcEmission('hev');
    const icev = calcEmission('icev');

    // Điểm hòa vốn phát thải (Break-even mileage giữa BEV và ICEV)
    let breakEvenKm = null;
    if (bev && icev) {
      const extraMfg = (bev.mfgVehicle + bev.mfgBattery) - icev.mfgVehicle;
      const icevPerKm = (icev.wtt + icev.ttw) / distanceKm;
      const bevPerKm = (bev.wtt + bev.ttw) / distanceKm;
      const savingPerKm = icevPerKm - bevPerKm;
      if (savingPerKm > 0) {
        breakEvenKm = Math.round(extraMfg / savingPerKm);
      }
    }

    return { bev, phev, hev, icev, breakEvenKm };
  }, [selectedClass, distanceKm, gridCi, batteryCiLfp, batteryCiNmc, vClass]);

  const maxTotalKg = Math.max(
    results.icev?.totalKg || 0,
    results.bev?.totalKg || 0,
    results.phev?.totalKg || 0,
    results.hev?.totalKg || 0
  );

  return (
    <div className="space-y-6">
      {/* HEADER GIỚI THIỆU PHƯƠNG PHÁP LUẬN */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold mb-3 border border-white/30">
              <Leaf className="w-3.5 h-3.5 text-emerald-300" />
              <span>Vietnam Vehicle LCA Methodology (Spotlight Handover)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading">
              So Sánh Phát Thải Vòng Đời Xe (LCA) tại Việt Nam
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              Mô hình hóa phát thải khí nhà kính (GHG) toàn diện từ khai thác nguyên liệu, sản xuất pin, truyền tải lưới điện Việt Nam đến vận hành thực tế giữa Xe Điện (BEV) và Xe Xăng/Dầu (ICEV).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedClass('car_c');
                setDistanceKm(150000);
                setGridCi(610);
              }}
              className="px-3.5 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại chuẩn</span>
            </button>
          </div>
        </div>
      </div>

      {/* CHỌN PHÂN KHÚC XE & SLIDERS THAM SỐ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Cấu hình phân khúc & Kịch bản lưới điện (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Car className="w-4 h-4 text-indigo-500" />
              <span>1. Chọn Phân Khúc Phương Tiện</span>
            </h3>

            <div className="space-y-2">
              {Object.entries(VEHICLE_CLASSES).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedClass(key);
                    setDistanceKm(item.defaultDistance);
                  }}
                  className={`w-full p-3 rounded-xl text-left text-xs font-semibold transition-all border cursor-pointer ${
                    selectedClass === key
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.type === 'moto' ? <Bike className="w-4 h-4 text-cyan-500" /> : <Car className="w-4 h-4 text-indigo-500" />}
                    <span>{item.name}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Kịch bản lưới điện */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>2. Kịch Bản Lưới Điện Việt Nam</span>
              </h3>

              <div className="space-y-2">
                {GRID_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setGridCi(sc.value)}
                    className={`w-full p-2.5 rounded-xl text-left text-xs transition-all border cursor-pointer ${
                      gridCi === sc.value
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-bold shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{sc.label}</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{sc.value} g/kWh</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{sc.desc}</div>
                  </button>
                ))}
              </div>

              {/* Slider tùy chỉnh lưới điện */}
              <div className="pt-2">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                  <span>Hệ số phát thải lưới điện tự chỉnh:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{gridCi} g CO₂/kWh</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="800"
                  step="10"
                  value={gridCi}
                  onChange={(e) => setGridCi(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Slider quãng đường vòng đời */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Quãng đường vòng đời xe:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{distanceKm.toLocaleString()} km</span>
              </div>
              <input
                type="range"
                min="20000"
                max="300000"
                step="10000"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Cột phải: Biểu đồ phân rã phát thải & Kết quả so sánh (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card điểm hòa vốn phát thải (Break-even) */}
          {results.breakEvenKm && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                  Điểm Hòa Vốn Phát Thải (Break-even): <span className="font-mono text-emerald-700 dark:text-emerald-300">{results.breakEvenKm.toLocaleString()} km</span>
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Sau {results.breakEvenKm.toLocaleString()} km, Xe điện (BEV) bắt đầu phát thải ròng thấp hơn Xe xăng (ICEV), bù đắp toàn bộ lượng phát thải ban đầu từ khâu chế tạo pin.
                </div>
              </div>
            </div>
          )}

          {/* Biểu đồ phân rã 4 giai đoạn */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Tổng Phát Thải Vòng Đời (Tấn CO₂e)</span>
              </h3>
              <span className="text-[11px] text-slate-400">Trên {distanceKm.toLocaleString()} km</span>
            </div>

            {/* Chú giải 4 giai đoạn */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500" />
                <span>Sản xuất thân xe</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-600" />
                <span>Sản xuất pin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500" />
                <span>Khai thác & truyền tải (WTT)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500" />
                <span>Đốt nhiên liệu ống xả (TTW)</span>
              </div>
            </div>

            {/* Các thanh phát thải */}
            <div className="space-y-4 pt-2">
              {[
                { label: '⚡ Xe Thuần Điện (BEV)', data: results.bev, color: 'text-blue-600' },
                results.phev ? { label: '🔌 Plug-in Hybrid (PHEV)', data: results.phev, color: 'text-cyan-600' } : null,
                results.hev ? { label: '🔋 Hybrid Tự Sạc (HEV)', data: results.hev, color: 'text-purple-600' } : null,
                { label: '⛽ Xe Xăng / Dầu (ICEV)', data: results.icev, color: 'text-rose-600' },
              ].filter(Boolean).map((item) => {
                const d = item.data;
                const mfgPct = (d.mfgVehicle / maxTotalKg) * 100;
                const batPct = (d.mfgBattery / maxTotalKg) * 100;
                const wttPct = (d.wtt / maxTotalKg) * 100;
                const ttwPct = (d.ttw / maxTotalKg) * 100;

                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold ${item.color}`}>{item.label}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{d.totalTons} tấn CO₂e</span>
                        <span className="text-[10px] text-slate-400">({d.gPerKm} g/km)</span>
                      </div>
                    </div>

                    {/* Progress stacked bar */}
                    <div className="w-full h-5 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden flex shadow-2xs">
                      {mfgPct > 0 && <div className="bg-amber-500 h-full" style={{ width: `${mfgPct}%` }} title={`Sản xuất xe: ${(d.mfgVehicle / 1000).toFixed(2)} tấn`} />}
                      {batPct > 0 && <div className="bg-purple-600 h-full" style={{ width: `${batPct}%` }} title={`Sản xuất pin: ${(d.mfgBattery / 1000).toFixed(2)} tấn`} />}
                      {wttPct > 0 && <div className="bg-blue-500 h-full" style={{ width: `${wttPct}%` }} title={`Well-to-Tank: ${(d.wtt / 1000).toFixed(2)} tấn`} />}
                      {ttwPct > 0 && <div className="bg-rose-500 h-full" style={{ width: `${ttwPct}%` }} title={`Tank-to-Wheel: ${(d.ttw / 1000).toFixed(2)} tấn`} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* So sánh giảm phát thải % */}
            {results.bev && results.icev && (
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs space-y-1">
                <div className="font-bold text-blue-900 dark:text-blue-100 flex items-center justify-between">
                  <span>Mức giảm phát thải khi chọn Xe Điện (BEV):</span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                    -{Math.round((1 - results.bev.totalKg / results.icev.totalKg) * 100)}%
                  </span>
                </div>
                <div className="text-[11px] text-blue-700 dark:text-blue-300">
                  Tiết kiệm được <b>{((results.icev.totalKg - results.bev.totalKg) / 1000).toFixed(2)} tấn CO₂e</b> trong suốt {distanceKm.toLocaleString()} km vận hành tại Việt Nam.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
