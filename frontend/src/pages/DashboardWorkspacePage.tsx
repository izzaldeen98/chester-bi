import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import GridLayout, { type Layout, type LayoutItem } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { dashboardsApi } from '../lib/api'
import type { DashboardPublicResponse } from '../lib/api'
import { AppButton } from '../components/ui/AppButton'
import { DataConnectDialog } from '../components/ui/DataConnectDialog'
import type { ConnectedModel } from '../components/ui/DataConnectDialog'
import { ArrowLeft, LayoutDashboard, X, Database } from '../lib/icons'
import { BiLineChart, BiBarChartAlt2, BiDoughnutChart , BiScatterChart  } from 'react-icons/bi'
import { AiFillBoxPlot } from "react-icons/ai";
import { FaChartArea } from "react-icons/fa";
import { BsTable } from 'react-icons/bs'
import { MdStackedBarChart, MdPieChart } from 'react-icons/md'

const CHART_TYPES = [
  { key: 'line',        label: 'Line Chart',     Icon: BiLineChart },
  { key: 'bar',         label: 'Bar Chart',      Icon: BiBarChartAlt2 },
  { key: 'stacked-bar', label: 'Stacked Bar',    Icon: MdStackedBarChart },
  { key: 'area',        label: 'Area Chart',     Icon: FaChartArea },
  { key: 'pie',         label: 'Pie Chart',      Icon: MdPieChart },
  { key: 'donut',       label: 'Donut Chart',    Icon: BiDoughnutChart },
  { key: 'scatter',     label: 'Scatter Chart',  Icon: BiScatterChart },
  { key: 'table',       label: 'Table',          Icon: BsTable },
  { key: 'boxplot',     label: 'Box Plot',       Icon: AiFillBoxPlot },
] as const

const COLS       = 32
const ROW_HEIGHT = 32

function CanvasEmptyHint() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center mb-4">
        <LayoutDashboard className="w-8 h-8 text-white/10" />
      </div>
      <p className="text-white/20 text-sm font-medium">Click a chart type on the left to add it</p>
      <p className="text-white/10 text-xs mt-1">Drag tiles to move · grab edge to resize · × to remove</p>
    </div>
  )
}

interface ChartTileProps {
  chartKey: string
  connected: ConnectedModel | null
  onRemove: () => void
  onOpenDataDialog: () => void
}

function ChartTile({ chartKey, connected, onRemove, onOpenDataDialog }: ChartTileProps) {
  const ct = CHART_TYPES.find(c => c.key === chartKey)
  const Icon = ct?.Icon

  return (
    <div className="w-full h-full flex flex-col rounded-xl bg-[#161616] border border-white/10 hover:border-yellow-400/25 transition-colors group cursor-grab active:cursor-grabbing">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] flex-shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-white/20 flex-shrink-0">
            <circle cx="1" cy="1" r="1" fill="currentColor" />
            <circle cx="5" cy="1" r="1" fill="currentColor" />
            <circle cx="1" cy="5" r="1" fill="currentColor" />
            <circle cx="5" cy="5" r="1" fill="currentColor" />
          </svg>
          <span className="text-white/35 text-[11px] font-medium">{ct?.label}</span>
          {connected && (
            <span className="text-[10px] text-yellow-400/60 font-mono truncate max-w-[100px]">
              {connected.modelName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Data connect button */}
          <button
            title={connected ? `Connected: ${connected.modelName}` : 'Connect data'}
            className={`nodrag w-5 h-5 flex items-center justify-center rounded transition-all flex-shrink-0 ${
              connected
                ? 'text-yellow-400 bg-yellow-400/10'
                : 'text-white/20 hover:text-yellow-400 hover:bg-yellow-400/10'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenDataDialog() }}
          >
            <Database className="w-3 h-3" />
          </button>

          {/* Remove button */}
          <button
            className="nodrag w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove() }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0 select-none">
        {Icon && <Icon size={32} className="text-white/15 group-hover:text-yellow-400/50 transition-colors" />}
        <span className="text-white/20 text-[11px] group-hover:text-white/40 transition-colors">{ct?.label}</span>
        {connected && (
          <span className="text-yellow-400/50 text-[10px] flex items-center gap-1">
            <Database className="w-2.5 h-2.5" />
            {connected.packageName} / {connected.modelName}
          </span>
        )}
      </div>
    </div>
  )
}

export default function DashboardWorkspacePage() {
  const { dashboardId } = useParams<{ dashboardId: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(900)
  const [dashboard, setDashboard] = useState<DashboardPublicResponse | null>(null)
  const [layout, setLayout] = useState<LayoutItem[]>([])

  // Per-tile data connections: tileId → ConnectedModel
  const [tileConnections, setTileConnections] = useState<Record<string, ConnectedModel>>({})
  // Which tile is the dialog open for (null = closed)
  const [dialogTileId, setDialogTileId] = useState<string | null>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const sync = () => setCanvasWidth(el.getBoundingClientRect().width)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!dashboardId) return
    dashboardsApi.get(dashboardId).then(setDashboard).catch(() => {})
  }, [dashboardId])

  const addChart = useCallback((key: string) => {
    setLayout(prev => [
      ...prev,
      {
        i: `${key}-${Date.now()}`,
        x: (prev.length * 8) % COLS,
        y: Infinity,
        w: 8,
        h: 6,
        minW: 3,
        minH: 3,
      },
    ])
  }, [])

  const removeItem = useCallback((id: string) => {
    setLayout(prev => prev.filter(item => item.i !== id))
  }, [])

  const onLayoutChange = useCallback((newLayout: Layout) => {
    setLayout([...newLayout])
  }, [])

  return (
    <div className="flex h-screen bg-[#0d0d0d] overflow-hidden">
      <aside className="w-56 flex-shrink-0 flex flex-col bg-[#111111] border-r border-white/10 overflow-hidden">
        <div className="px-4 py-4 border-b border-white/5">
          <button
            onClick={() => navigate('/home/dashboards')}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboards
          </button>
          <p className="text-white font-bold text-sm leading-tight truncate">
            {dashboard?.name ?? 'Workspace'}
          </p>
          {dashboard?.description && (
            <p className="text-white/30 text-xs mt-0.5 line-clamp-2">{dashboard.description}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2">
          <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-2 mb-2">
            Chart Types
          </p>
          <div className="space-y-0.5">
            {CHART_TYPES.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => addChart(key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/[0.05] group transition-colors"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center text-white/35 group-hover:text-yellow-400 group-hover:border-yellow-400/30 group-hover:bg-yellow-400/[0.06] transition-all">
                  <Icon size={16} />
                </span>
                <span className="text-white/45 text-xs font-medium group-hover:text-white/80 transition-colors leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-3 border-t border-white/5">
          <AppButton variant="ghost" size="sm" fullWidth onClick={() => setLayout([])}>
            Clear Canvas
          </AppButton>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-12 flex-shrink-0 flex items-center justify-between px-5 border-b border-white/8 bg-[#0f0f0f]">
          <div className="flex items-center gap-3">
            <span className="text-white/35 text-xs font-mono">{COLS} cols</span>
            {layout.length > 0 && (
              <span className="text-yellow-400/50 text-xs">
                {layout.length} widget{layout.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <AppButton size="sm" onClick={() => {}}>Save Layout</AppButton>
        </div>

        <div
          ref={canvasRef}
          className="flex-1 overflow-auto relative"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: `${canvasWidth / COLS}px ${ROW_HEIGHT}px`,
          }}
        >
          {layout.length === 0 && <CanvasEmptyHint />}

          <GridLayout
            layout={layout}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            width={canvasWidth}
            margin={[8, 8]}
            containerPadding={[12, 12]}
            isDraggable
            isResizable
            draggableCancel=".nodrag"
            resizeHandles={['se', 's', 'e']}
            onLayoutChange={onLayoutChange}
          >
            {layout.map((item) => (
              <div key={item.i}>
                <ChartTile
                  chartKey={item.i.split('-')[0]}
                  connected={tileConnections[item.i] ?? null}
                  onRemove={() => removeItem(item.i)}
                  onOpenDataDialog={() => setDialogTileId(item.i)}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      </main>

      {/* Data connect dialog */}
      <DataConnectDialog
        open={dialogTileId !== null}
        onClose={() => setDialogTileId(null)}
        current={dialogTileId ? (tileConnections[dialogTileId] ?? null) : null}
        onConnect={(data) => {
          if (!dialogTileId) return
          setTileConnections(prev => ({ ...prev, [dialogTileId]: data }))
        }}
      />
    </div>
  )
}
