import React, { useState, useMemo } from 'react';
import WorkspaceHeader from '../common/WorkspaceHeader';
import SummaryCards from '../common/SummaryCards';
import MemberBbsTable from '../common/MemberBbsTable';
import RetainingWallInputs from './RetainingWallInputs';
import RetainingWallCanvas from './RetainingWallCanvas';
import { generateRetainingWallBbs } from './retainingWallGenerator';

export default function RetainingWallWorkspace({
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
      H_stem: existing.H_stem || member?.dimensions?.length || 3500,
      t_top: existing.t_top || 250,
      t_bot: existing.t_bot || 400,
      B_base: existing.B_base || member?.dimensions?.width || 2500,
      t_base: existing.t_base || member?.dimensions?.depth || 450,
      L_toe: existing.L_toe || 700,
      L_heel: existing.L_heel || 1400,
      L_wall: existing.L_wall || 5000,
      coverEarth: existing.coverEarth || member?.clear_cover || 45,
      coverOuter: existing.coverOuter || 30,
      concreteGrade: existing.concreteGrade || member?.concrete_grade || 'M25',
      steelGrade: existing.steelGrade || member?.steel_grade || 'Fe500D',

      stemMainDia: existing.stemMainDia || 16,
      stemMainSpacing: existing.stemMainSpacing || 150,
      heelAnchorLength: existing.heelAnchorLength || 1000,

      stemOuterDia: existing.stemOuterDia || 10,
      stemOuterSpacing: existing.stemOuterSpacing || 200,

      stemHorizDia: existing.stemHorizDia || 8,
      stemHorizSpacing: existing.stemHorizSpacing || 200,

      heelTopDia: existing.heelTopDia || 16,
      heelTopSpacing: existing.heelTopSpacing || 150,
      toeBottomDia: existing.toeBottomDia || 12,
      toeBottomSpacing: existing.toeBottomSpacing || 150,

      ruleSetId: existing.ruleSetId || 'RULE_SET_CENTERLINE_EXACT'
    };
  });

  const calculationResult = useMemo(() => {
    return generateRetainingWallBbs(config);
  }, [config]);

  const { rebarItems, summary, validation } = calculationResult;

  const handleSave = () => {
    if (onSaveSchedule) {
      onSaveSchedule({
        memberId: member?._id || member?.id,
        detailingConfig: config,
        dimensions: {
          length: config.H_stem,
          width: config.B_base,
          depth: config.t_base
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
        workspaceTitle={`Retaining Wall Detailing: ${member?.displayId || 'RW1'}`}
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
          <RetainingWallCanvas
            H_stem={config.H_stem}
            t_top={config.t_top}
            t_bot={config.t_bot}
            B_base={config.B_base}
            t_base={config.t_base}
            L_toe={config.L_toe}
            L_heel={config.L_heel}
            stemMainDia={config.stemMainDia}
            coverEarth={config.coverEarth}
            width={620}
            height={280}
          />
        </div>

        <RetainingWallInputs
          config={config}
          onChange={setConfig}
          validation={validation}
        />

        <MemberBbsTable
          rebarItems={rebarItems}
          title={`Bar Bending Schedule: Retaining Wall ${member?.displayId || 'RW1'}`}
          subtitle="Stem cantilever vertical bars, heel & toe flexural steel, and temperature distribution mesh."
        />
      </div>
    </div>
  );
}

