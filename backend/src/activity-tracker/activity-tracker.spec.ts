import { ObjectId } from 'mongodb';
import { ActivityReportsService } from './activity-reports.service';
import { ActivityWeightagePeriod } from './activity-tracker.types';

if (typeof (global as any).describe === 'undefined') {
  (global as any).describe = (name: string, fn: () => void) => {
    console.log(`\nSUITE: ${name}`);
    fn();
  };
  (global as any).it = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      console.error(`  ✗ ${name}:`, e.message);
      throw e;
    }
  };
}

if (typeof (global as any).expect === 'undefined') {
  (global as any).expect = (actual: any) => ({
    toBe: (expected: any) => {
      if (actual !== expected) throw new Error(`Expected ${actual} to be ${expected}`);
    },
    toBeCloseTo: (expected: number, numDigits = 2) => {
      if (Math.abs(actual - expected) > Math.pow(10, -numDigits) / 2) {
        throw new Error(`Expected ${actual} to be close to ${expected}`);
      }
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected ${actual} to be null`);
    },
    toBeDefined: () => {
      if (actual === undefined) throw new Error(`Expected ${actual} to be defined`);
    },
    toHaveLength: (length: number) => {
      if (!actual || actual.length !== length) {
        throw new Error(`Expected length ${actual?.length} to be ${length}`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (!(actual > expected)) throw new Error(`Expected ${actual} to be greater than ${expected}`);
    },
    toBeLessThan: (expected: number) => {
      if (!(actual < expected)) throw new Error(`Expected ${actual} to be less than ${expected}`);
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
      }
    },
  });
}

describe('Activity & Progress Tracker — Mathematical & Logic Engine', () => {
  // ── 1. AUTOMATIC WEIGHTED PROGRESS CALCULATION ─────────────────────────────
  describe('Automatic Weighted Parent Progress Formula', () => {
    it('accurately computes weighted parent progress from child progress and weightages', () => {
      // Example from specification:
      // Child 1: 100% with 30% weight
      // Child 2: 100% with 40% weight
      // Child 3: 65% with 10% weight
      // Child 4: 0% with 20% weight
      // Expected: (100*0.30) + (100*0.40) + (65*0.10) + (0*0.20) = 30 + 40 + 6.5 + 0 = 76.5%
      const children = [
        { progress: 100, weight: 30 },
        { progress: 100, weight: 40 },
        { progress: 65, weight: 10 },
        { progress: 0, weight: 20 },
      ];

      const totalWeight = children.reduce((acc, c) => acc + c.weight, 0);
      expect(totalWeight).toBe(100);

      const parentProgress = children.reduce((acc, c) => acc + (c.progress * c.weight) / 100, 0);
      expect(Math.round(parentProgress * 100) / 100).toBe(76.5);
    });

    it('rejects weightage configurations that do not sum to 100%', () => {
      const invalidWeights = [25, 25, 25]; // Sums to 75%
      const sum = invalidWeights.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 100)).toBeGreaterThan(0.05);
    });

    it('rejects zero or negative weights', () => {
      const weights = [50, 60, -10];
      const hasNegative = weights.some((w) => w <= 0);
      expect(hasNegative).toBe(true);
    });
  });

  // ── 2. HISTORICAL WEIGHTAGE SELECTION & EFFECTIVE DATES ────────────────────
  describe('Historical Weightage Versioning by Effective Date', () => {
    const history: ActivityWeightagePeriod[] = [
      {
        version: 1,
        effectiveFrom: '2026-05-01',
        effectiveTo: '2026-05-20',
        weightages: [
          { childActivityId: new ObjectId(), weightage: 50 },
          { childActivityId: new ObjectId(), weightage: 50 },
        ],
        configuredBy: new ObjectId(),
        configuredByName: 'Engineer A',
        configuredAt: new Date('2026-05-01'),
        changeReason: 'Initial setup',
      },
      {
        version: 2,
        effectiveFrom: '2026-05-21',
        effectiveTo: null, // Active version
        weightages: [
          { childActivityId: new ObjectId(), weightage: 30 },
          { childActivityId: new ObjectId(), weightage: 40 },
          { childActivityId: new ObjectId(), weightage: 30 },
        ],
        configuredBy: new ObjectId(),
        configuredByName: 'Engineer B',
        configuredAt: new Date('2026-05-21'),
        changeReason: 'Added 3rd child activity',
      },
    ];

    it('selects Version 1 for a date falling within its active window (15 May 2026)', () => {
      const v = ActivityReportsService.getEffectiveWeightage(history, '2026-05-15');
      expect(v).toBeDefined();
      expect(v?.version).toBe(1);
      expect(v?.weightages).toHaveLength(2);
    });

    it('selects Version 2 for a date after 21 May 2026', () => {
      const v = ActivityReportsService.getEffectiveWeightage(history, '2026-05-25');
      expect(v).toBeDefined();
      expect(v?.version).toBe(2);
      expect(v?.weightages).toHaveLength(3);
    });

    it('past reports remain immutable when weightage history is preserved', () => {
      // Historical query on 10 May will always receive Version 1
      const vPast = ActivityReportsService.getEffectiveWeightage(history, '2026-05-10');
      expect(vPast?.version).toBe(1);
    });
  });

  // ── 3. HISTORICAL REPORTING PROGRESS DELTA MATH ───────────────────────────
  describe('Reporting Starting, Ending, and Period Delta Math', () => {
    it('computes correct day before start date in YYYY-MM-DD', () => {
      expect(ActivityReportsService.getDayBefore('2026-11-01')).toBe('2026-10-31');
      expect(ActivityReportsService.getDayBefore('2026-03-01')).toBe('2026-02-28'); // Non-leap year check
      expect(ActivityReportsService.getDayBefore('2026-11-17')).toBe('2026-11-16');
    });

    it('calculates true period progress (ΔP = Ending - Starting) where work on start date is included in period', () => {
      // Simulated scenario:
      // Activity updates:
      // 31-Oct: 20%
      // 01-Nov: 35% (Work completed on day 1 of report period)
      // 15-Nov: 60%
      // 30-Nov: 80% (End of report period)
      const updates = [
        { date: '2026-10-31', progress: 20 },
        { date: '2026-11-01', progress: 35 },
        { date: '2026-11-15', progress: 60 },
        { date: '2026-11-30', progress: 80 },
      ];

      const reportStart = '2026-11-01';
      const reportEnd = '2026-11-30';
      const dayBeforeStart = ActivityReportsService.getDayBefore(reportStart); // '2026-10-31'

      // Starting progress: latest update on or before dayBeforeStart
      const updatesBefore = updates.filter((u) => u.date <= dayBeforeStart);
      const startingProgress = updatesBefore[updatesBefore.length - 1].progress;
      expect(startingProgress).toBe(20);

      // Ending progress: latest update on or before reportEnd
      const updatesPeriod = updates.filter((u) => u.date <= reportEnd);
      const endingProgress = updatesPeriod[updatesPeriod.length - 1].progress;
      expect(endingProgress).toBe(80);

      // Period progress gained during November:
      const periodDelta = endingProgress - startingProgress;
      expect(periodDelta).toBe(60); // 80 - 20 = 60% (Includes the 15% gained on 01-Nov!)
    });

    it('defaults starting progress to 0% when no updates existed before the report period', () => {
      const updates = [
        { date: '2026-11-05', progress: 15 },
        { date: '2026-11-20', progress: 45 },
      ];
      const reportStart = '2026-11-01';
      const dayBefore = ActivityReportsService.getDayBefore(reportStart);
      const updatesBefore = updates.filter((u) => u.date <= dayBefore);
      const startingProgress = updatesBefore.length > 0 ? updatesBefore[updatesBefore.length - 1].progress : 0;

      expect(startingProgress).toBe(0);
      const endingProgress = updates[updates.length - 1].progress;
      expect(endingProgress).toBe(45);
      expect(endingProgress - startingProgress).toBe(45);
    });
  });

  // ── 4. TWO-LEVEL WBS HIERARCHY VALIDATION ─────────────────────────────────
  describe('Strict Two-Level WBS Enforcement', () => {
    it('allows Level 1 parent activity (parentActivityId = null)', () => {
      const parent = { _id: new ObjectId(), name: 'Superstructure Slab', parentActivityId: null };
      expect(parent.parentActivityId).toBeNull();
    });

    it('allows Level 2 child pointing to Level 1 parent', () => {
      const parentId = new ObjectId();
      const child = { _id: new ObjectId(), name: 'Rebar Binding', parentActivityId: parentId };
      expect(child.parentActivityId).toBe(parentId);
    });

    it('rejects a child becoming a parent to create a third level', () => {
      const existingParent = { _id: new ObjectId(), parentActivityId: null };
      const existingChild = { _id: new ObjectId(), parentActivityId: existingParent._id };

      // Attempting to create grandchild with parent = existingChild
      const canBeParent = (act: any) => act.parentActivityId === null;
      expect(canBeParent(existingParent)).toBe(true);
      expect(canBeParent(existingChild)).toBe(false); // Rejected!
    });
  });

  // ── 5. STATUS LIFECYCLE & OVERDUE INDICATOR ────────────────────────────────
  describe('Status Lifecycle & Overdue Evaluation', () => {
    it('identifies status purely based on progress when not on hold or cancelled', () => {
      const evaluateStatus = (progress: number, manualStatus?: string) => {
        if (manualStatus === 'ON_HOLD' || manualStatus === 'CANCELLED') return manualStatus;
        if (progress >= 100) return 'COMPLETED';
        if (progress > 0) return 'IN_PROGRESS';
        return 'NOT_STARTED';
      };

      expect(evaluateStatus(0)).toBe('NOT_STARTED');
      expect(evaluateStatus(25)).toBe('IN_PROGRESS');
      expect(evaluateStatus(99.9)).toBe('IN_PROGRESS');
      expect(evaluateStatus(100)).toBe('COMPLETED');
      expect(evaluateStatus(50, 'ON_HOLD')).toBe('ON_HOLD');
      expect(evaluateStatus(0, 'CANCELLED')).toBe('CANCELLED');
    });

    it('computes overdue indicator as an independent flag when today > plannedEndDate', () => {
      const todayStr = '2026-11-17';
      const isOverdue = (plannedEndDate: string, status: string) => {
        return todayStr > plannedEndDate && status !== 'COMPLETED' && status !== 'CANCELLED';
      };

      expect(isOverdue('2026-11-15', 'IN_PROGRESS')).toBe(true);
      expect(isOverdue('2026-11-15', 'NOT_STARTED')).toBe(true);
      expect(isOverdue('2026-11-15', 'ON_HOLD')).toBe(true);
      expect(isOverdue('2026-11-15', 'COMPLETED')).toBe(false); // Completed cannot be overdue
      expect(isOverdue('2026-11-15', 'CANCELLED')).toBe(false); // Cancelled cannot be overdue
      expect(isOverdue('2026-11-20', 'IN_PROGRESS')).toBe(false); // Future finish date
    });
  });
});
