-- ============================================================================
-- SUPABASE SCHEMA CHO HỆ THỐNG DATA-CRAWL (Thay thế Firebase RTDB)
-- Dự án: https://mmmnpsbnwbhracyuhhmd.supabase.co
-- ============================================================================

-- 1. BẢNG TRẠNG THÁI ĐỒNG BỘ (SYNC STATUS)
create table if not exists public.sync_status (
  source text primary key,              -- 'vrain', 'hymetnet', 'luquet_satlo', etc.
  last_sync timestamptz default now(),
  last_snapshot_id text,
  status text default 'success',        -- 'success', 'error', 'running'
  message text,
  metadata jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 2. BẢNG BẢN GHI MỚI NHẤT (LATEST DATA CACHE)
create table if not exists public.latest_data (
  source text primary key,              -- 'vrain', 'hymetnet_all', 'hymetnet_lightning', etc.
  snapshot_id text,
  vn_time text,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- 3. BẢNG VRAIN (ĐO MƯA CHUYÊN DỤNG - vrain.vn)
create table if not exists public.vrain_timeline (
  snapshot_id text primary key,         -- ví dụ '20261008_1100'
  date text not null,                   -- '2026-10-08'
  hour int not null,                    -- 11
  vn_time text,                         -- '11:07 08/10/2026'
  crawled_vn_time text,
  counts jsonb default '{}'::jsonb,
  summary jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.vrain_snapshots (
  snapshot_id text primary key,
  date text not null,
  hour int not null,
  vn_time text,
  crawled_vn_time text,
  counts jsonb default '{}'::jsonb,
  summary jsonb default '{}'::jsonb,
  cities jsonb default '[]'::jsonb,
  stations jsonb default '[]'::jsonb,
  raw_payload jsonb,
  created_at timestamptz default now()
);

-- 4. BẢNG HYMETNET (DÔNG SÉT & RADAR - hymetnet.gov.vn)
create table if not exists public.hymetnet_timeline (
  snapshot_id text primary key,         -- ví dụ '20261008_1000'
  date text not null,
  hour int not null,
  vn_time text,
  crawled_vn_time text,
  counts jsonb default '{}'::jsonb,
  summary jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.hymetnet_snapshots (
  snapshot_id text primary key,
  date text not null,
  hour int not null,
  vn_time text,
  crawled_vn_time text,
  counts jsonb default '{}'::jsonb,
  summary jsonb default '{}'::jsonb,
  layers jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 5. BẢNG NCHMF LŨ QUÉT & SẠT LỞ
create table if not exists public.luquet_satlo_timeline (
  snapshot_id text primary key,
  bulletin_id text,
  type text default 'hourly',           -- 'hourly' | 'bulletin'
  date text,
  time text,
  vn_time text,
  counts jsonb default '{}'::jsonb,
  summary jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.luquet_satlo_snapshots (
  snapshot_id text primary key,
  bulletin_id text,
  type text default 'hourly',
  vn_time text,
  counts jsonb default '{}'::jsonb,
  summary jsonb default '{}'::jsonb,
  layers jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 6. TẠO INDEXES PHỤC VỤ TRUY VẤN NHANH THEO THỜI GIAN & NGÀY
create index if not exists idx_vrain_timeline_date on public.vrain_timeline(date desc);
create index if not exists idx_vrain_snapshots_date on public.vrain_snapshots(date desc);
create index if not exists idx_hymetnet_timeline_date on public.hymetnet_timeline(date desc);
create index if not exists idx_hymetnet_snapshots_date on public.hymetnet_snapshots(date desc);
create index if not exists idx_luquet_timeline_date on public.luquet_satlo_timeline(created_at desc);

-- 7. CẤU HÌNH ROW LEVEL SECURITY (RLS)
-- Cho phép công chúng đọc dữ liệu tự do (Public Read) giống Firebase .read: true
alter table public.sync_status enable row level security;
alter table public.latest_data enable row level security;
alter table public.vrain_timeline enable row level security;
alter table public.vrain_snapshots enable row level security;
alter table public.hymetnet_timeline enable row level security;
alter table public.hymetnet_snapshots enable row level security;
alter table public.luquet_satlo_timeline enable row level security;
alter table public.luquet_satlo_snapshots enable row level security;

-- Policies: Đọc công khai
create policy "Public read sync_status" on public.sync_status for select using (true);
create policy "Public read latest_data" on public.latest_data for select using (true);
create policy "Public read vrain_timeline" on public.vrain_timeline for select using (true);
create policy "Public read vrain_snapshots" on public.vrain_snapshots for select using (true);
create policy "Public read hymetnet_timeline" on public.hymetnet_timeline for select using (true);
create policy "Public read hymetnet_snapshots" on public.hymetnet_snapshots for select using (true);
create policy "Public read luquet_satlo_timeline" on public.luquet_satlo_timeline for select using (true);
create policy "Public read luquet_satlo_snapshots" on public.luquet_satlo_snapshots for select using (true);

-- Policies: Ghi/Cập nhật dữ liệu từ crawler (cho phép cả anon hoặc service_role ghi)
create policy "Allow insert sync_status" on public.sync_status for all using (true) with check (true);
create policy "Allow insert latest_data" on public.latest_data for all using (true) with check (true);
create policy "Allow insert vrain_timeline" on public.vrain_timeline for all using (true) with check (true);
create policy "Allow insert vrain_snapshots" on public.vrain_snapshots for all using (true) with check (true);
create policy "Allow insert hymetnet_timeline" on public.hymetnet_timeline for all using (true) with check (true);
create policy "Allow insert hymetnet_snapshots" on public.hymetnet_snapshots for all using (true) with check (true);
create policy "Allow insert luquet_satlo_timeline" on public.luquet_satlo_timeline for all using (true) with check (true);
create policy "Allow insert luquet_satlo_snapshots" on public.luquet_satlo_snapshots for all using (true) with check (true);

-- BẬT REALTIME REPLICATION (Cho phép client lắng nghe thay đổi thời gian thực)
alter publication supabase_realtime add table public.latest_data;
alter publication supabase_realtime add table public.sync_status;
