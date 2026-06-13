import { useEffect, useRef, useState } from 'react'
import { modelsApi, semanticModelsApi } from '../../lib/api'
import type { PackageModels, CompiledModel, CompiledField, CompiledSource, QueryResult } from '../../lib/api'
import { Database, Package, Search, Table2, FileJson } from '../../lib/icons'
import { MdKeyboardArrowRight, MdKeyboardArrowDown } from 'react-icons/md'
import { BsCircleFill, BsPlay, BsArrowRepeat } from 'react-icons/bs'
import { FaFilter, FaSortAmountDown } from 'react-icons/fa'
import { HiOutlineXMark } from 'react-icons/hi2'
import { astFromFields, buildQuery, parseQuery, toggleOrderBy, addWhere, removeWhere } from '../../lib/queryPaser'
import type { MalloyQueryAST } from '../../lib/queryPaser'

// ── Exported types ────────────────────────────────────────────────────────────

export interface ConnectedModel {
  modelId: string
  modelName: string
  packageName: string
}

export interface SelectedField {
  name: string
  type: string
  datatype: string
  sourceName: string
}

export interface QueryWorkspaceProps {
  /** Called when the user clicks "Connect". Omit to hide the button. */
  onConnect?: (data: ConnectedModel) => void
  /** Pre-selected model to restore on open */
  current?: ConnectedModel | null
}

type PreviewTab = 'table' | 'json' | 'query'

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const LS_LIST_KEY  = 'chester:list-models'
const LS_MODEL_KEY = (id: string) => `chester:compiled-model:${id}`

function lsGet<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') }
  catch { return null }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) }
  catch { /* storage full – ignore */ }
}

/** Clear the package/model list cache and all compiled-model caches. */
function clearModelCache() {
  localStorage.removeItem(LS_LIST_KEY)
  Object.keys(localStorage)
    .filter(k => k.startsWith('chester:compiled-model:'))
    .forEach(k => localStorage.removeItem(k))
}

// ── Response normaliser ───────────────────────────────────────────────────────

/**
 * Malloy returns:  { result: <rows | compactJson>, resource, query, time }
 *
 * compactJson can be:
 *   - Array of objects:  [{col: val}, ...]
 *   - Compact array:     { columns: [{name}...], data: [[v,...], ...] }
 */
function extractRows(response: QueryResult): Record<string, unknown>[] {
  // The actual payload lives under the "result" key
  const payload = response.result ?? response

  // Already an array of objects
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[]
  }

  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>

    // Compact format: { columns: [...], data: [[...], ...] }
    if (Array.isArray(p.data) && Array.isArray(p.columns)) {
      const colNames = (p.columns as Array<string | { name: string }>).map(c =>
        typeof c === 'string' ? c : c.name
      )
      return (p.data as unknown[][]).map(row =>
        Object.fromEntries(colNames.map((col, i) => [col, row[i]]))
      )
    }

    // Compact format: { columns: [...], rows: [[...], ...] }
    if (Array.isArray(p.rows) && Array.isArray(p.columns)) {
      const colNames = (p.columns as Array<string | { name: string }>).map(c =>
        typeof c === 'string' ? c : c.name
      )
      return (p.rows as unknown[][]).map(row =>
        Object.fromEntries(colNames.map((col, i) => [col, row[i]]))
      )
    }

    // Array of objects already nested
    if (Array.isArray(p.rows)) return p.rows as Record<string, unknown>[]
    if (Array.isArray(p.data)) return p.data as Record<string, unknown>[]
  }

  return []
}

// ── Datatype helpers ──────────────────────────────────────────────────────────

const NUMBER_TYPES = new Set(['number', 'integer', 'int', 'bigint', 'decimal', 'float', 'double', 'numeric', 'real'])
const STRING_TYPES = new Set(['string', 'varchar', 'text', 'char', 'nvarchar', 'nchar'])
const DATE_TYPES   = new Set(['date', 'datetime', 'timestamp', 'time', 'timestamptz'])

export function datatypeSymbol(datatype: string): { label: string; color: string } {
  const dt = (datatype ?? '').toLowerCase()
  if (NUMBER_TYPES.has(dt)) return { label: '#',    color: 'text-blue-400' }
  if (STRING_TYPES.has(dt)) return { label: 'Aa',   color: 'text-green-400' }
  if (DATE_TYPES.has(dt))   return { label: 'Date', color: 'text-purple-400' }
  return { label: datatype?.slice(0, 3) ?? '?', color: 'text-gray-400 dark:text-white/25' }
}

function DatatypeChip({ datatype }: { datatype: string }) {
  const { label, color } = datatypeSymbol(datatype)
  return <span className={`text-[10px] font-bold w-7 text-right flex-shrink-0 font-mono ${color}`}>{label}</span>
}

const KIND_DOT: Record<string, string> = {
  dimension: 'text-blue-400',
  measure:   'text-yellow-400',
  join:      'text-purple-400',
  view:      'text-green-400',
}
function kindDot(type: string) {
  return KIND_DOT[type.toLowerCase()] ?? 'text-gray-400 dark:text-white/30'
}

// ── Malloy query generator (delegates to parser/builder) ─────────────────────

export function generateQuery(fields: SelectedField[]): string {
  if (fields.length === 0) return ''
  const source = fields[0].sourceName
  return buildQuery(astFromFields(source, fields))
}

// ── Source tree node ──────────────────────────────────────────────────────────

interface SourceNodeProps {
  source: CompiledSource
  search: string
  selectedFields: SelectedField[]
  onFieldClick: (f: CompiledField, sourceName: string) => void
  onFilter: (fieldName: string) => void
  onSort:   (fieldName: string) => void
  ast: MalloyQueryAST | null
}

function SourceNode({ source, search, selectedFields, onFieldClick, onFilter, onSort, ast }: SourceNodeProps) {
  const [open, setOpen] = useState(true)
  const Arrow = open ? MdKeyboardArrowDown : MdKeyboardArrowRight

  const visibleFields = search
    ? source.fields.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : source.fields

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
      >
        <Arrow className="w-4 h-4 text-gray-400 dark:text-white/30 flex-shrink-0" />
        <Database className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
        <span className="text-gray-800 dark:text-white text-xs font-semibold">{source.name}</span>
        <span className="ml-auto text-[10px] text-gray-400 dark:text-white/25 flex-shrink-0">{source.fields.length}</span>
      </button>

      {open && (
        <div className="ml-6 border-l border-gray-200 dark:border-white/[0.07] pl-2 mb-0.5">
          {visibleFields.map((f: CompiledField, i: number) => {
            const isSelected  = selectedFields.some(s => s.name === f.name && s.sourceName === source.name)
            const isFiltered  = ast?.where.some(w => w.field === f.name) ?? false
            const sortClause  = ast?.orderBy.find(o => o.field === f.name)
            return (
              <div
                key={i}
                onClick={() => onFieldClick(f, source.name)}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-yellow-400/10 border border-yellow-400/20'
                    : 'hover:bg-gray-100 dark:hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <BsCircleFill className={`w-1.5 h-1.5 flex-shrink-0 ${kindDot(f.type)}`} />
                <span className={`text-[11px] flex-1 truncate ${
                  isSelected ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-gray-700 dark:text-white/65'
                }`}>
                  {f.name}
                </span>

                {/* Filter button */}
                <button
                  title={isFiltered ? 'Remove filter' : 'Add filter'}
                  className={`w-5 h-5 flex items-center justify-center rounded transition-all flex-shrink-0 ${
                    isFiltered
                      ? 'opacity-100 text-blue-500 dark:text-blue-400 bg-blue-400/10'
                      : 'opacity-0 group-hover:opacity-100 text-gray-400 dark:text-white/25 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-400/10'
                  }`}
                  onClick={e => { e.stopPropagation(); onFilter(f.name) }}
                >
                  <FaFilter className="w-2.5 h-2.5" />
                </button>

                {/* Sort button */}
                <button
                  title={sortClause ? `Sorted ${sortClause.direction} — click to cycle` : 'Sort by this field'}
                  className={`w-5 h-5 flex items-center justify-center rounded transition-all flex-shrink-0 ${
                    sortClause
                      ? 'opacity-100 text-yellow-500 dark:text-yellow-400 bg-yellow-400/10'
                      : 'opacity-0 group-hover:opacity-100 text-gray-400 dark:text-white/25 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-400/10'
                  }`}
                  onClick={e => { e.stopPropagation(); onSort(f.name) }}
                >
                  <FaSortAmountDown className={`w-2.5 h-2.5 ${sortClause?.direction === 'asc' ? 'rotate-180' : ''}`} />
                </button>

                <DatatypeChip datatype={f.datatype} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Results table ─────────────────────────────────────────────────────────────

function ResultTable({ rows, columns, loading, hasRun, error }: {
  rows: Record<string, unknown>[]
  columns: string[]
  loading: boolean
  hasRun: boolean
  error: string
}) {
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 dark:text-white/20">
      <div className="w-6 h-6 border-2 border-gray-200 dark:border-white/10 border-t-yellow-400 rounded-full animate-spin" />
      <span className="text-sm">Running query…</span>
    </div>
  )
  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400 px-8 text-center">
      <p className="text-sm font-medium">Query failed</p>
      <p className="text-xs opacity-70 font-mono">{error}</p>
    </div>
  )
  if (!hasRun) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300 dark:text-white/15 select-none">
      <Table2 className="w-10 h-10" />
      <p className="text-sm font-medium">No data yet</p>
      <p className="text-xs opacity-70">Select fields and click Run to fetch results</p>
    </div>
  )
  if (rows.length === 0) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-white/25">Query returned 0 rows</div>
  )

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-100 dark:bg-white/[0.05]">
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-white/60 border-b border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
              {columns.map((col, ci) => {
                const val = row[col]
                return (
                  <td key={ci} className="px-4 py-2 text-xs text-gray-700 dark:text-white/60 whitespace-nowrap max-w-[200px] truncate">
                    {val === null || val === undefined
                      ? <span className="text-gray-300 dark:text-white/15 italic">null</span>
                      : String(val)
                    }
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Results JSON ──────────────────────────────────────────────────────────────

function ResultJson({ rows, hasRun, loading }: { rows: Record<string, unknown>[]; hasRun: boolean; loading: boolean }) {
  if (loading || !hasRun) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300 dark:text-white/15 select-none">
      <FileJson className="w-10 h-10" />
      <p className="text-sm font-medium">{loading ? 'Running…' : 'Run the query to see JSON'}</p>
    </div>
  )
  return (
    <div className="overflow-auto h-full p-4">
      <pre className="text-[11px] leading-relaxed font-mono text-gray-700 dark:text-white/60 whitespace-pre">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  )
}

// ── QueryWorkspace ────────────────────────────────────────────────────────────

export function QueryWorkspace({ onConnect, current }: QueryWorkspaceProps) {
  const [packages, setPackages]       = useState<PackageModels[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listErr, setListErr]         = useState('')

  const [selectedPkg, setSelectedPkg]     = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')

  const [compiled, setCompiled]         = useState<CompiledModel | null>(null)
  const [loadingModel, setLoadingModel] = useState(false)
  const [modelErr, setModelErr]         = useState('')

  const [search, setSearch]                 = useState('')
  const [selectedFields, setSelectedFields] = useState<SelectedField[]>([])
  const [activeTab, setActiveTab]           = useState<PreviewTab>('table')

  const [queryText, setQueryText]   = useState('')
  const [queryRows, setQueryRows]   = useState<Record<string, unknown>[]>([])
  const [queryErr, setQueryErr]     = useState('')
  const [runLoading, setRunLoading] = useState(false)
  const [hasRun, setHasRun]         = useState(false)
  const [queryTime, setQueryTime]   = useState<number | null>(null)

  // Parsed AST — kept in sync with queryText for filter/sort indicator state
  const [ast, setAst] = useState<MalloyQueryAST | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync generated query when fields change
  useEffect(() => {
    const q = generateQuery(selectedFields)
    setQueryText(q)
    setAst(q ? parseQuery(q) : null)
    setHasRun(false); setQueryRows([]); setQueryErr(''); setQueryTime(null)
  }, [selectedFields])

  // Keep AST in sync when user edits the textarea manually
  function handleQueryTextChange(val: string) {
    setQueryText(val)
    setAst(parseQuery(val))
  }

  // Mutate AST → rebuild query text
  function applyAst(next: MalloyQueryAST) {
    const q = buildQuery(next)
    setAst(next)
    setQueryText(q)
  }

  function handleFilter(fieldName: string) {
    const base = ast ?? (selectedFields.length ? parseQuery(generateQuery(selectedFields)) : null)
    if (!base) return
    const alreadyFiltered = base.where.some(w => w.field === fieldName)
    const next = alreadyFiltered
      ? removeWhere(base, fieldName)
      : addWhere(base, { field: fieldName, operator: '~', value: 'f``', raw: `${fieldName} ~ f\`\`` })
    applyAst(next)
  }

  function handleSort(fieldName: string) {
    const base = ast ?? (selectedFields.length ? parseQuery(generateQuery(selectedFields)) : null)
    if (!base) return
    applyAst(toggleOrderBy(base, fieldName))
  }

  // Initial load
  useEffect(() => {
    setSearch(''); setSelectedFields([]); setHasRun(false); setQueryRows([]); setQueryErr('')
    if (current) { setSelectedPkg(current.packageName); setSelectedModel(current.modelId) }
    loadPackageList()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedModel) { setCompiled(null); setSelectedFields([]); return }
    loadCompiledModel(selectedModel)
    setSelectedFields([])
  }, [selectedModel])

  async function loadPackageList() {
    const cached = lsGet<PackageModels[]>(LS_LIST_KEY)
    if (cached) { setPackages(cached); return }
    setLoadingList(true); setListErr('')
    try {
      const data = await modelsApi.listModels()
      setPackages(data); lsSet(LS_LIST_KEY, data)
    } catch (e: unknown) {
      setListErr(e instanceof Error ? e.message : 'Failed to load packages')
    } finally { setLoadingList(false) }
  }

  async function loadCompiledModel(modelId: string) {
    const cacheKey = LS_MODEL_KEY(modelId)
    const cached = lsGet<CompiledModel>(cacheKey)
    if (cached) { setCompiled(cached); setModelErr(''); return }
    setLoadingModel(true); setModelErr(''); setCompiled(null)
    try {
      const data = await semanticModelsApi.getCompiledModel(modelId)
      setCompiled(data); lsSet(cacheKey, data)
    } catch (e: unknown) {
      setModelErr(e instanceof Error ? e.message : 'Failed to load model')
    } finally { setLoadingModel(false) }
  }

  function toggleField(f: CompiledField, sourceName: string) {
    setSelectedFields(prev => {
      const idx = prev.findIndex(s => s.name === f.name && s.sourceName === sourceName)
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      return [...prev, { name: f.name, type: f.type, datatype: f.datatype, sourceName }]
    })
  }

  async function runQuery() {
    if (!selectedModel || !queryText.trim()) return
    setRunLoading(true); setQueryErr(''); setHasRun(false)
    try {
      const response: QueryResult = await semanticModelsApi.query(selectedModel, queryText.trim())
      const rows = extractRows(response)
      setQueryRows(rows)
      setQueryTime(typeof response.time === 'number' ? response.time : null)
      setHasRun(true)
    } catch (e: unknown) {
      setQueryErr(e instanceof Error ? e.message : 'Query failed')
      setHasRun(true)
    } finally { setRunLoading(false) }
  }

  function handleConnect() {
    if (!selectedModel || !compiled || !onConnect) return
    const pkg = packages.find(p => p.package_name === selectedPkg)
    const mdl = pkg?.models.find(m => m.model_id === selectedModel)
    if (!mdl) return
    onConnect({ modelId: selectedModel, modelName: mdl.model_name, packageName: pkg!.package_name })
  }

  const modelsInPkg    = packages.find(p => p.package_name === selectedPkg)?.models ?? []
  const filteredSchema = compiled?.schema.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.fields.some(f => f.name.toLowerCase().includes(search.toLowerCase()))
  ) ?? []
  const resultColumns  = queryRows.length > 0 ? Object.keys(queryRows[0]) : selectedFields.map(f => f.name)
  const totalDims      = compiled?.schema.reduce((a, s) => a + s.fields.filter(f => f.type === 'dimension').length, 0) ?? 0
  const totalMeasures  = compiled?.schema.reduce((a, s) => a + s.fields.filter(f => f.type === 'measure').length, 0) ?? 0

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left: tabs + content ──────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col bg-gray-50 dark:bg-[#0f0f0f] border-r border-gray-100 dark:border-white/[0.06] overflow-hidden">

        {/* Tab bar + field pills */}
        <div className="flex items-center px-4 pt-3 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-1 mr-4 flex-shrink-0">
            {/* Table tab */}
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'table'
                  ? 'border-yellow-400 text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>

            {/* JSON tab */}
            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'json'
                  ? 'border-yellow-400 text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" /> JSON
            </button>

            {/* Query tab */}
            <button
              onClick={() => setActiveTab('query')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'query'
                  ? 'border-yellow-400 text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60'
              }`}
            >
              <BsPlay className="w-3.5 h-3.5" />
              Query
              {/* dot indicator when query has content */}
              {queryText.trim() && activeTab !== 'query' && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
              )}
            </button>
          </div>

          {/* Field pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 flex-1 min-w-0">
            {selectedFields.map((f, i) => {
              const { label, color } = datatypeSymbol(f.datatype)
              return (
                <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/25 text-yellow-600 dark:text-yellow-400 text-[10px] font-medium whitespace-nowrap flex-shrink-0">
                  <span className={`font-bold font-mono ${color}`}>{label}</span>
                  {f.name}
                  <button onClick={() => toggleField(f as unknown as CompiledField, f.sourceName)} className="ml-0.5 hover:text-red-400 transition-colors">
                    <HiOutlineXMark className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
            {selectedFields.length > 0 && (
              <button onClick={() => setSelectedFields([])} className="text-[10px] text-gray-400 dark:text-white/25 hover:text-red-400 transition-colors whitespace-nowrap flex-shrink-0 ml-1">
                Clear all
              </button>
            )}

            {/* Run shortcut visible when not on Query tab */}
            {activeTab !== 'query' && (
              <button
                onClick={() => { setActiveTab('query'); setTimeout(runQuery, 50) }}
                disabled={runLoading || !queryText.trim() || !selectedModel}
                title="Run current query"
                className="ml-auto flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {runLoading
                  ? <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  : <BsPlay className="w-3 h-3" />
                }
                Run
              </button>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* ── Query tab ── */}
          {activeTab === 'query' && (
            <div className="h-full flex flex-col p-4 gap-3">
              <div className="flex items-start gap-2 flex-shrink-0">
                <textarea
                  ref={textareaRef}
                  value={queryText}
                  onChange={e => handleQueryTextChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery() } }}
                  rows={Math.max(5, queryText.split('\n').length + 1)}
                  placeholder={'Select fields to generate a query\nor type Malloy here…'}
                  spellCheck={false}
                  className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono text-gray-800 dark:text-white/80 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 outline-none focus:border-yellow-400 placeholder:text-gray-300 dark:placeholder:text-white/15 transition-colors resize-none leading-relaxed"
                />
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={runQuery}
                    disabled={runLoading || !queryText.trim() || !selectedModel}
                    title="Run (Ctrl+Enter)"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {runLoading
                      ? <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      : <BsPlay className="w-3.5 h-3.5" />
                    }
                    Run
                  </button>
                  {onConnect && (
                    <button
                      onClick={handleConnect}
                      disabled={!compiled}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-yellow-400/40 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {/* Status / hint */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-white/25 font-mono flex-shrink-0">
                {hasRun && !runLoading
                  ? queryErr
                    ? <span className="text-red-400">{queryErr}</span>
                    : <><span className="text-green-500">{queryRows.length} rows returned</span>{queryTime !== null && <span>· {queryTime.toFixed(3)}s</span>}</>
                  : <span>Ctrl+Enter to run</span>
                }
                {hasRun && !runLoading && !queryErr && (
                  <button
                    onClick={() => setActiveTab('table')}
                    className="ml-auto text-yellow-500 dark:text-yellow-400 hover:underline"
                  >
                    View results →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Table tab ── */}
          {activeTab === 'table' && (
            <ResultTable rows={queryRows} columns={resultColumns} loading={runLoading} hasRun={hasRun} error={queryErr} />
          )}

          {/* ── JSON tab ── */}
          {activeTab === 'json' && (
            <ResultJson rows={queryRows} hasRun={hasRun} loading={runLoading} />
          )}
        </div>
      </div>

      {/* ── Right sidebar: dropdowns + schema tree ─────────────────── */}
      <aside className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-white dark:bg-[#141414]">

        {/* Dropdowns */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0 space-y-3">
          {(listErr || modelErr) && (
            <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {listErr || modelErr}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30 flex items-center gap-1.5">
                <Package className="w-3 h-3" /> Package
              </label>
              <button
                title="Refresh models cache"
                onClick={() => { clearModelCache(); setPackages([]); setSelectedPkg(''); setSelectedModel(''); setCompiled(null); loadPackageList() }}
                className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-white/25 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
              >
                <BsArrowRepeat className="w-3 h-3" /> Refresh
              </button>
            </div>
            <select
              value={selectedPkg}
              onChange={e => { setSelectedPkg(e.target.value); setSelectedModel(''); setCompiled(null) }}
              className="w-full rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 outline-none focus:border-yellow-400 transition-colors"
            >
              <option value="" className="bg-white dark:bg-[#1a1a1a]">{loadingList ? 'Loading…' : '— select package —'}</option>
              {packages.map(p => <option key={p.package_id} value={p.package_name} className="bg-white dark:bg-[#1a1a1a]">{p.package_name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30 flex items-center gap-1.5">
              <Database className="w-3 h-3" /> Model
            </label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={!selectedPkg}
              className="w-full rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 outline-none focus:border-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="bg-white dark:bg-[#1a1a1a]">— select model —</option>
              {modelsInPkg.map(m => <option key={m.model_id} value={m.model_id} className="bg-white dark:bg-[#1a1a1a]">{m.model_name}</option>)}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-white/25" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              disabled={!compiled}
              placeholder="Search fields…"
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 outline-none focus:border-yellow-400 placeholder:text-gray-400 dark:placeholder:text-white/20 transition-colors disabled:opacity-40 disabled:cursor-default"
            />
          </div>
        </div>

        {/* Schema tree */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loadingModel ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-400 dark:text-white/20">
              <div className="w-5 h-5 border-2 border-gray-200 dark:border-white/10 border-t-yellow-400 rounded-full animate-spin" />
              <span className="text-xs">Loading schema…</span>
            </div>
          ) : !selectedModel ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-300 dark:text-white/15 select-none">
              <Database className="w-8 h-8" />
              <span className="text-xs">Select a model to explore its schema</span>
            </div>
          ) : modelErr ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-red-400">
              <p className="text-xs font-medium">Failed to load schema</p>
              <button onClick={() => loadCompiledModel(selectedModel)} className="px-3 py-1 text-[11px] rounded-lg bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors">Retry</button>
            </div>
          ) : filteredSchema.length === 0 && search ? (
            <div className="flex items-center justify-center h-24 text-[11px] text-gray-400 dark:text-white/25">No results for "{search}"</div>
          ) : (
            <div className="space-y-0.5">
              {filteredSchema.map((source, i) => (
                <SourceNode key={i} source={source} search={search} selectedFields={selectedFields} onFieldClick={toggleField} onFilter={handleFilter} onSort={handleSort} ast={ast} />
              ))}
            </div>
          )}
        </div>

        {/* Model meta footer */}
        {compiled && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.06] flex-shrink-0 bg-gray-50 dark:bg-white/[0.02]">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-blue-400/10 border border-blue-400/20 text-blue-500 dark:text-blue-400 font-medium">
                <BsCircleFill className="w-1 h-1" /> {totalDims} dims
              </span>
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-yellow-400/10 border border-yellow-400/20 text-yellow-600 dark:text-yellow-400 font-medium">
                <BsCircleFill className="w-1 h-1" /> {totalMeasures} measures
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/35 font-medium">
                {compiled.schema.length} sources
              </span>
            </div>
            <p className="text-[9px] font-mono text-gray-400 dark:text-white/20 truncate">
              {compiled.package_name}/{compiled.model_path} · malloy {compiled.malloy_version}
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
