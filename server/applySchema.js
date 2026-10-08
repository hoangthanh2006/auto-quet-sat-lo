import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const password = process.env.SUPABASE_DB_PASSWORD || process.argv[2];

if (!password) {
  console.error('❌ Lỗi: Cần cung cấp Supabase Database Password.');
  console.error('Cách dùng: node server/applySchema.js <YOUR-PASSWORD>');
  process.exit(1);
}

// Kết nối qua Supabase IPv4 Pooler (Seoul ap-northeast-2)
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const user = 'postgres.mmmnpsbnwbhracyuhhmd';
const port = 5432; // Session mode cho DDL Migration

async function main() {
  console.log(`🔄 Đang kết nối đến Supabase PostgreSQL (${host}:${port})...`);
  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Kết nối thành công! Đang thực thi schema.sql...');
    await client.query(sql);
    console.log('🎉 TOÀN BỘ BẢNG VÀ POLICIES ĐÃ ĐƯỢC TẠO THÀNH CÔNG TRÊN SUPABASE!');
  } catch (err) {
    console.error('❌ Thất bại:', err.message);
  } finally {
    await client.end();
  }
}

main();
