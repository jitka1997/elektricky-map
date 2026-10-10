/**
 * The name to show for a user: a name they chose on their profile, shown in
 * full; otherwise the first word of their Google name.
 */
export const shortName = (
  userName: string | null,
  customName?: string | null
): string =>
  customName?.trim() || (userName ? userName.trim().split(' ')[0] : '')
