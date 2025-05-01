/**
 * Get the nearest city based on latitude and longitude coordinates
 * @param latitude - The latitude coordinate
 * @param longitude - The longitude coordinate
 * @returns Promise with city information or null if not found
 */
export const getNearestCity = async (latitude: number, longitude: number) => {
  try {
    // Use OpenStreetMap's Nominatim service (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
      {
        headers: {
          'Accept-Language': 'en', // Get results in English
          'User-Agent': 'ElektrickyMap/1.0', // Please replace with your app name (required by Nominatim ToS)
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

/**
 * Get the coordinates of a city using OpenCage Geocoding API
 * @param city - The name of the city
 * @param country - The name of the country (optional)
 * @param state - The name of the state (optional)
 * @returns Promise with latitude and longitude or null if not found
 */
export const getCityCoordinates = async (
  city: string,
  country?: string,
  state?: string
) => {
  let searchQuery = city
  if (state) searchQuery += `, ${state}`
  if (country) searchQuery += `, ${country}`
  const cityResponse = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
    {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'ElektrickyMap/1.0',
      },
    }
  )

  if (!cityResponse.ok) {
    throw new Error(`City search API error: ${cityResponse.status}`)
  }

  const cityData = await cityResponse.json()
  if (cityData.length === 0) {
    console.error('City not found:', searchQuery)
    return null
  }
  const { lat, lon } = cityData[0]
  return {
    scatteredLatitude: parseFloat(lat),
    scatteredLongitude: parseFloat(lon),
  }
}
