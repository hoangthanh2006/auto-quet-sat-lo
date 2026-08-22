import { Users, Zap, Wrench, BarChart3 } from 'lucide-react';

const tools = [
  {
    id: 'tool-uvtu',
    title: 'Lấy data từ trang Danh sách thành viên UVTU theo khóa',
    description: 'Scan links theo khóa Đại hội, chọn link và extract nội dung profile (họ tên, ngày sinh, quê quán, timeline...). Export JSON/CSV.',
    icon: Users,
    color: 'blue',
  },
  {
    id: 'tool-dynamic',
    title: 'Dynamic Scraper - Lấy Dữ Liệu Linh Hoạt',
    description: 'Phân tích cấu trúc trang, cấu hình selector (text/link/image/API/click_content), scrape và export bảng dữ liệu. Hỗ trợ SPA sidebar.',
    icon: Zap,
    color: 'purple',
  },
  {
    id: 'tool-nso',
    title: 'NSO Scraper (nso.gov.vn) - Dữ Liệu Thống Kê',
    description: 'Trích xuất bảng số liệu thống kê (PX-Web), báo cáo, thông cáo báo chí từ Tổng cục Thống kê theo 5 nhóm chuyên mục chính. Xuất CSV/JSON.',
    icon: BarChart3,
    color: 'amber',
  },
];

const colorClasses = {
  blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/30 hover:bg-blue-100 dark:hover:bg-blue-900/40',
  purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/30 hover:bg-purple-100 dark:hover:bg-purple-900/40',
  amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/30 hover:bg-amber-100 dark:hover:bg-amber-900/40',
  gray: 'bg-gray-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700/50',
};

export default function DashboardHome({ onSelectTool }) {
  return (
    <div className="space-y-8 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-1 font-heading">Trang chủ</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Chọn một công cụ bên dưới để bắt đầu lấy dữ liệu.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className="text-left bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
            >
              <div className={`inline-flex p-3 rounded-xl mb-4 border ${colorClasses[tool.color] || colorClasses.gray}`}>
                <Icon className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2 font-heading">{tool.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{tool.description}</p>
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 font-heading">
          <Wrench className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          Công cụ khác
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Các tool lấy data khác sẽ được thêm vào đây khi có.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => onSelectTool('other-tools')}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            Xem trang Công cụ khác
          </button>
        </div>
      </div>
    </div>
  );
}
