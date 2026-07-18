import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DB_PATH, RETENTION_DAYS, ensureSafeDataDir } from './config.mjs'
import { encrypt, decrypt, hashOpaque } from './crypto.mjs'

export const SCHEMA_VERSION = 1

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agent_state(id INTEGER PRIMARY KEY CHECK(id = 1), status TEXT NOT NULL, last_error TEXT, account_hint TEXT, device_name TEXT, qr TEXT, pairing_code TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS whatsapp_auth(kind TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(kind, name));
CREATE TABLE IF NOT EXISTS contacts(id TEXT PRIMARY KEY, jid TEXT NOT NULL, display_name TEXT, phone TEXT, suppressed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
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
CREATE TABLE IF NOT EXISTS chat_sessions(jid TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'suggest-only', content_id TEXT, opened_at TEXT, last_user_at TEXT, manual_until TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_preferences(jid TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reply_rules(id TEXT PRIMARY KEY, name TEXT NOT NULL, keywords_json TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, match_type TEXT NOT NULL DEFAULT 'any', action_type TEXT NOT NULL DEFAULT 'text', response_text TEXT, content_query TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reply_rule_versions(id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intent_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, input_hash TEXT NOT NULL, intent TEXT NOT NULL, confidence REAL NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS unresolved_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT, input_hash TEXT NOT NULL, text_preview TEXT NOT NULL, reason TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reminders(id TEXT PRIMARY KEY, jid TEXT NOT NULL, content_id TEXT, due_at TEXT NOT NULL, original_text TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, sent_at TEXT);
CREATE TABLE IF NOT EXISTS azure_usage(month TEXT PRIMARY KEY, stt_seconds INTEGER NOT NULL DEFAULT 0, tts_chars INTEGER NOT NULL DEFAULT 0, last_error TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quote_cards(id TEXT PRIMARY KEY, content_id TEXT NOT NULL, quote TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, target TEXT, detail TEXT, created_at TEXT NOT NULL);
`

const now = () => new Date().toISOString()

export function openDatabase(dbPath = DB_PATH, options = {}) {
  if (dbPath !== ':memory:') {
    ensureSafeDataDir(fs)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 })
    try { fs.chmodSync(path.dirname(dbPath), 0o700) } catch { /* noop */ }
  }
  const db = new DatabaseSync(dbPath)
  db.exec(schema)
  const existing = db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get()
  if (!existing) db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(SCHEMA_VERSION, now())
  return new AgentDatabase(db, options)
}

export class AgentDatabase {
  constructor(db, options = {}) {
    this.db = db
    this.cryptoOptions = options.cryptoOptions || {}
  }
  close() { this.db.close() }
  run(sql, ...params) { return this.db.prepare(sql).run(...params) }
  get(sql, ...params) { return this.db.prepare(sql).get(...params) }
  all(sql, ...params) { return this.db.prepare(sql).all(...params) }
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
  purgeExpired(days = RETENTION_DAYS) { this.run("DELETE FROM intent_logs WHERE created_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM unresolved_messages WHERE created_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM message_attempts WHERE attempted_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM processed_messages WHERE created_at < datetime('now', ?)", `-${days} days`); this.run("DELETE FROM outbox_messages WHERE created_at < datetime('now', ?)", `-${days} days`) }
  jidKey(jid) { return hashOpaque(jid) }
  encryptJid(jid) { return encrypt(jid, this.cryptoOptions) }
  decryptJid(value) { return decrypt(value, this.cryptoOptions) }
  encryptText(value) { return encrypt(String(value || ''), this.cryptoOptions) }
  decryptText(value) { return decrypt(value, this.cryptoOptions) }
}

export const dbNow = now
