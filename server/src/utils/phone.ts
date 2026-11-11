export const normalizePhoneNumber = (rawPhone: string): string => {
  const cleaned = rawPhone.trim().replace(/\s+/g, '');
  if (!cleaned) {
    return '';
  }

  const withCountryCode = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  const digits = withCountryCode.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 13 && digits.startsWith('919')) {
    return `+${digits}`;
  }

  return `+${digits}`;
};

export const isValidIndianPhoneNumber = (phone: string): boolean => {
  const digits = normalizePhoneNumber(phone).replace(/\D/g, '');

  if (process.env.NODE_ENV !== 'production') {
    return digits.length >= 10 && digits.length <= 12;
  }

  const normalized = normalizePhoneNumber(phone);
  return /^\+91[6-9]\d{9}$/.test(normalized);
};
