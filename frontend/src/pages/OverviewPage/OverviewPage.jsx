import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { batchesApi } from '../../utils/api'
import {
  Package,
  Trash2,
  Percent,
  ShoppingCart,
  Scale,
  TrendingDown,
  Activity,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Layers,
  BarChart3
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner'
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
        setError('')
        const data = await batchesApi.getStats()
        setStats(data)
      } catch (err) {
        setError(err.message || 'Failed to fetch overview statistics.')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  // Currency & count integer formatter: e.g. 33,00,000 or 0
  const formatCurrency = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0'
    const val = Math.round(Number(num))
    if (val === 0) return '0'
    return val.toLocaleString('en-IN')
  }

  // Weight in Kg: strictly formatted as integer (e.g. 13,994 or 0, never decimals)
  const formatKg = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0'
    const val = Math.round(Number(num))
    if (val === 0) return '0'
    return val.toLocaleString('en-IN')
  }

  // Tonnage formatter: 0 -> "0 T", 55 -> "55 T"
  const formatTons = (kg) => {
    if (!kg || Number(kg) === 0) return '0 T'
    const tons = Number(kg) / 1000
    if (tons === 0 || Math.abs(tons) < 0.01) return '0 T'
    if (tons % 1 === 0) return `${Math.round(tons).toLocaleString('en-IN')} T`
    return `${tons.toLocaleString('en-IN', { maximumFractionDigits: 1 })} T`
  }

  // Percentage formatter: 0 -> "0.00", 0.35 -> "0.35"
  const formatPct = (num) => {
    if (!num || Number(num) === 0) return '0.00'
    return Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  if (loading) {
    return <LoadingSpinner message="Loading Dashboard Overview..." minHeight="65vh" />
  }

  const {
    liveStandardKg = 0,
    liveRemnantsKg = 0,
    liveScrapKg = 0,
    totalScrapKg = 0,
    wastagePercentage = 0,
    dailyScrapGraph = [],
    diameterWeights = {},
    remnantDiameterWeights = {},
    totalSteelPurchasedCost = 0,
    totalSteelPurchasedKg = 0,
    totalScrapSoldWeight = 0,
    totalScrapRevenue = 0,
    lostMaterialValue = 0
  } = stats || {}

  const standardDiameters = [8, 10, 12, 16, 20, 25, 32]

  // Chart Dimensions & calculations
  const chartHeight = 145
  const chartWidth = 520
  const highestScrap = Math.max(...dailyScrapGraph.map((d) => d.scrapKg), 10)
  const maxScrap = Math.ceil(highestScrap * 1.32) // 32% headroom above peak
  const padBottom = 24
  const padTop = 22
  const padLeft = 44
  const padRight = 16
  const graphHeight = chartHeight - padBottom - padTop
  const graphWidth = chartWidth - padLeft - padRight

  return (
    <div className="overview-page-wrapper">
      <div className="overview-page">
        {/* Top Header */}
        <div className="overview-header">
          <div className="header-title-group">
            <div className="title-row">
              <h1 className="overview-title">Dashboard Overview</h1>
              <span className="live-status-pill">
                <span className="pulse-dot"></span> Live Sync
              </span>
            </div>
            <p className="overview-subtitle">
              Real-time material analytics for <span className="highlight-company">{user?.companyName || 'Enterprise'}</span>
              {user?.projectName && (
                <>
                  <span className="subtitle-sep">•</span>
                  Project: <span className="highlight-project">{user.projectName}</span>
                </>
              )}
            </p>
          </div>
          {onNavigate && (
            <button className="run-opt-btn" onClick={() => onNavigate('inputs')}>
              <Activity size={15} />
              <span>Run Optimization</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>

        {error && (
          <div className="overview-error-banner">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 6 Equal-Sized Primary Metric Cards Grid */}
        <div className="equal-kpi-grid">
          {/* Card 1: Live Stock */}
          <div className="equal-kpi-card card-purple-accent">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Live Stock</span>
              <div className="kpi-icon-pill icon-purple">
                <Package size={16} />
              </div>
            </div>
            <div className="kpi-card-body">
              <div className="kpi-multi-row">
                <div className="kpi-sub-item">
                  <span className="kpi-sub-label">Standard :</span>
                  <div className="kpi-sub-val-wrapper">
                    <span className="kpi-val-highlight text-purple">{formatKg(liveStandardKg)}</span>
                    <span className="kpi-unit">Kg</span>
                  </div>
                </div>
                <div className="kpi-sub-divider"></div>
                <div className="kpi-sub-item">
                  <span className="kpi-sub-label">Remanants :</span>
                  <div className="kpi-sub-val-wrapper">
                    <span className="kpi-val-highlight text-indigo">{formatKg(liveRemnantsKg)}</span>
                    <span className="kpi-unit">Kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Scrap Stock */}
          <div className="equal-kpi-card card-rose-accent">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Scrap Stock</span>
              <div className="kpi-icon-pill icon-rose">
                <Trash2 size={16} />
              </div>
            </div>
            <div className="kpi-card-body">
              <div className="kpi-multi-row">
                <div className="kpi-sub-item">
                  <span className="kpi-sub-label">Live Scrap :</span>
                  <div className="kpi-sub-val-wrapper">
                    <span className="kpi-val-highlight text-rose">{formatKg(liveScrapKg)}</span>
                    <span className="kpi-unit">Kg</span>
                  </div>
                </div>
                <div className="kpi-sub-divider"></div>
                <div className="kpi-sub-item">
                  <span className="kpi-sub-label">Total Till Date :</span>
                  <div className="kpi-sub-val-wrapper">
                    <span className="kpi-val-highlight text-amber">{formatKg(totalScrapKg)}</span>
                    <span className="kpi-unit">Kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Scrap Percentage */}
          <div className="equal-kpi-card card-amber-accent">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Scrap Percentage</span>
              <div className="kpi-icon-pill icon-amber">
                <Percent size={16} />
              </div>
            </div>
            <div className="kpi-card-body single-metric-body">
              <div className="kpi-main-metric">
                <span className="kpi-hero-val text-amber">{formatPct(wastagePercentage)}</span>
                <span className="kpi-hero-unit">%</span>
              </div>
              <div className="kpi-pill-badge amber-badge">
                {wastagePercentage > 0
                  ? `${formatPct(100 - wastagePercentage)}% Rebar Yield`
                  : '0.00% Scrap Loss'}
              </div>
            </div>
          </div>

          {/* Card 4: Total Steel Purchased */}
          <div className="equal-kpi-card card-blue-accent">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Total Steel Purchased</span>
              <div className="kpi-icon-pill icon-blue">
                <ShoppingCart size={16} />
              </div>
            </div>
            <div className="kpi-card-body single-metric-body">
              <div className="kpi-purchased-block">
                <span className="kpi-sub-label">Till Date :</span>
                <div className="kpi-purchased-amount">
                  <span className="kpi-val-highlight text-blue">{formatCurrency(totalSteelPurchasedCost)}/-</span>
                  <span className="kpi-currency">Rs.</span>
                </div>
              </div>
              <div className="kpi-pill-badge blue-badge">
                Inward: {formatTons(totalSteelPurchasedKg)} ({formatKg(totalSteelPurchasedKg)} Kg)
              </div>
            </div>
          </div>

          {/* Card 5: Total Scrap Sold */}
          <div className="equal-kpi-card card-cyan-accent">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Total Scrap Sold</span>
              <div className="kpi-icon-pill icon-cyan">
                <Scale size={16} />
              </div>
            </div>
            <div className="kpi-card-body">
              <div className="kpi-multi-row">
                <div className="kpi-sub-item">
                  <span className="kpi-sub-label">Total Weight Sold :</span>
                  <div className="kpi-sub-val-wrapper">
                    <span className="kpi-val-highlight text-cyan">{formatKg(totalScrapSoldWeight)}</span>
                    <span className="kpi-unit">Kg</span>
                  </div>
                </div>
                <div className="kpi-sub-divider"></div>
                <div className="kpi-sub-item">
                  <span className="kpi-sub-label">Till Date :</span>
                  <div className="kpi-sub-val-wrapper">
                    <span className="kpi-val-highlight text-emerald">
                      {formatCurrency(totalScrapRevenue)}/-
                    </span>
                    <span className="kpi-currency">Rs.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 6: Lost Material Value */}
          <div className="equal-kpi-card card-crimson-accent">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Lost Material Value</span>
              <div className="kpi-icon-pill icon-crimson">
                <TrendingDown size={16} />
              </div>
            </div>
            <div className="kpi-card-body single-metric-body">
              <div className="kpi-main-metric">
                <span className="kpi-hero-val text-crimson">{formatCurrency(lostMaterialValue)}</span>
                <span className="kpi-currency">Rs.</span>
              </div>
              <div className="kpi-pill-badge crimson-badge">
                <span className="badge-dot"></span> Unrecovered Scrap Loss
              </div>
            </div>
          </div>
        </div>

        {/* Lower Analytics Section: Diawise Live Stock & 30-Day Scrap Generation */}
        <div className="overview-lower-grid">
          {/* Panel 1: Diawise Live Stock */}
          <div className="analytics-card diawise-panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <Layers size={16} className="panel-icon text-purple" />
                <div>
                  <h3 className="panel-title">Diawise Live Stock</h3>
                </div>
              </div>
              <div className="dia-legend-group">
                <span className="dia-legend-item">
                  <span className="legend-dot std-dot"></span> Standard
                </span>
                <span className="dia-legend-item">
                  <span className="legend-dot rem-dot"></span> Remanants
                </span>
              </div>
            </div>

            <div className="diawise-grid-container">
              {standardDiameters.map((dia) => {
                const stdKg = diameterWeights[dia] || 0
                const remKg = remnantDiameterWeights[dia] || 0
                const totalDiaKg = stdKg + remKg
                const maxDiaKg = Math.max(
                  ...standardDiameters.map((d) => (diameterWeights[d] || 0) + (remnantDiameterWeights[d] || 0)),
                  1
                )
                const percentStd = totalDiaKg > 0 ? (stdKg / maxDiaKg) * 100 : 0
                const percentRem = totalDiaKg > 0 ? (remKg / maxDiaKg) * 100 : 0

                return (
                  <div key={dia} className="dia-row-card">
                    <div className="dia-badge-col">
                      <span className="dia-number">{dia}</span>
                      <span className="dia-unit">mm</span>
                    </div>

                    <div className="dia-bar-wrapper">
                      <div className="dia-bar-track">
                        {percentStd > 0 && (
                          <div
                            className="dia-bar-segment std-bar"
                            style={{ width: `${percentStd}%` }}
                            title={`Standard: ${formatKg(stdKg)} Kg`}
                          ></div>
                        )}
                        {percentRem > 0 && (
                          <div
                            className="dia-bar-segment rem-bar"
                            style={{ width: `${percentRem}%` }}
                            title={`Remnants: ${formatKg(remKg)} Kg`}
                          ></div>
                        )}
                      </div>
                      <div className="dia-subvalues-row">
                        <span className="sub-metric std-txt">Std: {formatKg(stdKg)} Kg</span>
                        <span className="sub-metric rem-txt">Rem: {formatKg(remKg)} Kg</span>
                      </div>
                    </div>

                    <div className="dia-total-col">
                      <span className="dia-total-val">{formatKg(totalDiaKg)}</span>
                      <span className="dia-total-unit">Kg</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panel 2: Daily Scrap Generation Trend (30 Days) */}
          <div className="analytics-card trend-panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <BarChart3 size={16} className="panel-icon text-emerald" />
                <div>
                  <h3 className="panel-title">Daily Scrap Generation</h3>
                  <span className="panel-subtitle">Cumulative daily cut wastage history (Last 30 Days)</span>
                </div>
              </div>
              <span className="trend-badge">30-Day Trend</span>
            </div>

            <div className="svg-chart-container">
              {dailyScrapGraph.length === 0 ? (
                <div className="no-data-placeholder">
                  <Sparkles size={28} color="#64748b" />
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
                  const areaPath =
                    points.length > 0
                      ? `${smoothLinePath} L ${points[points.length - 1].x.toFixed(1)},${chartHeight - padBottom} L ${points[0].x.toFixed(1)},${chartHeight - padBottom} Z`
                      : ''

                  return (
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="scrap-svg-chart">
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                          <stop offset="60%" stopColor="#10b981" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#059669" />
                          <stop offset="50%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                        <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.4" />
                        </filter>
                      </defs>

                      {/* Gridlines */}
                      {[0, Math.round(highestScrap / 2), Math.round(highestScrap)].map((gridVal, idx) => {
                        const y = chartHeight - padBottom - (gridVal / maxScrap) * graphHeight
                        return (
                          <g key={idx}>
                            <line
                              x1={padLeft}
                              y1={y}
                              x2={chartWidth - padRight}
                              y2={y}
                              stroke="rgba(255, 255, 255, 0.07)"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <text x={padLeft - 6} y={y + 3} className="axis-text axis-y" textAnchor="end">
                              {gridVal} kg
                            </text>
                          </g>
                        )
                      })}

                      {/* Area */}
                      {areaPath && <path d={areaPath} fill="url(#areaGrad)" className="line-chart-area" />}

                      {/* Line */}
                      {smoothLinePath && (
                        <path
                          d={smoothLinePath}
                          fill="none"
                          stroke="url(#lineGrad)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="url(#glowEffect)"
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

                      {/* X-axis labels */}
                      {points.map(({ x, item, idx }) => {
                        const isTick =
                          idx === 0 || idx === 7 || idx === 14 || idx === 21 || idx === points.length - 1
                        if (!isTick) return null

                        return (
                          <g key={`lbl-${idx}`}>
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

                      {/* Points */}
                      {points.map(({ x, y, item, idx }) => {
                        const hasScrap = item.scrapKg > 0
                        return (
                          <g key={`pt-${idx}`} className="chart-point-group">
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
                                <text x={x} y={y - 8} className="point-value-tag" textAnchor="middle">
                                  {item.scrapKg >= 1000 ? `${Math.round(item.scrapKg / 1000)}k` : Math.round(item.scrapKg)}
                                </text>
                              </>
                            )}
                            <circle cx={x} cy={y} r="8" fill="transparent" className="hover-trigger-circle">
                              <title>{`${item.date}: ${Math.round(item.scrapKg)} kg scrap`}</title>
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
        </div>
      </div>
    </div>
  )
}
