const DB_FILE = 'class-manager.db';
let _db = null;
let _persistTimer = null;

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS classes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS students (
  id          TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  gender      TEXT,              -- 男 / 女
  photo       TEXT,
  description TEXT,
  birthday    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

CREATE TABLE IF NOT EXISTS family_members (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation   TEXT NOT NULL,
  name       TEXT,
  phone      TEXT,
  occupation TEXT,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_family_student ON family_members(student_id);

CREATE TABLE IF NOT EXISTS tag_dimensions (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL,
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id           TEXT PRIMARY KEY,
  dimension_id TEXT REFERENCES tag_dimensions(id) ON DELETE SET NULL,
  label        TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_tags_dimension ON tags(dimension_id);

CREATE TABLE IF NOT EXISTS student_tags (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (student_id, tag_id)
);

CREATE TABLE IF NOT EXISTS talk_records (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  type       TEXT NOT NULL,
  content    TEXT NOT NULL,
  follow_up  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_talks_student ON talk_records(student_id);
CREATE INDEX IF NOT EXISTS idx_talks_date ON talk_records(date);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_notes_student ON notes(student_id);

CREATE TABLE IF NOT EXISTS timeline_events (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  detail     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_events_student ON timeline_events(student_id);
`;

const SEED_SQL = `
INSERT OR IGNORE INTO tag_dimensions (id, name, color, sort) VALUES
  ('dim_learning', '学习能力', '#4A90D9', 1),
  ('dim_behavior', '行为习惯', '#52C41A', 2),
  ('dim_social',   '社交能力', '#FA8C16', 3),
  ('dim_mental',   '心理状态', '#722ED1', 4),
  ('dim_talent',   '特长爱好', '#F5222D', 5);

INSERT OR IGNORE INTO tags (id, dimension_id, label) VALUES
  ('tag_math_strong',   'dim_learning', '数学优秀'),
  ('tag_math_weak',     'dim_learning', '数学薄弱'),
  ('tag_eng_strong',    'dim_learning', '英语优秀'),
  ('tag_eng_weak',      'dim_learning', '英语薄弱'),
  ('tag_reading',       'dim_learning', '阅读能力强'),
  ('tag_disciplined',   'dim_behavior', '自律性强'),
  ('tag_distracted',    'dim_behavior', '容易分心'),
  ('tag_hw_delay',      'dim_behavior', '作业拖延'),
  ('tag_cooperative',   'dim_social',   '善于合作'),
  ('tag_introverted',   'dim_social',   '性格内向'),
  ('tag_leadership',    'dim_social',   '有领导力'),
  ('tag_stable',        'dim_mental',   '情绪稳定'),
  ('tag_anxious',       'dim_mental',   '易焦虑'),
  ('tag_resilient',     'dim_mental',   '抗压能力强'),
  ('tag_sports',        'dim_talent',   '体育特长'),
  ('tag_music',         'dim_talent',   '音乐天赋'),
  ('tag_coding',        'dim_talent',   '编程爱好');
`;

async function loadFromOPFS() {
  try {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_FILE);
    const file = await fh.getFile();
    const buf = await file.arrayBuffer();
    return buf.byteLength > 0 ? new Uint8Array(buf) : null;
  } catch {
    return null;
  }
}

async function saveToOPFS() {
  if (!_db) return;
  try {
    const data = _db.export();
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_FILE, { create: true });
    const writable = await fh.createWritable();
    await writable.write(data);
    await writable.close();
  } catch (err) {
    console.error('OPFS save failed:', err);
  }
}

function persistDebounced() {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => saveToOPFS(), 300);
}

function migrateDB() {
  try {
    const cols = querySQL("PRAGMA table_info(students)").map(c => c.name);
    if (!cols.includes('gender')) {
      _db.run("ALTER TABLE students ADD COLUMN gender TEXT");
    }
  } catch { /* table may not exist yet */ }
}

async function initDB() {
  const SQL = await initSqlJs({ locateFile: (file) => `lib/${file}` });
  const saved = await loadFromOPFS();
  _db = saved ? new SQL.Database(saved) : new SQL.Database();
  _db.run('PRAGMA foreign_keys = ON;');
  _db.run(SCHEMA_SQL);
  migrateDB();
  if (!saved) {
    _db.run(SEED_SQL);
    await saveToOPFS();
  }
  window.addEventListener('beforeunload', () => saveToOPFS());
  return _db;
}

function getDB() {
  return _db;
}

function runSQL(sql, params = []) {
  _db.run(sql, params);
  persistDebounced();
}

function querySQL(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = querySQL(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function exportDB() {
  return _db.export();
}

async function importDB(uint8Array) {
  const SQL = await initSqlJs({ locateFile: (file) => `lib/${file}` });
  _db = new SQL.Database(uint8Array);
  _db.run('PRAGMA foreign_keys = ON;');
  await saveToOPFS();
}

export { initDB, getDB, runSQL, querySQL, queryOne, genId, exportDB, importDB, saveToOPFS };
