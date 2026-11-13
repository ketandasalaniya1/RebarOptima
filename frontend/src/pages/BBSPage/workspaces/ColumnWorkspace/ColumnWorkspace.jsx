import React, { useState, useMemo, useEffect } from 'react';
import WorkspaceHeader from '../common/WorkspaceHeader';
import SummaryCards from '../common/SummaryCards';
import MemberBbsTable from '../common/MemberBbsTable';
import ColumnInputs from './ColumnInputs';
import ColumnSectionCanvas from './ColumnSectionCanvas';
import ColumnElevationCanvas from './ColumnElevationCanvas';
import { generateColumnBbs } from './columnGenerator';

export default function ColumnWorkspace({
  member,
  project,
  block,
  level,
  onSaveSchedule,
  onClose,
  onExportPDF,
  onPushOptimizer,
  saving = false
}) {
  // Initialize detailing config from existing member or safe initial values
  const [config, setConfig] = useState(() => {
    const existing = member?.detailingConfig || {};
    return {
      B: existing.B || member?.dimensions?.width || 300,
      D: existing.D || member?.dimensions?.depth || 450,
      H_clear: existing.H_clear || (member?.dimensions?.length ? member.dimensions.length : 3000),
      D_beam: existing.D_beam || 450,
      t_slab: existing.t_slab || 150,
      cover: existing.cover || member?.clear_cover || 40,
      concreteGrade: existing.concreteGrade || member?.concrete_grade || member?.concreteGrade || 'M25',
      steelGrade: existing.steelGrade || member?.steel_grade || 'Fe500D',

      cornerDia: existing.cornerDia || 20,
      faceXCount: existing.faceXCount !== undefined ? existing.faceXCount : 2,
      faceXDia: existing.faceXDia || 16,
      faceYCount: existing.faceYCount !== undefined ? existing.faceYCount : 0,
      faceYDia: existing.faceYDia || 16,

      boundaryCondition: existing.boundaryCondition || 'INTERMEDIATE',
      lapMode: existing.lapMode || 'MULTIPLIER',
      lapMultiplier: existing.lapMultiplier || 50,
      explicitLapLength: existing.explicitLapLength || 1000,
      staggerLaps: !!existing.staggerLaps,
      staggerOffsetMm: existing.staggerOffsetMm || 750,
      crankOffset: existing.crankOffset || 0,

      tieDia: existing.tieDia || 8,
      customConfinementHeight: existing.customConfinementHeight || null,
      confinementSpacing: existing.confinementSpacing || 100,
      middleSpacing: existing.middleSpacing || 150,
      includeJointTies: !!existing.includeJointTies,
      linkConfig: existing.linkConfig || 'DIAMOND',

      ruleSetId: existing.ruleSetId || 'RULE_SET_CENTERLINE_EXACT'
    };
  });

  // Calculate live BBS output
  const calculationResult = useMemo(() => {
    return generateColumnBbs(config);
  }, [config]);

  const { rebarItems, summary, validation } = calculationResult;

  // Handle Save
  const handleSave = () => {
    if (onSaveSchedule) {
      onSaveSchedule({
        memberId: member?._id || member?.id,
        detailingConfig: config,
        dimensions: {
          width: config.B,
          depth: config.D,
          length: config.H_clear + config.D_beam
        },
        rebarItems,
        summary
      });
    }
  };

  return (
    <div className="bbs-workspace-container">
      {/* Top Header */}
      <WorkspaceHeader
        member={member}
        project={project}
        block={block}
        level={level}
        workspaceTitle={`Column Detailing: ${member?.displayId || 'C1'}`}
        onSave={handleSave}
        onClose={onClose}
        onExportPDF={onExportPDF ? () => onExportPDF(member, rebarItems, summary) : null}
        onPushOptimizer={onPushOptimizer ? () => onPushOptimizer(rebarItems, project) : null}
        saving={saving}
      />

      <div className="bbs-workspace-body">
        {/* Summary Metric Cards */}
        <SummaryCards
          totalWeight={summary.totalSteelWeight}
          concreteVolume={summary.concreteVolume}
          barCount={summary.barCount}
          distinctDiameters={summary.distinctDiameters}
        />

        {/* Visual Previews and Interactive Canvases */}
        <div className="bbs-workspace-canvases-row">
          <ColumnSectionCanvas
            B={config.B}
            D={config.D}
            cover={config.cover}
            cornerDia={config.cornerDia}
            faceXCount={config.faceXCount}
            faceXDia={config.faceXDia}
            faceYCount={config.faceYCount}
            faceYDia={config.faceYDia}
            tieDia={config.tieDia}
            linkConfig={config.linkConfig}
            width={380}
            height={280}
          />

          <ColumnElevationCanvas
            H_clear={config.H_clear}
            D_beam={config.D_beam}
            Lo={validation.Lo}
            confinementSpacing={config.confinementSpacing}
            middleSpacing={config.middleSpacing}
            boundaryCondition={config.boundaryCondition}
            lapLength={config.lapMode === 'EXPLICIT' ? config.explicitLapLength : config.lapMultiplier * config.cornerDia}
            staggerLaps={config.staggerLaps}
            staggerOffsetMm={config.staggerOffsetMm}
            width={260}
            height={280}
          />
        </div>

        {/* Detailing Input Cards */}
        <ColumnInputs
          config={config}
          onChange={setConfig}
          validation={validation}
        />

        {/* Live Generated BBS Table */}
        <MemberBbsTable
          rebarItems={rebarItems}
          title={`Bar Bending Schedule: Column ${member?.displayId || 'C1'}`}
          subtitle="Real-time cutting lengths and weights derived from column geometry and CAD Shape Library."
        />
      </div>
    </div>
  );
}

