const OPENWEATHER_API_KEY = 'b1b15e88fa797225412429c1c50c122a1';

let currentUnits = {
    temperature: "celsius",
    windSpeed: "kmh",
    pressure: "mmHg"
};

let currentBackgroundState = "sunny";
let currentCityData = null;
let isMobile = false;


let audioEnabled = false;
let currentAudio = null;

// Аудио-объекты для MP3-файлов
const rainAudio = new Audio('звукдождя.mp3');
rainAudio.loop = true;
rainAudio.volume = 0.5;

const snowAudio = new Audio('звукснега.mp3');
snowAudio.loop = true;
snowAudio.volume = 0.5;

function loadAudioSetting() {
    const saved = localStorage.getItem('weatherAudioEnabled');
    if (saved !== null) {
        audioEnabled = saved === 'true';
    } else {
        audioEnabled = false;
    }
    updateSoundButtonUI();
}
loadAudioSetting();

function updateSoundButtonUI() {
    const btn = document.getElementById('sound-toggle-btn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (audioEnabled) {
        icon.className = 'fas fa-volume-up';
        btn.classList.remove('muted');
    } else {
        icon.className = 'fas fa-volume-mute';
        btn.classList.add('muted');
    }
}

// Остановить текущий звук
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}

// Солнечно — тишина
function playSunnySound() {
    stopCurrentAudio();
}

// Дождь — воспроизведение MP3 в петле
function playRainySound() {
    if (!audioEnabled) return;
    stopCurrentAudio();
    currentAudio = rainAudio;
    rainAudio.currentTime = 0;
    rainAudio.play().catch(e => console.warn('Не удалось воспроизвести звук дождя:', e));
}

// Снег — воспроизведение MP3 в петле
function playSnowySound() {
    if (!audioEnabled) return;
    stopCurrentAudio();
    currentAudio = snowAudio;
    snowAudio.currentTime = 0;
    snowAudio.play().catch(e => console.warn('Не удалось воспроизвести звук снега:', e));
}

// Воспроизведение звука в зависимости от типа погоды
function playWeatherSound(state) {
    if (!audioEnabled) {
        stopCurrentAudio();
        return;
    }
    switch(state) {
        case 'sunny':
            playSunnySound();
            break;
        case 'rainy':
            playRainySound();
            break;
        case 'snowy':
            playSnowySound();
            break;
        default:
            stopCurrentAudio();
            break;
    }
}

// Переключение звука (вызывается по кнопке)
function toggleSound() {
    if (audioEnabled) {
        audioEnabled = false;
        stopCurrentAudio();
    } else {
        audioEnabled = true;
        // Запускаем звук для текущего состояния погоды
        playWeatherSound(currentBackgroundState);
    }
    localStorage.setItem('weatherAudioEnabled', audioEnabled);
    updateSoundButtonUI();
}

// ---------- Остальной код (без изменений, кроме добавления вызова звука при смене фона) ----------
document.addEventListener('DOMContentLoaded', function() {
    isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    setupWeatherStateButtons();
    setupSettings();
    setupSearch();
    setupLocationButton();
    setCurrentDate();
    setUpdateTime();
    restoreSavedSettings();
    getWeatherByGeolocation();
    initDemoPrecipitationMap();
    
    // Кнопка звука
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
        soundBtn.addEventListener('click', toggleSound);
    }
});

function initDemoPrecipitationMap() {
    const mapContainer = document.getElementById('precipitation-map');
    if (mapContainer && mapContainer.children.length <= 1) {
        const demoData = getDemoPrecipitationData();
        updatePrecipitationMap(demoData);
    }
}

function setupWeatherStateButtons() {
    const stateButtons = document.querySelectorAll('.state-btn');
    
    stateButtons.forEach(button => {
        button.addEventListener('click', function() {
            stateButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            const newState = this.getAttribute('data-state');
            currentBackgroundState = newState;
            updateBackground(newState);
            // Воспроизвести звук при переключении фона (если звук включён)
            playWeatherSound(newState);
        });
    });
}

function updateBackground(state) {
    document.body.className = state;
}

function setupSettings() {
    const applyBtn = document.getElementById('apply-settings');
    applyBtn.addEventListener('click', function() {
        currentUnits.temperature = document.getElementById('temp-unit').value;
        currentUnits.windSpeed = document.getElementById('wind-unit').value;
        currentUnits.pressure = document.getElementById('pressure-unit').value;
        localStorage.setItem('weatherUnits', JSON.stringify(currentUnits));
        if (currentCityData) {
            updateWeatherDisplay(currentCityData);
        }
        showNotification('Настройки успешно применены!');
    });
}

function restoreSavedSettings() {
    const savedUnits = localStorage.getItem('weatherUnits');
    if (savedUnits) {
        currentUnits = JSON.parse(savedUnits);
        document.getElementById('temp-unit').value = currentUnits.temperature;
        document.getElementById('wind-unit').value = currentUnits.windSpeed;
        document.getElementById('pressure-unit').value = currentUnits.pressure;
    }
}

function setupSearch() {
    const searchBtn = document.getElementById('search-btn');
    const cityInput = document.getElementById('city-input');
    searchBtn.addEventListener('click', function() {
        const city = cityInput.value.trim();
        if (city) {
            getWeatherByCity(city);
            cityInput.value = '';
        }
    });
    cityInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
}

function setupLocationButton() {
    const locationBtn = document.getElementById('get-location-btn');
    locationBtn.addEventListener('click', function() {
        getWeatherByGeolocation();
    });
}

function getWeatherByGeolocation() {
    showNotification('Определение вашего местоположения...');
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается вашим браузером');
        getWeatherByCity("Москва");
        return;
    }
    showLoading(true);
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
                await getWeatherByCoords(lat, lon);
                showNotification('Погода для вашего местоположения загружена!');
            } catch (error) {
                console.error('Ошибка получения погоды по координатам:', error);
                showNotification('Не удалось получить погоду для вашего местоположения');
                getWeatherByCity("Москва");
            } finally {
                showLoading(false);
            }
        },
        (error) => {
            console.error('Ошибка геолокации:', error);
            let errorMessage = "Не удалось определить ваше местоположение. ";
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += "Разрешение на доступ к местоположению отклонено.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += "Информация о местоположении недоступна.";
                    break;
                case error.TIMEOUT:
                    errorMessage += "Время ожидания определения местоположения истекло.";
                    break;
                default:
                    errorMessage += "Произошла неизвестная ошибка.";
            }
            showNotification(errorMessage);
            getWeatherByCity("Москва");
            showLoading(false);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

async function getWeatherByCity(city) {
    if (!city) return;
    showNotification(`Поиск погоды для ${city}...`);
    showLoading(true);
    try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_API_KEY}&lang=ru`;
        const geoResponse = await fetch(geoUrl);
        if (!geoResponse.ok) throw new Error('Ошибка получения координат');
        const geoData = await geoResponse.json();
        if (!geoData || geoData.length === 0) throw new Error('Город не найден');
        const { lat, lon } = geoData[0];
        const cityName = geoData[0].local_names?.ru || geoData[0].name;
        await getWeatherByCoords(lat, lon, cityName);
        showNotification(`Погода для ${cityName} загружена!`);
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        showNotification(`Не удалось найти данные для ${city}`);
    } finally {
        showLoading(false);
    }
}

async function getWeatherByCoords(lat, lon, cityName = null) {
    try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=ru`;
        const weatherResponse = await fetch(weatherUrl);
        if (!weatherResponse.ok) throw new Error('Ошибка получения данных о погоде');
        const weatherDataResponse = await weatherResponse.json();
        const city = cityName || weatherDataResponse.name;
        const weatherData = {
            city: city,
            lat: lat,
            lon: lon,
            temp: Math.round(weatherDataResponse.main.temp),
            feelsLike: Math.round(weatherDataResponse.main.feels_like),
            description: weatherDataResponse.weather[0].description,
            windSpeed: weatherDataResponse.wind.speed,
            humidity: weatherDataResponse.main.humidity,
            pressure: weatherDataResponse.main.pressure,
            sunrise: new Date(weatherDataResponse.sys.sunrise * 1000),
            sunset: new Date(weatherDataResponse.sys.sunset * 1000),
            weatherCode: weatherDataResponse.weather[0].id,
            weatherMain: weatherDataResponse.weather[0].main
        };
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=ru`;
        const forecastResponse = await fetch(forecastUrl);
        if (forecastResponse.ok) {
            const forecastData = await forecastResponse.json();
            weatherData.hourlyForecast = processHourlyForecast(forecastData);
            weatherData.weeklyForecast = processWeeklyForecast(forecastData);
        }
        weatherData.precipitationMap = await getPrecipitationMapData(lat, lon);
        currentCityData = weatherData;
        updateWeatherDisplay(weatherData);
        updatePrecipitationMap(weatherData.precipitationMap);
    } catch (error) {
        console.error('Ошибка получения погоды по координатам:', error);
        throw error;
    }
}

function processHourlyForecast(forecastData) {
    const hourly = [];
    forecastData.list.slice(0, 8).forEach((item, index) => {
        const time = new Date(item.dt * 1000);
        const timeLabel = index === 0 ? "Сейчас" : `${time.getHours().toString().padStart(2, '0')}:00`;
        hourly.push({
            time: timeLabel,
            temp: Math.round(item.main.temp),
            icon: getWeatherIconFromCode(item.weather[0].id),
            description: item.weather[0].description
        });
    });
    return hourly;
}

function processWeeklyForecast(forecastData) {
    const weekly = [];
    const today = new Date();
    const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dailyData = {};
    forecastData.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toDateString();
        if (!dailyData[dayKey]) {
            dailyData[dayKey] = { temps: [], icons: [], date: date };
        }
        dailyData[dayKey].temps.push(item.main.temp);
        dailyData[dayKey].icons.push(item.weather[0].id);
    });
    const sortedDays = Object.keys(dailyData).sort();
    for (let i = 0; i < Math.min(sortedDays.length, 7); i++) {
        const dayKey = sortedDays[i];
        const data = dailyData[dayKey];
        const date = data.date;
        let dayName;
        if (i === 0) dayName = "Сегодня";
        else if (i === 1) dayName = "Завтра";
        else {
            const dayIndex = date.getDay();
            dayName = daysOfWeek[dayIndex];
        }
        const high = Math.round(Math.max(...data.temps));
        const low = Math.round(Math.min(...data.temps));
        const iconCounts = {};
        data.icons.forEach(icon => { iconCounts[icon] = (iconCounts[icon] || 0) + 1; });
        let mostCommonIcon = data.icons[0];
        let maxCount = 0;
        for (const [icon, count] of Object.entries(iconCounts)) {
            if (count > maxCount) { maxCount = count; mostCommonIcon = icon; }
        }
        weekly.push({
            day: dayName,
            high: high,
            low: low,
            icon: getWeatherIconFromCode(mostCommonIcon)
        });
    }
    return weekly;
}

async function getPrecipitationMapData(lat, lon) {
    try {
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&cnt=8`;
        const response = await fetch(forecastUrl);
        if (response.ok) {
            const forecastData = await response.json();
            return processPrecipitationMap(forecastData);
        }
    } catch (error) {
        console.error('Ошибка получения данных для карты осадков:', error);
    }
    return getDemoPrecipitationData();
}

function processPrecipitationMap(forecastData) {
    const mapData = [];
    forecastData.list.slice(0, 8).forEach((item, index) => {
        const weatherCode = item.weather[0].id;
        const pop = item.pop || 0;
        const humidity = item.main.humidity || 0;
        const clouds = item.clouds?.all || 0;
        const date = new Date(item.dt * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        mapData.push({
            time: index === 0 ? "Сейчас" : timeString,
            temp: Math.round(item.main.temp),
            type: getPrecipitationType(weatherCode),
            intensity: getPrecipitationIntensity(weatherCode, pop, clouds),
            pop: Math.round(pop * 100),
            humidity: humidity,
            icon: getPrecipitationIcon(weatherCode, pop)
        });
    });
    return mapData;
}

function getDemoPrecipitationData() {
    const mapData = [];
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        const timeString = `${hour}:00`;
        let type, temp, humidity, pop;
        if (i >= 6 && i <= 10) {
            type = Math.random() > 0.7 ? 'rain' : 'cloudy';
            temp = 10 + Math.floor(Math.random() * 5);
            humidity = 70 + Math.floor(Math.random() * 20);
            pop = type === 'rain' ? 40 + Math.floor(Math.random() * 40) : 10 + Math.floor(Math.random() * 20);
        } else if (i >= 11 && i <= 16) {
            type = Math.random() > 0.8 ? 'sunny' : (Math.random() > 0.6 ? 'cloudy' : 'rain');
            temp = 18 + Math.floor(Math.random() * 8);
            humidity = 50 + Math.floor(Math.random() * 20);
            pop = type === 'rain' ? 20 + Math.floor(Math.random() * 30) : 5 + Math.floor(Math.random() * 15);
        } else if (i >= 17 && i <= 20) {
            type = Math.random() > 0.7 ? 'cloudy' : (Math.random() > 0.5 ? 'rain' : 'sunny');
            temp = 14 + Math.floor(Math.random() * 6);
            humidity = 60 + Math.floor(Math.random() * 25);
            pop = type === 'rain' ? 30 + Math.floor(Math.random() * 40) : 10 + Math.floor(Math.random() * 20);
        } else {
            type = Math.random() > 0.8 ? 'rain' : (Math.random() > 0.6 ? 'cloudy' : 'sunny');
            temp = 8 + Math.floor(Math.random() * 6);
            humidity = 75 + Math.floor(Math.random() * 20);
            pop = type === 'rain' ? 30 + Math.floor(Math.random() * 50) : 5 + Math.floor(Math.random() * 15);
        }
        let intensity;
        switch(type) {
            case 'sunny': intensity = 0.7 + Math.random() * 0.3; break;
            case 'cloudy': intensity = 0.4 + Math.random() * 0.4; break;
            case 'rain': intensity = 0.6 + Math.random() * 0.4; break;
            case 'snow': intensity = 0.5 + Math.random() * 0.4; break;
            default: intensity = 0.5;
        }
        mapData.push({
            time: timeString,
            temp: temp,
            type: type,
            intensity: intensity,
            pop: pop,
            humidity: humidity,
            icon: getPrecipitationIconByType(type)
        });
    }
    return mapData;
}

function getPrecipitationType(weatherCode) {
    if (weatherCode >= 200 && weatherCode < 300) return 'rain';
    if (weatherCode >= 300 && weatherCode < 400) return 'rain';
    if (weatherCode >= 500 && weatherCode < 600) return 'rain';
    if (weatherCode >= 600 && weatherCode < 700) return 'snow';
    if (weatherCode === 800) return 'sunny';
    if (weatherCode > 800) return 'cloudy';
    return 'cloudy';
}

function getPrecipitationIntensity(weatherCode, pop, clouds) {
    if (weatherCode >= 200 && weatherCode < 700) {
        return Math.min(0.3 + (pop * 0.7), 0.95);
    } else if (weatherCode === 800) {
        return Math.max(0.7 - (clouds / 100 * 0.5), 0.3);
    } else {
        return Math.min(0.3 + (clouds / 100 * 0.5), 0.7);
    }
}

function getPrecipitationIcon(weatherCode, pop) {
    if (weatherCode >= 200 && weatherCode < 300) return 'fa-bolt';
    if (weatherCode >= 300 && weatherCode < 400) return 'fa-cloud-rain';
    if (weatherCode >= 500 && weatherCode < 600) {
        if (pop > 0.7) return 'fa-cloud-showers-heavy';
        return 'fa-cloud-rain';
    }
    if (weatherCode >= 600 && weatherCode < 700) return 'fa-snowflake';
    if (weatherCode === 800) return 'fa-sun';
    if (weatherCode === 801) return 'fa-cloud-sun';
    if (weatherCode === 802) return 'fa-cloud';
    if (weatherCode > 802) return 'fa-cloud';
    return 'fa-cloud';
}

function getPrecipitationIconByType(type) {
    switch(type) {
        case 'sunny': return 'fa-sun';
        case 'cloudy': return 'fa-cloud';
        case 'rain': return 'fa-cloud-rain';
        case 'snow': return 'fa-snowflake';
        default: return 'fa-cloud';
    }
}

function getWeatherSVGFromCode(weatherCode) {
    if (weatherCode === 800) return `
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:90px;height:90px">
          <style>@keyframes mw-rot{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.mw-rays{animation:mw-rot 10s linear infinite;transform-origin:32px 32px;}</style>
          <circle cx="32" cy="32" r="13" fill="#FF8C00"/>
          <g class="mw-rays" stroke="#FF8C00" stroke-width="3" stroke-linecap="round">
            <line x1="32" y1="4" x2="32" y2="11"/><line x1="32" y1="53" x2="32" y2="60"/>
            <line x1="4" y1="32" x2="11" y2="32"/><line x1="53" y1="32" x2="60" y2="32"/>
            <line x1="11.5" y1="11.5" x2="16.5" y2="16.5"/><line x1="47.5" y1="47.5" x2="52.5" y2="52.5"/>
            <line x1="52.5" y1="11.5" x2="47.5" y2="16.5"/><line x1="16.5" y1="47.5" x2="11.5" y2="52.5"/>
          </g>
        </svg>`;
    if (weatherCode === 801) return `
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:90px;height:90px">
          <circle cx="22" cy="24" r="9" fill="#FF8C00"/>
          <line x1="22" y1="10" x2="22" y2="14" stroke="#FF8C00" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="22" y1="34" x2="22" y2="38" stroke="#FF8C00" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="8" y1="24" x2="12" y2="24" stroke="#FF8C00" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="32" y1="24" x2="36" y2="24" stroke="#FF8C00" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M46 38a12 12 0 0 0-24 0H20a8 8 0 0 0 0 16h26a8 8 0 0 0 0-16z" fill="#90A4AE"/>
        </svg>`;
    if (weatherCode >= 300 && weatherCode < 600) return `
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:90px;height:90px">
          <style>@keyframes mw-drop{0%,100%{transform:translateY(0);opacity:1}80%{transform:translateY(12px);opacity:0}}.d1{animation:mw-drop 1.2s ease-in infinite}.d2{animation:mw-drop 1.2s ease-in .4s infinite}.d3{animation:mw-drop 1.2s ease-in .8s infinite}</style>
          <path d="M48 28a16 16 0 0 0-32 0H14a10 10 0 0 0 0 20h36a10 10 0 0 0 0-20z" fill="#90A4AE"/>
          <g fill="#2196F3">
            <path class="d1" d="M22 50 Q22 56 26 56 Q30 56 30 50 Z"/>
            <path class="d2" d="M30 50 Q30 56 34 56 Q38 56 38 50 Z"/>
            <path class="d3" d="M38 50 Q38 56 42 56 Q46 56 46 50 Z"/>
          </g>
        </svg>`;
    if (weatherCode >= 600 && weatherCode < 700) return `
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:90px;height:90px">
          <style>@keyframes mw-snow{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(14px) rotate(180deg);opacity:0}}.s1{animation:mw-snow 2s ease-in infinite}.s2{animation:mw-snow 2s ease-in .6s infinite}.s3{animation:mw-snow 2s ease-in 1.2s infinite}</style>
          <path d="M48 26a16 16 0 0 0-32 0H14a10 10 0 0 0 0 20h36a10 10 0 0 0 0-20z" fill="#B0BEC5"/>
          <g stroke="#BBDEFB" stroke-width="2.5" stroke-linecap="round">
            <g class="s1"><line x1="20" y1="50" x2="20" y2="60"/><line x1="15" y1="55" x2="25" y2="55"/><line x1="16.5" y1="51.5" x2="23.5" y2="58.5"/><line x1="23.5" y1="51.5" x2="16.5" y2="58.5"/></g>
            <g class="s2"><line x1="32" y1="50" x2="32" y2="60"/><line x1="27" y1="55" x2="37" y2="55"/><line x1="28.5" y1="51.5" x2="35.5" y2="58.5"/><line x1="35.5" y1="51.5" x2="28.5" y2="58.5"/></g>
            <g class="s3"><line x1="44" y1="50" x2="44" y2="60"/><line x1="39" y1="55" x2="49" y2="55"/><line x1="40.5" y1="51.5" x2="47.5" y2="58.5"/><line x1="47.5" y1="51.5" x2="40.5" y2="58.5"/></g>
          </g>
        </svg>`;
    if (weatherCode >= 200 && weatherCode < 300) return `
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:90px;height:90px">
          <path d="M48 26a16 16 0 0 0-32 0H14a10 10 0 0 0 0 20h36a10 10 0 0 0 0-20z" fill="#78909C"/>
          <polyline points="36,42 28,54 34,54 26,66" stroke="#FDD835" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>`;
    return `
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:90px;height:90px">
          <path d="M48 28a16 16 0 0 0-32 0H14a10 10 0 0 0 0 20h36a10 10 0 0 0 0-20z" fill="#90A4AE"/>
        </svg>`;
}

function getWeatherIconFromCode(weatherCode) {
    if (weatherCode >= 200 && weatherCode < 300) return 'fa-bolt';
    if (weatherCode >= 300 && weatherCode < 400) return 'fa-cloud-rain';
    if (weatherCode >= 500 && weatherCode < 600) return 'fa-cloud-showers-heavy';
    if (weatherCode >= 600 && weatherCode < 700) return 'fa-snowflake';
    if (weatherCode === 800) return 'fa-sun';
    if (weatherCode === 801) return 'fa-cloud-sun';
    if (weatherCode === 802) return 'fa-cloud';
    if (weatherCode > 802) return 'fa-cloud';
    return 'fa-cloud';
}

function updateWeatherDisplay(data) {
    document.getElementById('current-city').textContent = data.city;
    document.getElementById('current-temp').textContent = formatTemperature(data.temp);
    document.getElementById('feels-like').textContent = formatTemperature(data.feelsLike);
    const description = data.description.charAt(0).toUpperCase() + data.description.slice(1);
    document.getElementById('current-weather-desc').textContent = description;
    document.getElementById('wind-speed').textContent = formatWindSpeed(data.windSpeed);
    document.getElementById('humidity').textContent = `${data.humidity}%`;
    document.getElementById('pressure').textContent = formatPressure(data.pressure);
    document.getElementById('sunrise').textContent = formatTime(data.sunrise);
    document.getElementById('sunset').textContent = formatTime(data.sunset);
    const dayLength = calculateDayLength(data.sunrise, data.sunset);
    document.getElementById('day-length').textContent = dayLength;
    const weatherIcon = document.getElementById('main-weather-icon');
    weatherIcon.innerHTML = getWeatherSVGFromCode(data.weatherCode);
    updateHourlyForecastDisplay(data.hourlyForecast);
    updateWeeklyForecastDisplay(data.weeklyForecast);
    setUpdateTime();
}

function updateHourlyForecastDisplay(hourlyData) {
    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = '';
    if (!hourlyData || hourlyData.length === 0) return;
    hourlyData.forEach(hour => {
        const hourElement = document.createElement('div');
        hourElement.className = 'hour-item';
        hourElement.innerHTML = `
            <div class="time">${hour.time}</div>
            <div class="hour-icon" aria-hidden="true"><i class="fas ${hour.icon}"></i></div>
            <div class="hour-temp">${formatTemperature(hour.temp)}</div>
        `;
        hourlyContainer.appendChild(hourElement);
    });
    if (isMobile) {
        hourlyContainer.style.overflowX = 'auto';
        hourlyContainer.style.webkitOverflowScrolling = 'touch';
    }
}

function updateWeeklyForecastDisplay(weeklyData) {
    const weeklyContainer = document.getElementById('weekly-forecast');
    weeklyContainer.innerHTML = '';
    if (!weeklyData || weeklyData.length === 0) return;
    weeklyData.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'day-item';
        dayElement.innerHTML = `
            <div class="day-info">
                <div class="day-name">${day.day}</div>
                <div class="day-icon" aria-hidden="true"><i class="fas ${day.icon}"></i></div>
            </div>
            <div class="day-temps">
                <div class="day-high">${formatTemperature(day.high)}</div>
                <div class="day-low">${formatTemperature(day.low)}</div>
            </div>
        `;
        weeklyContainer.appendChild(dayElement);
    });
}

function updatePrecipitationMap(mapData) {
    const mapContainer = document.getElementById('precipitation-map');
    mapContainer.innerHTML = '';
    if (!mapData || mapData.length === 0) return;
    mapData.forEach(item => {
        const cell = document.createElement('div');
        cell.className = `map-cell ${item.type}`;
        let color;
        switch(item.type) {
            case 'sunny': color = `rgba(255, 235, 59, ${item.intensity})`; break;
            case 'cloudy': color = `rgba(189, 189, 189, ${item.intensity})`; break;
            case 'rain': color = `rgba(33, 150, 243, ${item.intensity})`; break;
            case 'snow': color = `rgba(187, 222, 251, ${item.intensity})`; break;
            default: color = 'rgba(255, 255, 255, 0.5)';
        }
        cell.style.backgroundColor = color;
        cell.innerHTML = `
            <div class="map-time">${item.time}</div>
            <div class="map-icon"><i class="fas ${item.icon}"></i></div>
            <div class="map-humidity">${item.humidity}%</div>
            <div class="map-temp">${formatTemperature(item.temp)}</div>
            ${item.pop > 0 ? `<div class="map-pop">${item.pop}% осадков</div>` : ''}
        `;
        cell.title = `${item.time}: ${item.type === 'sunny' ? 'Ясно' : item.type === 'cloudy' ? 'Облачно' : item.type === 'rain' ? 'Дождь' : 'Снег'}, ${item.temp}°C, влажность: ${item.humidity}%, осадки: ${item.pop}%`;
        mapContainer.appendChild(cell);
    });
    setupMapControls();
}

function setupMapControls() {
    document.getElementById('refresh-map').addEventListener('click', function() {
        if (currentCityData) {
            showNotification('Обновление карты осадков...');
            getPrecipitationMapData(currentCityData.lat, currentCityData.lon)
                .then(data => {
                    updatePrecipitationMap(data);
                    showNotification('Карта обновлена!');
                })
                .catch(() => {
                    showNotification('Не удалось обновить карту');
                });
        } else {
            showNotification('Нет данных о местоположении');
        }
    });
}

function formatTemperature(temp) {
    if (currentUnits.temperature === 'fahrenheit') {
        const fahrenheit = (temp * 9/5) + 32;
        return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(temp)}°C`;
}

function formatWindSpeed(speed) {
    let convertedSpeed;
    let unitLabel;
    switch(currentUnits.windSpeed) {
        case 'mph':
            convertedSpeed = speed * 2.23694;
            unitLabel = 'миль/ч';
            break;
        case 'ms':
            convertedSpeed = speed;
            unitLabel = 'м/с';
            break;
        case 'kmh':
        default:
            convertedSpeed = speed * 3.6;
            unitLabel = 'км/ч';
    }
    return `${Math.round(convertedSpeed)} ${unitLabel}`;
}

function formatPressure(pressure) {
    let convertedPressure;
    let unitLabel;
    switch(currentUnits.pressure) {
        case 'hPa':
            convertedPressure = pressure;
            unitLabel = 'гПа';
            break;
        case 'atm':
            convertedPressure = pressure / 1013.25;
            unitLabel = 'атм';
            break;
        case 'mmHg':
        default:
            convertedPressure = pressure * 0.750062;
            unitLabel = 'мм рт.ст.';
    }
    if (currentUnits.pressure === 'atm') {
        return `${convertedPressure.toFixed(2)} ${unitLabel}`;
    }
    return `${Math.round(convertedPressure)} ${unitLabel}`;
}

function formatTime(date) {
    if (!(date instanceof Date)) date = new Date(date);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function calculateDayLength(sunrise, sunset) {
    if (!(sunrise instanceof Date)) sunrise = new Date(sunrise);
    if (!(sunset instanceof Date)) sunset = new Date(sunset);
    const dayLengthMs = sunset - sunrise;
    const hours = Math.floor(dayLengthMs / (1000 * 60 * 60));
    const minutes = Math.floor((dayLengthMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
}

function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('ru-RU', options);
    const formattedDate = dateString.charAt(0).toUpperCase() + dateString.slice(1);
    document.getElementById('current-date').textContent = formattedDate;
}

function setUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('update-time').textContent = timeString;
    setTimeout(setUpdateTime, 60000);
}

function showLoading(show) {
    const mainContent = document.querySelector('.main-content');
    if (show) mainContent.classList.add('loading');
    else mainContent.classList.remove('loading');
}

function showNotification(message) {
    const isSmallScreen = window.innerWidth < 768;
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(notification => notification.remove());
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: ${isSmallScreen ? '10px' : '20px'};
        ${isSmallScreen ? 'left: 10px; right: 10px;' : 'right: 20px;'}
        background: #4CAF50;
        color: white;
        padding: ${isSmallScreen ? '12px 20px' : '15px 25px'};
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 500;
        transform: translateX(${isSmallScreen ? '0' : '150%'});
        transition: transform 0.5s ease;
        max-width: ${isSmallScreen ? 'calc(100vw - 40px)' : '400px'};
        text-align: center;
    `;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 100);
    setTimeout(() => {
        notification.style.transform = `translateX(${isSmallScreen ? '0' : '150%'})`;
        setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 500);
    }, 3000);
}