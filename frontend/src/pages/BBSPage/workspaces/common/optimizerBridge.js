/**
 * 1D Cutting Optimizer Bridge
 * Connects the Bar Bending Schedule module directly into RebarOptima's
 * 1D Cutting Stock Problem solver (optimizer.engine.ts / batches).
 */

export function pushBbsToCuttingOptimizer({
  rebarItems = [],
  project,
  member,
  onNavigate
}) {
  if (!rebarItems || rebarItems.length === 0) {
    alert('No scheduled reinforcement items available to optimize.');
    return;
  }

  const memberMark = member?.displayId || member?.member_id || '';
  const batchTitle = memberMark
    ? `BBS Batch - ${project?.name || 'Project'} (${memberMark})`
    : `BBS Batch - ${project?.name || 'Project'} MTO`;

  // Map each scheduled piece into requiredParts for the 1D Cutting Optimizer
  const requiredParts = rebarItems.map((item, index) => ({
    id: index + 1,
    diameter: String(item.diameter || item.barDiameter || 16),
    length: String(Math.round(Number(item.cut_length) || 0)),
    quantity: String(Number(item.quantity) || Number(item.bar_count) || 1),
    label: `${item.barMark ? `Mark ${item.barMark}: ` : ''}${item.description || item.shapeCode || 'Rebar'}`
  }));

  const payload = {
    batchName: batchTitle,
    projectId: project?._id || project?.id,
    projectName: project?.name,
    requiredParts,
    inputStock: [
      { diameter: '8', length: '12000', quantity: '100' },
      { diameter: '10', length: '12000', quantity: '100' },
      { diameter: '12', length: '12000', quantity: '100' },
      { diameter: '16', length: '12000', quantity: '100' },
      { diameter: '20', length: '12000', quantity: '100' },
      { diameter: '25', length: '12000', quantity: '100' },
      { diameter: '32', length: '12000', quantity: '50' }
    ]
  };

  try {
    sessionStorage.setItem('prefill_required_parts', JSON.stringify(requiredParts));
    sessionStorage.setItem('prefill_project_id', String(project?._id || project?.id || ''));
    sessionStorage.setItem('bbs_optimizer_payload', JSON.stringify(payload));

    const totalCuts = requiredParts.reduce((s, p) => s + Number(p.quantity), 0);
    const confirmHandoff = window.confirm(
      `Ready to optimize cutting list:\n\n` +
      `• Total Rebar Cuts: ${totalCuts} pieces across ${requiredParts.length} bar marks.\n` +
      `• Target: Minimize rebar scrap using standard 12-meter stock bars.\n\n` +
      `Click OK to proceed to the Cutting List Optimizer.`
    );

    if (confirmHandoff) {
      if (typeof onNavigate === 'function') {
        onNavigate('inputs');
      } else {
        window.location.hash = '#/inputs';
      }
    }
  } catch (err) {
    console.error('Failed to stage optimizer payload:', err);
    alert('Error staging cutting list for optimizer: ' + err.message);
  }
}
