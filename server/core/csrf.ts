const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isCookieAuthenticatedRequest(input: { method: string; cookie?: string; authorization?: string }): boolean {
  return UNSAFE_METHODS.has(input.method.toUpperCase())
    && /(?:^|;)\s*raloa_session=/.test(input.cookie || '')
    && !/^Bearer\s+\S+$/i.test(input.authorization || '');
}

export function isSameOriginMutation(input: {
  method: string;
  cookie?: string;
  authorization?: string;
  origin?: string;
  referer?: string;
  appOrigin: string;
}): boolean {
  if (!isCookieAuthenticatedRequest(input)) return true;
  const candidates = [input.origin, input.referer].filter((value): value is string => Boolean(value));
  if (!candidates.length) return false;
  try {
    const expected = new URL(input.appOrigin).origin;
    return candidates.every((value) => new URL(value).origin === expected);
  } catch {
    return false;
  }
}
