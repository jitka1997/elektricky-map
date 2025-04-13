/**
 * Get the nearest city based on latitude and longitude coordinates
 * @param latitude - The latitude coordinate
 * @param longitude - The longitude coordinate
 * @returns Promise with city information or null if not found
 */
export async function getNearestCity(latitude: number, longitude: number) {
  try {
    // Use OpenStreetMap's Nominatim service (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
      {
        headers: {
          'Accept-Language': 'en', // Get results in English
          'User-Agent': 'YourAppName/1.0', // Please replace with your app name (required by Nominatim ToS)
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }

    const data = await response.json()

    // Extract the relevant city information from the response
    const cityInfo = {
      name:
        data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.hamlet ||
        'Unknown',
      state: data.address.state || data.address.county || undefined,
      country: data.address.country || 'Unknown',
    }

    return cityInfo
  } catch (error) {
    console.error('Error getting nearest city:', error)
    return null
  }
}

// Example usage:
// const cityInfo = await getNearestCity(40.7128, -74.0060);
// console.log(cityInfo); // { name: "New York", state: "New York", country: "United States" }
