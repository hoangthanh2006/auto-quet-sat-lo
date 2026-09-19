import { useState, useEffect, lazy, Suspense } from 'react';
import { LayoutDashboard, Users, Zap, Wrench, Home, Sun, Moon, BookOpen, BarChart3, ScanText, Waves, Loader2, LogOut, Wind, Droplets, Leaf } from 'lucide-react';
import LoginPage from './components/LoginPage';
import { getStoredAuthUser, logoutSpotlightUser } from './services/firebase';

const DynamicScraper = lazy(() => import('./components/DynamicScraper'));
const ToolUVTU = lazy(() => import('./components/ToolUVTU'));
const ToolNSO = lazy(() => import('./components/ToolNSO'));
const ToolOCR = lazy(() => import('./components/ToolOCR'));
const ToolLuquetSatlo = lazy(() => import('./components/ToolLuquetSatlo'));
const ToolTyphoon = lazy(() => import('./components/ToolTyphoon'));
const ToolEnvironmentalCrawlers = lazy(() => import('./components/ToolEnvironmentalCrawlers'));
const ToolEvLcaCalculator = lazy(() => import('./components/ToolEvLcaCalculator'));
const DashboardHome = lazy(() => import('./components/DashboardHome'));
const OtherTools = lazy(() => import('./components/OtherTools'));
const UsageGuide = lazy(() => import('./components/UsageGuide'));
const Glossary = lazy(() => import('./components/Glossary'));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      <span className="text-xs font-medium">Đang tải phân hệ dữ liệu...</span>
    </div>
  </div>
);

const NAV_GROUPS = [
  {
    group: 'Chính',
    items: [
      { id: 'home', label: 'Trang chủ', icon: Home, color: 'text-indigo-500' },
    ]
  },
  {
    group: 'Môi Trường & Thiên Tai (Spotlight Hub)',
    items: [
      { id: 'tool-typhoon', label: 'Theo dõi & Phân tích bão', icon: Wind, color: 'text-rose-500', badge: 'JTWC' },
      { id: 'tool-environmental', label: 'Thu thập Dữ liệu Môi trường', icon: Droplets, color: 'text-emerald-500', badge: 'Hồ / Sông' },
      { id: 'tool-luquet-satlo', label: 'Lũ quét & Sạt lở (NCHMF)', icon: Waves, color: 'text-cyan-500', badge: 'Map' },
      { id: 'tool-ev-lca', label: 'Tính Phát thải Xe điện (LCA)', icon: Leaf, color: 'text-teal-500', badge: 'LCA' },
    ]
  },
  {
    group: 'Bộ Công Cụ Dữ Liệu Báo Chí',
    items: [
      { id: 'tool-ocr', label: 'Quét OCR (Ảnh & PDF)', icon: ScanText, color: 'text-teal-500' },
      { id: 'tool-uvtu', label: 'UVTU Đảng theo khóa', icon: Users, color: 'text-blue-500' },
      { id: 'tool-dynamic', label: 'Dynamic Web Scraper', icon: Zap, color: 'text-purple-500' },
      { id: 'tool-nso', label: 'NSO Thống kê (nso.gov.vn)', icon: BarChart3, color: 'text-amber-500' },
      { id: 'other-tools', label: 'Sitemap Scraper', icon: Wrench, color: 'text-slate-500' },
      { id: 'glossary', label: 'Thuật ngữ Scraper', icon: BookOpen, color: 'text-rose-500' },
    ]
  }
];

function App() {
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const [currentPage, setCurrentPage] = useState('home');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await logoutSpotlightUser();
    setAuthUser(null);
  };

  if (!authUser) {
    return (
      <LoginPage 
        onLoginSuccess={(user) => setAuthUser(user)} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Sidebar - Glassmorphism */}
      <aside className="w-68 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 shadow-lg z-10 transition-colors duration-300">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2 font-heading">
            <div className="p-1.5 bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 rounded-lg text-white shadow-md shadow-emerald-500/20">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span>Spotlight Hub</span>
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Trung tâm Dữ liệu Môi trường & Báo chí</p>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                {grp.group}
              </div>
              {grp.items.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-indigo-600/5 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs border border-emerald-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : item.color}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        active ? 'bg-emerald-200 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        
        {/* User Card & Action Controls */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              SP
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {authUser.displayName || 'Ban Spotlight'}
                </p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                  Active
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={authUser.email}>
                {authUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title={darkMode ? 'Giao diện Sáng' : 'Giao diện Tối'}
            >
              {darkMode ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              <span>{darkMode ? 'Tối' : 'Sáng'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 transition-colors cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl">
          <Suspense fallback={<PageFallback />}>
            {currentPage === 'home' && (
              <>
                <UsageGuide />
                <DashboardHome onSelectTool={setCurrentPage} />
              </>
            )}
            {currentPage === 'tool-typhoon' && <ToolTyphoon />}
            {currentPage === 'tool-environmental' && <ToolEnvironmentalCrawlers />}
            {currentPage === 'tool-luquet-satlo' && <ToolLuquetSatlo />}
            {currentPage === 'tool-ev-lca' && <ToolEvLcaCalculator />}
            {currentPage === 'tool-ocr' && <ToolOCR />}
            {currentPage === 'tool-uvtu' && <ToolUVTU />}
            {currentPage === 'tool-dynamic' && <DynamicScraper />}
            {currentPage === 'tool-nso' && <ToolNSO />}
            {currentPage === 'glossary' && <Glossary />}
            {currentPage === 'other-tools' && <OtherTools />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
