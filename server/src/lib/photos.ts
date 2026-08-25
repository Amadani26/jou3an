/**
 * Maps stored Places photo resource names onto proxy paths.
 *
 * Clients never see a Google URL or the API key — they get
 * "/api/photos/places/{placeId}/photos/{photoId}" and the server attaches the
 * key when streaming the image.
 */

export const photoProxyPath = (ref: string) => `/api/photos/${ref}`

/** Adds `photoUrls` (relative proxy paths) alongside the raw `photoRefs`. */
export function withPhotoUrls<T extends { photoRefs?: string[] | null }>(
  restaurant: T,
): T & { photoUrls: string[] } {
  return {
    ...restaurant,
    photoUrls: (restaurant.photoRefs ?? []).map(photoProxyPath),
  }
}

export const withPhotoUrlsAll = <T extends { photoRefs?: string[] | null }>(
  restaurants: T[],
) => restaurants.map(withPhotoUrls)
