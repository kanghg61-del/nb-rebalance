import { Pool, type PoolConfig } from 'pg';

const requiredEnv = ['DAAS_DB_HOST', 'DAAS_DB_PORT', 'DAAS_DB_NAME', 'DAAS_DB_USER', 'DAAS_DB_PASSWORD'] as const;

function assertDbEnv(): void {
  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length > 0) throw new Error(`[DaaS] 필수 환경변수 누락: ${missing.join(', ')}`);
}

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  assertDbEnv();
  const useSsl = String(process.env.DAAS_DB_SSL ?? 'true').toLowerCase() !== 'false';
  const config: PoolConfig = {
    host: process.env.DAAS_DB_HOST,
    port: Number(process.env.DAAS_DB_PORT),
    database: process.env.DAAS_DB_NAME,
    user: process.env.DAAS_DB_USER,
    password: process.env.DAAS_DB_PASSWORD,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
    query_timeout: 60_000,
  };
  _pool = new Pool(config);
  _pool.on('error', (err) => console.error('[DaaS pool error]', err));
  return _pool;
}

export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = getPool();
  try {
    const res = await pool.query(sql, params);
    return res.rows as T[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timeout') || msg.includes('terminated')) {
      _pool = null;
    }
    throw e;
  }
}

export async function pingDb(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const rows = await query<{ version: string }>('SELECT version() AS version');
    return { ok: true, version: rows[0]?.version };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
