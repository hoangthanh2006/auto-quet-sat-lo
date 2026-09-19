import { useState, useEffect, lazy, Suspense } from 'react';
import { LayoutDashboard, Users, Zap, Wrench, Home, Sun, Moon, BookOpen, BarChart3, ScanText, Waves, Loader2, LogOut, Wind } from 'lucide-react';
import LoginPage from './components/LoginPage';
import { getStoredAuthUser, logoutSpotlightUser } from './services/firebase';

const DynamicScraper = lazy(() => import('./components/DynamicScraper'));
const ToolUVTU = lazy(() => import('./components/ToolUVTU'));
const ToolNSO = lazy(() => import('./components/ToolNSO'));
const ToolOCR = lazy(() => import('./components/ToolOCR'));
const ToolLuquetSatlo = lazy(() => import('./components/ToolLuquetSatlo'));
const ToolTyphoon = lazy(() => import('./components/ToolTyphoon'));
const DashboardHome = lazy(() => import('./components/DashboardHome'));
const OtherTools = lazy(() => import('./components/OtherTools'));
const UsageGuide = lazy(() => import('./components/UsageGuide'));
const Glossary = lazy(() => import('./components/Glossary'));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      <span className="text-xs font-medium">Đang tải công cụ...</span>
    </div>
  </div>
);

const NAV = [
  { id: 'home', label: 'Trang chủ', icon: Home, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' },
  { id: 'tool-typhoon', label: 'Theo dõi & Phân tích bão', icon: Wind, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  { id: 'tool-luquet-satlo', label: 'Lũ quét & Sạt lở (NCHMF)', icon: Waves, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' },
  { id: 'tool-ocr', label: 'Quét OCR (Ảnh & PDF)', icon: ScanText, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/30' },
  { id: 'tool-uvtu', label: 'UVTU theo khóa', icon: Users, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  { id: 'tool-dynamic', label: 'Dynamic Scraper', icon: Zap, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
  { id: 'tool-nso', label: 'NSO Scraper', icon: BarChart3, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  { id: 'glossary', label: 'Thuật ngữ Scraper', icon: BookOpen, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' },
  { id: 'other-tools', label: 'Sitemap Scraper', icon: Wrench, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
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

  // Nếu chưa đăng nhập, hiển thị màn hình Login
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
      <aside className="w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 shadow-lg z-10 transition-colors duration-300">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2 font-heading">
            <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-lg text-white shadow-md shadow-indigo-500/20">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            Data Crawler
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Bộ công cụ lấy dữ liệu đa năng</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-violet-600/10 to-indigo-600/5 text-violet-600 dark:text-violet-400 font-semibold shadow-sm border border-violet-500/10'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        {/* User Card & Action Controls */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          {/* User Profile */}
          <div className="flex items-center gap-2.5 px-2 py-2 mb-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              SP
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {authUser.displayName || 'Ban Spotlight'}
                </p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
                  Active
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={authUser.email}>
                {authUser.email}
              </p>
            </div>
          </div>

          {/* Theme & Logout Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              title={darkMode ? 'Giao diện Sáng' : 'Giao diện Tối'}
            >
              {darkMode ? <Moon className="w-3.5 h-3.5 text-violet-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              <span>{darkMode ? 'Tối' : 'Sáng'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 transition-colors"
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
        <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
          <Suspense fallback={<PageFallback />}>
            {currentPage === 'home' && (
              <>
                <UsageGuide />
                <DashboardHome onSelectTool={setCurrentPage} />
              </>
            )}
            {currentPage === 'tool-typhoon' && <ToolTyphoon />}
            {currentPage === 'tool-luquet-satlo' && <ToolLuquetSatlo />}
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
