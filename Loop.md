## Loop 1 - Search for Arabic City "القاهرة"
- [x] Test: Search for Arabic city name "القاهرة"
- [x] Error: City not found (API only accepts English)
- [x] Fix: Added "القاهرة": "Cairo" to CITY_ALIASES
- [x] Verify: Search works and returns Cairo weather

## Loop 2 - Empty City Search Error
- [x] Test: Show error for empty city search
- [x] Error: No validation message when search is empty
- [x] Fix: Added check in searchWeather() and showError() for empty input
- [x] Verify: "Please enter a city name" appears when search is empty

## Loop 3 - Search Weather for a City
- [x] Test: Search weather for a city
- [x] Error: API response delayed or missing
- [x] Fix: Added loading state and improved error handling
- [x] Verify: Weather loads correctly for valid city

## Loop 4 - Unknown City Search Error
- [x] Test: Show error for unknown city search
- [x] Error: No clear error for non-existent city
- [x] Fix: Added geocodeSearch fallback and "City not found" message
- [x] Verify: Unknown city shows clear error

## Loop 5 - Location Weather Permission
- [x] Test: View current weather for my location
- [x] Error: Geolocation permission denied, UI stuck on "📍 Locating..."
- [x] Fix: Added isLocating flag and error handling for each error code
- [x] Verify: Location shows error without hanging

## Loop 6 - Switch from Location to Search
- [x] Test: Switch from location weather to searched city
- [x] Error: Search blocked while location pending
- [x] Fix: searchWeather cancels in-flight location request
- [x] Verify: Search works even if location was pending
