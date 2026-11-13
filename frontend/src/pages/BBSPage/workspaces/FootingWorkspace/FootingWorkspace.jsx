import React, { useState, useMemo } from 'react';
import WorkspaceHeader from '../common/WorkspaceHeader';
import SummaryCards from '../common/SummaryCards';
import MemberBbsTable from '../common/MemberBbsTable';
import FootingInputs from './FootingInputs';
import FootingCanvas from './FootingCanvas';
import { generateFootingBbs } from './footingGenerator';

export default function FootingWorkspace({
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
      L: existing.L || member?.dimensions?.length || 2000,
      B: existing.B || member?.dimensions?.width || 2000,
      D: existing.D || member?.dimensions?.depth || 500,
      cover: existing.cover || member?.clear_cover || 50,
      concreteGrade: existing.concreteGrade || member?.concrete_grade || 'M25',
      steelGrade: existing.steelGrade || member?.steel_grade || 'Fe500D',

      pL: existing.pL || 400,
      pB: existing.pB || 400,

      meshXDia: existing.meshXDia || 12,
      meshXSpacing: existing.meshXSpacing || 150,
      meshXHookLeg: existing.meshXHookLeg || 400,

      meshYDia: existing.meshYDia || 12,
      meshYSpacing: existing.meshYSpacing || 150,
      meshYHookLeg: existing.meshYHookLeg || 400,

      includeStarterDowels: existing.includeStarterDowels !== false,
      dowelDia: existing.dowelDia || 16,
      dowelCount: existing.dowelCount || 8,
      dowelFootingHook: existing.dowelFootingHook || 300,
      dowelLapExtension: existing.dowelLapExtension || 800,

      ruleSetId: existing.ruleSetId || 'RULE_SET_CENTERLINE_EXACT'
    };
  });

  const calculationResult = useMemo(() => {
    return generateFootingBbs(config);
  }, [config]);

  const { rebarItems, summary, validation } = calculationResult;

  const handleSave = () => {
    if (onSaveSchedule) {
      onSaveSchedule({
        memberId: member?._id || member?.id,
        detailingConfig: config,
        dimensions: {
          length: config.L,
          width: config.B,
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
        workspaceTitle={`Footing Detailing: ${member?.displayId || 'F1'}`}
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
          <FootingCanvas
            L={config.L}
            B={config.B}
            D={config.D}
            cover={config.cover}
            pL={config.pL}
            pB={config.pB}
            meshXDia={config.meshXDia}
            meshXSpacing={config.meshXSpacing}
            meshYDia={config.meshYDia}
            meshYSpacing={config.meshYSpacing}
            includeStarterDowels={config.includeStarterDowels}
            dowelCount={config.dowelCount}
            width={620}
            height={260}
          />
        </div>

        <FootingInputs
          config={config}
          onChange={setConfig}
          validation={validation}
        />

        <MemberBbsTable
          rebarItems={rebarItems}
          title={`Bar Bending Schedule: Footing ${member?.displayId || 'F1'}`}
          subtitle="Bottom two-way pad reinforcement mesh with upturned hooks and column starter dowels."
        />
      </div>
    </div>
  );
}

