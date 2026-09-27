import { randomBytes } from 'node:crypto';
import { isAbsolute } from 'node:path';

export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  function integer(key, fallback, min, max) {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  }
  function secret(key) {
    const value = env[key];
    if (value && /^[a-f0-9]{64}$/i.test(value)) return value;
    if (value || production) throw new Error(`${key} must be 32 random bytes encoded as 64 hex characters`);
    return randomBytes(32).toString('hex');
  }
  const origins = (env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000').split(',');
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) throw new Error('ALLOWED_ORIGINS must contain exact origins; production requires HTTPS');
  }
  if (production && !env.ALLOWED_ORIGINS) throw new Error('ALLOWED_ORIGINS is required');
  const widgetOrigins = (env.CHAT_WIDGET_ORIGINS ?? '').split(',').filter(Boolean);
  for (const origin of widgetOrigins) {
    if (!origins.includes(origin)) throw new Error('CHAT_WIDGET_ORIGINS must be a subset of ALLOWED_ORIGINS');
  }
  const dbPath = env.CHAT_DB_PATH ?? ':memory:';
  if (production && (!isAbsolute(dbPath) || dbPath === ':memory:')) throw new Error('CHAT_DB_PATH must be an absolute persistent disk path');
  const aiEnabled = env.AI_ENABLED === 'true';
  if (env.AI_ENABLED && !['true', 'false'].includes(env.AI_ENABLED)) throw new Error('Invalid AI_ENABLED');
  if (aiEnabled && (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)) throw new Error('AI_ENABLED requires OPENAI_API_KEY and OPENAI_MODEL');
  const encryptionKey = secret('LOG_ENCRYPTION_KEY');
  const hashKey = secret('IP_HASH_KEY');
  const sessionKey = secret('SESSION_SIGNING_KEY');
  const adminToken = env.ADMIN_TOKEN ?? '';
  if ((production || adminToken) && !/^[a-f0-9]{64}$/i.test(adminToken)) throw new Error('ADMIN_TOKEN must be 64 random hex characters');
  if (new Set([encryptionKey, hashKey, sessionKey, adminToken]).size !== 4) throw new Error('Use distinct secrets');
  return {
    production, origins, widgetOrigins, dbPath, encryptionKey, hashKey, sessionKey, adminToken, aiEnabled,
    openaiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL,
    host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    port: integer('PORT', 3000, 0, 65535),
    aiTimeoutMs: integer('AI_TIMEOUT_MS', 7000, 100, 20000),
    ipLimit: integer('IP_REQUESTS_PER_MINUTE', 20, 1, 1000),
    sessionLimit: integer('SESSION_REQUESTS_PER_MINUTE', 10, 1, 100),
    dailyLimit: integer('DAILY_CHAT_LIMIT', 1000, 1, 100000),
    retentionDays: integer('LOG_RETENTION_DAYS', 14, 1, 90),
    maxEvents: integer('MAX_LOG_EVENTS', 50000, 100, 1000000),
    trustedProxies: (env.TRUSTED_PROXY_IPS ?? '').split(',').filter(Boolean)
  };
}
