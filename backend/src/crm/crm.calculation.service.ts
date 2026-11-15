import { ICrmBooking, ICrmPaymentSchedule, ICrmPaymentTransaction } from './crm.types';

export interface IBookingFinancialSummary {
  agreementPrice: number;
  agreementPricePaise: number;
  discountAmount: number;
  discountAmountPaise: number;
  taxAmount: number;
  taxAmountPaise: number;
  netBookingValue: number;
  netBookingValuePaise: number;
  totalReceived: number;
  totalReceivedPaise: number;
  totalOutstanding: number;
  totalOutstandingPaise: number;
  overdueAmount: number;
  overdueAmountPaise: number;
  refundedAmount: number;
  refundedAmountPaise: number;
  collectionProgressPercent: number;
  scheduleMilestoneCount: number;
  paidMilestoneCount: number;
  isFullyPaid: boolean;
}

/**
 * Converts float rupees to integer paise safely (eliminates floating point precision issues).
 */
export function rupeesToPaise(rupees: number | string | undefined | null): number {
  if (rupees === undefined || rupees === null || isNaN(Number(rupees))) return 0;
  return Math.round(Number(rupees) * 100);
}

/**
 * Converts integer paise to 2-decimal rounded float rupees.
 */
export function paiseToRupees(paise: number | undefined | null): number {
  if (paise === undefined || paise === null || isNaN(Number(paise))) return 0;
  return Math.round(Number(paise)) / 100;
}

/**
 * Legacy monetary rounding helper - keeps 2 decimal currency precision.
 */
export function roundCurrency(amount: number): number {
  return paiseToRupees(rupeesToPaise(amount));
}

/**
 * Calculates accurate financial metrics for a booking using integer paise math.
 * Keeps float rupee fields fully readable for backwards compatibility.
 */
export function calculateBookingFinancials(
  booking: ICrmBooking,
  schedules: ICrmPaymentSchedule[] = [],
  transactions: ICrmPaymentTransaction[] = []
): IBookingFinancialSummary {
  const agreementPricePaise = booking.agreementPricePaise !== undefined
    ? Math.round(Number(booking.agreementPricePaise))
    : rupeesToPaise(booking.agreementPrice);

  const discountAmountPaise = booking.discountAmountPaise !== undefined
    ? Math.round(Number(booking.discountAmountPaise))
    : rupeesToPaise(booking.discountAmount || 0);

  const taxAmountPaise = booking.taxAmountPaise !== undefined
    ? Math.round(Number(booking.taxAmountPaise))
    : rupeesToPaise(booking.taxAmount || 0);

  const netBookingValuePaise = booking.netBookingValuePaise !== undefined
    ? Math.round(Number(booking.netBookingValuePaise))
    : (agreementPricePaise - discountAmountPaise + taxAmountPaise);

  let totalReceivedPaise = 0;
  let refundedAmountPaise = 0;

  for (const txn of transactions) {
    const amtPaise = txn.amountPaise !== undefined
      ? Math.round(Number(txn.amountPaise))
      : rupeesToPaise(txn.amount);

    if (txn.paymentStatus === 'Paid') {
      totalReceivedPaise += amtPaise;
    } else if (txn.paymentStatus === 'Refunded') {
      refundedAmountPaise += amtPaise;
    }
  }

  const totalOutstandingPaise = Math.max(0, netBookingValuePaise - totalReceivedPaise);

  const now = new Date();
  let overdueAmountPaise = 0;
  let paidMilestoneCount = 0;

  for (const milestone of schedules) {
    const dueAmtPaise = milestone.dueAmountPaise !== undefined
      ? Math.round(Number(milestone.dueAmountPaise))
      : rupeesToPaise(milestone.dueAmount);

    const paidAmtPaise = milestone.paidAmountPaise !== undefined
      ? Math.round(Number(milestone.paidAmountPaise))
      : rupeesToPaise(milestone.paidAmount || 0);

    const remainingDuePaise = Math.max(0, dueAmtPaise - paidAmtPaise);

    if (milestone.status === 'Paid' || (dueAmtPaise > 0 && remainingDuePaise === 0)) {
      paidMilestoneCount++;
    } else if (remainingDuePaise > 0) {
      const dueDate = new Date(milestone.dueDate);
      if (dueDate < now) {
        overdueAmountPaise += remainingDuePaise;
      }
    }
  }

  const collectionProgressPercent = netBookingValuePaise > 0
    ? Math.min(100, Math.round(((totalReceivedPaise / netBookingValuePaise) * 100) * 100) / 100)
    : 0;

  return {
    agreementPrice: paiseToRupees(agreementPricePaise),
    agreementPricePaise,
    discountAmount: paiseToRupees(discountAmountPaise),
    discountAmountPaise,
    taxAmount: paiseToRupees(taxAmountPaise),
    taxAmountPaise,
    netBookingValue: paiseToRupees(netBookingValuePaise),
    netBookingValuePaise,
    totalReceived: paiseToRupees(totalReceivedPaise),
    totalReceivedPaise,
    totalOutstanding: paiseToRupees(totalOutstandingPaise),
    totalOutstandingPaise,
    overdueAmount: paiseToRupees(overdueAmountPaise),
    overdueAmountPaise,
    refundedAmount: paiseToRupees(refundedAmountPaise),
    refundedAmountPaise,
    collectionProgressPercent,
    scheduleMilestoneCount: schedules.length,
    paidMilestoneCount,
    isFullyPaid: totalOutstandingPaise <= 0 && netBookingValuePaise > 0
  };
}

/**
 * Generates standardized installment milestones using integer paise precision.
 * Guarantees sum(milestones.dueAmountPaise) === netBookingValuePaise.
 */
export function generateInstallmentSchedule(
  netBookingValue: number,
  bookingDate: Date | string,
  milestoneTemplates?: { name: string; percentage: number }[]
): { milestoneName: string; milestonePercentage: number; dueAmount: number; dueAmountPaise: number; dueDate: string }[] {
  const defaultTemplates = milestoneTemplates && milestoneTemplates.length > 0 ? milestoneTemplates : [
    { name: 'Booking Token Amount', percentage: 10 },
    { name: 'Agreement Signing (Within 30 Days)', percentage: 15 },
    { name: 'Plinth / Foundation Level', percentage: 15 },
    { name: 'Floor Slab Casting Level', percentage: 25 },
    { name: 'Finishing & Plaster Milestone', percentage: 20 },
    { name: 'Notice of Possession & Handover', percentage: 15 }
  ];

  const netBookingValuePaise = rupeesToPaise(netBookingValue);
  const startDate = new Date(bookingDate || new Date());
  const schedule: { milestoneName: string; milestonePercentage: number; dueAmount: number; dueAmountPaise: number; dueDate: string }[] = [];

  let accumulatedPercent = 0;
  let accumulatedPaise = 0;

  defaultTemplates.forEach((template, index) => {
    const isLast = index === defaultTemplates.length - 1;
    const pct = template.percentage;
    accumulatedPercent += pct;

    // Last milestone absorbs any rounding difference to guarantee exact parity
    const dueAmountPaise = isLast
      ? (netBookingValuePaise - accumulatedPaise)
      : Math.round((netBookingValuePaise * pct) / 100);

    accumulatedPaise += dueAmountPaise;

    // Stagger due dates 45 days apart
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (index === 0 ? 0 : index * 45));

    schedule.push({
      milestoneName: template.name,
      milestonePercentage: pct,
      dueAmount: paiseToRupees(dueAmountPaise),
      dueAmountPaise,
      dueDate: dueDate.toISOString().split('T')[0]
    });
  });

  return schedule;
}
