import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { batchesApi } from '../../utils/api'
import {
  TrendingUp,
  Package,
  Trash2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Scale,
  DollarSign,
  TrendingDown,
  Sparkles,
  Activity,
  BarChart2,
  PieChart
} from 'lucide-react'
import './OverviewPage.css'

export default function OverviewPage({ onNavigate }) {
  const user = useSelector((state) => state.auth.user)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        const data = await batchesApi.getStats()
        setStats(data)
      } catch (err) {
        setError(err.message || 'Failed to fetch overview stats.')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="overview-page loading-state">
        <div className="loader"></div>
        <p>Loading project analytics dashboard...</p>
      </div>
    )
  }

  const {
    liveStandardKg = 0,
    liveRemnantsKg = 0,
    totalLiveStockKg = 0,
    totalScrapKg = 0,
    wastagePercentage = 0,
    dailyScrapGraph = [],
    diameterWeights = {},
    remnantDiameterWeights = {},
    totalScrapSoldWeight = 0,
    totalScrapRevenue = 0,
    totalScrapLossDifferential = 0
  } = stats || {}

  // SVG Chart Dimensions - Compact and proportional
  const chartHeight = 110
  const chartWidth = 480
  const maxScrap = Math.max(...dailyScrapGraph.map(d => d.scrapKg), 10)
  const padBottom = 18
  const padTop = 10
  const padLeft = 36
  const padRight = 12
  const graphHeight = chartHeight - padBottom - padTop
  const graphWidth = chartWidth - padLeft - padRight

  return (
    <div className="overview-page-wrapper">
      <div className="overview-page">
        {/* Top Header Bar */}
        <div className="overview-header">
          <div className="header-title-group">
            <div className="title-row">
              <h1 className="overview-title">Dashboard Overview</h1>
              <span className="live-status-pill">
                <span className="pulse-dot"></span> Live Sync Active
              </span>
            </div>
            <p className="overview-subtitle">
              Real-time analytics for <span className="highlight-company">{user?.companyName || 'Firm'}</span>
              {user?.projectName ? ` • Project: ${user.projectName}` : ''}
            </p>
          </div>
          <button className="run-opt-btn" onClick={() => onNavigate('inputs')}>
            <Activity size={14} style={{ marginRight: '6px' }} />
            Run Optimization
            <ArrowRight size={14} style={{ marginLeft: '6px' }} />
          </button>
        </div>

        {error && (
          <div className="overview-error-banner">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Metric Cards Row - 6 Sleek Micro Cards */}
        <div className="stats-cards-grid">
          {/* Card 1: Live Stock Weight */}
          <div className="stat-card card-purple-border">
            <div className="stat-card-header">
              <span className="card-lbl">Live Stock Weight</span>
              <div className="card-icon-wrapper purple-bg">
                <Package size={16} color="#8b5cf6" />
              </div>
            </div>
            <div className="card-val-row">
              <span className="card-val">
                {(totalLiveStockKg / 1000).toFixed(2)}
              </span>
              <span className="val-unit">Tons</span>
            </div>
            <div className="card-sub-stats">
              <span className="sub-stat-item">
                <span className="bullet std"></span> Standard: {(liveStandardKg / 1000).toFixed(2)} T
              </span>
              <span className="sub-stat-item highlight-remnant">
                <span className="bullet rem"></span> Remnants: {liveRemnantsKg.toFixed(1)} kg
              </span>
            </div>
          </div>

          {/* Card 2: Scrap Generated */}
          <div className="stat-card card-red-border">
            <div className="stat-card-header">
              <span className="card-lbl">Scrap Generated</span>
              <div className="card-icon-wrapper red-bg">
                <Trash2 size={16} color="#f43f5e" />
              </div>
            </div>
            <div className="card-val-row">
              <span className="card-val text-red">
                {totalScrapKg.toLocaleString()}
              </span>
              <span className="val-unit text-red">Kgs</span>
            </div>
            <span className="card-sub-lbl text-red">Cumulative cut waste</span>
          </div>

          {/* Card 3: Wastage Ratio */}
          <div className="stat-card card-orange-border">
            <div className="stat-card-header">
              <span className="card-lbl">Wastage / Scrap Ratio</span>
              <div className="card-icon-wrapper orange-bg">
                <TrendingUp size={16} color="#f59e0b" />
              </div>
            </div>
            <div className="card-val-row">
              <span className="card-val text-orange">
                {wastagePercentage.toFixed(2)}%
              </span>
            </div>
            <span className="yield-pill">
              {wastagePercentage > 0 ? `${(100 - wastagePercentage).toFixed(2)}% Yield` : 'No Batch Run'}
            </span>
          </div>

          {/* Card 4: Scrap Weight Sold */}
          <div className="stat-card card-cyan-border">
            <div className="stat-card-header">
              <span className="card-lbl">Total Scrap Sold</span>
              <div className="card-icon-wrapper cyan-bg">
                <Scale size={16} color="#06b6d4" />
              </div>
            </div>
            <div className="card-val-row">
              <span className="card-val text-cyan">
                {totalScrapSoldWeight.toLocaleString()}
              </span>
              <span className="val-unit text-cyan">Kgs</span>
            </div>
            <span className="card-sub-lbl text-cyan">Cleared from site</span>
          </div>

          {/* Card 5: Revenue Retrieved */}
          <div className="stat-card card-green-border">
            <div className="stat-card-header">
              <span className="card-lbl">Revenue Retrieved</span>
              <div className="card-icon-wrapper green-bg">
                <DollarSign size={16} color="#10b981" />
              </div>
            </div>
            <div className="card-val-row">
              <span className="card-val text-green">
                ₹{totalScrapRevenue.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="card-sub-lbl text-green">Capital recovered</span>
          </div>

          {/* Card 6: Lost Material Capital */}
          <div className="stat-card card-red-border">
            <div className="stat-card-header">
              <span className="card-lbl">Lost Material Value</span>
              <div className="card-icon-wrapper red-bg">
                <TrendingDown size={16} color="#f43f5e" />
              </div>
            </div>
            <div className="card-val-row">
              <span className="card-val text-red">
                ₹{totalScrapLossDifferential.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="card-sub-lbl text-red">Unrecovered scrap loss</span>
          </div>
        </div>

        {/* Lower Section: 3 Compact Cards Side-by-Side in 1 Row */}
        <div className="dashboard-compact-grid">
          {/* Card 1: Daily Scrap Generation (Line Chart - 30 Days) */}
          <div className="card compact-card graph-card">
            <div className="panel-header">
              <div className="panel-header-left">
                <Activity size={15} className="panel-icon text-emerald" />
                <h3 className="graph-card-title">Daily Scrap Generation</h3>
              </div>
              <span className="chart-legend-badge">Last 30 Days</span>
            </div>

            <div className="svg-chart-container">
              {dailyScrapGraph.length === 0 ? (
                <div className="no-data-placeholder">
                  <Layers size={28} color="#64748b" />
                  <p>No batch runs logged yet.</p>
                </div>
              ) : (
                (() => {
                  const points = dailyScrapGraph.map((item, idx) => {
                    const totalCount = Math.max(1, dailyScrapGraph.length - 1)
                    const x = padLeft + (idx / totalCount) * graphWidth
                    const y = chartHeight - padBottom - (item.scrapKg / maxScrap) * graphHeight
                    return { x, y, item, idx }
                  })

                  const getSmoothPath = (pts) => {
                    if (pts.length === 0) return ''
                    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`
                    let d = `M ${pts[0].x},${pts[0].y}`
                    for (let i = 0; i < pts.length - 1; i++) {
                      const p0 = pts[i === 0 ? 0 : i - 1]
                      const p1 = pts[i]
                      const p2 = pts[i + 1]
                      const p3 = pts[i + 2] || p2
                      const cp1x = p1.x + (p2.x - p0.x) / 6
                      const cp1y = p1.y + (p2.y - p0.y) / 6
                      const cp2x = p2.x - (p3.x - p1.x) / 6
                      const cp2y = p2.y - (p3.y - p1.y) / 6
                      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
                    }
                    return d
                  }

                  const smoothLinePath = getSmoothPath(points)
                  const areaPath = points.length > 0
                    ? `${smoothLinePath} L ${points[points.length - 1].x.toFixed(1)},${chartHeight - padBottom} L ${points[0].x.toFixed(1)},${chartHeight - padBottom} Z`
                    : ''

                  return (
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="scrap-svg-chart">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
                          <stop offset="60%" stopColor="#10b981" stopOpacity="0.12" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#059669" />
                          <stop offset="50%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.4" />
                        </filter>
                      </defs>

                      {/* Horizontal gridlines */}
                      {[0, 0.5, 1].map((ratio, idx) => {
                        const y = padTop + graphHeight * (1 - ratio)
                        const gridVal = Math.round(maxScrap * ratio)
                        return (
                          <g key={idx}>
                            <line
                              x1={padLeft}
                              y1={y}
                              x2={chartWidth - padRight}
                              y2={y}
                              stroke="rgba(255, 255, 255, 0.08)"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={padLeft - 6}
                              y={y + 3}
                              className="axis-text axis-y"
                              textAnchor="end"
                            >
                              {gridVal} kg
                            </text>
                          </g>
                        )
                      })}

                      {/* Area Fill */}
                      {areaPath && (
                        <path
                          d={areaPath}
                          fill="url(#areaGradient)"
                          className="line-chart-area"
                        />
                      )}

                      {/* Smooth Line */}
                      {smoothLinePath && (
                        <path
                          d={smoothLinePath}
                          fill="none"
                          stroke="url(#lineGradient)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="url(#glow)"
                          className="line-chart-path"
                        />
                      )}

                      {/* Baseline */}
                      <line
                        x1={padLeft}
                        y1={chartHeight - padBottom}
                        x2={chartWidth - padRight}
                        y2={chartHeight - padBottom}
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeWidth="1"
                      />

                      {/* X-axis tick labels (spaced evenly across 30 days) */}
                      {points.map(({ x, item, idx }) => {
                        const isTick = idx === 0 || idx === 7 || idx === 14 || idx === 21 || idx === points.length - 1
                        if (!isTick) return null

                        return (
                          <g key={`label-${idx}`}>
                            <line
                              x1={x}
                              y1={chartHeight - padBottom}
                              x2={x}
                              y2={chartHeight - padBottom + 4}
                              stroke="rgba(255, 255, 255, 0.2)"
                              strokeWidth="1"
                            />
                            <text
                              x={x}
                              y={chartHeight - padBottom + 14}
                              className="axis-text axis-x"
                              textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
                            >
                              {item.date}
                            </text>
                          </g>
                        )
                      })}

                      {/* Interactive Point Markers */}
                      {points.map(({ x, y, item, idx }) => {
                        const hasScrap = item.scrapKg > 0
                        return (
                          <g key={`pt-${idx}`} className="chart-point-group">
                            {/* Visible point dot for active scrap days */}
                            {hasScrap && (
                              <>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="4.5"
                                  fill="#10b981"
                                  stroke="#ffffff"
                                  strokeWidth="1.5"
                                  className="active-point-dot"
                                />
                                <text
                                  x={x}
                                  y={y - 8}
                                  className="point-value-tag"
                                  textAnchor="middle"
                                >
                                  {item.scrapKg >= 1000 ? `${(item.scrapKg / 1000).toFixed(1)}k` : Math.round(item.scrapKg)}
                                </text>
                              </>
                            )}
                            {/* Hover trigger zone */}
                            <circle
                              cx={x}
                              cy={y}
                              r="8"
                              fill="transparent"
                              className="hover-trigger-circle"
                            >
                              <title>{`${item.date}: ${item.scrapKg} kg scrap`}</title>
                            </circle>
                          </g>
                        )
                      })}
                    </svg>
                  )
                })()
              )}
            </div>
          </div>

          {/* Card 2: Stock Diameter Distribution (WITH ICON) */}
          <div className="card compact-card distribution-card">
            <div className="panel-header">
              <div className="panel-header-left">
                <PieChart size={15} className="panel-icon text-cyan" />
                <h3 className="dist-card-title">Stock Diameter Distribution</h3>
              </div>
              <span className="panel-tag font-mono">8mm-32mm</span>
            </div>

            <div className="dia-distribution-list">
              {(() => {
                const stdDiameters = [8, 10, 12, 16, 20, 25, 32]
                const weights = stdDiameters.map(dia => diameterWeights[dia] || 0)
                const maxWeight = Math.max(...weights, 1)

                return stdDiameters.map(dia => {
                  const weight = diameterWeights[dia] || 0
                  const percentWidth = maxWeight > 0 ? (weight / maxWeight) * 100 : 0
                  return (
                    <div key={dia} className="dia-dist-row">
                      <span className="dia-dist-label">{dia} mm</span>
                      <div className="dia-dist-bar-bg">
                        <div
                          className="dia-dist-bar-fill"
                          style={{ width: `${percentWidth}%` }}
                        ></div>
                      </div>
                      <span className="dia-dist-value">
                        {weight > 0 ? `${Math.round(weight).toLocaleString()} kg` : '0 kg'}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Card 3: Reusable Remnants (Diawise) */}
          <div className="card compact-card distribution-card remnant-dist-card">
            <div className="panel-header">
              <div className="panel-header-left">
                <Sparkles size={15} className="panel-icon text-emerald" />
                <h3 className="dist-card-title text-emerald-title">Reusable Remnants (Diawise)</h3>
              </div>
              <span className="total-remnant-badge">
                Total: {liveRemnantsKg.toFixed(1)} kg
              </span>
            </div>

            <div className="dia-distribution-list">
              {(() => {
                const stdDiameters = [8, 10, 12, 16, 20, 25, 32]
                const rWeights = stdDiameters.map(dia => remnantDiameterWeights[dia] || 0)
                const maxRemWeight = Math.max(...rWeights, 1)

                return stdDiameters.map(dia => {
                  const remWeight = remnantDiameterWeights[dia] || 0
                  const percentWidth = maxRemWeight > 0 ? (remWeight / maxRemWeight) * 100 : 0
                  return (
                    <div key={dia} className="dia-dist-row">
                      <span className="dia-dist-label font-bold">{dia} mm</span>
                      <div className="dia-dist-bar-bg remnant-bar-bg">
                        <div
                          className="dia-dist-bar-fill remnant-bar-fill"
                          style={{ width: `${percentWidth}%` }}
                        ></div>
                      </div>
                      <span className="dia-dist-value remnant-val">
                        {remWeight > 0 ? `${remWeight.toFixed(1)} kg` : '0 kg'}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
