const API_KEY = 'YOUR_OPENWEATHER_API_KEY';
let currentCity = '';
let currentCountry = '';
let currentLat = 0;
let currentLon = 0;
let weatherChart = null;
let isLocating = false;

const CITY_ALIASES = {
    'القاهره': 'Cairo',
    'القاهرة': 'Cairo',
    'الرياض': 'Riyadh',
    'دبي': 'Dubai',
    'بيروت': 'Beirut',
    'عمان': 'Amman',
    'بغداد': 'Baghdad',
    'دمشق': 'Damascus',
    'الدوحة': 'Doha',
    'الكويت': 'Kuwait City',
    'مسقط': 'Muscat',
    'الدار البيضاء': 'Casablanca',
    'الجزائر': 'Algiers',
    'تونس': 'Tunis',
    'طرابلس': 'Tripoli',
    'الخرطوم': 'Khartoum',
    'صنعاء': 'Sanaa',
    'القدس': 'Jerusalem',
    'إسطنبول': 'Istanbul',
    'اسطنبول': 'Istanbul',
    'تهران': 'Tehran',
    'مكة': 'Mecca',
    'المدينة': 'Medina',
    'جدة': 'Jeddah',
    'الإسكندرية': 'Alexandria',
    'الاسكندرية': 'Alexandria'
};

document.getElementById('searchBtn').addEventListener('click', searchWeather);
document.getElementById('cityInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchWeather();
});
document.getElementById('geoBtn').addEventListener('click', getLocationWeather);
document.getElementById('favoriteBtn').addEventListener('click', toggleFavorite);

function normalizeArabicText(text) {
    return text
        .trim()
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\u0640/g, '');
}

function resolveCityName(input) {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;

    if (CITY_ALIASES[trimmed]) {
        return CITY_ALIASES[trimmed];
    }

    const normalized = normalizeArabicText(trimmed);
    if (CITY_ALIASES[normalized]) {
        return CITY_ALIASES[normalized];
    }

    for (const [alias, englishName] of Object.entries(CITY_ALIASES)) {
        if (normalizeArabicText(alias) === normalized) {
            return englishName;
        }
    }

    return trimmed;
}

function searchWeather() {
    if (isLocating) {
        isLocating = false;
        resetGeoButton();
        showError('Location search cancelled. Searching for city instead.');
    }
    const city = document.getElementById('cityInput').value.trim();
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    showError('');
    showLoading('Searching for weather...');
    getCoordinates(city);
}

function getLocationWeather() {
    if (isLocating) return;
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
    }
    isLocating = true;
    const geoBtn = document.getElementById('geoBtn');
    geoBtn.disabled = true;
    geoBtn.textContent = '📍 Locating...';
    showError('');
    showLoading('Requesting location permission...');
    hideWeather();

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            currentLat = position.coords.latitude;
            currentLon = position.coords.longitude;
            showLoading('Fetching weather for your location...');
            try {
                await reverseGeocode(currentLat, currentLon);
                await fetchWeatherByCoords(currentLat, currentLon);
            } catch (error) {
                showError(error.message);
            } finally {
                resetGeoButton();
            }
        },
        (error) => {
            resetGeoButton();
            const messages = {
                1: 'Location permission denied. Please allow access or search manually.',
                2: 'Location unavailable. Please search manually.',
                3: 'Location request timed out. Please try again or search manually.'
            };
            showError(messages[error.code] || 'Unable to get location. Please search manually.');
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
}

function resetGeoButton() {
    const geoBtn = document.getElementById('geoBtn');
    geoBtn.disabled = false;
    geoBtn.textContent = '📍 My Location';
    isLocating = false;
}

async function reverseGeocode(lat, lon) {
    const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`
    );
    if (!response.ok) {
        currentCity = 'Current Location';
        currentCountry = '';
        return;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
        currentCity = data.results[0].name;
        currentCountry = data.results[0].country || '';
    } else {
        currentCity = 'Current Location';
        currentCountry = '';
    }
}

async function geocodeSearch(city) {
    const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    if (!response.ok) {
        throw new Error('Network error');
    }
    return response.json();
}

async function getCoordinates(city) {
    try {
        const resolvedCity = resolveCityName(city);
        let data = await geocodeSearch(resolvedCity);

        if ((!data.results || data.results.length === 0) && resolvedCity !== city) {
            data = await geocodeSearch(city);
        }

        if (!data.results || data.results.length === 0) {
            throw new Error('City not found');
        }

        const result = data.results[0];
        currentLat = result.latitude;
        currentLon = result.longitude;
        currentCity = result.name;
        currentCountry = result.country || '';
        await fetchWeatherByCoords(currentLat, currentLon);
    } catch (error) {
        showError(error.message);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,cloudcover,windspeed_10m&timezone=auto`),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=5`)
        ]);

        if (!currentRes.ok || !forecastRes.ok) {
            throw new Error('Weather data not available');
        }

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        displayCurrentWeather(currentData);
        displayForecast(forecastData);
        loadFavorites();

        hideLoading();
        document.getElementById('currentWeather').style.display = 'block';
        document.getElementById('forecastSection').style.display = 'block';
        document.getElementById('errorMessage').style.display = 'none';
    } catch (error) {
        showError(error.message);
    }
}

function displayCurrentWeather(data) {
    const weather = data.current_weather;
    const humidity = data.hourly.relative_humidity_2m[0] || 0;
    const clouds = data.hourly.cloudcover[0] || 0;

    document.getElementById('cityName').textContent = currentCity;
    document.getElementById('countryName').textContent = currentCountry;
    document.getElementById('temperature').textContent = `${Math.round(weather.temperature)}°C`;
    document.getElementById('conditionIcon').textContent = getWeatherIcon(weather.weathercode);
    document.getElementById('windSpeed').textContent = Math.round(weather.windspeed);
    document.getElementById('humidity').textContent = Math.round(humidity);
    document.getElementById('feelsLike').textContent = Math.round(weather.temperature);
    document.getElementById('clouds').textContent = Math.round(clouds);

    const favBtn = document.getElementById('favoriteBtn');
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favorites.some(f => f.name === currentCity && f.country === currentCountry)) {
        favBtn.textContent = '★ Remove from Favorites';
        favBtn.style.background = '#ff6b6b';
    } else {
        favBtn.textContent = '☆ Add to Favorites';
        favBtn.style.background = '#ffd700';
    }
}

function displayForecast(data) {
    const container = document.getElementById('forecastContainer');
    container.innerHTML = '';

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const labels = [];
    const temps = [];

    for (let i = 0; i < data.daily.time.length; i++) {
        const date = new Date(data.daily.time[i]);
        const dayName = days[date.getDay()];
        const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
        const minTemp = Math.round(data.daily.temperature_2m_min[i]);
        const code = data.daily.weathercode[i];

        labels.push(dayName);
        temps.push(maxTemp);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="day">${dayName}</div>
            <div class="condition">${getWeatherIcon(code)}</div>
            <div class="temp">${maxTemp}°C</div>
            <div class="temp-min">↓ ${minTemp}°C</div>
        `;
        container.appendChild(card);
    }

    updateChart(labels, temps);
}

function getWeatherIcon(code) {
    const icons = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌧️', 53: '🌧️', 55: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️',
        71: '❄️', 73: '❄️', 75: '❄️',
        80: '🌦️', 81: '🌦️', 82: '🌦️',
        95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return icons[code] || '🌤️';
}

function updateChart(labels, data) {
    const ctx = document.getElementById('tempChart').getContext('2d');

    if (weatherChart) {
        weatherChart.destroy();
    }

    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function toggleFavorite() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favorites.findIndex(f => f.name === currentCity && f.country === currentCountry);

    if (index > -1) {
        favorites.splice(index, 1);
        document.getElementById('favoriteBtn').textContent = '☆ Add to Favorites';
        document.getElementById('favoriteBtn').style.background = '#ffd700';
    } else {
        favorites.push({
            name: currentCity,
            country: currentCountry,
            lat: currentLat,
            lon: currentLon
        });
        document.getElementById('favoriteBtn').textContent = '★ Remove from Favorites';
        document.getElementById('favoriteBtn').style.background = '#ff6b6b';
    }

    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
}

function loadFavorites() {
    const container = document.getElementById('favoritesList');
    container.innerHTML = '';
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    favorites.forEach(fav => {
        const item = document.createElement('span');
        item.className = 'fav-item';
        item.innerHTML = `
            ${fav.name}, ${fav.country}
            <span class="remove" data-name="${fav.name}" data-country="${fav.country}">×</span>
        `;
        item.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove')) {
                removeFavorite(e.target.dataset.name, e.target.dataset.country);
            } else {
                loadFavoriteWeather(fav.name);
            }
        });
        container.appendChild(item);
    });
}

function removeFavorite(name, country) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favorites = favorites.filter(f => !(f.name === name && f.country === country));
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
}

function loadFavoriteWeather(city) {
    document.getElementById('cityInput').value = city;
    searchWeather();
}

function showLoading(message) {
    const loadingDiv = document.getElementById('loadingMessage');
    loadingDiv.textContent = message;
    loadingDiv.style.display = message ? 'block' : 'none';
    if (message) {
        document.getElementById('errorMessage').style.display = 'none';
    }
}

function hideLoading() {
    document.getElementById('loadingMessage').style.display = 'none';
}

function hideWeather() {
    document.getElementById('currentWeather').style.display = 'none';
    document.getElementById('forecastSection').style.display = 'none';
}

function showError(message) {
    hideLoading();
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = message ? 'block' : 'none';
    if (message) {
        hideWeather();
    }
}

loadFavorites();
