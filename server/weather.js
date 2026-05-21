export function parseWeatherCode(code) {
  if (code === 0) return '맑음';
  if (code <= 3) return '구름 조금';
  if (code <= 48) return '흐림';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  return '흐림';
}

export async function fetchWeather(city) {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ko&format=json`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return null;

    const { latitude, longitude } = geoData.results[0];
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,precipitation_probability&timezone=auto`
    );
    const weatherData = await weatherRes.json();
    const current = weatherData.current;

    return {
      temperature: Math.round(current.temperature_2m),
      condition: parseWeatherCode(current.weathercode),
      precipitationProbability: current.precipitation_probability ?? 0,
    };
  } catch {
    return null;
  }
}
