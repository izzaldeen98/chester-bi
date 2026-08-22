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

  // Cube's query dispatch calls driverFactory once with no dataSource at
  // all (or the literal string "default") purely to resolve a SQL dialect
  // for the outer/wrapping query, before routing each cube's actual data
  // pull to its own explicit `data_source:`. There's no real "default"
  // connection in our per-account model, so any of the account's saved
  // connections works equally well for that; fall back to a stateless
  // DuckDB engine if the account has none saved at all.
  if (!dataSource || dataSource === 'default') {
    const first = Object.values(connections)[0];
    return first || { type: 'duckdb' };
  }

  const conn = connections[dataSource];
  if (!conn) {
    throw new Error(`No connection named "${dataSource}" in this request's security context`);
  }
  return conn;
}

module.exports = {
  contextToAppId: ({ securityContext }) =>
    securityContext ? `${securityContext.accountId}_${securityContext.definitionVersion || '0'}` : NO_CONTEXT_APP_ID,

  contextToOrchestratorId: ({ securityContext }) =>
    securityContext ? securityContext.accountId : NO_CONTEXT_APP_ID,

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

    // Real database connections — postgres/mysql/snowflake/bigquery, matching
    // the dialects backend/utils/malloy.py used to build per-account.
    return {
      type: conn.type,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      user: conn.user,
      password: conn.password,
      ...(conn.extra || {}),
    };
  },

  scheduledRefreshContexts: () => [],
};
