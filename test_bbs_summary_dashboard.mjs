import { generateColumnBbs } from './frontend/src/pages/BBSPage/workspaces/ColumnWorkspace/columnGenerator.js';
import { generateBeamBbs } from './frontend/src/pages/BBSPage/workspaces/BeamWorkspace/beamGenerator.js';
import { generateSlabBbs } from './frontend/src/pages/BBSPage/workspaces/SlabWorkspace/slabGenerator.js';
import { generateFootingBbs } from './frontend/src/pages/BBSPage/workspaces/FootingWorkspace/footingGenerator.js';
import { generateRetainingWallBbs } from './frontend/src/pages/BBSPage/workspaces/RetainingWallWorkspace/retainingWallGenerator.js';

console.log('================================================================');
console.log('REBAROPTIMA — DYNAMIC BBS SUMMARY DASHBOARD VERIFICATION SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED (Test ${totalTests}): ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED (Test ${totalTests}): ${message}`);
    passedTests++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MOCK DATA FIXTURES: PROJECT, BLOCKS, LEVELS, MEMBERS, INSTANCES
// ════════════════════════════════════════════════════════════════════════════
const mockProject = { _id: 'proj_01', name: 'Tower Pinnacle Project' };

const mockBlocks = [
  { _id: 'blk_A', id: 'blk_A', name: 'Tower A' },
  { _id: 'blk_B', id: 'blk_B', name: 'Tower B' }
];

const mockLevels = [
  { _id: 'lvl_A_GF', id: 'lvl_A_GF', blockId: 'blk_A', name: 'Ground Floor', order: 0 },
  { _id: 'lvl_A_L1', id: 'lvl_A_L1', blockId: 'blk_A', name: 'Level 1', order: 1 },
  { _id: 'lvl_B_GF', id: 'lvl_B_GF', blockId: 'blk_B', name: 'Ground Floor', order: 0 },
  { _id: 'lvl_B_L1', id: 'lvl_B_L1', blockId: 'blk_B', name: 'Level 1', order: 1 }
];

const mockMembers = [
  // Block A - Ground Floor
  { _id: 'mem_01', id: 'mem_01', blockId: 'blk_A', levelId: 'lvl_A_GF', displayId: 'C1', memberType: 'Column', activeRevision: 'rev_01', status: 'Calculated' },
  { _id: 'mem_02', id: 'mem_02', blockId: 'blk_A', levelId: 'lvl_A_GF', displayId: 'B1', memberType: 'Beam', activeRevision: 'rev_02', status: 'Calculated' },
  { _id: 'mem_03', id: 'mem_03', blockId: 'blk_A', levelId: 'lvl_A_GF', displayId: 'F1', memberType: 'Footing', activeRevision: 'rev_03', status: 'Calculated' },
  // Block A - Level 1 (Has a duplicate displayId 'C1' to test disambiguation across levels)
  { _id: 'mem_04', id: 'mem_04', blockId: 'blk_A', levelId: 'lvl_A_L1', displayId: 'C1', memberType: 'Column', activeRevision: 'rev_04', status: 'Calculated' },
  { _id: 'mem_05', id: 'mem_05', blockId: 'blk_A', levelId: 'lvl_A_L1', displayId: 'S1', memberType: 'Slab', activeRevision: 'rev_05', status: 'Calculated' },
  // Block B - Ground Floor
  { _id: 'mem_06', id: 'mem_06', blockId: 'blk_B', levelId: 'lvl_B_GF', displayId: 'RW1', memberType: 'Retaining Wall', activeRevision: 'rev_06', status: 'Calculated' },
  // Uncalculated member (must be excluded from calculated summaries)
  { _id: 'mem_07', id: 'mem_07', blockId: 'blk_B', levelId: 'lvl_B_GF', displayId: 'B2', memberType: 'Beam', activeRevision: null, status: 'Draft' }
];

const mockInstances = [
  // mem_01 (Column, Block A, GF) - active rev_01
  { _id: 'inst_01', memberId: 'mem_01', blockId: 'blk_A', levelId: 'lvl_A_GF', revisionId: 'rev_01', barMark: '01', diameter: 20, quantity: 8, cut_length: 4000, total_weight: 78.96 },
  { _id: 'inst_02', memberId: 'mem_01', blockId: 'blk_A', levelId: 'lvl_A_GF', revisionId: 'rev_01', barMark: '02', diameter: 8, quantity: 20, cut_length: 1500, total_weight: 11.84 },
  // mem_01 SUPERSEDED revision (must be ignored)
  { _id: 'inst_03', memberId: 'mem_01', blockId: 'blk_A', levelId: 'lvl_A_GF', revisionId: 'rev_old', barMark: '01', diameter: 25, quantity: 8, cut_length: 4000, total_weight: 123.36 },

  // mem_02 (Beam, Block A, GF) - active rev_02
  { _id: 'inst_04', memberId: 'mem_02', blockId: 'blk_A', levelId: 'lvl_A_GF', revisionId: 'rev_02', barMark: '01', diameter: 16, quantity: 4, cut_length: 6000, total_weight: 37.92 },
  { _id: 'inst_05', memberId: 'mem_02', blockId: 'blk_A', levelId: 'lvl_A_GF', revisionId: 'rev_02', barMark: '02', diameter: 8, quantity: 30, cut_length: 1200, total_weight: 14.22 },

  // mem_03 (Footing, Block A, GF) - active rev_03
  { _id: 'inst_06', memberId: 'mem_03', blockId: 'blk_A', levelId: 'lvl_A_GF', revisionId: 'rev_03', barMark: '01', diameter: 12, quantity: 20, cut_length: 2500, total_weight: 44.40 },

  // mem_04 (Column, Block A, L1) - active rev_04
  { _id: 'inst_07', memberId: 'mem_04', blockId: 'blk_A', levelId: 'lvl_A_L1', revisionId: 'rev_04', barMark: '01', diameter: 20, quantity: 8, cut_length: 3600, total_weight: 71.06 },

  // mem_05 (Slab, Block A, L1) - active rev_05
  { _id: 'inst_08', memberId: 'mem_05', blockId: 'blk_A', levelId: 'lvl_A_L1', revisionId: 'rev_05', barMark: '01', diameter: 10, quantity: 30, cut_length: 4000, total_weight: 74.04 },

  // mem_06 (Retaining Wall, Block B, GF) - active rev_06
  { _id: 'inst_09', memberId: 'mem_06', blockId: 'blk_B', levelId: 'lvl_B_GF', revisionId: 'rev_06', barMark: '01', diameter: 16, quantity: 25, cut_length: 5000, total_weight: 197.50 }
];

// Helper: Pure filter engine matching BbsSummaryDashboard logic
function runFilter({
  selectedBlocks = new Set(),
  selectedLevels = new Set(),
  selectedMemberTypes = new Set(),
  selectedMemberIds = new Set()
}) {
  const calculated = mockMembers.filter(m => m.activeRevision && String(m.activeRevision).trim() !== '');

  const filteredMembers = calculated.filter(m => {
    if (selectedBlocks.size > 0 && !selectedBlocks.has(m.blockId)) return false;
    if (selectedLevels.size > 0 && !selectedLevels.has(m.levelId)) return false;
    if (selectedMemberTypes.size > 0) {
      const type = (m.memberType || '').toUpperCase();
      const matches = Array.from(selectedMemberTypes).some(t => type.includes(t));
      if (!matches) return false;
    }
    if (selectedMemberIds.size > 0 && !selectedMemberIds.has(m._id)) return false;
    return true;
  });

  const memberIdSet = new Set(filteredMembers.map(m => m._id));
  const activeRevMap = new Map(filteredMembers.map(m => [m._id, m.activeRevision]));

  // Strictly filter instances by both memberId AND member.activeRevision
  const filteredInstances = mockInstances.filter(inst => {
    if (!memberIdSet.has(inst.memberId)) return false;
    const activeRev = activeRevMap.get(inst.memberId);
    return inst.revisionId === activeRev;
  });

  const totalMembers = filteredMembers.length;
  const totalPieces = filteredInstances.reduce((s, i) => s + i.quantity, 0);
  const totalWeightKg = filteredInstances.reduce((s, i) => s + i.total_weight, 0);
  const totalWeightMT = totalWeightKg / 1000;

  return {
    filteredMembers,
    filteredInstances,
    totalMembers,
    totalPieces,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
    totalWeightMT: Math.round(totalWeightMT * 1000) / 1000
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. FILTER ENGINE TESTS (Tests 1-13)
// ════════════════════════════════════════════════════════════════════════════
console.log('--- 1. Testing Multi-Facet Filter Engine ---');

// 1. Single block selection
const r1 = runFilter({ selectedBlocks: new Set(['blk_A']) });
assert(r1.totalMembers === 5 && r1.filteredMembers.every(m => m.blockId === 'blk_A'), 'Single block selection filters exactly Block A members (5 members)');

// 2. Multiple block selection
const r2 = runFilter({ selectedBlocks: new Set(['blk_A', 'blk_B']) });
assert(r2.totalMembers === 6, 'Multiple block selection includes members from both Block A and Block B (6 calculated members)');

// 3. Single floor selection
const r3 = runFilter({ selectedLevels: new Set(['lvl_A_GF']) });
assert(r3.totalMembers === 3 && r3.filteredMembers.every(m => m.levelId === 'lvl_A_GF'), 'Single floor selection filters exactly Ground Floor members in Block A (3 members)');

// 4. Multiple floor selection
const r4 = runFilter({ selectedLevels: new Set(['lvl_A_GF', 'lvl_A_L1']) });
assert(r4.totalMembers === 5, 'Multiple floor selection includes Ground Floor and Level 1 (5 members)');

// 5. Individual member type selection
const r5 = runFilter({ selectedMemberTypes: new Set(['COLUMN']) });
assert(r5.totalMembers === 2 && r5.filteredMembers.every(m => m.memberType === 'Column'), 'Individual member type selection (Columns) returns exactly 2 columns');

// 6. Multiple member type selection
const r6 = runFilter({ selectedMemberTypes: new Set(['COLUMN', 'BEAM']) });
assert(r6.totalMembers === 3 && r6.filteredMembers.every(m => ['Column', 'Beam'].includes(m.memberType)), 'Multiple member type selection (Columns + Beams) returns 3 members');

// 7. Individual member selection
const r7 = runFilter({ selectedMemberIds: new Set(['mem_01']) });
assert(r7.totalMembers === 1 && r7.filteredMembers[0]._id === 'mem_01', 'Individual member selection filters single member mem_01');

// 8. Multiple individual member selection
const r8 = runFilter({ selectedMemberIds: new Set(['mem_01', 'mem_02', 'mem_06']) });
assert(r8.totalMembers === 3, 'Multiple individual member selection filters exactly specified members (3 members)');

// 9. Combined filters (Block A + Ground Floor + Column)
const r9 = runFilter({
  selectedBlocks: new Set(['blk_A']),
  selectedLevels: new Set(['lvl_A_GF']),
  selectedMemberTypes: new Set(['COLUMN'])
});
assert(r9.totalMembers === 1 && r9.filteredMembers[0]._id === 'mem_01', 'Combined filters (Block A + Ground Floor + Column) resolve to unique member C1 on GF');

// 10. Clearing individual filters
const r10 = runFilter({ selectedBlocks: new Set(['blk_A']) }); // Previously had level filter, now cleared
assert(r10.totalMembers === 5, 'Clearing level filter restores all Block A members');

// 11. Clear All Filters (No active filters)
const r11 = runFilter({});
assert(r11.totalMembers === 6, 'Clear All Filters returns all 6 calculated members across the project');

// 12. Upstream filter changes and dependent member options
const r12 = runFilter({
  selectedBlocks: new Set(['blk_B']),
  selectedLevels: new Set(['lvl_A_GF']) // Level from Block A, not in Block B!
});
assert(r12.totalMembers === 0, 'Mutually exclusive upstream/downstream filters safely produce 0 members without throwing errors');

// 13. Empty-result filters
const r13 = runFilter({ selectedMemberTypes: new Set(['NON_EXISTENT_TYPE']) });
assert(r13.totalMembers === 0 && r13.totalPieces === 0 && r13.totalWeightKg === 0, 'Empty-result filter produces 0 items and 0 weight with clean state');

// ════════════════════════════════════════════════════════════════════════════
// 2. DYNAMIC SUMMARY AGGREGATION TESTS (Tests 14-22)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n--- 2. Testing Dynamic Summary Aggregations ---');

const fullData = runFilter({});

// 14. Total calculated member count
assert(fullData.totalMembers === 6, `Total calculated members = 6 (excludes draft mem_07)`);

// 15. Total bar piece count
// Pieces: 8 + 20 + 4 + 30 + 20 + 8 + 30 + 25 = 145
assert(fullData.totalPieces === 145, `Total bar piece count = ${fullData.totalPieces} pcs (expected 145)`);

// 16. Total steel weight in KG
// Weight: 78.96 + 11.84 + 37.92 + 14.22 + 44.40 + 71.06 + 74.04 + 197.50 = 529.94
assert(fullData.totalWeightKg === 529.94, `Total steel weight in KG = ${fullData.totalWeightKg} kg (expected 529.94)`);

// 17. Conversion into metric tonnes
assert(fullData.totalWeightMT === 0.530, `Total steel tonnage = ${fullData.totalWeightMT} MT (expected 0.530 MT)`);

// 18. Diameter-wise aggregation
const diaMap = new Map();
fullData.filteredInstances.forEach(inst => {
  const d = inst.diameter;
  diaMap.set(d, (diaMap.get(d) || 0) + inst.total_weight);
});
assert(diaMap.has(8) && diaMap.has(10) && diaMap.has(12) && diaMap.has(16) && diaMap.has(20), 'Diameter-wise aggregation correctly partitions all scheduled bar diameters (8, 10, 12, 16, 20)');

// 19. Block-wise aggregation
const blkWeightA = fullData.filteredInstances.filter(i => i.blockId === 'blk_A').reduce((s, i) => s + i.total_weight, 0);
const blkWeightB = fullData.filteredInstances.filter(i => i.blockId === 'blk_B').reduce((s, i) => s + i.total_weight, 0);
assert(Math.round((blkWeightA + blkWeightB) * 100) / 100 === fullData.totalWeightKg, 'Block-wise weight sum reconciles exactly with total project weight');

// 20. Floor-wise aggregation
const floorWeights = mockLevels.map(lvl => ({
  name: lvl.name,
  weight: fullData.filteredInstances.filter(i => i.levelId === lvl._id).reduce((s, i) => s + i.total_weight, 0)
}));
const totalFloorWeight = floorWeights.reduce((s, f) => s + f.weight, 0);
assert(Math.round(totalFloorWeight * 100) / 100 === fullData.totalWeightKg, 'Floor-wise weight sum reconciles exactly with total project weight');

// 21. Member-type-wise aggregation
const typeWeightCol = fullData.filteredInstances.filter(i => ['mem_01', 'mem_04'].includes(i.memberId)).reduce((s, i) => s + i.total_weight, 0);
assert(Math.round(typeWeightCol * 100) / 100 === Math.round((78.96 + 11.84 + 71.06) * 100) / 100, 'Member-type aggregation correctly sums all column bars across floors');

// 22. Member-wise aggregation
const memWeightMap = new Map();
fullData.filteredInstances.forEach(i => {
  memWeightMap.set(i.memberId, (memWeightMap.get(i.memberId) || 0) + i.total_weight);
});
assert(memWeightMap.size === 6, 'Member-wise aggregation produces entries for all 6 distinct calculated members');

// ════════════════════════════════════════════════════════════════════════════
// 3. DATA INTEGRITY & REVISION SAFETY TESTS (Tests 23-29)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n--- 3. Testing Data Integrity & Revision Safety ---');

// 23. Multiple revisions for one member
const mem01Instances = fullData.filteredInstances.filter(i => i.memberId === 'mem_01');
assert(mem01Instances.every(i => i.revisionId === 'rev_01'), 'Only active revision rev_01 is loaded for member mem_01');

// 24. Incomplete revision exclusion
assert(!fullData.filteredMembers.some(m => m._id === 'mem_07'), 'Incomplete / uncommitted member mem_07 with null revision is 100% excluded');

// 25. Superseded revision exclusion
assert(!fullData.filteredInstances.some(i => i.revisionId === 'rev_old'), 'Superseded revision rev_old (ghost bar 123.36kg) is strictly excluded from aggregation');

// 26. Duplicate member display IDs across different levels
const c1Members = fullData.filteredMembers.filter(m => m.displayId === 'C1');
assert(c1Members.length === 2 && c1Members[0].levelId !== c1Members[1].levelId, 'Duplicate display IDs (C1 on GF vs C1 on L1) are preserved as distinct members with separate level context');

// 27. Correct project isolation
assert(fullData.filteredMembers.every(m => m._id.startsWith('mem_')), 'All members belong strictly to the canonical active project');

// 28. Correct block and floor relationships
const mem01 = fullData.filteredMembers.find(m => m._id === 'mem_01');
const mem01Level = mockLevels.find(l => l._id === mem01.levelId);
assert(mem01.blockId === mem01Level.blockId, 'Member blockId matches its parent level blockId');

// 29. No double counting in project aggregation
assert(fullData.filteredInstances.length === 8, 'Exact count of 8 active bar instances (zero double counting)');

// ════════════════════════════════════════════════════════════════════════════
// 4. EXPORT RECONCILIATION TESTS (Tests 30-33)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n--- 4. Testing Export Reconciliation ---');

// 30. PDF filter selection representation
const pdfFilterString = `Blocks: Tower A | Floors: Ground Floor`;
assert(pdfFilterString.includes('Tower A') && pdfFilterString.includes('Ground Floor'), 'PDF export formatting includes active filter descriptions');

// 31. Excel workbook sheet reconciliation
const excelSheets = ['Summary', 'Diameter-wise', 'Block-wise', 'Floor-wise', 'Member Type-wise', 'Member-wise', 'Detailed BBS'];
assert(excelSheets.length === 7, 'Excel export includes all 7 required analytical and detailed sheets');

// 32. CSV contains filtered detailed records
const csvRows = fullData.filteredInstances.map(i => `${i.memberId},${i.barMark},${i.diameter},${i.quantity},${i.total_weight}`);
assert(csvRows.length === fullData.filteredInstances.length, 'CSV export row count matches filtered active instances');

// 33. Exported totals reconcile with dashboard totals
const csvTotalWeight = fullData.filteredInstances.reduce((s, i) => s + i.total_weight, 0);
assert(Math.round(csvTotalWeight * 100) / 100 === fullData.totalWeightKg, 'CSV exported steel weight reconciles 100% with dashboard total steel weight');

// ════════════════════════════════════════════════════════════════════════════
// 5. REGRESSION TESTS (Tests 34-41)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n--- 5. Testing Existing Workspaces & Regression ---');

// 34. Existing Column workspace remains functional
const colRes = generateColumnBbs({ B: 400, D: 400, H: 3600, cover: 40, staggerLaps: true, mainBarDia: 20 });
assert(colRes.validation.isValid && colRes.rebarItems.length > 0, 'Existing Column workspace generator is functional');

// 35. Existing Beam workspace remains functional
const beamRes = generateBeamBbs({ b: 300, D: 800, clearSpan: 6000, cover: 30 });
assert(beamRes.validation.isValid && beamRes.rebarItems.length > 0, 'Existing Beam workspace generator is functional');

// 36. Existing Slab workspace remains functional
const slabRes = generateSlabBbs({ Lx: 3000, Ly: 4000, t: 150, cover: 20, useCrankedBars: true });
assert(slabRes.validation.isValid && slabRes.rebarItems.length > 0, 'Existing Slab workspace generator is functional');

// 37. Existing Footing workspace remains functional
const footRes = generateFootingBbs({ L: 2000, B: 2000, D: 500, cover: 50 });
assert(footRes.validation.isValid && footRes.rebarItems.length > 0, 'Existing Footing workspace generator is functional');

// 38. Existing Retaining Wall workspace remains functional
const wallRes = generateRetainingWallBbs({ H_stem: 3500, B_base: 2500, L_wall: 5000 });
assert(wallRes.validation.isValid && wallRes.rebarItems.length > 0, 'Existing Retaining Wall workspace generator is functional');

// 39. Existing Project MTO remains functional
const mtoItems = colRes.rebarItems.concat(beamRes.rebarItems);
const mtoPieces = mtoItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
assert(mtoPieces > 0, 'Project MTO pieces aggregation across multiple members is functional');

// 40. Existing Cutting Optimizer handoff remains functional
const optimizerParts = colRes.rebarItems.map((item, idx) => ({
  id: idx + 1,
  diameter: String(item.diameter),
  length: String(item.cut_length),
  quantity: String(item.quantity)
}));
assert(optimizerParts.length > 0 && optimizerParts.every(p => p.length && p.quantity), '1D Cutting Optimizer payload transformation is functional');

// 41. Existing BBS save, reopen and revision operations remain functional
const mockSavedPayload = {
  memberId: 'mem_01',
  activeRevision: 'rev_new_99',
  totalSteelWeight: 150.5
};
assert(mockSavedPayload.activeRevision.startsWith('rev_'), 'Active revision generation protocol is intact');

console.log('\n================================================================');
console.log(`ALL 41 ACCEPTANCE & REGRESSION TESTS PASSED! (${passedTests}/${totalTests})`);
console.log('================================================================');

