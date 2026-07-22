import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DB_PATH, RETENTION_DAYS, ensureSafeDataDir } from './config.mjs'
import { encrypt, decrypt, hashOpaque } from './crypto.mjs'

export const SCHEMA_VERSION = 6

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agent_state(id INTEGER PRIMARY KEY CHECK(id = 1), status TEXT NOT NULL, last_error TEXT, account_hint TEXT, device_name TEXT, qr TEXT, pairing_code TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS whatsapp_auth(kind TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(kind, name));
CREATE TABLE IF NOT EXISTS contacts(id TEXT PRIMARY KEY, jid TEXT NOT NULL, display_name TEXT, phone TEXT, suppressed INTEGER NOT NULL DEFAULT 0, nickname TEXT, wa_name TEXT, source TEXT DEFAULT 'whatsapp', last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS broadcast_lists(id TEXT PRIMARY KEY, name TEXT, jid TEXT, member_count INTEGER NOT NULL DEFAULT 0, members_readable INTEGER NOT NULL DEFAULT 0, discovered_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS broadcast_members(list_id TEXT NOT NULL, jid TEXT NOT NULL, opaque_id TEXT NOT NULL, PRIMARY KEY(list_id, jid));
CREATE TABLE IF NOT EXISTS content_items(id TEXT PRIMARY KEY, kind TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, excerpt TEXT, body TEXT, url TEXT NOT NULL, image TEXT, date TEXT, words INTEGER NOT NULL DEFAULT 0, audio_json TEXT, keywords TEXT, hash TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(kind, slug));
CREATE VIRTUAL TABLE IF NOT EXISTS content_items_fts USING fts5(id UNINDEXED, title, excerpt, body, keywords, kind, tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, approved_at TEXT, scheduled_at TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS campaign_targets(campaign_id TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL, suppressed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(campaign_id, target_id));
CREATE TABLE IF NOT EXISTS message_jobs(id TEXT PRIMARY KEY, campaign_id TEXT, jid TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS message_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, state TEXT NOT NULL, error TEXT, attempted_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS processed_messages(message_id TEXT PRIMARY KEY, jid TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox_messages(message_id TEXT PRIMARY KEY, jid TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_sessions(jid TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'suggest-only', content_id TEXT, opened_at TEXT, last_user_at TEXT, manual_until TEXT, followup_json TEXT, context_json TEXT, wake_version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_preferences(jid TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sent_content(jid TEXT NOT NULL, content_id TEXT NOT NULL, sent_at TEXT NOT NULL, PRIMARY KEY(jid, content_id));
CREATE TABLE IF NOT EXISTS content_reservations(jid TEXT NOT NULL, content_id TEXT NOT NULL, reserved_at TEXT NOT NULL, PRIMARY KEY(jid, content_id));
CREATE TABLE IF NOT EXISTS saved_content(jid TEXT NOT NULL, content_id TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY(jid, content_id));
CREATE TABLE IF NOT EXISTS answer_evidence(id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, intent TEXT NOT NULL, content_ids_json TEXT NOT NULL, reply_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS privacy_tombstones(jid TEXT PRIMARY KEY, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reply_rules(id TEXT PRIMARY KEY, name TEXT NOT NULL, keywords_json TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, match_type TEXT NOT NULL DEFAULT 'any', action_type TEXT NOT NULL DEFAULT 'text', response_text TEXT, content_query TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reply_rule_versions(id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intent_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, input_hash TEXT NOT NULL, intent TEXT NOT NULL, confidence REAL NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS unresolved_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, input_hash TEXT NOT NULL, text_preview TEXT NOT NULL, reason TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS learning_patterns(id INTEGER PRIMARY KEY AUTOINCREMENT, pattern_hash TEXT NOT NULL UNIQUE, canonical_hash TEXT NOT NULL, phrase TEXT NOT NULL, hits INTEGER NOT NULL DEFAULT 1, candidate_intent TEXT, confirmations INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'observing', first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, learned_at TEXT);
CREATE TABLE IF NOT EXISTS learning_votes(pattern_hash TEXT NOT NULL, intent TEXT NOT NULL, confirmations INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT NOT NULL, PRIMARY KEY(pattern_hash, intent));
CREATE TABLE IF NOT EXISTS learning_evidence(pattern_hash TEXT NOT NULL, intent TEXT NOT NULL, jid_hash TEXT NOT NULL, day_key TEXT NOT NULL, confirmed_at TEXT NOT NULL, PRIMARY KEY(pattern_hash, intent, jid_hash, day_key));
CREATE TABLE IF NOT EXISTS learning_pending(jid TEXT PRIMARY KEY, pattern_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reminders(id TEXT PRIMARY KEY, jid TEXT NOT NULL, content_id TEXT, due_at TEXT NOT NULL, original_text TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, sent_at TEXT);
CREATE TABLE IF NOT EXISTS azure_usage(month TEXT PRIMARY KEY, stt_seconds INTEGER NOT NULL DEFAULT 0, tts_chars INTEGER NOT NULL DEFAULT 0, last_error TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quote_cards(id TEXT PRIMARY KEY, content_id TEXT NOT NULL, quote TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, target TEXT, detail TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_content_kind_date ON content_items(kind, date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_target_created ON audit_log(action, target, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_created ON processed_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_manual ON chat_sessions(jid, manual_until);
CREATE INDEX IF NOT EXISTS idx_jobs_state_available ON message_jobs(state, available_at);
CREATE INDEX IF NOT EXISTS idx_intent_jid_created ON intent_logs(jid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_status_hits ON learning_patterns(status, confirmations DESC, hits DESC, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_canonical ON learning_patterns(canonical_hash, status);
CREATE INDEX IF NOT EXISTS idx_learning_pending_expires ON learning_pending(expires_at);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_pattern ON learning_evidence(pattern_hash, intent, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_source ON learning_evidence(jid_hash, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_content_jid_created ON saved_content(jid, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reservations_time ON content_reservations(reserved_at);
CREATE INDEX IF NOT EXISTS idx_answer_evidence_jid_created ON answer_evidence(jid, created_at DESC);
`

/* الأعمدة المُضافة بعد الإصدار الأول. [الجدول، العمود، تعريفه]
   followup_json: ما وجده محرك المكتبة ولم يعرضه بعد — سؤالُ السائل والبقية
   المحفوظة. بدونه كان البوت يعد بـ«زدني» ثم لا يجد ما وعد به. */
const ADDED_COLUMNS = [
  ['chat_sessions', 'followup_json', 'TEXT'],
  ['chat_sessions', 'context_json', 'TEXT'],
  ['chat_sessions', 'wake_version', 'INTEGER NOT NULL DEFAULT 0'],
  ['contacts', 'nickname', 'TEXT'],
  ['contacts', 'wa_name', 'TEXT'],
  ['contacts', 'source', "TEXT DEFAULT 'whatsapp'"],
  ['contacts', 'last_seen_at', 'TEXT'],
]

const now = () => new Date().toISOString()

export function openDatabase(dbPath = DB_PATH, options = {}) {
  if (dbPath !== ':memory:') {
    ensureSafeDataDir(fs)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 })
    try { fs.chmodSync(path.dirname(dbPath), 0o700) } catch { /* noop */ }
  }
  const db = new DatabaseSync(dbPath)
  /* قاعدة البوت تُقرأ وتُكتب مع وصول رسائل واتساب ولوحة الإدارة في اللحظة
     نفسها. WAL يمنع أن ينتظر الردّ انتهاء كتابةٍ قصيرة، وNORMAL آمن هنا
     وأسرع من الإعداد الافتراضي. الذاكرة لا تحتاج WAL. */
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode=WAL;')
  db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-16000; PRAGMA busy_timeout=3000;')
  db.exec(schema)
  /* CREATE TABLE IF NOT EXISTS لا يُضيف عموداً إلى جدولٍ قائم — وقاعدة الدكتور
     قائمةٌ منذ أشهر. فالأعمدة الجديدة تُضاف هنا صراحةً، ومحاولةً محاولةً، فلا
     يسقط الإقلاع إن كان العمود موجوداً أصلاً ولا تُمسّ بياناته. */
  for (const [table, column, definition] of ADDED_COLUMNS) {
    const present = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column)
    if (!present) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  const existing = db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get()
  if (Number(existing?.version || 0) < SCHEMA_VERSION) {
    db.prepare('INSERT OR REPLACE INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(SCHEMA_VERSION, now())
  }
  return new AgentDatabase(db, options)
}

export class AgentDatabase {
  constructor(db, options = {}) {
    this.db = db
    this.cryptoOptions = options.cryptoOptions || {}
    this.statements = new Map()
  }
  statement(sql) {
    let prepared = this.statements.get(sql)
    if (!prepared) {
      prepared = this.db.prepare(sql)
      this.statements.set(sql, prepared)
      if (this.statements.size > 256) this.statements.delete(this.statements.keys().next().value)
    }
    return prepared
  }
  close() { this.statements.clear(); this.db.close() }
  run(sql, ...params) { return this.statement(sql).run(...params) }
  get(sql, ...params) { return this.statement(sql).get(...params) }
  all(sql, ...params) { return this.statement(sql).all(...params) }
  transaction(fn) { return this.db.exec('BEGIN IMMEDIATE'), (() => { try { const result = fn(); this.db.exec('COMMIT'); return result } catch (error) { this.db.exec('ROLLBACK'); throw error } })() }
  setSetting(key, value) { this.run('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', key, JSON.stringify(value), now()) }
  getSetting(key, fallback = null) { const row = this.get('SELECT value FROM settings WHERE key=?', key); if (!row) return fallback; try { return JSON.parse(row.value) } catch { return row.value } }
  setState(patch) {
    const previous = this.get('SELECT * FROM agent_state WHERE id=1') || {}
    const next = { status: 'unconfigured', ...previous, ...patch, updated_at: now() }
    this.run('INSERT INTO agent_state(id,status,last_error,account_hint,device_name,qr,pairing_code,updated_at) VALUES(1,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_error=excluded.last_error,account_hint=excluded.account_hint,device_name=excluded.device_name,qr=excluded.qr,pairing_code=excluded.pairing_code,updated_at=excluded.updated_at', next.status, next.last_error || null, next.account_hint || null, next.device_name || null, next.qr || null, next.pairing_code || null, next.updated_at)
  }
  state() { return this.get('SELECT * FROM agent_state WHERE id=1') || { status: 'unconfigured' } }
  saveAuth(kind, name, value) { this.run('INSERT INTO whatsapp_auth(kind,name,value,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', kind, name, encrypt(value, this.cryptoOptions), now()) }
  loadAuth(kind, name) { const row = this.get('SELECT value FROM whatsapp_auth WHERE kind=? AND name=?', kind, name); return row ? decrypt(row.value, this.cryptoOptions) : null }
  deleteAuth() { this.run('DELETE FROM whatsapp_auth') }
  addAudit(action, target = '', detail = '') { this.run('INSERT INTO audit_log(action,target,detail,created_at) VALUES(?,?,?,?)', action, target, detail, now()) }
  purgeExpired(days = RETENTION_DAYS) { this.run("DELETE FROM intent_logs WHERE created_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM unresolved_messages WHERE created_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM message_attempts WHERE attempted_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM processed_messages WHERE created_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM outbox_messages WHERE created_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM learning_pending WHERE expires_at < datetime('now')"); this.run("DELETE FROM learning_patterns WHERE status='observing' AND confirmations=0 AND last_seen_at < datetime('now','-90 days')"); this.run("DELETE FROM learning_evidence WHERE confirmed_at < datetime('now','-365 days')") }
  jidKey(jid) { return hashOpaque(jid) }
  encryptJid(jid) { return encrypt(jid, this.cryptoOptions) }
  decryptJid(value) { return decrypt(value, this.cryptoOptions) }
  encryptText(value) { return encrypt(String(value || ''), this.cryptoOptions) }
  decryptText(value) { return decrypt(value, this.cryptoOptions) }
}

export const dbNow = now
