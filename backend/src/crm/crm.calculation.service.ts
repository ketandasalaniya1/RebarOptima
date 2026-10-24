import { ICrmBooking, ICrmPaymentSchedule, ICrmPaymentTransaction } from './crm.types';

export interface IBookingFinancialSummary {
  agreementPrice: number;
  discountAmount: number;
  taxAmount: number;
  netBookingValue: number;
  totalReceived: number;
  totalOutstanding: number;
  overdueAmount: number;
  refundedAmount: number;
  collectionProgressPercent: number;
  scheduleMilestoneCount: number;
  paidMilestoneCount: number;
  isFullyPaid: boolean;
}

/**
 * Monetary rounding helper - eliminates JavaScript binary floating-point drift.
 * Keeps exact 2 decimal currency precision.
 */
export function roundCurrency(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/**
 * Calculates accurate financial metrics for a booking given its schedules and transactions.
 */
export function calculateBookingFinancials(
  booking: ICrmBooking,
  schedules: ICrmPaymentSchedule[] = [],
  transactions: ICrmPaymentTransaction[] = []
): IBookingFinancialSummary {
  const agreementPrice = roundCurrency(booking.agreementPrice);
  const discountAmount = roundCurrency(booking.discountAmount || 0);
  const taxAmount = roundCurrency(booking.taxAmount || 0);
  const netBookingValue = roundCurrency(
    booking.netBookingValue || (agreementPrice - discountAmount + taxAmount)
  );

  let totalReceived = 0;
  let refundedAmount = 0;

  for (const txn of transactions) {
    const amt = roundCurrency(txn.amount);
    if (txn.paymentStatus === 'Paid') {
      totalReceived += amt;
    } else if (txn.paymentStatus === 'Refunded') {
      refundedAmount += amt;
    }
  }

  totalReceived = roundCurrency(totalReceived);
  refundedAmount = roundCurrency(refundedAmount);

  const totalOutstanding = roundCurrency(Math.max(0, netBookingValue - totalReceived));

  const now = new Date();
  let overdueAmount = 0;
  let paidMilestoneCount = 0;

  for (const milestone of schedules) {
    const dueAmt = roundCurrency(milestone.dueAmount);
    const paidAmt = roundCurrency(milestone.paidAmount || 0);
    const remainingDue = roundCurrency(Math.max(0, dueAmt - paidAmt));

    if (milestone.status === 'Paid') {
      paidMilestoneCount++;
    } else if (remainingDue > 0) {
      const dueDate = new Date(milestone.dueDate);
      if (dueDate < now) {
        overdueAmount += remainingDue;
      }
    }
  }

  overdueAmount = roundCurrency(overdueAmount);

  const collectionProgressPercent = netBookingValue > 0
    ? roundCurrency(Math.min(100, (totalReceived / netBookingValue) * 100))
    : 0;

  return {
    agreementPrice,
    discountAmount,
    taxAmount,
    netBookingValue,
    totalReceived,
    totalOutstanding,
    overdueAmount,
    refundedAmount,
    collectionProgressPercent,
    scheduleMilestoneCount: schedules.length,
    paidMilestoneCount,
    isFullyPaid: totalOutstanding <= 0 && netBookingValue > 0
  };
}

/**
 * Generates standardized installment milestones from templates or percentages.
 */
export function generateInstallmentSchedule(
  netBookingValue: number,
  bookingDate: Date | string,
  milestoneTemplates?: { name: string; percentage: number }[]
): { milestoneName: string; milestonePercentage: number; dueAmount: number; dueDate: string }[] {
  const defaultTemplates = milestoneTemplates && milestoneTemplates.length > 0 ? milestoneTemplates : [
    { name: 'Booking Token Amount', percentage: 10 },
    { name: 'Agreement Signing (Within 30 Days)', percentage: 15 },
    { name: 'Plinth / Foundation Level', percentage: 15 },
    { name: 'Floor Slab Casting Level', percentage: 25 },
    { name: 'Finishing & Plaster Milestone', percentage: 20 },
    { name: 'Notice of Possession & Handover', percentage: 15 }
  ];

  const startDate = new Date(bookingDate || new Date());
  const schedule: { milestoneName: string; milestonePercentage: number; dueAmount: number; dueDate: string }[] = [];

  let accumulatedPercent = 0;
  let accumulatedAmount = 0;

  defaultTemplates.forEach((template, index) => {
    const isLast = index === defaultTemplates.length - 1;
    const pct = template.percentage;
    accumulatedPercent += pct;

    // Last milestone absorbs any rounding cents to guarantee sum(milestones) === netBookingValue
    const dueAmount = isLast
      ? roundCurrency(netBookingValue - accumulatedAmount)
      : roundCurrency((netBookingValue * pct) / 100);

    accumulatedAmount = roundCurrency(accumulatedAmount + dueAmount);

    // Stagger due dates 45 days apart
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (index === 0 ? 0 : index * 45));

    schedule.push({
      milestoneName: template.name,
      milestonePercentage: pct,
      dueAmount,
      dueDate: dueDate.toISOString().split('T')[0]
    });
  });

  return schedule;
}
