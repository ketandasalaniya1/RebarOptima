import React, { useState } from 'react';
import {
  TrendingUp, Users, DollarSign, Award, Target,
  Filter, Calendar, Download, PieChart, BarChart3, CheckCircle2
} from 'lucide-react';
import { formatINR, formatShortINR } from '../../../utils/money';

export default function ReportsView({
  summary = null,
  pipeline = [],
  bookings = [],
  customers = [],
  projects = [],
  selectedProjectId = ''
}) {
  const [timeRange, setTimeRange] = useState('thisMonth');

  // Compute stats
  const totalBookingsCount = bookings.length;
  const totalBookingValue = bookings.reduce((sum, b) => sum + (b.netBookingValue || 0), 0);
  const totalCollections = bookings.reduce((sum, b) => sum + (b.financials?.totalPaid || 0), 0);
  const totalOutstanding = bookings.reduce((sum, b) => sum + (b.financials?.totalOutstanding || 0), 0);

  // Salesperson stats
  const agentMap = {};
  customers.forEach(c => {
    const agent = c.assignedTo || 'Unassigned';
    if (!agentMap[agent]) {
      agentMap[agent] = { leads: 0, siteVisits: 0, bookings: 0, bookedValue: 0 };
    }
    agentMap[agent].leads += 1;
    if (['SITE_VISIT_CONDUCTED', 'NEGOTIATION', 'BOOKED'].includes(c.pipelineStage)) {
      agentMap[agent].siteVisits += 1;
    }
    if (c.pipelineStage === 'BOOKED') {
      agentMap[agent].bookings += 1;
    }
  });

  bookings.forEach(b => {
    const agent = b.salesAgent || 'Direct';
    if (!agentMap[agent]) {
      agentMap[agent] = { leads: 0, siteVisits: 0, bookings: 0, bookedValue: 0 };
    }
    agentMap[agent].bookedValue += (b.netBookingValue || 0);
  });

  const agentLeaderboard = Object.entries(agentMap).map(([name, data]) => ({
    name,
    ...data,
    conversionRate: data.leads > 0 ? Math.round((data.bookings / data.leads) * 100) : 0
  })).sort((a, b) => b.bookedValue - a.bookedValue);

  // Lead Sources Breakdown
  const sourceMap = {};
  customers.forEach(c => {
    const src = c.leadSource || 'Walk-in';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  });

  // Funnel counts
  const stageCounts = {
    'Total Inbound': customers.length,
    'Qualified': customers.filter(c => !['NEW', 'LOST'].includes(c.pipelineStage)).length,
    'Site Visits Done': customers.filter(c => ['SITE_VISIT_CONDUCTED', 'NEGOTIATION', 'BOOKED'].includes(c.pipelineStage)).length,
    'Negotiation': customers.filter(c => ['NEGOTIATION', 'BOOKED'].includes(c.pipelineStage)).length,
    'Booked Contracts': bookings.length
  };

  return (
    <div className="crm-reports-view" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
            Executive Sales & Revenue Analytics
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #64748b)', fontSize: '0.88rem' }}>
            High-level metrics for sales velocity, collections, and pipeline conversion
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--bg-secondary, #ffffff)',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="thisQuarter">This Quarter</option>
            <option value="fy2026">FY 2026-27</option>
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--bg-primary, #ffffff)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: "none" }}>
              Total Gross Sales
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginTop: '8px' }}>
            {formatShortINR(totalBookingValue)}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#16a34a', marginTop: '4px', fontWeight: 500 }}>
            {totalBookingsCount} units sold
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: "none" }}>
              Collections Realized
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#dcfce7', color: '#15803d' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d', marginTop: '8px' }}>
            {formatShortINR(totalCollections)}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)', marginTop: '4px' }}>
            {totalBookingValue > 0 ? `${Math.round((totalCollections / totalBookingValue) * 100)}% of booked value` : '0%'}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: "none" }}>
              Pending Receivables
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' }}>
              <Target size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b91c1c', marginTop: '8px' }}>
            {formatShortINR(totalOutstanding)}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)', marginTop: '4px' }}>
            Milestones due or in progress
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: "none" }}>
              Active Pipeline
            </span>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#fef3c7', color: '#b45309' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginTop: '8px' }}>
            {customers.filter(c => !['BOOKED', 'LOST'].includes(c.pipelineStage)).length}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)', marginTop: '4px' }}>
            Prospects in active stages
          </div>
        </div>
      </div>

      {/* Conversion Funnel + Lead Sources Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '24px',
        marginBottom: '28px'
      }}>
        {/* Sales Pipeline Funnel */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} /> Sales Pipeline Conversion Funnel
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(stageCounts).map(([stage, count], idx) => {
              const maxCount = Math.max(1, customers.length);
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500 }}>{stage}</span>
                    <span style={{ fontWeight: 700 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: idx === 4 ? '#16a34a' : '#3b82f6',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Sources Distribution */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} /> Lead Acquisition Channels
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(sourceMap).map(([src, count]) => {
              const pct = Math.round((count / Math.max(1, customers.length)) * 100);
              return (
                <div key={src} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'var(--bg-secondary, #f8fafc)',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{src}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>{pct}%</span>
                    <span style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}>
                      {count} leads
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Salesperson Leaderboard */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={18} color="#eab308" /> Sales Team Performance Leaderboard
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', textAlign: 'left', color: 'var(--text-secondary, #64748b)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Sales Agent</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Total Leads</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Site Visits</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Bookings</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Conv. Rate</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Revenue Booked</th>
              </tr>
            </thead>
            <tbody>
              {agentLeaderboard.map((agent, idx) => (
                <tr key={agent.name} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                    {idx === 0 && <span style={{ marginRight: '6px' }}>🥇</span>}
                    {idx === 1 && <span style={{ marginRight: '6px' }}>🥈</span>}
                    {idx === 2 && <span style={{ marginRight: '6px' }}>🥉</span>}
                    {agent.name}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{agent.leads}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{agent.siteVisits}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{agent.bookings}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{agent.conversionRate}%</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                    {formatINR(agent.bookedValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

