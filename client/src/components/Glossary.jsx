import { useState } from 'react';
import { Book, HelpCircle, GitFork, Compass, Layers, ShieldAlert, Cpu, Search, Check, Sparkles, ChevronRight, CornerDownRight, FileText } from 'lucide-react';

const GLOSSARY_CATEGORIES = [
  { id: 'all', label: 'Tất cả thuật ngữ', icon: Book },
  { id: 'basics', label: 'Khái niệm cơ bản', icon: HelpCircle },
  { id: 'depth', label: 'Cấp độ cào (Depth)', icon: Layers },
  { id: 'techniques', label: 'Kỹ thuật nâng cao', icon: Compass }
];

const GLOSSARY_ITEMS = [
  {
    id: 'crawling-vs-scraping',
    category: 'basics',
    title: 'Data Crawling vs Data Scraping',
    slug: 'crawling-vs-scraping',
    summary: 'Phân biệt hai khái niệm thu thập dữ liệu tự động phổ biến nhất trên Internet.',
    icon: GitFork,
    details: (
      <div className="space-y-3">
        <p>Tuy thường được sử dụng thay thế nhau, hai khái niệm này có sự khác biệt rõ rệt về mục đích:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <h5 className="font-bold text-blue-700 dark:text-blue-400 text-sm mb-1.5">🕸️ Data Crawling (Quét liên kết)</h5>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Là quá trình <strong>tìm kiếm và lập chỉ mục</strong> (Indexing) các liên kết trên web. Crawler tự động đi qua các đường dẫn (hyperlink) từ trang này sang trang khác để thu thập URL (giống Googlebot lưu trữ các trang web).
            </p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
            <h5 className="font-bold text-purple-700 dark:text-purple-400 text-sm mb-1.5">✂️ Data Scraping (Trích xuất dữ liệu)</h5>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Là quá trình <strong>bóc tách và trích xuất dữ liệu cụ thể</strong> từ trang web (như lấy họ tên, giá sản phẩm, tiểu sử, ảnh). Scraper đi sâu vào cấu trúc HTML để kéo dữ liệu mục tiêu về lưu thành bảng Excel/JSON.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'css-selector',
    category: 'basics',
    title: 'CSS Selector (Bộ chọn phần tử)',
    slug: 'css-selector',
    summary: 'Công cụ chỉ đường giúp crawler tìm chính xác vị trí văn bản hoặc thuộc tính cần lấy trong mã nguồn HTML.',
    icon: CornerDownRight,
    details: (
      <div className="space-y-3">
        <p>CSS Selector là cú pháp dùng để chọn các phần tử HTML trên trang web. Dưới đây là các loại selector phổ biến nhất:</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-xs divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 text-left">Loại Selector</th>
                <th className="px-4 py-2 text-left">Cú pháp mẫu</th>
                <th className="px-4 py-2 text-left">Ý nghĩa giải thích</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <td className="px-4 py-2 font-bold font-mono text-purple-600">Class Selector</td>
                <td className="px-4 py-2 font-mono">.thumb-art</td>
                <td className="px-4 py-2">Chọn mọi phần tử có class là <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">thumb-art</code> (thường bắt đầu bằng dấu chấm).</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-bold font-mono text-blue-600">ID Selector</td>
                <td className="px-4 py-2 font-mono">#content</td>
                <td className="px-4 py-2">Chọn phần tử duy nhất có thuộc tính ID là <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">content</code> (thường bắt đầu bằng dấu thăng).</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-bold font-mono text-emerald-600">Tag Selector</td>
                <td className="px-4 py-2 font-mono">h1, table, a</td>
                <td className="px-4 py-2">Chọn trực tiếp theo tên thẻ HTML. Ví dụ chọn mọi thẻ tiêu đề lớn <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">&lt;h1&gt;</code>.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-bold font-mono text-amber-600">Compound Selector</td>
                <td className="px-4 py-2 font-mono">.box-content .title</td>
                <td className="px-4 py-2">Chọn phần tử có class <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.title</code> nằm bên trong một khối cha có class <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.box-content</code> (ngăn cách bởi dấu cách).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },
  {
    id: 'depth-options',
    category: 'depth',
    title: 'Số cấp độ cào (Crawl Depth Option)',
    slug: 'depth-options',
    summary: 'Tham số điều khiển độ sâu đệ quy của crawler, quyết định khoảng cách liên kết tối đa mà trình duyệt sẽ duyệt qua.',
    icon: Layers,
    details: (
      <div className="space-y-4">
        <p>Độ sâu (Depth) định nghĩa mức độ crawler sẽ "đào sâu" vào các đường dẫn xuất hiện trên trang web gốc. Hiểu rõ độ sâu giúp bạn tối ưu hóa tốc độ cào và lấy đúng tệp dữ liệu cần thiết:</p>
        
        {/* Visual Diagram */}
        <div className="p-4 bg-slate-950 text-slate-100 rounded-xl border border-slate-800 font-mono text-[11px] space-y-3 relative overflow-hidden shadow-inner">
          <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Sơ đồ mô phỏng đệ quy độ sâu cào (Crawl Tree)
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-blue-600/30 text-blue-400 border border-blue-500/20 rounded font-bold">Cấp 1</span>
              <span className="text-white">URL gốc (Trang bắt đầu cào)</span>
            </div>
            
            <div className="pl-6 border-l border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <CornerDownRight className="w-3 h-3 text-slate-500" />
                <span className="px-1.5 py-0.5 bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 rounded font-bold">Cấp 2</span>
                <span className="text-slate-350">Mọi liên kết được tìm thấy ở Trang Cấp 1 (ví dụ: Trang chi tiết bài viết A, B)</span>
              </div>
              
              <div className="pl-6 border-l border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <CornerDownRight className="w-3 h-3 text-slate-600" />
                  <span className="px-1.5 py-0.5 bg-purple-600/30 text-purple-400 border border-purple-500/20 rounded font-bold">Cấp 3</span>
                  <span className="text-slate-450">Các liên kết phụ tìm thấy bên trong Trang Cấp 2 (ví dụ: bình luận, bài viết liên quan)</span>
                </div>
                
                <div className="pl-6 border-l border-slate-850 text-slate-500 italic">
                  ... Tiếp diễn đệ quy tuần tự cho tới khi đạt giới hạn cấu hình (tối đa Cấp 10) ...
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          <p>
            📌 <strong>Lưu ý về số dòng kết quả và phân trang bảng dữ liệu:</strong>
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-amber-900 dark:text-amber-300">
            Khi chọn <strong>Cào 1 cấp (Chỉ trang gốc)</strong>, crawler chỉ truy cập đúng 1 địa chỉ web. Tuy nhiên, nếu trên trang web đó chứa nhiều phần tử trùng khớp (ví dụ: danh sách 30 bài viết khác nhau), bảng kết quả sẽ hiện ra <strong>30 dòng dữ liệu</strong>. Vì bảng hiển thị mặc định phân trang 10 dòng/trang, nên kết quả của bạn sẽ hiển thị thành <strong>3 trang trong bảng phân trang</strong>. Điều này không có nghĩa là crawler đã truy cập 3 trang web khác nhau!
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'puppeteer-headless',
    category: 'basics',
    title: 'Puppeteer & Headless Browser',
    slug: 'puppeteer-headless',
    summary: 'Công nghệ cốt lõi giúp hệ thống khởi chạy một trình duyệt Chrome ảo không có giao diện hiển thị để tự động truy cập trang web.',
    icon: Cpu,
    details: (
      <div className="space-y-3">
        <p><strong>Puppeteer</strong> là thư viện mã nguồn mở của Google cung cấp API để điều khiển trình duyệt Chrome hoặc Chromium thông qua code:</p>
        <ul className="list-disc list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400 pl-1">
          <li>
            <strong>Headless Mode (Trình duyệt ẩn)</strong>: Chạy trình duyệt ngầm mà không hiển thị cửa sổ window lên màn hình. Giúp tối ưu hóa tốc độ tải trang gấp 2-3 lần và giảm dung lượng sử dụng RAM.
          </li>
          <li>
            <strong>Render Javascript động</strong>: Trình duyệt Puppeteer tải toàn bộ mã Javascript giống hệt như trình duyệt bạn dùng thường ngày. Do đó nó giải quyết được các trang web AJAX, SPA, React, Angular mà phương pháp tải HTML tĩnh thông thường (như `axios` hay `cheerio`) không thể đọc được.
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 'url-filtering-limits',
    category: 'techniques',
    title: 'URL Filter & Rate Limiting (Lọc liên kết & Giới hạn)',
    slug: 'url-filtering-limits',
    summary: 'Các biện pháp bảo vệ giúp định hướng crawler đi đúng nội dung và bảo vệ IP của bạn không bị máy chủ đối tác chặn (block/ban).',
    icon: ShieldAlert,
    details: (
      <div className="space-y-3">
        <p>Cào dữ liệu đệ quy rất dễ dẫn đến tình trạng "bùng nổ" liên kết (ví dụ: cào sâu sang các link quảng cáo, diễn đàn ngoài tên miền). Chúng ta sử dụng 2 chốt chặn bảo vệ:</p>
        <div className="space-y-3 text-xs">
          <div className="flex gap-2 items-start">
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold rounded">Bộ lọc URL (Filter)</span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Nhập từ khóa filter (ví dụ: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">/nhan-su/</code>). Trình duyệt sẽ chỉ cào tiếp các liên kết có chứa chuỗi kí tự này, loại bỏ toàn bộ các liên kết giới thiệu sản phẩm hay điều hướng linh tinh khác.
            </p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold rounded">Giới hạn số trang (Max Links)</span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Rất quan trọng! Nếu bạn đặt đệ quy Cấp 3, số lượng URL phát hiện có thể lên tới 10,000 trang. Đặt giới hạn trang tối đa (ví dụ: 20 trang) sẽ lập tức ngắt tiến trình cào khi đạt đủ số trang, tránh làm nghẽn máy chủ đối tác và ngăn chặn việc bị IP blacklist.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'spa-dynamic-scraping',
    category: 'techniques',
    title: 'SPA (Single Page Application) Scraper',
    slug: 'spa-dynamic-scraping',
    summary: 'Kỹ thuật cào nâng cao dành riêng cho các trang web hiện đại không tải lại trang khi chuyển mục.',
    icon: Compass,
    details: (
      <div className="space-y-3">
        <p>Các website hiện đại (xây dựng bằng React/Vue) thường hiển thị dữ liệu chi tiết dưới dạng một Sidebar hoặc Modal nhảy ra ngay trên trang hiện tại khi người dùng click vào một danh sách, mà không hề thay đổi đường dẫn URL:</p>
        <ul className="list-disc list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400 pl-1">
          <li>
            <strong>Nguyên lý hoạt động</strong>: Scraper của chúng ta sẽ mô phỏng hành vi click chuột của con người. Nó xác định danh sách các nút bằng class selector (ví dụ: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">[data-id]</code>), click tuần tự vào từng mục, đợi khung sidebar cập nhật thông tin trong một khoảng thời gian nhất định (miliseconds), sau đó trích xuất nội dung sidebar lưu vào bộ nhớ.
          </li>
          <li>
            <strong>Dữ liệu khóa (data-id)</strong>: Dùng để xác định ID duy nhất của từng mục dữ liệu, ngăn việc cào lặp lại khi DOM cập nhật chậm hoặc bị trượt phần tử.
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 'api-data-json',
    category: 'techniques',
    title: 'API Data (JSON) (Cào Siêu Dữ Liệu Dạng JSON)',
    slug: 'api-data-json',
    summary: 'Kỹ thuật lấy dữ liệu cấu trúc ẩn được nhúng sẵn trong HTML bằng thẻ script hoặc các thuộc tính data-attributes.',
    icon: Cpu,
    details: (
      <div className="space-y-3">
        <p>Các trang web hiện đại (được xây dựng bằng React, Next.js, Angular, Nuxt...) thường nhúng sẵn một khối dữ liệu cấu trúc JSON ẩn dưới mỗi phần tử HTML (để phục vụ SEO, đồng bộ hóa State hoặc truyền tham số) mà không hiển thị trực tiếp lên màn hình.</p>
        <p>Chọn tùy chọn <strong>API Data (JSON)</strong> giúp bạn thu thập toàn bộ các trường thông tin ẩn đó chỉ bằng 1 bộ chọn duy nhất mà không cần tách lọc thủ công:</p>
        <ul className="list-disc list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400 pl-1">
          <li>
            <strong>Trích xuất thuộc tính (Attributes)</strong>: Hệ thống sẽ tự động quét các thuộc tính lưu trữ dữ liệu của thẻ như <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">data-json</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">data-data</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">data-api</code>, hoặc <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">data-url</code> trên phần tử được chọn để kéo về.
          </li>
          <li>
            <strong>Trích xuất thẻ Script ẩn</strong>: Nếu các thẻ trên không tồn tại, scraper sẽ tự động tìm kiếm thẻ kịch bản có định dạng <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">&lt;script type="application/json"&gt;</code> lồng bên trong, đọc nội dung và giải mã chuỗi JSON đó về dạng cấu trúc sạch.
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 'click-link-detail',
    category: 'techniques',
    title: 'Click link → Nội dung trang chi tiết',
    slug: 'click-link-detail',
    summary: 'Kỹ thuật cào sâu đệ quy tự động: quét liên kết ở trang danh sách, tự động mở trang chi tiết và kéo toàn bộ nội dung chi tiết về lưu trữ.',
    icon: Compass,
    details: (
      <div className="space-y-3">
        <p>Đây là kỹ thuật vô cùng mạnh mẽ giúp giải quyết bài toán cào dữ liệu dạng bài viết, sản phẩm khi trang danh sách chỉ hiển thị Tiêu đề + Ảnh đại diện ngắn gọn, còn nội dung cốt lõi nằm ở trang chi tiết.</p>
        <p><strong>Quy trình hoạt động:</strong></p>
        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400 pl-1">
          <li>
            <strong>Thu thập liên kết</strong>: Hệ thống tìm kiếm tất cả các thẻ liên kết chi tiết có thuộc tính <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">href</code> khớp với Selector bạn cấu hình ở Bước 2.
          </li>
          <li>
            <strong>Điều hướng tự động</strong>: Trình duyệt Puppeteer chạy ngầm sẽ lần lượt truy cập tự động vào từng liên kết đó (tối đa theo giới hạn Max Links).
          </li>
          <li>
            <strong>Bóc tách nội dung chi tiết</strong>: Hệ thống sẽ tự động bóc tách toàn bộ văn bản của trang chi tiết đó (hoặc bóc tách theo Selector cụ thể của phần thân bài viết được cấu hình) và gán trực tiếp vào cột kết quả song song với hàng dữ liệu ở trang danh sách.
          </li>
        </ol>
      </div>
    )
  }
];

export default function Glossary() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItem, setExpandedItem] = useState(null);

  const filteredItems = GLOSSARY_ITEMS.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-slate-850 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-md p-6 transition-all duration-300 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-80 h-80 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl text-white shadow-md shadow-blue-500/10">
            <Book className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-950 dark:text-slate-50 font-heading">
            Từ Điển Thuật Ngữ Web Scraper
          </h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
          Giải thích cặn kẽ các thuật ngữ chuyên môn, nguyên lý hoạt động của các bộ chọn dữ liệu (CSS Selector) và cấu hình độ sâu (Depth Options) giúp bạn làm chủ bộ công cụ.
        </p>
      </div>

      {/* Controls: Category + Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {GLOSSARY_CATEGORIES.map(category => {
            const Icon = category.icon;
            const active = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => {
                  setActiveCategory(category.id);
                  setExpandedItem(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-650 border-blue-600 text-white shadow-sm shadow-blue-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {category.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setExpandedItem(null);
            }}
            placeholder="Tìm kiếm thuật ngữ..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Glossary Items List */}
      <div className="space-y-4">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => {
            const Icon = item.icon || HelpCircle;
            const isExpanded = expandedItem === item.id;
            
            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ${
                  isExpanded 
                    ? 'border-blue-400 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900/10' 
                    : 'border-slate-200 dark:border-slate-800/80'
                }`}
              >
                {/* Accordion Trigger */}
                <button
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                  className="w-full p-5 text-left flex items-start gap-4 cursor-pointer"
                >
                  <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                    isExpanded 
                      ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' 
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2 mb-1">
                      {item.title}
                      {item.category === 'depth' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-400 rounded-full">
                          Depth
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed font-normal">
                      {item.summary}
                    </p>
                  </div>
                  <div className={`mt-2 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-450 dark:text-slate-500 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-500 border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="px-5 pb-6 border-t border-slate-100 dark:border-slate-800/80 pt-4 text-slate-700 dark:text-slate-350 text-xs leading-relaxed space-y-4">
                    {item.details}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-12 text-center transition-all duration-300">
            <Search className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4 animate-pulse" />
            <h3 className="text-base font-bold text-slate-850 dark:text-slate-200 mb-1">Không tìm thấy thuật ngữ phù hợp</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Thử tìm kiếm với từ khóa khác như "depth", "crawling", "selector"...</p>
          </div>
        )}
      </div>

      {/* Cheat Sheet Box */}
      <div className="bg-gradient-to-r from-blue-650 to-indigo-650 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden transition-all">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-40 h-40 bg-white/5 rounded-full blur-xl" />
        <h3 className="text-base font-black flex items-center gap-2 mb-3 font-heading">
          <Sparkles className="w-5 h-5 text-amber-300" />
          Mẹo cào dữ liệu nhanh cho người mới bắt đầu:
        </h3>
        <ul className="text-xs space-y-3 leading-relaxed text-blue-50">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <span><strong>Luôn dùng tính năng "Phân tích trang" trước</strong>: Giúp bạn hiểu nhanh cấu trúc trang web và lọc ra các CSS Selector gợi ý có sẵn, thay vì mò bằng tay trong F12.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <span><strong>Chạy thử (Test Selector) từng trường</strong>: Bấm vào biểu tượng Con mắt ở Bước 2 để hệ thống chạy thử xem bộ chọn đó có ra đúng nội dung bạn cần hay không trước khi bấm cào quy mô lớn.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <span><strong>Khi cào đệ quy (nhiều cấp)</strong>: Hãy bắt đầu với số cấp nhỏ trước (ví dụ 2 cấp) và đặt giới hạn trang (Max Links) khoảng 10-20 trang để đảm bảo dữ liệu chạy đúng cấu trúc mong muốn.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
