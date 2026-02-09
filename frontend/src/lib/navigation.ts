/**
 * Navigation helpers for cross-page workflows.
 */

/**
 * Build the canonical URL for the "Shop a Car" workflow.
 *
 * Every "Shop Now" / "Shop this Car" action across the app should use this
 * function so the shopping page receives a consistent URL shape.
 *
 * @param carNumber  The car to shop (required)
 * @param options.reason  Optional shopping reason code to pre-fill
 * @param options.boId    Optional bad-order report ID to link
 */
export function buildShopCarURL(
  carNumber: string,
  options?: { reason?: string; boId?: string },
): string {
  const params = new URLSearchParams({ shopCar: carNumber });
  if (options?.reason) params.set('reason', options.reason);
  if (options?.boId) params.set('boId', options.boId);
  return `/shopping?${params.toString()}`;
}
