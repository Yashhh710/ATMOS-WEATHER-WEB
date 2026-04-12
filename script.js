const OM_BASE = 'https://api.open-meteo.com/v1/forecast';
        const OM_GEO = 'https://geocoding-api.open-meteo.com/v1/search';



        let weatherData = null;
        let forecastData = null;
        let useFahrenheit = false;
        let map = null;
        let mapMarker = null;
        let favorites = JSON.parse(localStorage.getItem('axon-favorites') || '[]');
        let recognition = null;
        let isListening = false;
        let currentLat = null, currentLon = null;


        window.addEventListener('load', async () => {
            generateStars();
            setGreeting();
            renderFavorites();
            initMap();

            setTimeout(() => {
                document.getElementById('loading').style.opacity = '0';
                setTimeout(() => document.getElementById('loading').style.display = 'none', 500);
            }, 2200);

            setTimeout(() => {
                getUserLocation();
            }, 2300);


            // Axon greeting after panel opens
            axonGreet();
        });


        // --- PARTICLE ENGINE ---
        let particles = [];
        let particleType = 'none';

        function generateStars() {
            // Replaced by canvas engine below, but kept as a stub for compatibility
            const canvas = document.getElementById('particles-canvas');
            if (canvas && !window.canvasInitialized) {
                const ctx = canvas.getContext('2d');
                window.canvasInitialized = true;
                function resizeCanvas() {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                }
                window.addEventListener('resize', resizeCanvas);
                resizeCanvas();

                class Particle {
                    constructor(type) {
                        this.type = type;
                        this.x = Math.random() * canvas.width;
                        this.y = Math.random() * canvas.height;
                        this.size = Math.random() * 2 + 1;
                        this.speedY = 0;
                        this.speedX = 0;
                        this.alpha = Math.random() * 0.5 + 0.5;

                        if (type === 'rain') {
                            this.speedY = Math.random() * 10 + 10;
                            this.speedX = Math.random() * 1 - 0.5;
                            this.size = Math.random() * 1.5 + 0.5;
                            this.length = Math.random() * 10 + 10;
                        } else if (type === 'snow') {
                            this.speedY = Math.random() * 2 + 1;
                            this.speedX = Math.random() * 2 - 1;
                            this.size = Math.random() * 3 + 1;
                        } else if (type === 'stars') {
                            this.speedY = 0;
                            this.speedX = Math.random() * 0.1 - 0.05;
                            this.alpha = Math.random();
                            this.alphaChange = (Math.random() * 0.02) - 0.01;
                        }
                    }

                    update() {
                        if (this.type === 'stars') {
                            this.alpha += this.alphaChange;
                            if (this.alpha <= 0.1 || this.alpha >= 1) this.alphaChange *= -1;
                            this.x += this.speedX;
                            if (this.x > canvas.width) this.x = 0;
                            else if (this.x < 0) this.x = canvas.width;
                            return;
                        }

                        this.y += this.speedY;
                        this.x += this.speedX;

                        if (this.y > canvas.height) {
                            this.y = -this.length || -10;
                            this.x = Math.random() * canvas.width;
                        }
                    }

                    draw() {
                        ctx.globalAlpha = this.alpha;
                        ctx.fillStyle = 'white';
                        
                        if (this.type === 'rain') {
                            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                            ctx.lineWidth = this.size;
                            ctx.beginPath();
                            ctx.moveTo(this.x, this.y);
                            ctx.lineTo(this.x - this.speedX * 2, this.y - this.length);
                            ctx.stroke();
                        } else if (this.type === 'snow' || this.type === 'stars') {
                            ctx.beginPath();
                            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.globalAlpha = 1;
                    }
                }

                window.initParticles = function(type) {
                    particles = [];
                    particleType = type;
                    if (type === 'none') {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        return;
                    }

                    let count = window.maxParticles || (type === 'rain' ? 150 : type === 'snow' ? 200 : 150);

                    for (let i = 0; i < count; i++) {
                        particles.push(new Particle(type));
                    }
                }

                function animateParticles() {
                    if (particleType === 'none') {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    } else {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        for (let p of particles) {
                            p.update();
                            p.draw();
                        }
                    }
                    requestAnimationFrame(animateParticles);
                }
                animateParticles();
            }
        }


        function setGreeting() {
            const h = new Date().getHours();
            let g;
            if (h < 12) g = 'GOOD MORNING ☀️';
            else if (h < 17) g = 'GOOD AFTERNOON 🌤️';
            else if (h < 21) g = 'GOOD EVENING 🌆';
            else g = 'GOOD NIGHT 🌙';
            if (document.getElementById('greeting')) document.getElementById('greeting').textContent = g;
        }


        function initMap() {
            map = L.map('map', { zoomControl: true, attributionControl: false }).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19
            }).addTo(map);
        }
        function updateMap(lat, lon, cityName) {
            map.setView([lat, lon], 11, { animate: true });
            if (mapMarker) mapMarker.remove();
            const icon = L.divIcon({
                html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:radial-gradient(circle,#00d4ff,#7b2fff);
      box-shadow:0 0 15px #00d4ff,0 0 30px rgba(0,212,255,0.5);
      border:2px solid #00d4ff;
    "></div>`,
                className: '', iconSize: [18, 18], iconAnchor: [9, 9]
            });
            mapMarker = L.marker([lat, lon], { icon }).addTo(map);
            mapMarker.bindPopup(`<b style="color:#00d4ff;font-family:'Orbitron',monospace">${cityName}</b>`).openPopup();
        }


        function getUserLocation() {
            if (!navigator.geolocation) { fetchWeather('Mumbai'); return; }
            navigator.geolocation.getCurrentPosition(
                pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
                () => fetchWeather('Mumbai')
            );
        }


        async function fetchWeatherByCoords(lat, lon, cityName = null) {
            try {
                const url = `${OM_BASE}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,dew_point_2m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
                const res = await fetch(url).then(r => r.json());



                // Reverse geocode if city name is not provided
                if (!cityName) {
                    try {
                        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`).then(r => r.json());
                        cityName = geoRes.address.city || geoRes.address.town || geoRes.address.village || 'Unknown';
                    } catch (e) { cityName = 'My Location'; }
                }

                currentLat = lat; currentLon = lon;
                processWeather(res, cityName);
            } catch (e) {
                showToast('⚠️ ' + e.message);
                console.error(e);
                loadDemoData();
            }
        }

        async function fetchWeather(city) {
            try {
                const geo = await fetch(`${OM_GEO}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`).then(r => r.json());
                if (!geo.results || !geo.results.length) throw new Error('City not found');
                const item = geo.results[0];
                fetchWeatherByCoords(item.latitude, item.longitude, item.name);
            } catch (e) { showToast('⚠️ ' + e.message); }
        }



        function processWeather(res, cityName) {
            weatherData = res;
            weatherData.name = cityName; // Store for Axon

            const current = res.current;
            const daily = res.daily;

            const rawTemp = current.temperature_2m;
            const temp = Math.round(rawTemp);
            const code = current.weather_code;
            const isNight = !current.is_day;
            const icon = getWeatherIcon(code, isNight);
            const desc = getWeatherDesc(code);
            const humidity = current.relative_humidity_2m;
            const pressure = Math.round(current.pressure_msl);
            const rawFeels = current.apparent_temperature;
            const feelsLike = Math.round(rawFeels);
            const windSpeed = Math.round(current.wind_speed_10m);
            const windGusts = Math.round(current.wind_gusts_10m);
            const windDeg = current.wind_direction_10m;
            const visibility = (current.visibility / 1000).toFixed(1);
            const rawDew = current.dew_point_2m;
            const dewPoint = Math.round(rawDew);
            const clouds = current.cloud_cover;
            const precip = current.precipitation;
            const surfPress = Math.round(current.surface_pressure);

            const sunriseDate = new Date(daily.sunrise[0]);
            const sunsetDate = new Date(daily.sunset[0]);
            const sunrise = sunriseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const sunset = sunsetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const uvIdx = Math.round(daily.uv_index_max[0]);

            // Update DOM
            document.getElementById('city-name').textContent = cityName;
            if(document.getElementById('search-input')) document.getElementById('search-input').value = cityName;
            document.getElementById('country-tag').textContent = new Date().toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' });
            document.getElementById('temp-value').textContent = useFahrenheit ? Math.round(rawTemp * 9 / 5 + 32) : temp;
            document.getElementById('unit-label').textContent = useFahrenheit ? '°F' : '°C';
            document.getElementById('weather-icon').textContent = icon;
            document.getElementById('weather-desc').textContent = desc.toUpperCase();
            document.getElementById('humidity').textContent = humidity + '%';
            document.getElementById('pressure').textContent = pressure + ' hPa';
            document.getElementById('feels-like').textContent = (useFahrenheit ? Math.round(rawFeels * 9 / 5 + 32) : feelsLike) + (useFahrenheit ? '°F' : '°C');
            document.getElementById('visibility').textContent = visibility + ' km';
            document.getElementById('wind-speed').textContent = windSpeed + ' km/h';
            document.getElementById('wind-gusts').textContent = windGusts + ' km/h';
            document.getElementById('cloud-cover').textContent = clouds + '%';
            document.getElementById('dew-point').textContent = (useFahrenheit ? Math.round(rawDew * 9 / 5 + 32) : dewPoint) + (useFahrenheit ? '°F' : '°C');
            document.getElementById('precip-val').textContent = precip + ' mm';
            document.getElementById('surface-press').textContent = surfPress + ' hPa';
            document.getElementById('wind-dir-text').textContent = getWindDir(windDeg);
            document.getElementById('sunrise').textContent = sunrise;
            document.getElementById('sunset').textContent = sunset;





            // AQI (Simulated if not available, or I could use another API for AQI)
            // For now, let's just use a reasonable default or keep it as is
            const aqi = 2; // Simulated
            const aqiLabels = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
            const aqiColors = ['', '#00ff88', '#a8ff00', '#ffd700', '#ff8c00', '#ff3333'];
            const aqiPct = (aqi / 5 * 100).toFixed(0);
            document.getElementById('aqi-val').textContent = aqi;
            document.getElementById('aqi-status').textContent = aqiLabels[aqi] || '—';
            document.getElementById('aqi-ring').style.setProperty('--pct', aqiPct + '%');
            document.getElementById('aqi-ring').style.background = `conic-gradient(${aqiColors[aqi]} ${aqiPct}%, var(--chip-bg) 0%)`;


            // UV
            const uvPct = (uvIdx / 11 * 100).toFixed(0);
            document.getElementById('uv-val').textContent = uvIdx;
            document.getElementById('uv-status').textContent = uvIdx < 3 ? 'Low' : uvIdx < 6 ? 'Moderate' : uvIdx < 8 ? 'High' : 'Very High';
            document.getElementById('uv-ring').style.setProperty('--pct', uvPct + '%');

            // Compass
            document.getElementById('compass-needle').style.transform = `translateX(-50%) translateY(-100%) rotate(${windDeg}deg)`;

            // Map
            updateMap(res.latitude, res.longitude, cityName);

            // Alerts Detection
            const alerts = [];
            if (code >= 95) alerts.push("Severe Thunderstorms active in the region. Seek shelter.");
            if (temp > 38) alerts.push("Extreme Heat Warning: Temperatures exceeding 38°C. Stay hydrated.");
            if (temp < -5) alerts.push("Freeze Warning: Dangerous cold detected. Protect pets and plants.");
            if (windSpeed > 60) alerts.push("High Wind Advisory: Gusts exceeding 60 km/h. Secure loose objects.");
            if (code >= 71 && code <= 77 && temp < 0) alerts.push("Heavy Snowfall Alert: Hazardous travel conditions expected.");

            const banner = document.getElementById('alert-banner');
            if (alerts.length > 0) {
                document.getElementById('alert-msg').textContent = alerts.join(' | ');
                banner.style.display = 'flex';
            } else {
                banner.style.display = 'none';
            }

            // Forecast

            renderForecast(res);
            renderHourly(res);
            applyTheme(code, isNight);
            generateSummary(res);
        }

        function getWeatherIcon(code, isNight) {
            if (code === 0) return isNight ? '🌙' : '☀️';
            if (code <= 3) return isNight ? '☁️' : '⛅';
            if (code === 45 || code === 48) return '🌫️';
            if (code <= 55) return '🌧️';
            if (code <= 57) return '🌨️';
            if (code <= 65) return '🌧️';
            if (code <= 67) return '🌨️';
            if (code <= 77) return '❄️';
            if (code <= 82) return '🌦️';
            if (code <= 86) return '❄️';
            if (code >= 95) return '⛈️';
            return '🌡️';
        }

        function getWeatherDesc(code) {
            const codes = {
                0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
                45: 'Fog', 48: 'Depositing rime fog',
                51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
                56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
                61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
                66: 'Light freezing rain', 67: 'Heavy freezing rain',
                71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
                77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
                85: 'Slight snow showers', 86: 'Heavy snow showers',
                95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
            };
            return codes[code] || 'Unknown';
        }

        function getWindDir(deg) {
            const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
            const i = Math.round(deg / 22.5) % 16;
            return dirs[i];
        }




        function renderForecast(res) {
            const daily = res.daily;
            const grid = document.getElementById('forecast-grid');
            grid.innerHTML = '';

            for (let i = 0; i < 5; i++) {
                const date = new Date(daily.time[i]);
                const code = daily.weather_code[i];
                const hi = Math.round(daily.temperature_2m_max[i]);
                const lo = Math.round(daily.temperature_2m_min[i]);
                const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en', { weekday: 'short' });
                const icon = getWeatherIcon(code, false);

                const div = document.createElement('div');
                div.className = 'forecast-day' + (i === 0 ? ' active' : '');
                div.innerHTML = `<div class="fd-day">${dayName}</div>
      <span class="fd-icon">${icon}</span>
      <div class="fd-hi">${useFahrenheit ? Math.round(hi * 9 / 5 + 32) : hi}°</div>
      <div class="fd-lo">${useFahrenheit ? Math.round(lo * 9 / 5 + 32) : lo}°</div>`;
                div.onclick = () => {
                    document.querySelectorAll('.forecast-day').forEach(x => x.classList.remove('active'));
                    div.classList.add('active');
                };
                grid.appendChild(div);
            }
        }


        function renderHourly(res) {
            const scroll = document.getElementById('hourly-scroll');
            scroll.innerHTML = '';
            const hourly = res.hourly;

            // Get current hour index
            const now = new Date();
            const currentHour = now.getHours();
            let startIndex = hourly.time.findIndex(t => new Date(t).getHours() >= currentHour);
            if (startIndex === -1) startIndex = 0;

            for (let i = startIndex; i < startIndex + 16 && i < hourly.time.length; i++) {
                const date = new Date(hourly.time[i]);
                const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const temp = Math.round(hourly.temperature_2m[i]);
                const code = hourly.weather_code[i];
                const icon = getWeatherIcon(code, date.getHours() < 6 || date.getHours() > 19);

                const chip = document.createElement('div');
                chip.className = 'hour-chip';
                chip.innerHTML = `<div class="hc-time">${time}</div>
      <span class="hc-icon">${icon}</span>
      <div class="hc-temp">${useFahrenheit ? Math.round(temp * 9 / 5 + 32) : temp}°</div>`;
                scroll.appendChild(chip);
            }
        }



        function applyTheme(code, isNight) {
            // First determine time-of-day class based on actual hour
            const h = new Date().getHours();
            let timeClass = '';
            
            // If from sandbox
            const timeVal = document.getElementById('time-select')?.value;
            if (timeVal && timeVal !== 'auto') {
                if (timeVal === 'morning') timeClass = 'time-morning';
                else if (timeVal === 'day') timeClass = 'time-day';
                else if (timeVal === 'evening') timeClass = 'time-evening';
                else timeClass = 'time-night';
            } else {
                if (h >= 6 && h < 10) timeClass = 'time-morning';
                else if (h >= 10 && h < 17) timeClass = 'time-day';
                else if (h >= 17 && h < 20) timeClass = 'time-evening';
                else timeClass = 'time-night';
            }

            // Fallback for purely night codes via OpenMeteo
            if (timeVal === 'auto' && isNight && timeClass !== 'time-night' && timeClass !== 'time-evening') {
                timeClass = 'time-night';
            }

            // Remove previous classes
            document.body.className = document.body.className.replace(/\btheme-\S+/g, '').replace(/\btime-\S+/g, '');
            document.body.classList.add(timeClass);

            let pType = 'none';
            if (code >= 95) {
                document.body.classList.add('theme-storm');
                pType = 'rain';
            } else if (code >= 71 && code <= 77) {
                document.body.classList.add('theme-snow');
                pType = 'snow';
            } else if (code >= 51 && code <= 67 || code >= 80 && code <= 82) {
                document.body.classList.add('theme-rain');
                pType = 'rain';
            } else if (code === 45 || code === 48) {
                document.body.classList.add('theme-mist');
            } else if (code === 1 || code === 2 || code === 3) {
                document.body.classList.add('theme-clouds');
            } else if (code === 0) {
                if (isNight) pType = 'stars';
            }

            if (window.initParticles) window.initParticles(pType);
        }



        function generateSummary(res) {
            const current = res.current;
            const temp = Math.round(current.temperature_2m);
            const humidity = current.relative_humidity_2m;
            const windSpeed = Math.round(current.wind_speed_10m);
            const code = current.weather_code;
            const desc = getWeatherDesc(code);

            const unit = useFahrenheit ? '°F' : '°C';
            const displayTemp = useFahrenheit ? Math.round(current.temperature_2m * 9 / 5 + 32) : temp;
            let summary = `Today in <strong>${res.name}</strong>: ${desc} with a temperature of ${displayTemp}${unit}. `;

            if (temp > 35) summary += 'Extreme heat — stay indoors during peak hours and hydrate frequently. ';
            else if (temp > 28) summary += 'Warm and sunny conditions. Perfect for outdoor activities in the morning or evening. ';
            else if (temp < 10) summary += 'Cold conditions — bundle up before heading out. ';
            if (humidity > 80) summary += 'High humidity makes it feel muggier than usual. ';
            if (windSpeed > 30) summary += 'Strong winds expected — hold on to your hat! ';
            if (code >= 51 && code <= 67) summary += 'Precipitation is in the forecast — carry an umbrella. ';

            document.getElementById('daily-summary').innerHTML = summary;

            // Notifications
            const notifs = [];
            if (code >= 51 && code <= 67) notifs.push({ icon: '☂️', text: 'Rain expected — carry umbrella', type: 'warn' });
            if (temp > 35) notifs.push({ icon: '🥵', text: 'Heat alert: Stay hydrated', type: 'warn' });
            if (temp < 5) notifs.push({ icon: '🧥', text: 'Cold snap: Dress warmly', type: 'warn' });
            if (code === 0) notifs.push({ icon: '📸', text: 'Great weather for photography!', type: 'info' });
            if (windSpeed < 15 && temp > 18 && temp < 30 && code === 0) notifs.push({ icon: '🚴', text: 'Perfect day for a bike ride', type: 'info' });

            const row = document.getElementById('notif-row');
            row.innerHTML = notifs.map(n => `<div class="notif-chip ${n.type}">${n.icon} ${n.text}</div>`).join('');
        }



        function toggleUnit() {
            useFahrenheit = !useFahrenheit;
            document.getElementById('unit-label').textContent = useFahrenheit ? '°F' : '°C';
            if (weatherData) processWeather(weatherData, weatherData.name);
        }



        let acTimeout;
        document.getElementById('search-input').addEventListener('input', function () {
            clearTimeout(acTimeout);
            const q = this.value.trim();
            if (!q || q.length < 2) { document.getElementById('autocomplete-list').style.display = 'none'; return; }
            acTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(`${OM_GEO}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`).then(r => r.json());
                    const list = document.getElementById('autocomplete-list');
                    list.innerHTML = '';
                    if (!res.results || !res.results.length) { list.style.display = 'none'; return; }
                    res.results.forEach(item => {
                        const d = document.createElement('div');
                        d.textContent = `${item.name}, ${item.country}${item.admin1 ? ', ' + item.admin1 : ''}`;
                        d.onclick = () => {
                            document.getElementById('search-input').value = item.name;
                            list.style.display = 'none';
                            fetchWeatherByCoords(item.latitude, item.longitude, item.name);
                        };
                        list.appendChild(d);
                    });
                    list.style.display = 'block';
                } catch (e) { console.error(e); }
            }, 400);

        });
        document.getElementById('search-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                const q = this.value.trim();
                if (q) { fetchWeather(q); document.getElementById('autocomplete-list').style.display = 'none'; }
            }
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.search-wrap')) document.getElementById('autocomplete-list').style.display = 'none';
        });

        if(document.getElementById('location-btn')) document.getElementById('location-btn').addEventListener('click', getUserLocation);
        if(document.getElementById('unit-toggle')) document.getElementById('unit-toggle').addEventListener('click', toggleUnit);
        if(document.getElementById('fav-btn')) document.getElementById('fav-btn').addEventListener('click', () => {
            if (!weatherData) return;
            const city = weatherData.name;
            if (!favorites.includes(city)) {
                favorites.push(city);
                localStorage.setItem('axon-favorites', JSON.stringify(favorites));
                renderFavorites();
                showToast('⭐ ' + city + ' added to favorites');
            } else {
                showToast('Already in favorites');
            }
        });

        function renderFavorites() {
            const strip = document.getElementById('fav-strip');
            if(!strip) return;
            strip.innerHTML = '';
            favorites.forEach(city => {
                const chip = document.createElement('div');
                chip.className = 'fav-chip';
                chip.innerHTML = `<span onclick="fetchWeather('${city}')">${city}</span><span class="fav-del" onclick="removeFav('${city}')">✕</span>`;
                strip.appendChild(chip);
            });
        }
        function removeFav(city) {
            favorites = favorites.filter(f => f !== city);
            localStorage.setItem('axon-favorites', JSON.stringify(favorites));
            renderFavorites();
        }


        function showToast(msg) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 4000);
        }


        function toggleAxon() {
            const panel = document.getElementById('axon-panel');
            const btn = document.getElementById('axon-btn');
            const isOpen = panel.classList.contains('show');
            panel.classList.toggle('show', !isOpen);
            btn.classList.toggle('open', !isOpen);
        }

        function axonGreet() {
            const h = new Date().getHours();
            let greet;
            if (h < 12) greet = "Good morning! I'm Axon, your weather intelligence. ☀️ How can I help you today?";
            else if (h < 17) greet = "Good afternoon! Axon here. 🌤️ Ask me anything about the weather!";
            else greet = "Good evening! Axon online. 🌙 Ready to assist with weather insights.";
            addAxonMsg(greet, 'bot');
        }

        function addAxonMsg(text, role) {
            const chat = document.getElementById('axon-chat');
            const div = document.createElement('div');
            div.className = `msg ${role}`;
            div.innerHTML = `<div class="msg-bubble">${text}</div>`;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        function showTyping() {
            const chat = document.getElementById('axon-chat');
            const div = document.createElement('div');
            div.className = 'msg bot';
            div.id = 'typing-indicator';
            div.innerHTML = `<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }
        function hideTyping() {
            const t = document.getElementById('typing-indicator');
            if (t) t.remove();
        }

        function quickAsk(btn) {
            const q = btn.textContent.trim();
            handleAxonQuery(q);
        }

        async function sendAxon() {
            const input = document.getElementById('axon-input');
            const q = input.value.trim();
            if (!q) return;
            input.value = '';
            handleAxonQuery(q);
        }

        async function handleAxonQuery(q) {
            addAxonMsg(q, 'user');
            showTyping();

            // Build weather context
            let ctx = '';
            if (weatherData) {
                const w = weatherData;
                const cur = w.current;
                ctx = `Current weather in ${w.name}: ${getWeatherDesc(cur.weather_code)}, ${Math.round(cur.temperature_2m)}°C, feels like ${Math.round(cur.apparent_temperature)}°C, humidity ${cur.relative_humidity_2m}%, wind ${Math.round(cur.wind_speed_10m)} km/h. `;
                const rainProb = w.hourly.weather_code.slice(0, 12).some(c => c >= 51 && c <= 67);
                ctx += rainProb ? 'Rain is expected in the next 12 hours. ' : 'No significant rain expected in the next 12 hours. ';
            } else {
                ctx = 'No live weather data available. ';
            }


            const h = new Date().getHours();
            const timeCtx = `Current time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. It is ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}.`;

            // Call Anthropic API
            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 1000,
                        system: `You are Axon, a futuristic AI weather assistant embedded in a sleek weather app. You have a friendly, slightly witty, intelligent personality. You give concise, helpful responses (2-5 sentences max). Always use relevant emojis. You focus on weather questions but can handle general queries briefly.

Weather context: ${ctx} ${timeCtx}

Guidelines:
- For rain queries: check if rain is expected, recommend umbrella if >40% chance
- For temperature: give practical advice (what to wear, hydration, etc.)
- For outdoor timing: suggest best windows based on weather data
- For hot weather (>35°C): always mention heat warnings
- At night: use calmer, softer tone
- Keep responses sharp and actionable`,
                        messages: [{ role: 'user', content: q }]
                    })
                });
                const data = await response.json();
                const reply = data.content?.map(i => i.text || '').join('') || "I'm having trouble connecting right now. Please try again! 🔄";
                hideTyping();
                addAxonMsg(reply, 'bot');
                speak(reply.replace(/[^\w\s.,!?]/g, ''));
            } catch (e) {
                hideTyping();
                // Fallback local intelligence
                const fallback = localAxonResponse(q);
                addAxonMsg(fallback, 'bot');
                speak(fallback.replace(/[^\w\s.,!?]/g, ''));
            }
        }

        function localAxonResponse(q) {
            q = q.toLowerCase();
            if (!weatherData) return "I don't have live weather data yet. I'm connecting to the satellites now! 🛰️";

            const w = weatherData;
            const cur = w.current;
            const temp = Math.round(cur.temperature_2m);
            const code = cur.weather_code;
            const isRain = code >= 51 && code <= 67;
            const isStorm = code >= 95;
            const windSpd = Math.round(cur.wind_speed_10m);

            if (q.includes('umbrella') || q.includes('rain')) {
                return isRain || isStorm
                    ? `☔ Absolutely! Rain detected right now in ${w.name}. Don't leave home without an umbrella!`
                    : `🌤️ No rain currently in ${w.name}. But weather can change — keep an eye on the sky!`;
            }
            if (q.includes('temperature') || q.includes('hot') || q.includes('cold') || q.includes('weather today')) {
                let msg = `🌡️ It's ${temp}°C in ${w.name} with ${getWeatherDesc(code)}.`;
                if (temp > 35) msg += ' ⚠️ Extreme heat — stay hydrated and avoid direct sunlight!';
                else if (temp > 28) msg += ' 😎 Warm and pleasant — great day!';
                else if (temp < 10) msg += ' 🧥 Bundle up, it\'s chilly!';
                return msg;
            }
            if (q.includes('outside') || q.includes('outdoor') || q.includes('go out') || q.includes('best time')) {
                if (isRain || isStorm) return `🌧️ Rain is currently active — best to wait it out. Try checking again in a few hours!`;
                if (temp > 35) return `🕕 Best time to go outside is early morning (6-9 AM) or after sunset to avoid the heat!`;
                return `✅ Current conditions look good for heading out! Temperature is ${temp}°C. Enjoy! 🌿`;
            }
            if (q.includes('wind')) {
                return `💨 Wind speed is ${windSpd} km/h in ${w.name}. ${windSpd > 40 ? 'Quite windy — hold onto light objects!' : windSpd > 20 ? 'Moderate breeze. Pleasant!' : 'Calm winds — perfect weather!'}`;
            }
            if (q.includes('report') || q.includes('summary')) {
                return `📊 ${w.name} Report: ${temp}°C, ${getWeatherDesc(code)}, ${cur.relative_humidity_2m}% humidity, ${windSpd} km/h winds. ${isRain ? '🌧️ Rain active.' : code === 0 ? '☀️ Clear skies!' : '⛅ Partly cloudy.'}`;
            }
            return `🤖 I'm Axon! Currently showing weather for ${w.name}: ${temp}°C with ${getWeatherDesc(code)}. Ask me anything more specific! 🌍`;
        }



        function toggleVoice() {
            if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
                showToast('Voice input not supported in this browser');
                return;
            }
            if (isListening) {
                recognition.stop();
                return;
            }
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SR();
            recognition.lang = 'en-US';
            recognition.onstart = () => {
                isListening = true;
                document.getElementById('axon-voice-btn').classList.add('listening');
            };
            recognition.onresult = e => {
                const transcript = e.results[0][0].transcript;
                document.getElementById('axon-input').value = transcript;
                handleAxonQuery(transcript);
            };
            recognition.onend = () => {
                isListening = false;
                document.getElementById('axon-voice-btn').classList.remove('listening');
            };
            recognition.start();
        }

        function speak(text) {
            if (!window.speechSynthesis) return;
            const utt = new SpeechSynthesisUtterance(text.substring(0, 200));
            utt.rate = 1; utt.pitch = 1.1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utt);
        }


        function loadDemoData() {
            fetchWeather('Mumbai');
        }



        function toggleSettings() {
            const panel = document.getElementById('settings-panel');
            panel.classList.toggle('show');
        }

        function applyColorTheme(theme) {
            const root = document.documentElement;
            const themes = {
                cyan: { accent: '#00d4ff', accent2: '#7b2fff' },
                emerald: { accent: '#00ff88', accent2: '#00aaff' },
                gold: { accent: '#ffd700', accent2: '#ff8c00' },
                ruby: { accent: '#ff3366', accent2: '#7b2fff' },
                amethyst: { accent: '#7b2fff', accent2: '#00d4ff' },
                orange: { accent: '#ff8c00', accent2: '#ff3366' },
                pink: { accent: '#ff00ff', accent2: '#7b2fff' },
                mint: { accent: '#00ffee', accent2: '#0088aa' },
                crimson: { accent: '#ff0044', accent2: '#880022' },
                lavender: { accent: '#cc99ff', accent2: '#7733cc' },
                arctic: { accent: '#aaddff', accent2: '#3388ff' }
            };


            const t = themes[theme];
            root.style.setProperty('--accent', t.accent);
            root.style.setProperty('--accent2', t.accent2);
            
            // Apply slight tint to text for cohesion, but keep it very light for visibility
            root.style.setProperty('--text', '#ffffff');
            root.style.setProperty('--text2', 'rgba(255, 255, 255, 0.8)');
            
            // Add a very subtle glow to ALL text using the accent color
            root.style.setProperty('--text-glow', `0 0 10px ${t.accent}44`);

            // Update highlights
            const opts = document.querySelectorAll('#settings-panel .theme-grid:last-of-type .theme-opt');
            opts.forEach(opt => {
                if (opt.getAttribute('onclick').includes(`'${theme}'`)) {
                    opt.classList.add('active');
                } else {
                    opt.classList.remove('active');
                }
            });

            // If an accent is applied, it "wins" over the theme accent, but we don't necessarily remove the preset border
            // unless we want them to be strictly separate. Let's keep them stacking for now.

            // Update panel border safely
            const sPanel = document.getElementById('settings-panel');
            const aPanel = document.getElementById('axon-panel');
            if(sPanel) sPanel.style.borderColor = t.accent;
            if(aPanel) aPanel.style.borderColor = t.accent;

            localStorage.setItem('atmos-theme', theme);
            showToast('🎨 UI accent updated to ' + theme);
        }

        function applyPreset(preset) {
            const root = document.documentElement;
            const presets = {
                cyberpunk: {
                    accent: '#00d4ff', accent2: '#7b2fff',
                    card: 'rgba(0, 212, 255, 0.05)', chip: 'rgba(123, 47, 255, 0.05)',
                    surface: 'rgba(0, 212, 255, 0.05)',
                    bg: '#03060f', surface2: 'rgba(0, 212, 255, 0.08)'
                },
                synthwave: {
                    accent: '#ff00ff', accent2: '#7b2fff',
                    card: 'rgba(255, 0, 255, 0.05)', chip: 'rgba(123, 47, 255, 0.05)',
                    surface: 'rgba(255, 0, 255, 0.05)',
                    bg: '#1a0633', surface2: 'rgba(255, 0, 255, 0.08)'
                },
                ocean: {
                    accent: '#00d4ff', accent2: '#004488',
                    card: 'rgba(0, 212, 255, 0.05)', chip: 'rgba(0, 68, 136, 0.05)',
                    surface: 'rgba(0, 212, 255, 0.05)',
                    bg: '#001122', surface2: 'rgba(0, 212, 255, 0.08)'
                },
                nebula: {
                    accent: '#ff3366', accent2: '#7b2fff',
                    card: 'rgba(255, 51, 102, 0.05)', chip: 'rgba(123, 47, 255, 0.05)',
                    surface: 'rgba(255, 51, 102, 0.05)',
                    bg: '#0a0a20', surface2: 'rgba(255, 51, 102, 0.08)'
                },
                space: {
                    accent: '#ffffff', accent2: '#888888',
                    card: 'rgba(255, 255, 255, 0.03)', chip: 'rgba(255, 255, 255, 0.03)',
                    surface: 'rgba(255, 255, 255, 0.02)',
                    bg: '#000000', surface2: 'rgba(255, 255, 255, 0.05)'
                },
                ghost: {
                    accent: '#00d4ff', accent2: '#ffffff',
                    card: 'rgba(255, 255, 255, 0.05)', chip: 'rgba(255, 255, 255, 0.1)',
                    surface: 'rgba(200, 230, 255, 0.05)',
                    bg: '#002b36', surface2: 'rgba(255, 255, 255, 0.1)'
                },
                vulcan: {
                    accent: '#ff3366', accent2: '#ffd700',
                    card: 'rgba(255, 51, 102, 0.05)', chip: 'rgba(255, 215, 0, 0.05)',
                    surface: 'rgba(255, 51, 102, 0.05)',
                    bg: '#0f0303', surface2: 'rgba(255, 51, 102, 0.08)'
                },
                toxic: {
                    accent: '#00ff88', accent2: '#004422',
                    card: 'rgba(0, 255, 136, 0.05)', chip: 'rgba(0, 68, 34, 0.08)',
                    surface: 'rgba(0, 255, 136, 0.05)',
                    bg: '#000f05', surface2: 'rgba(0, 255, 136, 0.08)'
                }
            };

            const p = presets[preset];
            root.style.setProperty('--accent', p.accent);
            root.style.setProperty('--accent2', p.accent2);
            root.style.setProperty('--card', p.card);
            root.style.setProperty('--chip-bg', p.chip);
            root.style.setProperty('--surface', p.surface);
            root.style.setProperty('--surface2', p.surface2);
            root.style.setProperty('--bg', p.bg);



            // Update highlights
            const opts = document.querySelectorAll('#preset-grid .theme-opt');
            opts.forEach(opt => {
                if (opt.getAttribute('onclick').includes(`'${preset}'`)) {
                    opt.classList.add('active');
                } else {
                    opt.classList.remove('active');
                }
            });

            // Update panel border
            document.getElementById('settings-panel').style.borderColor = p.accent;
            document.getElementById('axon-panel').style.borderColor = p.accent;

            // Update mountain colors to match preset
            document.querySelectorAll('.mountain-range').forEach(m => {
                const hue = preset === 'vulcan' ? 320 : preset === 'toxic' ? 120 : preset === 'synthwave' ? 280 : 0;
                const br = p.bg === '#000000' ? 0.3 : 1;
                m.style.filter = `hue-rotate(${hue}deg) brightness(${br})`;
            });

            localStorage.setItem('atmos-preset', preset);
            showToast('🌌 Global Preset: ' + preset.toUpperCase());

            // CRITICAL FIX: If user has a specific accent selected, re-apply it so it doesn't get lost
            const currentAccent = localStorage.getItem('atmos-theme');
            if(currentAccent) {
                // Use setTimeout to ensure preset variables are fully set before overriding again
                setTimeout(() => applyColorTheme(currentAccent), 10);
            }
        }

        function resetTheme() {
            localStorage.removeItem('atmos-preset');
            localStorage.removeItem('atmos-theme');
            localStorage.removeItem('atmos-chip-style');

            // Apply default Cyberpunk preset
            const defaultBtn = document.querySelector('#preset-grid .theme-opt');
            if (defaultBtn) defaultBtn.click();

            // Reset advanced sliders
            if(blurSlider) { blurSlider.value = 20; blurSlider.dispatchEvent(new Event('input')); }
            if(particleSlider) { particleSlider.value = 200; particleSlider.dispatchEvent(new Event('input')); }
            if(holoToggle) { holoToggle.checked = false; holoToggle.dispatchEvent(new Event('change')); }

            showToast('🔄 UI Reset to Cyberpunk Default');
        }

        // Load saved themes
        const savedPreset = localStorage.getItem('atmos-preset');

        const savedAccent = localStorage.getItem('atmos-theme');

        window.addEventListener('load', () => {
            setTimeout(() => {
                if (savedPreset) {
                    const opts = document.querySelectorAll('#preset-grid .theme-opt');
                    opts.forEach(opt => {
                        if (opt.getAttribute('onclick').includes(`'${savedPreset}'`)) {
                             // Temporarily disable toast to avoid double toast on load
                             const oldToast = window.showToast;
                             window.showToast = () => {};
                             opt.click();
                             window.showToast = oldToast;
                        }
                    });
                }
                
                // Always apply accent after preset if it exists
                if (savedAccent) {
                    const opts = document.querySelectorAll('#settings-panel .theme-grid:last-of-type .theme-opt');
                    opts.forEach(opt => {
                        if (opt.getAttribute('onclick').includes(`'${savedAccent}'`)) {
                             const oldToast = window.showToast;
                             window.showToast = () => {};
                             opt.click();
                             window.showToast = oldToast;
                        }
                    });
                }
            }, 400);
        });

        document.getElementById('settings-btn').addEventListener('click', toggleSettings);




        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                document.getElementById('axon-panel').classList.remove('show');
                document.getElementById('axon-btn').classList.remove('open');
                document.getElementById('settings-panel').classList.remove('show');
            }
        });
    
        // --- ENVIRONMENT SANDBOX LOGIC ---
        const timeSelect = document.getElementById('time-select');
        const weatherSelect = document.getElementById('weather-select');

        function updateFromSandbox() {
            let isNight = false;
            let code = 0;
            
            const tVal = timeSelect.value;
            if (tVal === 'night' || tVal === 'evening') isNight = true;
            else if (tVal === 'day' || tVal === 'morning') isNight = false;
            else if (typeof weatherData !== 'undefined' && weatherData && weatherData.current) isNight = !weatherData.current.is_day;

            const wVal = weatherSelect.value;
            if (wVal === 'clear') code = 0;
            else if (wVal === 'clouds') code = 3;
            else if (wVal === 'mist') code = 45;
            else if (wVal === 'rain') code = 61;
            else if (wVal === 'snow') code = 71;
            else if (wVal === 'thunderstorm') code = 95;
            else if (typeof weatherData !== 'undefined' && weatherData && weatherData.current) code = weatherData.current.weather_code;

            if (typeof applyTheme === 'function') {
                applyTheme(code, isNight);
            }
        }

        if(timeSelect) timeSelect.addEventListener('change', updateFromSandbox);
        if(weatherSelect) weatherSelect.addEventListener('change', updateFromSandbox);
        // --- ADVANCED VISUAL CUSTOMIZATION ---
        const blurSlider = document.getElementById('blur-slider');
        const blurValText = document.getElementById('blur-val');
        const particleSlider = document.getElementById('particle-slider');
        const particleValText = document.getElementById('particle-val');
        const holoToggle = document.getElementById('holo-toggle');
        const holoLayer = document.getElementById('holo-layer');

        if(blurSlider) {
            blurSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                blurValText.textContent = val + 'px';
                document.documentElement.style.setProperty('--blur-val', val + 'px');
                // Apply directly to cards/header
                document.querySelectorAll('.card, header').forEach(el => {
                    el.style.backdropFilter = `blur(${val}px)`;
                    el.style.webkitBackdropFilter = `blur(${val}px)`;
                });
            });
        }

        if(particleSlider) {
            particleSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                // Update global particle count if engine supports it
                window.maxParticles = parseInt(val);
                if(typeof initParticles === 'function') initParticles();
            });
        }

        if(holoToggle) {
            holoToggle.addEventListener('change', (e) => {
                if(e.target.checked) holoLayer.classList.add('active');
                else holoLayer.classList.remove('active');
            });
        }

        // --- MOUNTAIN PARALLAX ENGINE ---
        const backRange = document.getElementById('back-range');
        const midRange = document.getElementById('mid-range');
        const frontRange = document.getElementById('front-range');

        window.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
            const y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1

            if(backRange) backRange.style.transform = 	ranslate(px, px);
            if(midRange) midRange.style.transform = 	ranslate(px, px);
            if(frontRange) frontRange.style.transform = 	ranslate(px, px);
        });
