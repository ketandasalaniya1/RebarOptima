import React, { useState, useMemo } from 'react';
import WorkspaceHeader from '../common/WorkspaceHeader';
import SummaryCards from '../common/SummaryCards';
import MemberBbsTable from '../common/MemberBbsTable';
import BeamInputs from './BeamInputs';
import BeamCanvas from './BeamCanvas';
import { generateBeamBbs } from './beamGenerator';

export default function BeamWorkspace({
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
  const [config, setConfig] = useState(() => {
    const existing = member?.detailingConfig || {};
    return {
      L_clear: existing.L_clear || member?.dimensions?.length || 4000,
      b: existing.b || member?.dimensions?.width || 250,
      D: existing.D || member?.dimensions?.depth || 450,
      W_left: existing.W_left || 300,
      W_right: existing.W_right || 300,
      cover: existing.cover || member?.clear_cover || 25,
      concreteGrade: existing.concreteGrade || member?.concrete_grade || 'M25',
      steelGrade: existing.steelGrade || member?.steel_grade || 'Fe500D',

      topHangerDia: existing.topHangerDia || 12,
      topHangerCount: existing.topHangerCount || 2,
      bottomMainDia: existing.bottomMainDia || 16,
      bottomMainCount: existing.bottomMainCount || 3,

      topExtraLeftCount: existing.topExtraLeftCount !== undefined ? existing.topExtraLeftCount : 2,
      topExtraLeftDia: existing.topExtraLeftDia || 16,
      topExtraRightCount: existing.topExtraRightCount !== undefined ? existing.topExtraRightCount : 2,
      topExtraRightDia: existing.topExtraRightDia || 16,
      curtailmentFraction: existing.curtailmentFraction || 0.33,

      includeSideFaceBars: existing.includeSideFaceBars || (existing.D ? existing.D > 750 : false),
      sideFaceDia: existing.sideFaceDia || 12,
      sideFaceCountPerFace: existing.sideFaceCountPerFace || 1,

      stirrupDia: existing.stirrupDia || 8,
      supportSpacing: existing.supportSpacing || 100,
      midspanSpacing: existing.midspanSpacing || 150,
      supportZoneLength: existing.supportZoneLength || 900,

      ruleSetId: existing.ruleSetId || 'RULE_SET_CENTERLINE_EXACT'
    };
  });

  const calculationResult = useMemo(() => {
    return generateBeamBbs(config);
  }, [config]);

  const { rebarItems, summary, validation } = calculationResult;

  const handleSave = () => {
    if (onSaveSchedule) {
      onSaveSchedule({
        memberId: member?._id || member?.id,
        detailingConfig: config,
        dimensions: {
          length: config.L_clear,
          width: config.b,
          depth: config.D
        },
        rebarItems,
        summary
      });
    }
  };

  return (
    <div className="bbs-workspace-container">
      <WorkspaceHeader
        member={member}
        project={project}
        block={block}
        level={level}
        workspaceTitle={`Beam Detailing: ${member?.displayId || 'B1'}`}
        onSave={handleSave}
        onClose={onClose}
        onExportPDF={onExportPDF ? () => onExportPDF(member, rebarItems, summary) : null}
        onPushOptimizer={onPushOptimizer ? () => onPushOptimizer(rebarItems, project) : null}
        saving={saving}
      />

      <div className="bbs-workspace-body">
        <SummaryCards
          totalWeight={summary.totalSteelWeight}
          concreteVolume={summary.concreteVolume}
          barCount={summary.barCount}
          distinctDiameters={summary.distinctDiameters}
        />

        <div className="bbs-workspace-canvases-row">
          <BeamCanvas
            L_clear={config.L_clear}
            b={config.b}
            D={config.D}
            cover={config.cover}
            topHangerCount={config.topHangerCount}
            topHangerDia={config.topHangerDia}
            bottomMainCount={config.bottomMainCount}
            bottomMainDia={config.bottomMainDia}
            stirrupDia={config.stirrupDia}
            supportSpacing={config.supportSpacing}
            midspanSpacing={config.midspanSpacing}
            includeSideFaceBars={config.includeSideFaceBars}
            width={620}
            height={260}
          />
        </div>

        <BeamInputs
          config={config}
          onChange={setConfig}
          validation={validation}
        />

        <MemberBbsTable
          rebarItems={rebarItems}
          title={`Bar Bending Schedule: Beam ${member?.displayId || 'B1'}`}
          subtitle="Longitudinal tension steel, support curtailments, crack-control web bars, and shear stirrups."
        />
      </div>
    </div>
  );
}

