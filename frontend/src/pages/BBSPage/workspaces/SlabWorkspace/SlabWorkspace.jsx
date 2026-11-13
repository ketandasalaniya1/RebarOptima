import React, { useState, useMemo } from 'react';
import WorkspaceHeader from '../common/WorkspaceHeader';
import SummaryCards from '../common/SummaryCards';
import MemberBbsTable from '../common/MemberBbsTable';
import SlabInputs from './SlabInputs';
import SlabCanvas from './SlabCanvas';
import { generateSlabBbs } from './slabGenerator';

export default function SlabWorkspace({
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
      Lx: existing.Lx || member?.dimensions?.width || 3000,
      Ly: existing.Ly || member?.dimensions?.length || 4500,
      t: existing.t || member?.dimensions?.depth || 150,
      cover: existing.cover || member?.clear_cover || 20,
      concreteGrade: existing.concreteGrade || member?.concrete_grade || 'M20',
      steelGrade: existing.steelGrade || member?.steel_grade || 'Fe500D',

      spanningType: existing.spanningType || ((existing.Ly || 4500) / (existing.Lx || 3000) > 2 ? 'ONE_WAY' : 'TWO_WAY'),

      mainDia: existing.mainDia || 10,
      mainSpacing: existing.mainSpacing || 150,
      mainEndHook: existing.mainEndHook !== undefined ? existing.mainEndHook : 100,

      distDia: existing.distDia || 8,
      distSpacing: existing.distSpacing || 150,
      distEndHook: existing.distEndHook !== undefined ? existing.distEndHook : 100,

      includeTopExtras: existing.includeTopExtras !== false,
      topExtraDia: existing.topExtraDia || 8,
      topExtraSpacing: existing.topExtraSpacing || 200,
      topExtraFraction: existing.topExtraFraction || 0.25,

      useCrankedBars: !!existing.useCrankedBars,

      ruleSetId: existing.ruleSetId || 'RULE_SET_CENTERLINE_EXACT'
    };
  });

  const calculationResult = useMemo(() => {
    return generateSlabBbs(config);
  }, [config]);

  const { rebarItems, summary, validation } = calculationResult;

  const handleSave = () => {
    if (onSaveSchedule) {
      onSaveSchedule({
        memberId: member?._id || member?.id,
        detailingConfig: config,
        dimensions: {
          width: config.Lx,
          length: config.Ly,
          depth: config.t
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
        workspaceTitle={`Slab Detailing: ${member?.displayId || 'S1'}`}
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
          <SlabCanvas
            Lx={config.Lx}
            Ly={config.Ly}
            t={config.t}
            cover={config.cover}
            mainDia={config.mainDia}
            mainSpacing={config.mainSpacing}
            distDia={config.distDia}
            distSpacing={config.distSpacing}
            includeTopExtras={config.includeTopExtras}
            width={620}
            height={260}
          />
        </div>

        <SlabInputs
          config={config}
          onChange={setConfig}
          validation={validation}
        />

        <MemberBbsTable
          rebarItems={rebarItems}
          title={`Bar Bending Schedule: Slab ${member?.displayId || 'S1'}`}
          subtitle="Main spanning bars, distribution/secondary mesh, and top negative hogging rebar."
        />
      </div>
    </div>
  );
}

