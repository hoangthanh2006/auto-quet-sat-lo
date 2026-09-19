import { Users, Zap, Wrench, BarChart3, ScanText, Waves, Wind, Droplets, Leaf, Sparkles } from 'lucide-react';

const tools = [
  {
    id: 'tool-typhoon',
    title: 'Theo Dõi & Phân Tích Bão (JTWC & JMA)',
    description: 'Dữ liệu thời gian thực từ Hải quân Mỹ (JTWC) & Nhật Bản (JMA): Bản đồ đường đi bão 5 ngày, bán kính gió nguy hiểm, ước lượng đổ bộ đất liền VN, và so sánh tương quan với 500+ cơn bão lịch sử (1950 - nay).',
    icon: Wind,
    color: 'rose',
    badge: 'Real-time & Lịch sử'
  },
  {
    id: 'tool-environmental',
    title: 'Trình Thu Thập Dữ Liệu Môi Trường (crawlers.ipynb)',
    description: 'Bộ crawler hợp nhất: Mực nước & Dung tích 22 Hồ chứa (Tổng cục Thủy lợi), Mực nước sông & Cảnh báo lũ 5 cấp (VNDMS), và Cảnh báo sạt lở lũ quét cấp xã (NCHMF). Xuất CSV/Excel/Drive.',
    icon: Droplets,
    color: 'emerald',
    badge: 'Mới · Spotlight Hub'
  },
  {
    id: 'tool-luquet-satlo',
    title: 'Bản Đồ Lũ Quét & Sạt Lở Đất (NCHMF)',
    description: 'Bản đồ số hóa thời gian thực: Cảnh báo nguy cơ lũ quét sạt lở theo xã/huyện, 1.053 điểm sạt lở thực địa, 8.400+ trạm đo mưa, độ ẩm đất và ảnh radar thời tiết.',
    icon: Waves,
    color: 'cyan',
  },
  {
    id: 'tool-ev-lca',
    title: 'So Sánh Phát Thải Vòng Đời Xe Điện (Vietnam EV LCA)',
    description: 'Mô hình hóa phát thải GHG vòng đời xe theo phương pháp luận thích ứng lưới điện Việt Nam (EV vs Hybrid vs Xăng). Biểu đồ 4 giai đoạn phát thải và tính điểm hòa vốn (Break-even).',
    icon: Leaf,
    color: 'violet',
    badge: 'Phương pháp luận VnExpress'
  },
  {
    id: 'tool-ocr',
    title: 'Quét OCR Văn Bản (Ảnh & PDF)',
    description: 'Trích xuất văn bản tự động từ tệp Ảnh (PNG, JPG, WEBP) và tài liệu PDF bằng EasyOCR (Hỗ trợ Tiếng Việt + Tiếng Anh). Xuất TXT/CSV/Google Drive.',
    icon: ScanText,
    color: 'teal',
  },
  {
    id: 'tool-uvtu',
    title: 'UVTU Đảng Theo Khóa (XII, XIII, XIV)',
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
  rose: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/30 hover:bg-rose-100 dark:hover:bg-rose-900/40',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
  cyan: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/30 hover:bg-cyan-100 dark:hover:bg-cyan-900/40',
  violet: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/30 hover:bg-violet-100 dark:hover:bg-violet-900/40',
  teal: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/30 hover:bg-teal-100 dark:hover:bg-teal-900/40',
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
