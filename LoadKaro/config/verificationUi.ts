/** Copy + field definitions for verification upload (trucks vs user KYC). */

export const VERIFICATION_UI = {
  verifyButton: 'Verify',
  uploadFile: 'Upload File',
  submit: 'Submit for Verification',
  successTitle: 'Submitted',
  successMessage: 'Documents submitted. Verification pending.',
} as const;

/* ─── Truck verification ─── */

export const TRUCK_VERIFICATION_COPY = {
  modalTitle: 'Truck verification',
  modalSubtitle:
    'Upload the following documents to get this truck verified.',
} as const;

export const TRUCK_VERIFICATION_FIELDS = [
  {
    key: 'registration_certificate',
    label: 'Registration Certificate (RC)',
  },
  { key: 'insurance', label: 'Insurance Policy' },
  { key: 'driver_license', label: "Current Driver's License" },
  { key: 'fitness_certificate', label: 'Fitness Certificate' },
] as const;

/* ─── User KYC — Individual shipper / truck owner / broker ─── */

export const USER_KYC_INDIVIDUAL_COPY = {
  modalTitle: 'Identity verification (Individual)',
  modalSubtitle:
    'Upload any of the following government-issued identity documents.',
} as const;

export const USER_KYC_INDIVIDUAL_FIELDS = [
  { key: 'aadhar', label: 'Aadhaar card' },
  { key: 'pan', label: 'PAN card' },
  { key: 'driving_license', label: 'Driving License' },
  { key: 'other_kyc', label: 'Other valid ID (Voter ID, Passport, etc.)' },
] as const;

/* ─── User KYC — Organization shipper ─── */

export const USER_KYC_ORG_COPY = {
  modalTitle: 'Organization verification',
  modalSubtitle:
    'Upload company documents to verify your organization.',
} as const;

export const USER_KYC_ORG_FIELDS = [
  { key: 'gst_certificate', label: 'GST Certificate' },
  { key: 'company_pan', label: 'Company PAN card' },
  { key: 'incorporation_certificate', label: 'Certificate of Incorporation / Registration' },
  { key: 'trade_license', label: 'Trade License / MSME / Udyam Certificate' },
] as const;

/** @deprecated — kept for backward compat; prefer the split variants above */
export const USER_KYC_COPY = USER_KYC_INDIVIDUAL_COPY;
/** @deprecated */
export const USER_KYC_FIELDS = USER_KYC_INDIVIDUAL_FIELDS;

export type VerificationVariant = 'truck' | 'user';
export type ShipperKycType = 'individual' | 'organization';
