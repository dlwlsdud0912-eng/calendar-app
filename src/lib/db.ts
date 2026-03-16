import { Pool } from '@neondatabase/serverless';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query(text: string, params?: (string | number | boolean | null | undefined | string[] | number[])[]) {
  const p = getPool();
  return p.query(text, params);
}

export async function initDb() {
  // users 테이블
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email_verified BOOLEAN DEFAULT FALSE,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  // email_verifications 테이블 (비밀번호 찾기용)
  await query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'password_reset',
      expires_at TEXT NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email)`);

  // folders 테이블
  await query(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366F1',
      "order" INTEGER DEFAULT 0,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'team',
      icon TEXT,
      created_at TEXT DEFAULT (NOW()::TEXT)
    )
  `);

  // user_folders 테이블
  await query(`
    CREATE TABLE IF NOT EXISTS user_folders (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (NOW()::TEXT),
      PRIMARY KEY (user_id, folder_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_folders_user_id ON user_folders(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_folders_folder_id ON user_folders(folder_id)`);

  // calendar_events 테이블
  await query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      customer_id TEXT,
      customer_name TEXT,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_end_date TEXT,
      event_type TEXT NOT NULL DEFAULT '일상',
      event_time TEXT,
      amount BIGINT,
      memo TEXT,
      completed BOOLEAN DEFAULT FALSE,
      import_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_calendar_events_folder_id ON calendar_events(folder_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON calendar_events(event_date)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_calendar_events_deleted_at ON calendar_events(deleted_at)`);

  // event_categories 테이블
  await query(`
    CREATE TABLE IF NOT EXISTS event_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color_bg TEXT NOT NULL DEFAULT '#f3f4f6',
      color_text TEXT NOT NULL DEFAULT '#374151',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_event_categories_user_id ON event_categories(user_id)`);

  // keywords 컬럼 마이그레이션 (기존 DB에 없을 수 있음)
  try {
    await query(`ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS keywords TEXT NOT NULL DEFAULT ''`);
  } catch {
    // 이미 존재하면 무시
  }
}

let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

export async function ensureDb(): Promise<void> {
  if (dbInitialized) return;
  if (!dbInitPromise) {
    dbInitPromise = initDb()
      .then(() => { dbInitialized = true; })
      .catch((err) => { dbInitPromise = null; throw err; });
  }
  return dbInitPromise;
}
