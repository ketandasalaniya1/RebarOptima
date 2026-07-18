import { useState, useEffect } from 'react'
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
  TrendingDown
} from 'lucide-react'
import './OverviewPage.css'

export default function OverviewPage({ onNavigate }) {
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
        <p>Loading project stats...</p>
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
    totalScrapSoldWeight = 0,
    totalScrapRevenue = 0,
    totalScrapLossDifferential = 0
  } = stats || {}

  // SVG Chart Dimensions
  const chartHeight = 220
  const chartWidth = 560
  const maxScrap = Math.max(...dailyScrapGraph.map(d => d.scrapKg), 10)
  const padBottom = 30
  const padTop = 20
  const padLeft = 40
  const padRight = 20
  const graphHeight = chartHeight - padBottom - padTop
  const graphWidth = chartWidth - padLeft - padRight

  return (
    <div className="overview-page">
      <div className="overview-header">
        <div>
          <h1 className="overview-title">Dashboard Overview</h1>
          <p className="overview-subtitle">Real-time steel stock analytics and optimization efficiency logs.</p>
        </div>
        <button className="run-opt-btn" onClick={() => onNavigate('inputs')}>
          Run Optimization <ArrowRight size={16} style={{ marginLeft: '6px' }} />
        </button>
      </div>

      {error && (
        <div className="overview-error-banner">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="stats-cards-grid">
        <div className="card stat-card">
          <div className="stat-card-left">
            <span className="card-lbl">Live Stock Weight</span>
            <span className="card-val">
              {(totalLiveStockKg / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="val-unit">Tons</span>
            </span>
            <div className="card-sub-stats">
              <span className="sub-stat-item">
                <span className="bullet std"></span> Standard: {(liveStandardKg / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tons
              </span>
              <span className="sub-stat-item">
                <span className="bullet rem"></span> Remnants: {(liveRemnantsKg / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tons
              </span>
            </div>
          </div>
          <div className="card-icon-wrapper purple-bg">
            <Package size={22} color="var(--accent)" />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card-left">
            <span className="card-lbl">Scrap Generated (Till Date)</span>
            <span className="card-val text-red">
              {totalScrapKg.toLocaleString()} <span className="val-unit">Kgs</span>
            </span>
            <span className="card-sub-lbl text-red">Cumulative waste generated from cut lists</span>
          </div>
          <div className="card-icon-wrapper red-bg">
            <Trash2 size={22} color="#ea4a4a" />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card-left">
            <span className="card-lbl">Wastage / Scrap Ratio</span>
            <span className="card-val text-orange">
              {wastagePercentage.toFixed(2)}<span className="val-unit">%</span>
            </span>
            <span className="card-sub-lbl text-orange">
              {wastagePercentage > 0 
                ? `Efficiency: ${(100 - wastagePercentage).toFixed(2)}% yield`
                : 'No optimization batches run yet'}
            </span>
          </div>
          <div className="card-icon-wrapper orange-bg">
            <TrendingUp size={22} color="#e38c22" />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card-left">
            <span className="card-lbl">Total Scrap Weight Sold</span>
            <span className="card-val text-cyan">
              {totalScrapSoldWeight.toLocaleString()} <span className="val-unit">Kgs</span>
            </span>
            <span className="card-sub-lbl text-cyan">Scrap cleared & sold from site</span>
          </div>
          <div className="card-icon-wrapper cyan-bg">
            <Scale size={22} color="#3ac0e8" />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card-left">
            <span className="card-lbl">Total Revenue Retrieved</span>
            <span className="card-val text-green">
              ₹{totalScrapRevenue.toLocaleString('en-IN')}
            </span>
            <span className="card-sub-lbl text-green">Capital recovered from waste sales</span>
          </div>
          <div className="card-icon-wrapper green-bg">
            <DollarSign size={22} color="#2da44e" />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card-left">
            <span className="card-lbl">Lost Material Capital</span>
            <span className="card-val text-red">
              ₹{totalScrapLossDifferential.toLocaleString('en-IN')}
            </span>
            <span className="card-sub-lbl text-red">Lost value (Purchased vs sold scrap)</span>
          </div>
          <div className="card-icon-wrapper red-bg">
            <TrendingDown size={22} color="#ea4a4a" />
          </div>
        </div>
      </div>

      {/* Main Graphs & Stock breakdown Section */}
      <div className="dashboard-content-grid">
        {/* SVG Daily Scrap Graph */}
        <div className="card graph-card">
          <h3 className="graph-card-title">Daily Scrap Generation</h3>
          <p className="graph-card-subtitle">Scrap weight logged per batch over the last 7 active days.</p>
          
          <div className="svg-chart-container">
            {dailyScrapGraph.length === 0 ? (
              <div className="no-data-placeholder">
                <Layers size={40} color="#8d86b8" />
                <p>No batch runs completed yet to compile charts.</p>
              </div>
            ) : (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="scrap-svg-chart">
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = padTop + graphHeight * (1 - ratio)
                  const gridVal = Math.round(maxScrap * ratio)
                  return (
                    <g key={idx}>
                      <line 
                        x1={padLeft} 
                        y1={y} 
                        x2={chartWidth - padRight} 
                        y2={y} 
                        stroke="var(--border-color)" 
                        strokeWidth="1" 
                        strokeDasharray="4 4"
                      />
                      <text 
                        x={padLeft - 10} 
                        y={y + 4} 
                        className="axis-text axis-y" 
                        textAnchor="end"
                      >
                        {gridVal} kg
                      </text>
                    </g>
                  )
                })}

                {/* Bars */}
                {dailyScrapGraph.map((item, idx) => {
                  const barCount = dailyScrapGraph.length
                  const colWidth = graphWidth / barCount
                  const barWidth = colWidth * 0.5
                  const x = padLeft + idx * colWidth + (colWidth - barWidth) / 2
                  
                  // Height mapping
                  const barHeight = item.scrapKg > 0 ? (item.scrapKg / maxScrap) * graphHeight : 4
                  const y = chartHeight - padBottom - barHeight
                  
                  return (
                    <g key={idx} className="chart-bar-group">
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        ry="4"
                        className="svg-bar"
                      />
                      {/* Tooltip value */}
                      <text
                        x={x + barWidth / 2}
                        y={y - 8}
                        className="bar-value-lbl"
                        textAnchor="middle"
                      >
                        {item.scrapKg > 0 ? `${item.scrapKg} kg` : '0'}
                      </text>
                      {/* Label */}
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - padBottom + 18}
                        className="axis-text axis-x"
                        textAnchor="middle"
                      >
                        {item.date}
                      </text>
                    </g>
                  )
                })}

                {/* Bottom Base axis */}
                <line 
                  x1={padLeft} 
                  y1={chartHeight - padBottom} 
                  x2={chartWidth - padRight} 
                  y2={chartHeight - padBottom} 
                  stroke="var(--text-secondary)" 
                  strokeWidth="1"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Live inventory distribution summary */}
        <div className="card distribution-card">
          <h3 className="dist-card-title">Stock Diameter Distribution</h3>
          <p className="dist-card-subtitle">Total weight distribution by rebar size (8mm to 32mm).</p>

          <div className="dia-distribution-list">
            {(() => {
              const weights = [8, 10, 12, 16, 20, 25, 32].map(dia => diameterWeights[dia] || 0);
              const maxWeight = Math.max(...weights, 0);

              return [8, 10, 12, 16, 20, 25, 32].map(dia => {
                const weight = diameterWeights[dia] || 0;
                const percentWidth = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
                return (
                  <div key={dia} className="dia-dist-row">
                    <span className="dia-dist-label">{dia} mm</span>
                    <div className="dia-dist-bar-bg">
                      <div 
                        className="dia-dist-bar-fill" 
                        style={{ 
                          width: `${percentWidth}%`
                        }}
                      ></div>
                    </div>
                    <span className="dia-dist-value">
                      {weight > 0 ? `${Math.round(weight).toLocaleString()} kg` : '0 kg'}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
