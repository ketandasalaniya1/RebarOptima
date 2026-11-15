export interface UnitMasterData {
  unitTypes: string[];
  unitConfigurations: string[];
  unitSpecifications: string[];
  areaMeasurementOptions: string[];
  facingOptions: string[];
  availabilityStatuses: string[];
}

export const DEFAULT_UNIT_MASTER_DATA: UnitMasterData = {
  unitTypes: [
    'Apartment',
    'Commercial Office',
    'Retail Shop',
    'Penthouse',
    'Villa',
    'Duplex',
    'Studio',
    'Plot / Land',
    'Warehouse',
    'Row House',
  ],
  unitConfigurations: [
    '1 BHK',
    '1.5 BHK',
    '2 BHK',
    '2.5 BHK',
    '3 BHK',
    '3.5 BHK',
    '4 BHK',
    '5 BHK',
    'Penthouse',
    'Studio',
    'Duplex',
    'Commercial Office',
    'Retail Shop',
    'Showroom',
    'Villa',
    'Plot',
  ],
  unitSpecifications: [
    'Modular Kitchen',
    'Vitrified Flooring',
    'Wooden Flooring',
    'Granite Countertops',
    'Premium Sanitaryware',
    'Video Door Phone',
    'Balcony Deck',
    'Covered Parking',
    'Piped Gas Connection',
    'Split AC Provision',
    'False Ceiling with LED',
    'Fire Sprinklers',
    'High-speed Fiber Internet',
    'Smart Home Automation',
    'Cross Ventilation',
  ],
  areaMeasurementOptions: ['sq.ft', 'sq.m', 'sq.yd'],
  facingOptions: [
    'East',
    'West',
    'North',
    'South',
    'North-East',
    'North-West',
    'South-East',
    'South-West',
    'East Garden View',
    'West Skyline View',
    'North-East Panoramic Sky Deck',
  ],
  availabilityStatuses: [
    'Available',
    'Held',
    'Reserved',
    'Booked',
    'Blocked',
    'Sold',
  ],
};

/**
 * Fetch master data for a company from crm_settings, falling back to defaults.
 */
export async function getCompanyUnitMasterData(
  db: any,
  companyId: string,
): Promise<UnitMasterData> {
  try {
    const settings = await db.collection('crm_settings').findOne({
      $or: [{ companyId }, { companyId: String(companyId) }],
    });
    if (!settings) return DEFAULT_UNIT_MASTER_DATA;

    return {
      unitTypes:
        Array.isArray(settings.unitTypes) && settings.unitTypes.length > 0
          ? settings.unitTypes
          : DEFAULT_UNIT_MASTER_DATA.unitTypes,
      unitConfigurations:
        Array.isArray(settings.unitConfigurations) && settings.unitConfigurations.length > 0
          ? settings.unitConfigurations
          : DEFAULT_UNIT_MASTER_DATA.unitConfigurations,
      unitSpecifications:
        Array.isArray(settings.unitSpecifications) && settings.unitSpecifications.length > 0
          ? settings.unitSpecifications
          : DEFAULT_UNIT_MASTER_DATA.unitSpecifications,
      areaMeasurementOptions:
        Array.isArray(settings.areaMeasurementOptions) &&
        settings.areaMeasurementOptions.length > 0
          ? settings.areaMeasurementOptions
          : DEFAULT_UNIT_MASTER_DATA.areaMeasurementOptions,
      facingOptions:
        Array.isArray(settings.facingOptions) && settings.facingOptions.length > 0
          ? settings.facingOptions
          : DEFAULT_UNIT_MASTER_DATA.facingOptions,
      availabilityStatuses:
        Array.isArray(settings.availabilityStatuses) && settings.availabilityStatuses.length > 0
          ? settings.availabilityStatuses
          : DEFAULT_UNIT_MASTER_DATA.availabilityStatuses,
    };
  } catch {
    return DEFAULT_UNIT_MASTER_DATA;
  }
}

