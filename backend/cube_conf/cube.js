// Multi-tenant Cube Core config for chester-bi.
//
// One shared Cube instance serves every account. Cube's built-in JWT
// verification (against CUBEJS_API_SECRET) decodes the token the backend
// mints per request straight into `req.securityContext` — no custom
// checkAuth needed, we just read the claims it put there.
//
// Cube is intentionally kept stateless with respect to any one account's
// database: the backend embeds each of the account's named connections'
// (already-decrypted, see backend/security/security.py's Fernet usage)
// credentials directly into the JWT claims per request, keyed by connection
// name. driverFactory looks a connection up by name (Cube's `dataSource`,
// set via a cube's `data_source:` property) instead of Cube holding any
// long-lived DB credentials of its own.
const { FileRepository } = require('@cubejs-backend/server-core');
const path = require('path');

const DEFINITIONS_ROOT = '/cube/definitions_root';

// FileRepository.localPath() does `path.join(process.cwd(), repositoryPath)`
// — a leading "/" on repositoryPath is NOT treated as absolute the way you'd
// expect, it's just concatenated onto cwd (Cube's own docs example always
// passes a relative path, e.g. `model/${tenant}`, for exactly this reason).
// process.cwd() is /cube/conf, so an absolute DEFINITIONS_ROOT has to be
// rewritten relative to that before being handed to FileRepository.
function repositoryPathFor(accountId) {
  const absolute = accountId ? path.join(DEFINITIONS_ROOT, accountId, 'definitions') : DEFINITIONS_ROOT;
  return path.relative(process.cwd(), absolute);
}

// Cube's own dev-mode playground/DevServer makes internal driver/schema
// checks (e.g. a background "is the DB reachable" probe) that carry no
// request-bound securityContext at all — securityContext is `null`, not an
// empty object, for those calls. There's no real tenant to resolve in that
// case, so every hook below falls back to a harmless placeholder instead of
// crashing; actual per-account requests always carry a real securityContext
// (the backend mints one — see backend/utils/cube.py's mint_token).
const NO_CONTEXT_APP_ID = 'no-context';

function connectionFor(securityContext, dataSource) {
  const connections = (securityContext && securityContext.connections) || {};

  // "default" is what Cube uses for a cube with no `data_source:` — in
  // practice a hand-written file cube (`read_csv(...)`), since a database
  // cube can't be queried without naming its connection. It always means
  // the stateless DuckDB engine. It used to mean "the account's first saved
  // connection", so adding a connection silently re-routed every such cube
  // to it, and one unreachable database broke unrelated dashboards.
  if (!dataSource || dataSource === 'default') {
    return { type: 'duckdb' };
  }

  const conn = connections[dataSource];
  if (!conn) {
    throw new Error(`No connection named "${dataSource}" in this request's security context`);
  }
  return conn;
}

// Cube runs in a container, where "localhost" is the container itself and
// never a database. A connection saved as localhost means the machine
// running Docker, so point it there (compose maps host.docker.internal to
// the host gateway, which Linux needs; Docker Desktop provides it anyway).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function withReachableHost(conn) {
  const out = { ...conn };
  for (const key of ['host', 'server']) {
    if (LOCAL_HOSTS.has(String(out[key]).toLowerCase())) out[key] = 'host.docker.internal';
  }
  return out;
}

module.exports = {
  contextToAppId: ({ securityContext }) =>
    securityContext ? `${securityContext.accountId}_${securityContext.definitionVersion || '0'}` : NO_CONTEXT_APP_ID,

  // The orchestrator caches one resolved driver per dataSource for its whole
  // life, so the account alone is not enough to key it on: a connection added
  // (or re-credentialled) later would never be looked up again, and its
  // queries failed with "No connection named ...". connectionsVersion is a
  // hash of the account's connection set (see backend/utils/cube.py), so
  // changing one retires the old orchestrator rather than outliving it.
  contextToOrchestratorId: ({ securityContext }) =>
    securityContext
      ? `${securityContext.accountId}_${securityContext.connectionsVersion || '0'}`
      : NO_CONTEXT_APP_ID,

  repositoryFactory: ({ securityContext }) =>
    new FileRepository(repositoryPathFor(securityContext && securityContext.accountId)),

  driverFactory: ({ securityContext, dataSource }) => {
    if (!securityContext) {
      // No real query to serve — an in-memory DuckDB never fails to "connect".
      return { type: 'duckdb', database: ':memory:' };
    }

    // DuckDB-backed file sources (CSV/Parquet uploads) need no per-account
    // claim at all — the wizard bakes the absolute file path directly into
    // the cube's own `sql: read_csv('/path')`, so the driver itself is just
    // a stateless generic DuckDB engine, the same for every account.
    const conn = dataSource === 'duckdb'
      ? { type: 'duckdb' }
      : connectionFor(securityContext, dataSource);

    if (conn.type === 'duckdb') {
      return { type: 'duckdb', database: conn.file };
    }

    // Real database connections. The claim is already the exact option set
    // this dialect's driver takes — backend/utils/db_drivers.py builds it
    // from that driver's own constructor keys, which genuinely differ
    // (mssql takes `server`, clickhouse and snowflake take `username`).
    // Re-mapping the keys here is what silently broke every dialect that
    // isn't shaped like Postgres, so nothing is re-mapped: pass it through.
    return withReachableHost(conn);
  },

  scheduledRefreshContexts: () => [],
};
