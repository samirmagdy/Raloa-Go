export type ValidationResult<T> = { valid: true; value: T } | { valid: false; errors: Record<string, string> };

export function requiredString(value: unknown, field: string, maxLength = 200): ValidationResult<string> {
  if (typeof value !== 'string' || !value.trim()) return { valid: false, errors: { [field]: `${field} is required` } };
  if (value.trim().length > maxLength) return { valid: false, errors: { [field]: `${field} is too long` } };
  return { valid: true, value: value.trim() };
}

export function oneOf<T extends string>(value: unknown, field: string, values: readonly T[]): ValidationResult<T> {
  if (typeof value !== 'string' || !values.includes(value as T)) return { valid: false, errors: { [field]: `${field} is invalid` } };
  return { valid: true, value: value as T };
}
