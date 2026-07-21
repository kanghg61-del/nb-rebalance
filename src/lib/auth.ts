export const AUTH_COOKIE_NAME = 'reba_auth';
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 8;  // 8시간

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? 'NB';
  return input === expected;
}
