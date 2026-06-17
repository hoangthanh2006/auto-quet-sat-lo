import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Zap, Wrench, Home, Sun, Moon, BookOpen } from 'lucide-react';
import DynamicScraper from './components/DynamicScraper';
import ToolUVTU from './components/ToolUVTU';
import DashboardHome from './components/DashboardHome';
import OtherTools from './components/OtherTools';
import UsageGuide from './components/UsageGuide';
import Glossary from './components/Glossary';

const NAV = [
  { id: 'home', label: 'Trang chủ', icon: Home, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' },
  { id: 'tool-uvtu', label: 'UVTU theo khóa', icon: Users, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  { id: 'tool-dynamic', label: 'Dynamic Scraper', icon: Zap, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
  { id: 'glossary', label: 'Thuật ngữ Scraper', icon: BookOpen, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' },
  { id: 'other-tools', label: 'Sitemap Scraper', icon: Wrench, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
];

function App() {
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
        
        {/* Dark Mode Switcher */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="text-slate-700 dark:text-slate-200 flex items-center gap-2">
              {darkMode ? <Moon className="w-4 h-4 text-violet-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span>Giao diện</span>
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {darkMode ? 'Tối' : 'Sáng'}
            </span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          {currentPage === 'home' && (
            <>
              <UsageGuide />
              <DashboardHome onSelectTool={setCurrentPage} />
            </>
          )}
          {currentPage === 'tool-uvtu' && <ToolUVTU />}
          {currentPage === 'tool-dynamic' && <DynamicScraper />}
          {currentPage === 'glossary' && <Glossary />}
          {currentPage === 'other-tools' && <OtherTools />}
        </div>
      </main>
    </div>
  );
}

export default App;
