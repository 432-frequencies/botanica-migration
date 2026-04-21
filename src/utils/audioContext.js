/**
 * Audio Context Enrichment System for W1LD
 * Collects environmental and temporal context to improve
 * bioacoustic identification accuracy
 */

/**
 * Determine time of day category
 * @param {Date} date
 * @returns {Object} Time category and label
 */
export function getTimeOfDay(date = new Date()) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeDecimal = hours + minutes / 60;

  // Sunrise/sunset approximations (can be refined with solar calculations)
  const summerSunrise = 6;
  const summerSunset = 21;
  const winterSunrise = 8;
  const winterSunset = 17;

  const month = date.getMonth();
  const isSummer = month >= 4 && month <= 8; // May-September

  const sunrise = isSummer ? summerSunrise : winterSunrise;
  const sunset = isSummer ? summerSunset : winterSunset;

  let category, label, description;

  if (timeDecimal < sunrise - 1) {
    category = "night";
    label = "Nuit profonde";
    description = "Nocturne";
  } else if (timeDecimal < sunrise + 1) {
    category = "dawn";
    label = "Aube";
    description = "Crépuscule matinal";
  } else if (timeDecimal < 12) {
    category = "morning";
    label = "Matinée";
    description = "Diurne";
  } else if (timeDecimal < 18) {
    category = "afternoon";
    label = "Après-midi";
    description = "Diurne";
  } else if (timeDecimal < sunset + 1) {
    category = "dusk";
    label = "Crépuscule";
    description = "Crépuscule vespéral";
  } else {
    category = "night";
    label = "Nuit";
    description = "Nocturne";
  }

  return {
    category,
    label,
    description,
    hour: hours,
    formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  };
}

/**
 * Determine current season (Northern Hemisphere)
 * @param {Date} date
 * @returns {Object} Season information
 */
export function getSeason(date = new Date()) {
  const month = date.getMonth(); // 0-11
  const day = date.getDate();

  let season, label, description;

  if ((month === 11 && day >= 21) || month === 0 || month === 1 || (month === 2 && day < 20)) {
    season = "winter";
    label = "Hiver";
    description = "Période hivernale - activité réduite, migrations";
  } else if ((month === 2 && day >= 20) || month === 3 || month === 4 || (month === 5 && day < 21)) {
    season = "spring";
    label = "Printemps";
    description = "Période de reproduction - chants nuptiaux intenses";
  } else if ((month === 5 && day >= 21) || month === 6 || month === 7 || (month === 8 && day < 22)) {
    season = "summer";
    label = "Été";
    description = "Été - jeunes éclos, chants territoriaux";
  } else {
    season = "autumn";
    label = "Automne";
    description = "Automne - préparation hivernale, migrations";
  }

  return {
    season,
    label,
    description,
    month: month + 1
  };
}

/**
 * Determine biogeographic region from coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Object} Region information
 */
export function getBiogeographicRegion(latitude, longitude) {
  if (!latitude || !longitude) {
    return {
      region: "unknown",
      label: "Région inconnue",
      description: "Localisation non disponible"
    };
  }

  // Simple regional classification for Europe/France
  // Can be expanded for global coverage

  let region, label, description;

  // France métropolitaine
  if (latitude >= 41 && latitude <= 51 && longitude >= -5 && longitude <= 8) {
    if (latitude >= 48.5) {
      region = "northern_france";
      label = "Nord de la France";
      description = "Climat océanique, faune tempérée";
    } else if (longitude >= 4) {
      region = "eastern_france";
      label = "Est de la France";
      description = "Climat continental, influences alpines";
    } else if (latitude <= 44) {
      region = "mediterranean";
      label = "Méditerranée";
      description = "Climat méditerranéen, faune méridionale";
    } else {
      region = "central_france";
      label = "Centre de la France";
      description = "Climat tempéré, transition océanique-continental";
    }
  }
  // Benelux
  else if (latitude >= 49 && latitude <= 54 && longitude >= 2 && longitude <= 7) {
    region = "benelux";
    label = "Benelux";
    description = "Climat océanique, zones humides";
  }
  // Iberian Peninsula
  else if (latitude >= 36 && latitude <= 44 && longitude >= -9 && longitude <= 3) {
    region = "iberia";
    label = "Péninsule ibérique";
    description = "Climat méditerranéen à atlantique";
  }
  // Alps
  else if (latitude >= 44 && latitude <= 48 && longitude >= 5 && longitude <= 13) {
    region = "alps";
    label = "Alpes";
    description = "Faune montagnarde, altitude";
  }
  // Central Europe
  else if (latitude >= 47 && latitude <= 55 && longitude >= 7 && longitude <= 16) {
    region = "central_europe";
    label = "Europe centrale";
    description = "Climat continental";
  }
  // Northern Europe
  else if (latitude >= 55 && latitude <= 70 && longitude >= -10 && longitude <= 30) {
    region = "northern_europe";
    label = "Europe du Nord";
    description = "Climat boréal, taïga";
  }
  // Mediterranean
  else if (latitude >= 35 && latitude <= 45 && longitude >= 8 && longitude <= 20) {
    region = "mediterranean";
    label = "Méditerranée";
    description = "Climat méditerranéen";
  }
  // North Africa
  else if (latitude >= 25 && latitude <= 37 && longitude >= -10 && longitude <= 10) {
    region = "north_africa";
    label = "Afrique du Nord";
    description = "Climat méditerranéen à désertique";
  }
  // Default to temperate
  else {
    region = "temperate";
    label = "Zone tempérée";
    description = "Climat tempéré";
  }

  return {
    region,
    label,
    description,
    coordinates: {
      latitude: Math.round(latitude * 100) / 100,
      longitude: Math.round(longitude * 100) / 100
    }
  };
}

/**
 * Get habitat type from location (simplified - could be enhanced with land cover data)
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string} Habitat description
 */
export function getHabitatHint(latitude, longitude) {
  // This is a simplified version
  // In production, you could use OpenStreetMap/land cover APIs

  const region = getBiogeographicRegion(latitude, longitude);

  const habitatHints = {
    mediterranean: "Probable : maquis, garrigue, forêt méditerranéenne",
    alps: "Probable : forêt de montagne, prairie alpine",
    northern_europe: "Probable : forêt boréale, tourbière",
    northern_france: "Probable : bocage, forêt tempérée, zones humides",
    central_france: "Probable : bocage, forêt mixte, prairie",
    eastern_france: "Probable : forêt mixte, montagne",
    temperate: "Probable : forêt tempérée, prairie"
  };

  return habitatHints[region.region] || "Habitat varié";
}

/**
 * Fetch weather data (optional - requires API key)
 * Using Open-Meteo (free, no API key required)
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Object>} Weather data
 */
export async function getWeatherData(latitude, longitude) {
  if (!latitude || !longitude) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    );

    if (!response.ok) {
      throw new Error("Weather API failed");
    }

    const data = await response.json();
    const current = data.current_weather;

    return {
      temperature: Math.round(current.temperature),
      windSpeed: Math.round(current.windspeed),
      weatherCode: current.weathercode,
      description: getWeatherDescription(current.weathercode)
    };
  } catch (error) {
    console.warn("Weather fetch failed:", error);
    return null;
  }
}

/**
 * Convert WMO weather code to description
 */
function getWeatherDescription(code) {
  const codes = {
    0: "Ciel dégagé",
    1: "Principalement dégagé",
    2: "Partiellement nuageux",
    3: "Couvert",
    45: "Brouillard",
    48: "Brouillard givrant",
    51: "Bruine légère",
    53: "Bruine modérée",
    55: "Bruine dense",
    61: "Pluie légère",
    63: "Pluie modérée",
    65: "Pluie forte",
    71: "Neige légère",
    73: "Neige modérée",
    75: "Neige forte",
    80: "Averses légères",
    81: "Averses modérées",
    82: "Averses violentes",
    95: "Orage"
  };

  return codes[code] || "Conditions variables";
}

/**
 * Collect all environmental context
 * @param {number} latitude
 * @param {number} longitude
 * @param {boolean} includeWeather - Whether to fetch weather (slower)
 * @returns {Promise<Object>} Complete environmental context
 */
export async function collectEnvironmentalContext(latitude, longitude, includeWeather = false) {
  const timeOfDay = getTimeOfDay();
  const season = getSeason();
  const region = getBiogeographicRegion(latitude, longitude);
  const habitatHint = getHabitatHint(latitude, longitude);

  let weather = null;
  if (includeWeather && latitude && longitude) {
    weather = await getWeatherData(latitude, longitude);
  }

  return {
    timeOfDay,
    season,
    region,
    habitatHint,
    weather,
    timestamp: new Date().toISOString()
  };
}

/**
 * Format context for Gemini prompt
 * @param {Object} context - Environmental context
 * @returns {string} Formatted context string
 */
export function formatContextForPrompt(context) {
  let formatted = `
Contexte d'observation :
- Heure : ${context.timeOfDay.formatted} (${context.timeOfDay.description})
- Saison : ${context.season.label} (${context.season.description})
- Région : ${context.region.label} (${context.region.description})
- Habitat probable : ${context.habitatHint}`;

  if (context.weather) {
    formatted += `\n- Météo : ${context.weather.description}, ${context.weather.temperature}°C`;
  }

  return formatted.trim();
}

/**
 * Suggest optimal sound type based on context
 * @param {Object} context
 * @returns {string} Suggested sound type ('bird', 'insect', 'amphibian')
 */
export function suggestSoundType(context) {
  const { timeOfDay, season } = context;

  // Night-time: likely insects or amphibians
  if (timeOfDay.category === "night" || timeOfDay.category === "dusk") {
    // Spring/summer night: amphibians likely
    if (season.season === "spring" || season.season === "summer") {
      return "amphibian";
    }
    return "insect";
  }

  // Dawn/morning: birds very active
  if (timeOfDay.category === "dawn" || timeOfDay.category === "morning") {
    return "bird";
  }

  // Day: birds
  if (timeOfDay.category === "afternoon") {
    return "bird";
  }

  // Default
  return "auto";
}

/**
 * Get activity expectations for a sound type based on context
 * @param {string} soundType
 * @param {Object} context
 * @returns {Object} Activity expectations
 */
export function getActivityExpectations(soundType, context) {
  const { timeOfDay, season } = context;

  if (soundType === "bird") {
    let activity = "modérée";
    let confidence = "moyenne";

    if (timeOfDay.category === "dawn" || timeOfDay.category === "morning") {
      activity = "très élevée";
      confidence = "haute";
    } else if (season.season === "spring") {
      activity = "élevée (période de reproduction)";
      confidence = "haute";
    } else if (timeOfDay.category === "night") {
      activity = "faible (sauf rapaces nocturnes)";
      confidence = "faible";
    }

    return { activity, confidence };
  }

  if (soundType === "insect") {
    let activity = "modérée";
    let confidence = "moyenne";

    if (timeOfDay.category === "night" || timeOfDay.category === "dusk") {
      activity = "élevée";
      confidence = "haute";
    } else if (season.season === "summer") {
      activity = "très élevée";
      confidence = "haute";
    } else if (season.season === "winter") {
      activity = "faible à nulle";
      confidence = "très faible";
    }

    return { activity, confidence };
  }

  if (soundType === "amphibian") {
    let activity = "modérée";
    let confidence = "moyenne";

    if (timeOfDay.category === "night" || timeOfDay.category === "dusk") {
      if (season.season === "spring") {
        activity = "très élevée (période de reproduction)";
        confidence = "très haute";
      } else {
        activity = "élevée";
        confidence = "haute";
      }
    } else if (season.season === "winter") {
      activity = "nulle (hibernation)";
      confidence = "nulle";
    }

    return { activity, confidence };
  }

  return { activity: "variable", confidence: "moyenne" };
}
