import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  constructor(config) {
    this.config = config;
    this.key = Buffer.from(config.encryptionKey, 'hex');
    if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(config.dbPath);
    try {
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, created INTEGER NOT NULL, payload TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS events_created ON events(created);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS limits_expires ON limits(expires);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, created INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_created ON audit(created);`);
    if (config.dbPath !== ':memory:') chmodSync(config.dbPath, 0o600);
    const sentinel = this.db.prepare("SELECT value FROM metadata WHERE key='encryption_check'").get();
    if (sentinel) {
      if (this.decrypt(sentinel.value, 'encryption_check').check !== 'pepcision') throw new Error('Invalid database encryption key');
    } else {
      this.db.prepare('INSERT INTO metadata VALUES (?,?)').run('encryption_check', this.encrypt({ check: 'pepcision' }, 'encryption_check'));
    }
    this.cleanup();
    } catch (error) { this.db.close(); throw error; }
  }
  encrypt(value, aad) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }
  decrypt(value, aad) {
    const bytes = Buffer.from(value, 'base64');
    const cipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(aad));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]));
  }
  consume(key, maximum, windowMs, now = Date.now()) {
    const bucket = `${key}:${Math.floor(now / windowMs)}`;
    const expires = (Math.floor(now / windowMs) + 1) * windowMs;
    const row = this.db.prepare(`INSERT INTO limits(key,count,expires) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count`).get(bucket, expires, maximum);
    return Boolean(row);
  }
  append(event) {
    if (this.db.prepare('SELECT count(*) AS n FROM events').get().n >= this.config.maxEvents) throw new Error('Log capacity reached');
    // Explicit allowlist: no message, IP address, URL, model explanation, or user-supplied text.
    const payload = Object.fromEntries(['session', 'intent', 'action', 'trigger', 'answerId', 'classifier', 'policyVersion', 'reviewRequired'].map(key => [key, event[key]]));
    this.db.prepare('INSERT INTO events(id,created,payload) VALUES (?,?,?)').run(event.id, event.created, this.encrypt(payload, event.id));
  }
  list(before = { created: Date.now() + 1, id: '' }, limit = 50) {
    return this.db.prepare('SELECT * FROM events WHERE created < ? OR (created = ? AND id < ?) ORDER BY created DESC, id DESC LIMIT ?').all(before.created, before.created, before.id, limit).map(row => ({ id: row.id, created: row.created, reviewed: Boolean(row.reviewed), ...this.decrypt(row.payload, row.id) }));
  }
  review(id) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare('UPDATE events SET reviewed=1 WHERE id=? AND reviewed=0').run(id);
      if (result.changes) {
        const created = Date.now();
        this.db.prepare('INSERT INTO audit(created,payload) VALUES (?,?)').run(created, this.encrypt({ action: 'reviewed', eventId: id, actor: 'admin-token' }, String(created)));
      }
      this.db.exec('COMMIT');
      return Boolean(result.changes);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  cleanup(now = Date.now()) {
    const cutoff = now - this.config.retentionDays * 86400000;
    this.db.prepare('DELETE FROM events WHERE created < ?').run(cutoff);
    this.db.prepare('DELETE FROM audit WHERE created < ?').run(cutoff);
    this.db.prepare('DELETE FROM limits WHERE expires < ?').run(now);
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }
  close() { this.db.close(); }
}
