const API_BASE = "http://localhost:5000";
const PROTECTED_PAGES = ["dashboard.html", "map.html", "sos.html", "report.html", "history.html", "Contacts.html", "settings.html", "profile.html", "fake-call.html", "transportation.html"];
const SETTINGS_KEY = "appSettings";
const ZONE_COLORS = {
  safe: "#16a34a",
  moderate: "#f59e0b",
  danger: "#dc2626"
};
const TRANSLATIONS = {
  en: {
    "settings.languageLabel": "App Language",
    "settings.languageCopy": "Choose the language used in the main safety screens",
    "settings.fakeCall": "Open Fake Call",
    "map.routeTitle": "Safe Route Navigation",
    "map.routeScore": "Route score",
    "map.routeStatus": "Status",
    "map.routeButton": "Generate Safe Route",
    "fakeCall.title": "Fake Call",
    "fakeCall.badge": "QUICK COVER",
    "fakeCall.heading": "Create a realistic incoming call",
    "fakeCall.copy": "Use this screen to trigger a believable fake call when you need a quick reason to step away.",
    "fakeCall.callerLabel": "Caller Name",
    "fakeCall.callerPlaceholder": "Who should call you?",
    "fakeCall.delayLabel": "Delay",
    "fakeCall.delayNow": "Call now",
    "fakeCall.delay10": "In 10 seconds",
    "fakeCall.delay30": "In 30 seconds",
    "fakeCall.start": "Start Fake Call",
    "fakeCall.ready": "Ready when you are.",
    "fakeCall.incoming": "Incoming call",
    "fakeCall.phoneLabel": "Mobile",
    "fakeCall.decline": "Decline",
    "fakeCall.answer": "Answer"
  },
  hi: {
    "settings.languageLabel": "ऐप भाषा",
    "settings.languageCopy": "मुख्य सुरक्षा स्क्रीन के लिए भाषा चुनें",
    "settings.fakeCall": "फेक कॉल खोलें",
    "map.routeTitle": "सेफ रूट नेविगेशन",
    "map.routeScore": "रूट स्कोर",
    "map.routeStatus": "स्थिति",
    "map.routeButton": "सेफ रूट बनाएं",
    "fakeCall.title": "फेक कॉल",
    "fakeCall.badge": "QUICK COVER",
    "fakeCall.heading": "एक वास्तविक इनकमिंग कॉल बनाएं",
    "fakeCall.copy": "जब आपको तुरंत किसी बहाने की ज़रूरत हो, तब यह स्क्रीन एक भरोसेमंद फेक कॉल दिखाती है।",
    "fakeCall.callerLabel": "कॉलर का नाम",
    "fakeCall.callerPlaceholder": "कौन आपको कॉल करे?",
    "fakeCall.delayLabel": "देरी",
    "fakeCall.delayNow": "अभी कॉल",
    "fakeCall.delay10": "10 सेकंड में",
    "fakeCall.delay30": "30 सेकंड में",
    "fakeCall.start": "फेक कॉल शुरू करें",
    "fakeCall.ready": "जब चाहें तैयार है।",
    "fakeCall.incoming": "इनकमिंग कॉल",
    "fakeCall.phoneLabel": "मोबाइल",
    "fakeCall.decline": "काटें",
    "fakeCall.answer": "उठाएं"
  }
};

let map;
let marker;
let destinationMarker = null;
let zoneLayers = [];
let currentCoords = null;
let userCoords = null;
let sosTimer;
let reportMap;
let reportMarker;
let liveShareInterval = null;
let lastShareLink = "";
let uploadedEvidence = [];
let nearbyServiceLayers = [];
let routeLayer = null;
let routeEndpointLayers = [];
let selectedDestination = null;
let lastRouteData = null;
let activeSafetyData = null;
let fakeCallTimeout = null;
let fakeCallTicker = null;
let fakeCallStartedAt = null;
let nearbyServicesCache = {};
let latestNearbyServicesRequestId = 0;
let googleLoginClientId = "";
let lastTransportPlan = null;
let tripCheckinTimer = null;
let tripCheckinDeadline = 0;
const REPORT_MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const REPORT_MAX_IMAGES = 4;

async function fetchWithTimeout(resource, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function currentPage() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function isProtectedPage() {
  return PROTECTED_PAGES.includes(currentPage());
}

function goToLogin() { window.location.href = "login.html"; }
function goHome() { window.location.href = "index.html"; }
function goToAbout() { window.location.href = "about.html"; }
function goToDashboard() { window.location.href = "dashboard.html"; }
function goToHistory() { window.location.href = "history.html"; }
function goToReport() { window.location.href = "report.html"; }
function goToContacts() { window.location.href = "Contacts.html"; }
function goToSOS() { window.location.href = "sos.html"; }
function goToSettings() { window.location.href = "settings.html"; }
function goToProfile() { window.location.href = "profile.html"; }
function goToTracking() { window.location.href = "map.html"; }
function goToFakeCall() { window.location.href = "fake-call.html"; }
function goToTransport() { window.location.href = "transportation.html"; }
function goBack() { window.history.back(); }
function goToSignup() { window.location.href = "signup.html"; }

function openRideMode(mode = "driving") {
  if (currentPage() !== "transportation.html") return;

  const destination = document.getElementById("transportDestination")?.value.trim();
  const statusEl = document.getElementById("transportStatus");

  if (!destination) {
    alert("Please enter a destination first.");
    return;
  }

  const modeValue = mode === "transit" ? "transit" : "driving";
  const modeLabel = modeValue === "transit" ? "public transit" : "cab route";

  const openUrl = origin => {
    const params = new URLSearchParams({
      api: "1",
      destination,
      travelmode: modeValue
    });

    if (origin?.lat && origin?.lon) {
      params.set("origin", `${origin.lat},${origin.lon}`);
    }

    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank");
    if (statusEl) statusEl.innerText = `Opening ${modeLabel} directions to ${destination}.`;
  };

  if (!navigator.geolocation) {
    openUrl(null);
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    openUrl({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude
    });
  }, () => {
    openUrl(null);
  }, { enableHighAccuracy: true, timeout: 6000 });
}

function findNearbyTransport() {
  if (currentPage() !== "transportation.html") return;

  const statusEl = document.getElementById("transportStatus");
  const query = "taxi stand or auto stand near me";

  const openNearbySearch = locationHint => {
    const fullQuery = locationHint ? `${query} ${locationHint}` : query;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`, "_blank");
    if (statusEl) statusEl.innerText = "Opening nearby taxi and auto stands.";
  };

  if (!navigator.geolocation) {
    openNearbySearch("");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    openNearbySearch(`${pos.coords.latitude},${pos.coords.longitude}`);
  }, () => {
    openNearbySearch("");
  }, { enableHighAccuracy: true, timeout: 6000 });
}

function initializeTransportationPage() {
  if (currentPage() !== "transportation.html") return;

  const input = document.getElementById("transportDestination");
  const statusEl = document.getElementById("transportStatus");
  const checkinStatusEl = document.getElementById("tripCheckinStatus");
  const user = getStoredUser();

  if (input && !input.value.trim()) {
    input.value = "";
  }

  if (statusEl) {
    statusEl.innerText = user?.fullName
      ? `Hi ${user.fullName}, choose a destination to start safe travel.`
      : "Ready to help you travel safely.";
  }

  if (checkinStatusEl) {
    if (tripCheckinTimer && tripCheckinDeadline > Date.now()) {
      const minsLeft = Math.max(1, Math.ceil((tripCheckinDeadline - Date.now()) / 60000));
      checkinStatusEl.innerText = `Reminder active. About ${minsLeft} minute(s) left.`;
    } else {
      checkinStatusEl.innerText = "No active check-in reminder.";
    }
  }
}

function getCurrentPositionSafe(options = {}) {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(pos => {
      resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      });
    }, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 7000,
      ...options
    });
  });
}

async function geocodeDestination(destination) {
  const res = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(destination)}`,
    {},
    7000
  );

  if (!res.ok) {
    throw new Error("Location search failed");
  }

  const data = await res.json();
  const top = data?.[0];
  if (!top) {
    throw new Error("Destination not found");
  }

  return {
    lat: Number(top.lat),
    lon: Number(top.lon),
    label: top.display_name || destination
  };
}

function buildRideOptions(distanceKm) {
  const minDistance = Math.max(1.2, distanceKm);
  const minuteBase = Math.max(8, Math.round(minDistance * 3.8));

  return [
    {
      id: "economy",
      title: "Economy Cab",
      eta: `${minuteBase + 4}-${minuteBase + 9} min`,
      fare: `Rs ${Math.round(45 + minDistance * 14)}-${Math.round(70 + minDistance * 18)}`
    },
    {
      id: "auto",
      title: "Auto",
      eta: `${minuteBase + 3}-${minuteBase + 8} min`,
      fare: `Rs ${Math.round(35 + minDistance * 10)}-${Math.round(55 + minDistance * 14)}`
    },
    {
      id: "premium",
      title: "Premium Cab",
      eta: `${minuteBase + 6}-${minuteBase + 12} min`,
      fare: `Rs ${Math.round(90 + minDistance * 21)}-${Math.round(130 + minDistance * 27)}`
    }
  ];
}

function getProviderLink(provider, transportPlan = {}, optionId = "economy") {
  const destinationLabel = transportPlan?.destination || "";
  const destination = transportPlan?.destinationCoords || {};
  const origin = transportPlan?.originCoords || {};

  if (provider === "uber") {
    const params = new URLSearchParams({
      action: "setPickup",
      pickup: "my_location"
    });

    if (destinationLabel) {
      params.set("dropoff[formatted_address]", destinationLabel);
      params.set("dropoff[nickname]", destinationLabel);
    }
    if (destination.lat && destination.lon) {
      params.set("dropoff[latitude]", String(destination.lat));
      params.set("dropoff[longitude]", String(destination.lon));
    }
    if (origin.lat && origin.lon) {
      params.set("pickup[latitude]", String(origin.lat));
      params.set("pickup[longitude]", String(origin.lon));
    }

    return `https://m.uber.com/ul/?${params.toString()}`;
  }

  if (provider === "ola") {
    const params = new URLSearchParams({
      pickup_name: "Current Location",
      dropoff_name: destinationLabel || "Destination",
      category: optionId
    });

    if (origin.lat && origin.lon) {
      params.set("pickup_lat", String(origin.lat));
      params.set("pickup_lng", String(origin.lon));
    }
    if (destination.lat && destination.lon) {
      params.set("drop_lat", String(destination.lat));
      params.set("drop_lng", String(destination.lon));
    }

    return `https://book.olacabs.com/?${params.toString()}`;
  }

  if (provider === "rapido") {
    if (destination.lat && destination.lon) {
      return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lon}&travelmode=driving`;
    }
    return "https://www.rapido.bike/";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationLabel || "destination")}`;
}

function renderTransportOptions(options) {
  const listEl = document.getElementById("transportOptionsList");
  if (!listEl) return;

  listEl.innerHTML = options.map(option => `
    <div class="transport-option-card">
      <div>
        <strong>${option.title}</strong>
        <p>ETA: ${option.eta}</p>
        <p>Estimated fare: ${option.fare}</p>
      </div>
      <div class="transport-provider-row">
        <button class="secondary-btn" type="button" onclick="bookRideOption('uber','${option.id}')">Book Uber</button>
        <button class="secondary-btn" type="button" onclick="bookRideOption('ola','${option.id}')">Book Ola</button>
        <button class="secondary-btn" type="button" onclick="bookRideOption('rapido','${option.id}')">Book Rapido</button>
      </div>
    </div>
  `).join("");
}

async function loadRideOptions() {
  if (currentPage() !== "transportation.html") return;

  const destination = document.getElementById("transportDestination")?.value.trim();
  const statusEl = document.getElementById("transportStatus");
  const distanceEl = document.getElementById("transportDistanceLabel");
  const listEl = document.getElementById("transportOptionsList");

  if (!destination) {
    alert("Please enter a destination first.");
    return;
  }

  if (statusEl) statusEl.innerText = "Checking route and fare estimates...";
  if (listEl) listEl.innerHTML = "<p class='empty-state'>Loading ride options...</p>";

  try {
    const [origin, target] = await Promise.all([
      getCurrentPositionSafe(),
      geocodeDestination(destination)
    ]);

    const distanceKm = origin
      ? calculateDistanceKm(origin.lat, origin.lon, target.lat, target.lon)
      : 6;

    const options = buildRideOptions(distanceKm);
    lastTransportPlan = {
      destination: target.label || destination,
      destinationCoords: {
        lat: target.lat,
        lon: target.lon
      },
      originCoords: origin ? { lat: origin.lat, lon: origin.lon } : null,
      optionMap: Object.fromEntries(options.map(item => [item.id, item]))
    };

    if (distanceEl) distanceEl.innerText = `Approx distance: ${distanceKm.toFixed(1)} km`;
    renderTransportOptions(options);
    if (statusEl) statusEl.innerText = `Showing options to ${target.label || destination}.`;
  } catch (error) {
    if (distanceEl) distanceEl.innerText = "Could not estimate distance right now.";
    if (listEl) listEl.innerHTML = "<p class='empty-state'>Could not load options. Please try again.</p>";
    if (statusEl) statusEl.innerText = error.message || "Unable to fetch ride options.";
  }
}

function bookRideOption(provider, optionId) {
  if (currentPage() !== "transportation.html") return;

  const statusEl = document.getElementById("transportStatus");
  const destinationInput = document.getElementById("transportDestination")?.value.trim();
  const destination = lastTransportPlan?.destination || destinationInput;

  if (!destination) {
    alert("Enter destination and load ride options first.");
    return;
  }

  const option = lastTransportPlan?.optionMap?.[optionId];
  const optionLabel = option?.title || "Ride";
  const url = getProviderLink(provider, {
    ...lastTransportPlan,
    destination,
    destinationCoords: lastTransportPlan?.destinationCoords
  }, optionId);
  window.open(url, "_blank");

  if (statusEl) {
    statusEl.innerText = `Opening ${provider.toUpperCase()} booking page for ${optionLabel}.`;
  }
}

function buildTripDetailsText() {
  const destinationInput = document.getElementById("transportDestination")?.value.trim();
  const destination = lastTransportPlan?.destination || destinationInput || "Not set";
  const distance = document.getElementById("transportDistanceLabel")?.innerText || "Distance not estimated";
  const optionSummary = lastTransportPlan?.optionMap
    ? Object.values(lastTransportPlan.optionMap)
      .map(item => `${item.title}: ${item.fare} (${item.eta})`)
      .join(" | ")
    : "Load ride options to see estimates.";

  return `Trip Plan
Destination: ${destination}
${distance}
Ride Options: ${optionSummary}
Live map link: https://maps.google.com/?q=${encodeURIComponent(destination)}`;
}

async function copyTripDetails() {
  if (currentPage() !== "transportation.html") return;
  const statusEl = document.getElementById("transportStatus");

  try {
    await copyText(buildTripDetailsText());
    if (statusEl) statusEl.innerText = "Trip details copied. Share with a trusted contact.";
  } catch {
    if (statusEl) statusEl.innerText = "Unable to copy trip details right now.";
  }
}

async function shareTripPlan() {
  if (currentPage() !== "transportation.html") return;
  const statusEl = document.getElementById("transportStatus");
  const details = buildTripDetailsText();

  try {
    if (navigator.share) {
      await navigator.share({
        title: "My Trip Plan",
        text: details
      });
      if (statusEl) statusEl.innerText = "Trip plan shared successfully.";
      return;
    }

    await copyText(details);
    if (statusEl) statusEl.innerText = "Share unavailable, trip details copied instead.";
  } catch {
    if (statusEl) statusEl.innerText = "Trip share was cancelled or unavailable.";
  }
}

function requestTripNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function startTripCheckinTimer() {
  if (currentPage() !== "transportation.html") return;

  const delayMins = Number(document.getElementById("tripCheckinDelay")?.value || 30);
  const statusEl = document.getElementById("tripCheckinStatus");
  const destination = document.getElementById("transportDestination")?.value.trim() || "your destination";

  stopTripCheckinTimer(true);
  requestTripNotificationPermission();

  tripCheckinDeadline = Date.now() + delayMins * 60 * 1000;
  tripCheckinTimer = setTimeout(() => {
    const message = `Safety check-in reminder: Are you safe on your way to ${destination}?`;
    alert(message);

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("PersonalSafety check-in", { body: message });
    }

    if (statusEl) statusEl.innerText = "Reminder sent. Start another timer if needed.";
    tripCheckinTimer = null;
    tripCheckinDeadline = 0;
  }, delayMins * 60 * 1000);

  if (statusEl) statusEl.innerText = `Check-in reminder set for ${delayMins} minutes.`;
}

function stopTripCheckinTimer(silent = false) {
  if (tripCheckinTimer) {
    clearTimeout(tripCheckinTimer);
    tripCheckinTimer = null;
  }
  tripCheckinDeadline = 0;

  if (!silent && currentPage() === "transportation.html") {
    const statusEl = document.getElementById("tripCheckinStatus");
    if (statusEl) statusEl.innerText = "Check-in reminder stopped.";
  }
}

function saveMapIntent(intent) {
  sessionStorage.setItem("mapIntent", JSON.stringify(intent));
}

function readMapIntent() {
  try {
    return JSON.parse(sessionStorage.getItem("mapIntent")) || null;
  } catch {
    return null;
  }
}

function clearMapIntent() {
  sessionStorage.removeItem("mapIntent");
}

function saveSOSIntent(intent) {
  sessionStorage.setItem("sosIntent", intent);
}

function readSOSIntent() {
  return sessionStorage.getItem("sosIntent");
}

function clearSOSIntent() {
  sessionStorage.removeItem("sosIntent");
}

function getToken() {
  return localStorage.getItem("token");
}

function getStoredUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem("userProfile")) || {};
    const email = parsed.email || localStorage.getItem("userEmail") || "";
    const fallbackName = localStorage.getItem("userName") || "";
    const derivedName = email ? email.split("@")[0] : "";
    const fullName = parsed.fullName && parsed.fullName !== "User"
      ? parsed.fullName
      : fallbackName || derivedName || "User";

    const normalized = {
      id: parsed.id || "",
      fullName,
      email,
      phone: parsed.phone || ""
    };

    if (!normalized.email && fullName === "User" && !normalized.phone) {
      return null;
    }

    return normalized;
  } catch {
    const email = localStorage.getItem("userEmail") || "";
    const fallbackName = localStorage.getItem("userName") || "";
    if (!email && !fallbackName) return null;

    return {
      id: "",
      fullName: fallbackName || (email ? email.split("@")[0] : "User"),
      email,
      phone: ""
    };
  }
}

function getAppSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
      locationReminder: true,
      safetyAlerts: true,
      liveSharing: true,
      darkMode: false,
      language: "en"
    };
  } catch {
    return {
      locationReminder: true,
      safetyAlerts: true,
      liveSharing: true,
      darkMode: false,
      language: "en"
    };
  }
}

function saveAppSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applyTheme() {
  const settings = getAppSettings();
  document.documentElement.setAttribute("data-theme", settings.darkMode ? "dark" : "light");
  document.documentElement.lang = settings.language || "en";
}

function getLanguage() {
  return getAppSettings().language || "en";
}

function t(key) {
  const language = getLanguage();
  return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.innerText = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
}

function storeUserProfile(user) {
  if (!user) return;
  const normalized = {
    id: user.id || user._id || "",
    username: user.username || localStorage.getItem("userUsername") || "",
    fullName: user.fullName || localStorage.getItem("userName") || "User",
    email: user.email || localStorage.getItem("userEmail") || "",
    phone: user.phone || ""
  };
  localStorage.setItem("userProfile", JSON.stringify(normalized));
  localStorage.setItem("userEmail", normalized.email);
  localStorage.setItem("userName", normalized.fullName);
  localStorage.setItem("userUsername", normalized.username);
}

function checkAuth() {
  if (!isProtectedPage()) return true;

  const token = getToken();
  if (!token) {
    alert("Please login first");
    goToLogin();
    return false;
  }

  return true;
}

const PASSWORD_RULES = {
  length: value => value.length >= 8,
  uppercase: value => /[A-Z]/.test(value),
  lowercase: value => /[a-z]/.test(value),
  number: value => /\d/.test(value),
  special: value => /[^A-Za-z0-9]/.test(value)
};

function getPasswordRuleState(password = "") {
  return Object.fromEntries(
    Object.entries(PASSWORD_RULES).map(([key, test]) => [key, test(password)])
  );
}

function getPasswordStrength(password = "") {
  const metCount = Object.values(getPasswordRuleState(password)).filter(Boolean).length;

  if (!password) {
    return { score: 0, width: "0%", label: "Strength: Too weak", color: "var(--danger)" };
  }

  if (metCount <= 2) {
    return { score: metCount, width: "32%", label: "Strength: Weak", color: "var(--danger)" };
  }

  if (metCount === 3 || metCount === 4) {
    return { score: metCount, width: "68%", label: "Strength: Medium", color: "var(--moderate)" };
  }

  return { score: metCount, width: "100%", label: "Strength: Strong", color: "var(--safe)" };
}

function isStrongPassword(password = "") {
  return Object.values(getPasswordRuleState(password)).every(Boolean);
}

function updatePasswordCriteria(inputId, criteriaId) {
  const input = document.getElementById(inputId);
  const criteria = document.getElementById(criteriaId);
  if (!input || !criteria) return;

  const state = getPasswordRuleState(input.value || "");
  criteria.querySelectorAll("[data-rule]").forEach(item => {
    item.classList.toggle("met", !!state[item.dataset.rule]);
  });
}

function updatePasswordStrength(inputId, strengthId) {
  const input = document.getElementById(inputId);
  const strength = document.getElementById(strengthId);
  if (!input || !strength) return;

  const fill = strength.querySelector(".password-strength-fill");
  const label = strength.querySelector(".password-strength-label");
  if (!fill || !label) return;

  const status = getPasswordStrength(input.value || "");
  fill.style.width = status.width;
  fill.style.backgroundColor = status.color;
  label.innerText = status.label;
}

function initializePasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;

      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.innerText = showing ? "Show" : "Hide";
    });
  });
}

function initializePasswordCriteria() {
  const bindings = [
    ["signupPassword", "signupPasswordCriteria", "signupPasswordStrength"]
  ];

  bindings.forEach(([inputId, criteriaId, strengthId]) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("input", () => {
      updatePasswordCriteria(inputId, criteriaId);
      updatePasswordStrength(inputId, strengthId);
    });
    updatePasswordCriteria(inputId, criteriaId);
    updatePasswordStrength(inputId, strengthId);
  });
}

function completeLogin(data, identifier = "") {
  localStorage.setItem("token", data.token);

  const fallbackUser = (() => {
    const idValue = (identifier || "").trim();
    const isEmail = idValue.includes("@");
    return {
      fullName: isEmail ? idValue.split("@")[0] : idValue || "User",
      email: isEmail ? idValue.toLowerCase() : "",
      phone: ""
    };
  })();

  storeUserProfile(data.user || fallbackUser);
  alert("Login successful");
  goToDashboard();
}

async function signupUser() {
  const fullName = document.getElementById("fullName")?.value.trim();
  const username = document.getElementById("username")?.value.trim();
  const email = document.getElementById("signupEmail")?.value.trim().toLowerCase();
  const phone = document.getElementById("phone")?.value.trim();
  const password = document.getElementById("signupPassword")?.value;
  const confirmPassword = document.getElementById("confirmPassword")?.value;

  if (!fullName || !username || !email || !password) {
    return alert("Please enter your name, username, email, and password");
  }

  if (!/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
    return alert("Username must be 3-20 characters and use only letters, numbers, dots, or underscores.");
  }

  if (password !== confirmPassword) {
    return alert("Passwords do not match");
  }

  if (!isStrongPassword(password)) {
    return alert("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.");
  }

  try {
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, username, email, phone, password })
    });

    const data = await res.json();

    if (res.ok) {
      const emailMessage = data.emailNotification === "sent"
        ? " Welcome email sent."
        : data.emailNotification === "failed"
          ? " Account created, but the welcome email could not be sent."
          : "";
      alert("Signup successful." + emailMessage);
      goToLogin();
    } else {
      alert(data.message || "Signup failed");
    }
  } catch {
    alert("Backend error");
  }
}

async function loginUser() {
  const identifier = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!identifier || !password) return alert("Please enter your email or username and password");

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });

    const data = await res.json();

    if (res.ok) {
      completeLogin(data, identifier);
    } else {
      alert(data.message || "Login failed");
    }
  } catch {
    alert("Server error");
  }
}

async function initializeGoogleLogin() {
  const buttonContainer = document.getElementById("googleLoginButton");
  const hint = document.getElementById("googleLoginHint");
  if (!buttonContainer || !window.google?.accounts?.id) return;

  try {
    const res = await fetch(`${API_BASE}/auth/google/config`);
    const data = await res.json();

    if (!res.ok || !data.enabled || !data.clientId) {
      if (hint) hint.innerText = "Google sign-in is not configured yet.";
      return;
    }

    googleLoginClientId = data.clientId;
    window.google.accounts.id.initialize({
      client_id: googleLoginClientId,
      callback: handleGoogleCredential
    });

    window.google.accounts.id.renderButton(buttonContainer, {
      theme: "outline",
      size: "large",
      shape: "pill",
      width: 320,
      text: "continue_with"
    });

    if (hint) hint.innerText = "Use your Google account to sign in instantly.";
  } catch {
    if (hint) hint.innerText = "Google sign-in is unavailable right now.";
  }
}

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    return alert("Google sign-in did not return a valid credential.");
  }

  try {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();

    if (res.ok) {
      completeLogin(data);
    } else {
      alert(data.message || "Google login failed");
    }
  } catch {
    alert("Server error");
  }
}

function logout() {
  localStorage.clear();
  goToLogin();
}

async function fetchProfile() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: token }
    });

    if (!res.ok) return getStoredUser();

    const user = await res.json();
    storeUserProfile(user);
    return user;
  } catch {
    return getStoredUser();
  }
}

async function saveProfile() {
  const token = getToken();
  if (!token) {
    goToLogin();
    return;
  }

  const fullName = document.getElementById("editProfileName")?.value.trim();
  const phone = document.getElementById("editProfilePhone")?.value.trim();

  if (!fullName) {
    alert("Please enter your full name");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({ fullName, phone })
    });

    const raw = await res.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { message: raw };
    }

    if (!res.ok) {
      const message = data.message || `Unable to save profile (HTTP ${res.status})`;
      if (res.status === 404 || res.status === 405) {
        const fallbackUser = {
          ...getStoredUser(),
          fullName,
          phone: phone || ""
        };
        storeUserProfile(fallbackUser);
        initializeSettingsPage();
        initializeProfilePage();
        renderGreeting();
        alert("Profile saved locally. Backend profile route is not available yet.");
      } else {
        alert(message);
      }
      return;
    }

    storeUserProfile(data.user || data);
    initializeSettingsPage();
    initializeProfilePage();
    renderGreeting();
    alert("Profile updated successfully");
  } catch (error) {
    console.error(error);
    alert("Could not reach the backend. Make sure http://localhost:5000 is running, then try again.");
  }
}

function renderGreeting() {
  const user = getStoredUser();
  const welcomeEl = document.getElementById("welcomeUser");

  if (welcomeEl && user?.fullName) {
    welcomeEl.innerText = `Welcome back, ${user.fullName}`;
  }
}

function openZoneDetails(status) {
  saveMapIntent({ type: "zone", status });
  goToTracking();
}

function openLiveShareFromDashboard() {
  saveMapIntent({ type: "share" });
  goToTracking();
}

function activateSOSFromDashboard() {
  saveSOSIntent("auto-send");
  goToSOS();
}

function getStatusLabel(status) {
  const labels = {
    en: {
      safe: "Safe",
      moderate: "Caution",
      danger: "Risky",
      waiting: "Waiting"
    },
    hi: {
      safe: "सुरक्षित",
      moderate: "सावधानी",
      danger: "जोखिम",
      waiting: "प्रतीक्षा"
    }
  };

  return labels[getLanguage()]?.[status] || labels.en[status] || status;
}

function buildSafetyNotice(score, status) {
  if (getLanguage() === "hi") {
    if (status === "safe") return `यह क्षेत्र अभी ${score}/100 स्कोर के साथ सुरक्षित दिख रहा है।`;
    if (status === "moderate") return `यह क्षेत्र ${score}/100 स्कोर के साथ सावधानी मांगता है।`;
    return `यह क्षेत्र अभी ${score}/100 स्कोर के साथ जोखिमपूर्ण दिख रहा है।`;
  }

  if (status === "safe") return `This area looks safe right now with a live score of ${score}/100.`;
  if (status === "moderate") return `This area needs caution with a live score of ${score}/100.`;
  return `This area is risky right now with a live score of ${score}/100.`;
}

async function loadContacts() {
  const token = getToken();
  const list = document.getElementById("contactsList");
  if (!list || !token) return;

  try {
    const res = await fetch(`${API_BASE}/contacts`, {
      headers: { Authorization: token }
    });

    const contacts = await res.json();
    list.innerHTML = "";

    if (!Array.isArray(contacts) || contacts.length === 0) {
      list.innerHTML = `<p class="empty-state">No contacts saved yet.</p>`;
      return;
    }

    contacts.forEach(contact => {
      list.innerHTML += `
        <div class="contact-card">
          <div class="contact-left">
            <div class="contact-avatar">${(contact.name || "?").charAt(0).toUpperCase()}</div>
            <div class="contact-info">
              <h4>${contact.name || "Unnamed contact"}</h4>
              <p>${contact.phone || "No phone number"}</p>
              <span class="contact-tag">${contact.tag || "general"}</span>
            </div>
          </div>
          <div class="contact-actions">
            <button onclick="deleteContact('${contact._id}')">🗑️</button>
          </div>
        </div>
      `;
    });
  } catch {
    list.innerHTML = "<p class='empty-state'>Failed to load contacts.</p>";
  }
}

async function addContactPrompt() {
  const name = prompt("Name:");
  const phone = prompt("Phone:");
  const tag = prompt("Relation or tag:", "emergency");
  if (!name || !phone) return;

  await fetch(`${API_BASE}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken()
    },
    body: JSON.stringify({ name, phone, tag })
  });

  loadContacts();
}

async function deleteContact(id) {
  await fetch(`${API_BASE}/contacts/${id}`, {
    method: "DELETE",
    headers: { Authorization: getToken() }
  });

  loadContacts();
}

function startSOS() {
  const status = document.getElementById("sosStatus");
  if (status) status.innerText = "Hold for 2 seconds...";

  sosTimer = setTimeout(() => {
    if (status) status.innerText = "Sending SOS...";
    activateSOS();
  }, 2000);
}

function cancelSOS() {
  clearTimeout(sosTimer);
}

async function activateSOS() {
  const token = getToken();
  if (!token) return goToLogin();

  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;

    try {
      const res = await fetch(`${API_BASE}/sos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        },
        body: JSON.stringify({ lat, lon })
      });

      const data = await res.json();
      const statusEl = document.getElementById("sosStatus");
      const resultsEl = document.getElementById("sosResults");

      if (data.results?.length) {
        if (statusEl) {
          statusEl.innerText = `SOS processed for ${data.results.length} emergency contact(s).`;
        }

        if (resultsEl) {
          resultsEl.innerHTML = data.results.map(result => `
            <div class="sos-result-item">
              <strong>${result.phone}</strong>
              <span>${result.status}</span>
              ${result.whatsapp ? `<button class="secondary-btn compact-btn" onclick="openWhatsAppLink('${result.whatsapp}')">Open WhatsApp</button>` : ""}
            </div>
          `).join("");
        }
      } else if (data.message) {
        if (statusEl) statusEl.innerText = data.message;
        alert(data.message);
        return;
      }

      alert("SOS sent");
    } catch (err) {
      console.error(err);
      alert("SOS failed");
    }
  }, () => {
    alert("Please allow location access");
  });
}

function openWhatsAppLink(link) {
  window.open(link, "_blank");
}

function initializeLeafletMap(mapId, lat, lon, zoom = 15) {
  if (typeof L === "undefined") return null;

  const target = document.getElementById(mapId);
  if (!target) return null;

  if (map) {
    map.remove();
  }

  map = L.map(mapId).setView([lat, lon], zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 300);
  return map;
}

function createUserMarker(lat, lon, popupText = "📍 You are here") {
  if (!map || typeof L === "undefined") return;

  if (marker) {
    marker.setLatLng([lat, lon]).bindPopup(popupText);
  } else {
    marker = L.marker([lat, lon]).addTo(map).bindPopup(popupText);
  }

  marker.openPopup();
}

function createDestinationMarker(lat, lon, popupText = "📍 Destination") {
  if (!map || typeof L === "undefined") return;

  if (destinationMarker) {
    destinationMarker
      .setLatLng([lat, lon])
      .bindPopup(popupText)
      .bindTooltip(popupText, { permanent: true, direction: "top", offset: [0, -14] });
  } else {
    destinationMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup(popupText)
      .bindTooltip(popupText, { permanent: true, direction: "top", offset: [0, -14] });
  }
}

async function fetchLocationDetails(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const data = await res.json();

    const shortName =
      data.address?.neighbourhood ||
      data.address?.suburb ||
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.display_name ||
      "Current location";

    return {
      shortName,
      fullName: data.display_name || shortName
    };
  } catch {
    return {
      shortName: "Current location",
      fullName: "Current location"
    };
  }
}

function clearZoneLayers() {
  zoneLayers.forEach(layer => map?.removeLayer(layer));
  zoneLayers = [];
}

function clearNearbyServiceLayers() {
  nearbyServiceLayers.forEach(layer => map?.removeLayer(layer));
  nearbyServiceLayers = [];
}

function clearRouteLayer() {
  if (routeLayer) {
    map?.removeLayer(routeLayer);
    routeLayer = null;
  }

  routeEndpointLayers.forEach(layer => map?.removeLayer(layer));
  routeEndpointLayers = [];
}

function clearDestinationMarker() {
  if (destinationMarker) {
    map?.removeLayer(destinationMarker);
    destinationMarker = null;
  }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRadians = value => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function getNearbyServicesCacheKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function renderNearbyServicesLoading() {
  const servicesBar = document.getElementById("servicesBar");
  const countLabel = document.getElementById("servicesCountLabel");
  if (!servicesBar) return;

  if (countLabel) {
    countLabel.innerText = "Loading...";
  }

  servicesBar.innerHTML = "<p class='empty-state'>Loading nearby police, hospitals, and pharmacies...</p>";
}

function renderAreaSearchResults(results) {
  const resultsEl = document.getElementById("areaSearchResults");
  if (!resultsEl) return;

  if (!results?.length) {
    resultsEl.innerHTML = "";
    window.__areaSearchMatches = [];
    return;
  }

  window.__areaSearchMatches = results;
  resultsEl.innerHTML = results.map((result, index) => `
    <button type="button" class="area-search-option" onclick="selectAreaLocation(${index})">
      <strong>Option ${index + 1}</strong>
      <span>${result.display_name}</span>
    </button>
  `).join("");
}

function getRouteOrigin() {
  return userCoords || currentCoords;
}

function pickBestSearchResult(results) {
  if (!Array.isArray(results) || !results.length) return null;

  const origin = userCoords || currentCoords;
  if (!origin) return results[0];

  return results
    .map(result => ({
      ...result,
      distanceFromUser: calculateDistanceKm(
        origin.lat,
        origin.lon,
        parseFloat(result.lat),
        parseFloat(result.lon)
      )
    }))
    .sort((a, b) => a.distanceFromUser - b.distanceFromUser)[0];
}

function buildLocalSearchUrl(query) {
  const origin = userCoords || currentCoords;
  if (!origin) return null;

  const lonMin = origin.lon - 0.25;
  const lonMax = origin.lon + 0.25;
  const latMin = origin.lat - 0.2;
  const latMax = origin.lat + 0.2;

  return `https://nominatim.openstreetmap.org/search?format=json&limit=8&bounded=1&viewbox=${lonMin},${latMax},${lonMax},${latMin}&q=${encodeURIComponent(query)}`;
}

function scoreToStatus(score) {
  if (score >= 76) return "safe";
  if (score >= 51) return "moderate";
  return "danger";
}

function getZoneMeta(status) {
  const zoneMeta = {
    safe: {
      name: "Community Safe Zone",
      description: "Higher public activity, better lighting, and support access nearby."
    },
    moderate: {
      name: "Transit Caution Zone",
      description: "Moderate traffic and mixed visibility. Stay aware during late hours."
    },
    danger: {
      name: "High Alert Zone",
      description: "Lower visibility and fewer support points. Avoid alone if possible."
    }
  };

  return zoneMeta[status] || zoneMeta.moderate;
}

function createFallbackNearbyServices(lat, lon) {
  return [
    {
      lat: lat + 0.008,
      lon: lon - 0.006,
      tags: {
        amenity: "police",
        phone: "Number unavailable"
      }
    },
    {
      lat: lat - 0.005,
      lon: lon + 0.004,
      tags: {
        amenity: "hospital",
        phone: "Number unavailable"
      }
    },
    {
      lat: lat + 0.003,
      lon: lon + 0.007,
      tags: {
        amenity: "pharmacy",
        phone: "Number unavailable"
      }
    },
    {
      lat: lat - 0.007,
      lon: lon - 0.003,
      tags: {
        amenity: "hospital",
        phone: "Number unavailable"
      }
    }
  ];
}

async function enrichServiceNames(services) {
  const enriched = await Promise.all(services.map(async service => {
    if (service.tags?.name) {
      return service;
    }

    try {
      const location = await fetchLocationDetails(service.lat, service.lon);

      return {
        ...service,
        tags: {
          ...service.tags,
          name: location.fullName || location.shortName || "Unnamed place"
        }
      };
    } catch {
      return service;
    }
  }));

  return enriched;
}

function updateRouteCard(route) {
  const destinationEl = document.getElementById("routeDestinationLabel");
  const scoreEl = document.getElementById("routeScoreValue");
  const statusEl = document.getElementById("routeStatusValue");
  const noteEl = document.getElementById("routeSafetyNote");
  const distanceEl = document.getElementById("routeDistanceLabel");
  const actionBtn = document.getElementById("safeRouteBtn");
  if (!destinationEl || !scoreEl || !statusEl || !noteEl || !distanceEl) return;

  if (!route) {
    destinationEl.innerText = getLanguage() === "hi"
      ? "गंतव्य खोजें ताकि सुरक्षित रूट प्रीव्यू दिख सके।"
      : "Search for a destination to preview a safer route.";
    scoreEl.innerText = "--/100";
    scoreEl.style.color = "";
    statusEl.innerText = getStatusLabel("waiting");
    statusEl.style.color = "";
    noteEl.innerText = getLanguage() === "hi"
      ? "हम बताएंगे कि यह रूट सुरक्षित, सावधानी वाला, या जोखिमपूर्ण है।"
      : "We will show whether the route feels safe, moderate, or risky.";
    distanceEl.innerText = getStatusLabel("waiting");
    if (actionBtn) actionBtn.innerText = t("map.routeButton");
    return;
  }

  destinationEl.innerText = route.destinationName;
  scoreEl.innerText = `${route.score}/100`;
  scoreEl.style.color = ZONE_COLORS[route.status];
  statusEl.innerText = getStatusLabel(route.status);
  statusEl.style.color = ZONE_COLORS[route.status];
  noteEl.innerText = route.note;
  distanceEl.innerText = `${formatDistance(route.distanceKm)} • ${route.etaMinutes} min`;
  if (actionBtn) {
    actionBtn.innerText = route.status === "danger"
      ? (getLanguage() === "hi" ? "ज्यादा सुरक्षित रास्ता खोजें" : "Find Safer Option")
      : route.status === "moderate"
        ? (getLanguage() === "hi" ? "सुरक्षित विकल्प सुधारें" : "Improve Route Safety")
        : (getLanguage() === "hi" ? "रूट रीफ्रेश करें" : "Refresh Route");
  }
}

function renderSafeRoute(route) {
  if (!map || typeof L === "undefined") return;

  clearRouteLayer();

  routeLayer = L.polyline(route.points, {
    color: ZONE_COLORS[route.status],
    weight: 6,
    opacity: 0.88,
    lineCap: "round"
  }).addTo(map);

  routeLayer.bindPopup(`
    <strong>${route.destinationName}</strong><br>
    Route score: ${route.score}/100<br>
    Status: ${getStatusLabel(route.status)}<br>
    ETA: ${route.etaMinutes} min
  `);

  const origin = getRouteOrigin();
  if (origin) {
    const startMarker = L.marker([origin.lat, origin.lon]).addTo(map).bindPopup(`
      <strong>Start</strong><br>
      Your route begins here.
    `);
    routeEndpointLayers.push(startMarker);
  }

  const endMarker = L.marker([route.destination.lat, route.destination.lon]).addTo(map).bindPopup(`
    <strong>Destination</strong><br>
    ${route.destinationName}
  `);
  routeEndpointLayers.push(endMarker);

  map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
}

function buildRoutePath(start, destination, status) {
  const offsetLat = status === "danger" ? 0.004 : status === "moderate" ? 0.0025 : 0.0015;
  const offsetLon = status === "safe" ? -0.0025 : 0.002;
  const midLat = (start.lat + destination.lat) / 2 + offsetLat;
  const midLon = (start.lon + destination.lon) / 2 + offsetLon;

  return [
    [start.lat, start.lon],
    [midLat, midLon],
    [destination.lat, destination.lon]
  ];
}

function buildAlternativeRoutePath(start, destination, variant = 0) {
  const configs = [
    { latA: 0.005, lonA: -0.004, latB: 0.002, lonB: -0.005 },
    { latA: -0.004, lonA: 0.005, latB: -0.002, lonB: 0.006 },
    { latA: 0.006, lonA: 0.002, latB: 0.004, lonB: -0.004 }
  ];
  const picked = configs[variant % configs.length];
  const stepOne = [
    start.lat + (destination.lat - start.lat) * 0.35 + picked.latA,
    start.lon + (destination.lon - start.lon) * 0.35 + picked.lonA
  ];
  const stepTwo = [
    start.lat + (destination.lat - start.lat) * 0.7 + picked.latB,
    start.lon + (destination.lon - start.lon) * 0.7 + picked.lonB
  ];

  return [
    [start.lat, start.lon],
    stepOne,
    stepTwo,
    [destination.lat, destination.lon]
  ];
}

function buildRouteNote(status, isAlternative, scoreGain = 0) {
  if (getLanguage() === "hi") {
    if (isAlternative) {
      return scoreGain > 0
        ? `यह वैकल्पिक रास्ता भीड़भाड़ और सेवाओं वाले इलाकों से होकर जाता है। सुरक्षा स्कोर ${scoreGain} अंक बेहतर हुआ है।`
        : "यह वैकल्पिक रास्ता थोड़ा सुरक्षित है और अधिक सक्रिय इलाकों को प्राथमिकता देता है।";
    }
    if (status === "safe") return "यह रूट अभी सुरक्षित दिख रहा है। फिर भी अच्छी रोशनी और भीड़ वाली सड़कों को प्राथमिकता दें।";
    if (status === "moderate") return "यह रूट ठीक है, लेकिन कुछ हिस्सों में सावधानी रखें और लाइव शेयर चालू रखें।";
    return "यह रूट जोखिमपूर्ण है। Generate Safe Route दबाने पर हम ज्यादा सुरक्षित विकल्प खोजेंगे।";
  }

  if (isAlternative) {
    return scoreGain > 0
      ? `This alternative route stays closer to active roads and improves the route safety score by ${scoreGain} points.`
      : "This alternative route favors more active roads and nearby services.";
  }
  if (status === "safe") return "This route looks safe right now. Still prefer well-lit and active streets.";
  if (status === "moderate") return "This route is usable, but keep caution in some stretches and keep live sharing on.";
  return "This route looks risky. Tap Generate Safe Route and we will try a safer detour.";
}

async function generateSafeRoute(destination = selectedDestination, preferAlternative = false) {
  const origin = getRouteOrigin();
  if (!origin || !destination) {
    updateRouteCard(null);
    return;
  }

  const [originSafety, destinationSafety] = await Promise.all([
    activeSafetyData ? Promise.resolve(activeSafetyData) : fetchSafetyZones(origin.lat, origin.lon),
    fetchSafetyZones(destination.lat, destination.lon)
  ]);

  const distanceKm = calculateDistanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const rawScore = Math.round(originSafety.safetyIndex * 0.45 + destinationSafety.safetyIndex * 0.55 - Math.min(distanceKm * 2.5, 12));
  const score = Math.max(18, Math.min(96, rawScore));
  const status = scoreToStatus(score);

  let route = {
    destinationName: destination.name,
    destination,
    score,
    status,
    distanceKm,
    etaMinutes: Math.max(3, Math.round(distanceKm / 0.45)),
    note: buildRouteNote(status, false),
    points: buildRoutePath(origin, destination, status),
    isAlternative: false
  };

  if (preferAlternative && route.status !== "safe") {
    const alternatives = [0, 1, 2].map(index => {
      const extraDistanceFactor = 1.1 + index * 0.06;
      const saferScore = Math.min(96, route.score + 12 + index * 4);
      const saferStatus = scoreToStatus(saferScore);
      const saferDistance = route.distanceKm * extraDistanceFactor;

      return {
        destinationName: destination.name,
        destination,
        score: saferScore,
        status: saferStatus,
        distanceKm: saferDistance,
        etaMinutes: Math.max(4, Math.round(saferDistance / 0.45)),
        note: buildRouteNote(saferStatus, true, saferScore - route.score),
        points: buildAlternativeRoutePath(origin, destination, index),
        isAlternative: true
      };
    });

    const saferChoice = alternatives.sort((a, b) => b.score - a.score)[0];
    if (saferChoice.score > route.score) {
      route = saferChoice;
    }
  }

  lastRouteData = route;
  updateRouteCard(route);
  renderSafeRoute(route);
}

async function buildSafeRouteToSearch() {
  if (!selectedDestination) {
    alert(getLanguage() === "hi" ? "पहले कोई स्थान खोजें।" : "Search for a destination first.");
    return;
  }

  await generateSafeRoute(selectedDestination, true);
  toggleMapSheet(false);
}

function selectPriorityServices(services) {
  const origin = userCoords || currentCoords;
  if (!origin) return services.slice(0, 4);

  const normalized = services
    .filter(service => service?.lat && service?.lon)
    .map(service => ({
      ...service,
      distanceKm: calculateDistanceKm(origin.lat, origin.lon, service.lat, service.lon)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const unique = normalized.filter((service, index, array) => {
    const name = service.tags?.name || `${service.tags?.amenity || "service"}-${service.lat}-${service.lon}`;
    return array.findIndex(item => (item.tags?.name || `${item.tags?.amenity || "service"}-${item.lat}-${item.lon}`) === name) === index;
  });

  const picks = [];
  const preferredTypes = ["police", "hospital", "pharmacy"];

  preferredTypes.forEach(type => {
    const match = unique.find(service =>
      service.tags?.amenity === type &&
      !picks.some(picked => picked.lat === service.lat && picked.lon === service.lon)
    );
    if (match) picks.push(match);
  });

  unique.forEach(service => {
    if (picks.length >= 4) return;
    const alreadyPicked = picks.some(picked => picked.lat === service.lat && picked.lon === service.lon);
    if (!alreadyPicked) {
      picks.push(service);
    }
  });

  return picks.slice(0, 4);
}

function createFallbackZones(lat, lon) {
  const safeScore = Math.round(Math.max(18, Math.min(96, 58 + Math.sin(lat * 5.4) * 22 + Math.cos(lon * 7.1) * 14)));
  const moderateScore = Math.round(Math.max(18, Math.min(96, 52 + Math.sin((lat + lon) * 4.3) * 18 - Math.cos(lon * 3.6) * 11)));
  const dangerScore = Math.round(Math.max(18, Math.min(96, 46 - Math.cos(lat * 4.8) * 20 + Math.sin(lon * 5.2) * 13)));
  const overall = Math.round((safeScore + moderateScore + dangerScore) / 3);
  const firstStatus = scoreToStatus(safeScore);
  const secondStatus = scoreToStatus(moderateScore);
  const thirdStatus = scoreToStatus(dangerScore);
  const firstMeta = getZoneMeta(firstStatus);
  const secondMeta = getZoneMeta(secondStatus);
  const thirdMeta = getZoneMeta(thirdStatus);

  return {
    safetyIndex: overall,
    status: scoreToStatus(overall),
    zones: [
      {
        id: "safe-zone",
        name: firstMeta.name,
        status: firstStatus,
        safetyScore: safeScore,
        center: [lat + 0.0035, lon - 0.002],
        radius: 280,
        description: firstMeta.description
      },
      {
        id: "moderate-zone",
        name: secondMeta.name,
        status: secondStatus,
        safetyScore: moderateScore,
        center: [lat - 0.0025, lon + 0.003],
        radius: 240,
        description: secondMeta.description
      },
      {
        id: "danger-zone",
        name: thirdMeta.name,
        status: thirdStatus,
        safetyScore: dangerScore,
        center: [lat + 0.001, lon + 0.005],
        radius: 220,
        description: thirdMeta.description
      }
    ]
  };
}

async function fetchSafetyZones(lat, lon) {
  const token = getToken();

  try {
    const res = await fetchWithTimeout(`${API_BASE}/safety-zones?lat=${lat}&lon=${lon}`, {
      headers: { Authorization: token }
    }, 4500);

    if (!res.ok) throw new Error("Backend unavailable");
    return await res.json();
  } catch (error) {
    console.warn("Using fallback safety zones:", error.message);
    return createFallbackZones(lat, lon);
  }
}

async function fetchNearbyServices(lat, lon) {
  const cacheKey = getNearbyServicesCacheKey(lat, lon);
  if (nearbyServicesCache[cacheKey]) {
    return nearbyServicesCache[cacheKey];
  }

  const query = `
    [out:json][timeout:20];
    (
      nwr["amenity"="police"](around:3500,${lat},${lon});
      nwr["amenity"="hospital"](around:3500,${lat},${lon});
      nwr["amenity"="pharmacy"](around:3500,${lat},${lon});
    );
    out center;
  `;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        body: query
      }, 5000);

      if (!res.ok) continue;
      const text = await res.text();
      if (text.startsWith("<")) continue;

      const data = JSON.parse(text);
      const normalizedServices = (data.elements || []).map(service => ({
        ...service,
        lat: service.lat ?? service.center?.lat,
        lon: service.lon ?? service.center?.lon
      })).filter(service => service.lat && service.lon);
      nearbyServicesCache[cacheKey] = await enrichServiceNames(normalizedServices);
      return nearbyServicesCache[cacheKey];
    } catch (error) {
      console.warn("Nearby services endpoint failed:", endpoint, error.message);
    }
  }

  const fallback = await enrichServiceNames(createFallbackNearbyServices(lat, lon));
  nearbyServicesCache[cacheKey] = fallback;
  return fallback;
}

function renderZoneOverlays(data) {
  if (!map || typeof L === "undefined") return;

  clearZoneLayers();

  data.zones.forEach(zone => {
    const layer = L.circle(zone.center, {
      color: ZONE_COLORS[zone.status],
      fillColor: ZONE_COLORS[zone.status],
      fillOpacity: 0.28,
      radius: zone.radius,
      weight: 2
    }).addTo(map);

    layer.zoneId = zone.id;
    layer.zoneStatus = zone.status;

    layer.bindPopup(`
      <strong>${zone.name}</strong><br>
      Status: ${zone.status}<br>
      Safety score: ${zone.safetyScore}/100<br>
      ${zone.description}
    `);

    zoneLayers.push(layer);
    zone.layer = layer;
  });
}

function renderNearbyServices(services) {
  const servicesBar = document.getElementById("servicesBar");
  const countLabel = document.getElementById("servicesCountLabel");
  if (!servicesBar) return;

  const filteredServices = selectPriorityServices(services);

  if (countLabel) {
    countLabel.innerText = `${filteredServices.length} places`;
  }

  if (!filteredServices.length) {
    servicesBar.innerHTML = "<p class='empty-state'>No nearby police, hospitals, or pharmacies found.</p>";
    clearNearbyServiceLayers();
    return;
  }

  servicesBar.innerHTML = filteredServices.map((service, index) => {
    const amenity = service.tags?.amenity || "service";
    const phone = service.tags?.phone || service.tags?.["contact:phone"] || "Number unavailable";
    const name = service.tags?.name || `${amenity.charAt(0).toUpperCase()}${amenity.slice(1)} nearby`;
    const emoji = amenity === "police" ? "👮" : amenity === "hospital" ? "🏥" : "💊";
    const typeLabel = amenity === "police" ? "Police Station" : amenity === "hospital" ? "Hospital" : "Pharmacy";
    const distanceLabel = service.distanceKm ? `${service.distanceKm.toFixed(1)} km away` : "Nearby";

    return `
      <div class="service-pill" onclick="focusServiceOnMap(${index})">
        <div class="service-pill-top">
          <strong>${emoji} ${name}</strong>
          <small>${typeLabel}</small>
        </div>
        <small class="service-distance">${distanceLabel}</small>
        <span>${phone}</span>
      </div>
    `;
  }).join("");

  clearNearbyServiceLayers();

  filteredServices.forEach((service, index) => {
    if (!service.lat || !service.lon || !map || typeof L === "undefined") return;

    const amenity = service.tags?.amenity || "service";
    const phone = service.tags?.phone || service.tags?.["contact:phone"] || "Number unavailable";
    const name = service.tags?.name || `${amenity.charAt(0).toUpperCase()}${amenity.slice(1)} nearby`;
    const emoji = amenity === "police" ? "👮" : amenity === "hospital" ? "🏥" : "💊";

    const layer = L.marker([service.lat, service.lon]).addTo(map).bindPopup(`
      <strong>${emoji} ${name}</strong><br>
      Type: ${amenity}<br>
      Phone: ${phone}
    `);

    layer.serviceIndex = index;
    nearbyServiceLayers.push(layer);
  });
}

function focusServiceOnMap(index) {
  const layer = nearbyServiceLayers.find(item => item.serviceIndex === index);
  if (!layer) return;
  map.setView(layer.getLatLng(), 16);
  layer.openPopup();
}

function updateSafetyUI(score, status = "moderate") {
  const scoreEl = document.getElementById("safetyScore");
  const labelEl = document.getElementById("safetyLabel");
  const noticeEl = document.getElementById("mapSafetyNotice");
  const dashboardScoreEl = document.getElementById("dashboardSafetyScore");
  const dashboardLabelEl = document.getElementById("dashboardSafetyLabel");

  const label = status === "safe"
    ? getLanguage() === "hi" ? "सुरक्षित क्षेत्र" : "Safe Area"
    : status === "moderate"
      ? getLanguage() === "hi" ? "मध्यम जोखिम" : "Moderate Risk"
      : getLanguage() === "hi" ? "उच्च जोखिम क्षेत्र" : "High Risk Area";
  const notice = buildSafetyNotice(score, status);

  [scoreEl, dashboardScoreEl].forEach(el => {
    if (!el) return;
    el.innerText = `${score}/100`;
    el.style.color = ZONE_COLORS[status];
  });

  if (labelEl) labelEl.innerText = label;
  if (noticeEl) noticeEl.innerText = notice;
  if (dashboardLabelEl) {
    dashboardLabelEl.innerText = getLanguage() === "hi"
      ? `आपके आसपास ${label}`
      : `${label} around your current area`;
  }
}

function renderZoneList(data) {
  const list = document.getElementById("zoneList");
  const label = document.getElementById("zoneCountLabel");
  const preview = document.getElementById("dashboardZonePreview");
  const counts = { safe: 0, moderate: 0, danger: 0 };

  data.zones.forEach(zone => { counts[zone.status] += 1; });

  if (document.getElementById("safeZoneCount")) {
    document.getElementById("safeZoneCount").innerText = counts.safe;
    document.getElementById("moderateZoneCount").innerText = counts.moderate;
    document.getElementById("dangerZoneCount").innerText = counts.danger;
  }

  if (label) {
    label.innerText = `${data.zones.length} zones`;
  }

  if (preview) {
    preview.innerHTML = data.zones.map(zone => `
      <div class="zone-preview-item zone-${zone.status}" onclick="event.stopPropagation(); openZoneDetails('${zone.status}')">
        <strong>${zone.name}</strong>
        <span>${zone.safetyScore}/100</span>
      </div>
    `).join("");
  }

  if (!list) return;

  list.innerHTML = data.zones.map(zone => `
    <div class="zone-item clickable-item" onclick="focusZoneOnMap('${zone.id}')">
      <div class="zone-status-mark" style="background:${ZONE_COLORS[zone.status]}"></div>
      <div class="zone-item-content">
        <div class="zone-item-head">
          <h4>${zone.name}</h4>
          <span>${zone.safetyScore}/100</span>
        </div>
        <p>${zone.description}</p>
      </div>
    </div>
  `).join("");
}

function focusZoneOnMap(zoneId) {
  const matchingLayer = zoneLayers.find(layer => layer.zoneId === zoneId || layer.zoneStatus === zoneId);

  if (matchingLayer) {
    map.fitBounds(matchingLayer.getBounds(), { padding: [30, 30] });
    matchingLayer.openPopup();
  }
}

async function applySafetyData(lat, lon) {
  currentCoords = { lat, lon };
  const data = await fetchSafetyZones(lat, lon);
  activeSafetyData = data;
  updateSafetyUI(data.safetyIndex, data.status);
  renderZoneList(data);
  renderZoneOverlays(data);
  if (selectedDestination) {
    await generateSafeRoute(selectedDestination);
  } else {
    updateRouteCard(lastRouteData);
  }
  handlePendingMapIntent();

  const cacheKey = getNearbyServicesCacheKey(lat, lon);
  if (nearbyServicesCache[cacheKey]) {
    renderNearbyServices(nearbyServicesCache[cacheKey]);
  } else {
    renderNearbyServicesLoading();
  }

  const requestId = ++latestNearbyServicesRequestId;
  fetchNearbyServices(lat, lon)
    .then(services => {
      if (requestId !== latestNearbyServicesRequestId) return;
      renderNearbyServices(services);
    })
    .catch(() => {
      if (requestId !== latestNearbyServicesRequestId) return;
      renderNearbyServices([]);
    });
}

async function updateLocationName(lat, lon) {
  const location = await fetchLocationDetails(lat, lon);
  const el = document.getElementById("locationName");
  if (el) el.innerText = `📍 ${location.shortName}`;
  return location;
}

async function showLocationOnMap(lat, lon, popupText, options = {}) {
  if (!map) return;
  const { asUserLocation = false, refreshAreaData = false } = options;
  map.setView([lat, lon], 15);
  const location = await fetchLocationDetails(lat, lon);

  if (asUserLocation) {
    await updateLocationName(lat, lon);
    createUserMarker(lat, lon, popupText || `📍 ${location.shortName}`);
  } else {
    createDestinationMarker(lat, lon, popupText || `📍 ${location.shortName}`);
  }

  if (refreshAreaData) {
    await applySafetyData(lat, lon);
  }
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined" || currentPage() !== "map.html") return;

  if (!navigator.geolocation) {
    alert("Geolocation is not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    userCoords = { lat, lon };

    initializeLeafletMap("map", lat, lon);
    await showLocationOnMap(lat, lon, "", { asUserLocation: true, refreshAreaData: true });
  }, async () => {
    const lat = 23.0225;
    const lon = 72.5714;
    userCoords = { lat, lon };
    initializeLeafletMap("map", lat, lon, 13);
    await showLocationOnMap(lat, lon, "", { asUserLocation: true, refreshAreaData: true });
  });
}

async function fetchPlaceResults(query) {
  return fetchPlaceResultsWithOptions(query, { preferLocal: true });
}

function dedupePlaceResults(results) {
  const seen = new Set();
  return (results || []).filter(result => {
    const key = `${result.display_name}|${result.lat}|${result.lon}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parsePlaceSearchResponse(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizePhotonResults(payload) {
  if (!payload || !Array.isArray(payload.features)) return [];

  return payload.features
    .filter(feature => Array.isArray(feature.geometry?.coordinates))
    .map(feature => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const parts = [
        props.name,
        props.street,
        props.city,
        props.state,
        props.country
      ].filter(Boolean);

      return {
        lat: String(lat),
        lon: String(lon),
        display_name: parts.join(", ") || props.name || "Unnamed place"
      };
    });
}

async function fetchPlaceResultsWithOptions(query, options = {}) {
  const { preferLocal = true } = options;
  const localUrl = preferLocal ? buildLocalSearchUrl(query) : null;
  let data = [];

  if (localUrl) {
    try {
      const localRes = await fetchWithTimeout(localUrl, {}, 5000);
      if (localRes.ok) {
        const localText = await localRes.text();
        data = parsePlaceSearchResponse(localText);
      }
    } catch (error) {
      console.warn("Local place search failed:", error.message);
    }
  }

  if (!data.length) {
    try {
      const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=json&limit=10&q=${encodeURIComponent(query)}`, {}, 5000);
      if (res.ok) {
        const text = await res.text();
        data = parsePlaceSearchResponse(text);
      }
    } catch (error) {
      console.warn("Global place search failed:", error.message);
    }
  }

  if (!data.length) {
    try {
      const photonRes = await fetchWithTimeout(`https://photon.komoot.io/api/?limit=8&q=${encodeURIComponent(query)}`, {}, 6000);
      if (photonRes.ok) {
        const photonText = await photonRes.text();
        const photonJson = photonText ? JSON.parse(photonText) : null;
        data = normalizePhotonResults(photonJson);
      }
    } catch (error) {
      console.warn("Photon place search failed:", error.message);
    }
  }

  if (!data.length) {
    return null;
  }

  const deduped = dedupePlaceResults(data);
  return preferLocal ? pickBestSearchResult(deduped) : deduped[0];
}

async function fetchPlaceMatches(query, options = {}) {
  const { preferLocal = false } = options;
  const localUrl = preferLocal ? buildLocalSearchUrl(query) : null;
  let data = [];

  if (localUrl) {
    try {
      const localRes = await fetchWithTimeout(localUrl, {}, 5000);
      if (localRes.ok) {
        data = parsePlaceSearchResponse(await localRes.text());
      }
    } catch (error) {
      console.warn("Local match search failed:", error.message);
    }
  }

  if (!data.length) {
    try {
      const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=json&limit=10&q=${encodeURIComponent(query)}`, {}, 5000);
      if (res.ok) {
        data = parsePlaceSearchResponse(await res.text());
      }
    } catch (error) {
      console.warn("Global match search failed:", error.message);
    }
  }

  if (!data.length) {
    try {
      const photonRes = await fetchWithTimeout(`https://photon.komoot.io/api/?limit=8&q=${encodeURIComponent(query)}`, {}, 6000);
      if (photonRes.ok) {
        const photonText = await photonRes.text();
        const photonJson = photonText ? JSON.parse(photonText) : null;
        data = normalizePhotonResults(photonJson);
      }
    } catch (error) {
      console.warn("Photon match search failed:", error.message);
    }
  }

  return dedupePlaceResults(data).slice(0, 5);
}

function renderRouteSearchResults(results) {
  const resultsEl = document.getElementById("routeSearchResults");
  if (!resultsEl) return;

  if (!results?.length) {
    resultsEl.innerHTML = "";
    window.__routeSearchMatches = [];
    return;
  }

  window.__routeSearchMatches = results;
  resultsEl.innerHTML = results.map((result, index) => `
    <button type="button" class="route-search-option" onclick="selectRouteDestination(${index})">
      <strong>Option ${index + 1}</strong>
      <span>${result.display_name}</span>
    </button>
  `).join("");
}

async function selectRouteDestination(index) {
  const bestMatch = (window.__routeSearchMatches || [])[index];
  if (!bestMatch) return;

  const lat = parseFloat(bestMatch.lat);
  const lon = parseFloat(bestMatch.lon);
  selectedDestination = {
    lat,
    lon,
    name: bestMatch.display_name
  };
  renderRouteSearchResults([]);
  await showLocationOnMap(lat, lon, `📍 ${bestMatch.display_name}`, { asUserLocation: false, refreshAreaData: false });
  await generateSafeRoute(selectedDestination);
}

async function searchAreaLocation() {
  const query = document.getElementById("searchInput")?.value.trim();
  if (!query || !map) {
    return alert("Enter a location");
  }

  try {
    const matches = await fetchPlaceMatches(query, { preferLocal: true });
    if (!matches.length) {
      alert("Location not found");
      renderAreaSearchResults([]);
      return;
    }
    renderAreaSearchResults(matches);
    await selectAreaLocation(0);
  } catch (err) {
    console.error(err);
    alert("Location search failed. Please try again.");
  }
}

async function selectAreaLocation(index) {
  const bestMatch = (window.__areaSearchMatches || [])[index];
  if (!bestMatch) return;

  const lat = parseFloat(bestMatch.lat);
  const lon = parseFloat(bestMatch.lon);
  currentCoords = { lat, lon };
  clearDestinationMarker();
  renderAreaSearchResults([]);
  await showLocationOnMap(lat, lon, `📍 ${bestMatch.display_name}`, { asUserLocation: false, refreshAreaData: true });
}

async function searchRouteDestination() {
  const query = document.getElementById("routeSearchInput")?.value.trim();
  if (!query || !map) {
    return alert("Enter a destination");
  }

  try {
    const matches = await fetchPlaceMatches(query, { preferLocal: false });
    if (!matches.length) {
      alert("Destination not found");
      renderRouteSearchResults([]);
      return;
    }
    renderRouteSearchResults(matches);
    await selectRouteDestination(0);
  } catch (err) {
    console.error(err);
    alert("Search failed");
  }
}

function zoomIn() {
  if (map) map.zoomIn();
}

function zoomOut() {
  if (map) map.zoomOut();
}

function locateMe() {
  if (!navigator.geolocation || !map) return;

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    userCoords = { lat, lon };
    selectedDestination = null;
    lastRouteData = null;
    clearRouteLayer();
    clearDestinationMarker();
    updateRouteCard(null);
    await showLocationOnMap(lat, lon, "", { asUserLocation: true, refreshAreaData: true });
  });
}

function setShareStatus(message, link = "") {
  const statusEl = document.getElementById("liveShareStatus");
  const linkEl = document.getElementById("liveShareLink");

  if (statusEl) statusEl.innerText = message;
  if (linkEl) linkEl.innerText = link || "Your share link will appear here.";
}

function buildShareLink(lat, lon) {
  return `https://maps.google.com/?q=${lat},${lon}`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  document.body.appendChild(helper);
  helper.select();
  const success = document.execCommand("copy");
  document.body.removeChild(helper);
  return success;
}

async function shareCurrentLocation() {
  const locationToShare = userCoords || currentCoords;
  if (!locationToShare) {
    alert("Waiting for your location");
    return;
  }

  const shareLink = buildShareLink(locationToShare.lat, locationToShare.lon);
  lastShareLink = shareLink;
  setShareStatus("Location ready to share.", shareLink);

  try {
    if (navigator.share) {
      await navigator.share({
        title: "My live location",
        text: "Track my current location here:",
        url: shareLink
      });
    } else {
      await copyText(shareLink);
      alert("Live location link copied");
    }
  } catch (error) {
    console.warn("Share cancelled or unavailable:", error);
    try {
      await copyText(shareLink);
      alert("Live location link copied");
    } catch (copyError) {
      console.warn("Copy fallback failed:", copyError);
    }
  }
}

async function refreshLiveShareLink() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    userCoords = { lat, lon };
    currentCoords = { lat, lon };
    lastShareLink = buildShareLink(lat, lon);
    setShareStatus("Live sharing is active.", lastShareLink);

    if (map && currentPage() === "map.html") {
      await showLocationOnMap(lat, lon, "📍 Live shared location", { asUserLocation: true, refreshAreaData: true });
    }
  });
}

function stopLiveTracking() {
  if (liveShareInterval) {
    clearInterval(liveShareInterval);
    liveShareInterval = null;
  }

  const toggle = document.getElementById("liveToggle");
  if (toggle) toggle.checked = false;
  setShareStatus("Live sharing is off.", lastShareLink);
}

function startLiveTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported");
    return;
  }

  if (liveShareInterval) {
    clearInterval(liveShareInterval);
  }

  refreshLiveShareLink();
  liveShareInterval = setInterval(refreshLiveShareLink, 15000);
  setShareStatus("Live sharing is active.", lastShareLink);
}

function handleLiveToggle(event) {
  if (event.target.checked) {
    startLiveTracking();
  } else {
    stopLiveTracking();
  }
}

function safetyCheckIn() {
  const coords = userCoords || currentCoords;
  if (!coords) {
    alert("Location is still loading");
    return;
  }

  alert(`Safety check-in saved at ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`);
}

function toggleMapSheet(forceState) {
  const body = document.body;
  if (!body.classList.contains("map-body")) return;

  const shouldMinimize = typeof forceState === "boolean"
    ? forceState
    : !body.classList.contains("sheet-minimized");

  body.classList.toggle("sheet-minimized", shouldMinimize);

  const toggleBtn = document.getElementById("sheetToggleBtn");
  if (toggleBtn) {
    toggleBtn.innerText = shouldMinimize ? "Expand" : "Minimize";
  }

  const floatingToggle = document.getElementById("sheetFloatingToggle");
  if (floatingToggle) {
    floatingToggle.innerText = shouldMinimize ? "Expand" : "Minimize";
  }

  setTimeout(() => map?.invalidateSize(), 260);
}

function handlePendingMapIntent() {
  const intent = readMapIntent();
  if (!intent || currentPage() !== "map.html") return;

  if (intent.type === "share") {
    toggleMapSheet(false);
    shareCurrentLocation();
  }

  if (intent.type === "zone" && intent.status) {
    toggleMapSheet(false);
    focusZoneOnMap(intent.status);
  }

  clearMapIntent();
}

function initSOSMap() {
  const mapEl = document.querySelector(".sos-map");
  if (!mapEl || typeof L === "undefined") return;

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    initializeLeafletMap("map", lat, lon, 16);
    const location = await updateLocationName(lat, lon);
    createUserMarker(lat, lon, `📍 ${location.shortName}`);
  }, () => {
    mapEl.innerHTML = "<p class='empty-state'>Location preview unavailable.</p>";
  });
}

function renderEvidencePreview() {
  const preview = document.getElementById("evidencePreview");
  if (!preview) return;

  if (!uploadedEvidence.length) {
    preview.innerHTML = "";
    return;
  }

  preview.innerHTML = uploadedEvidence.map(file => `
    <div class="evidence-card">
      <img src="${file.dataUrl}" alt="${file.name}">
      <div class="evidence-meta">
        <strong>${file.name}</strong>
        <span>${Math.round(file.size / 1024)} KB</span>
      </div>
    </div>
  `).join("");
}

function initializeEvidenceUpload() {
  const input = document.getElementById("evidenceUpload");
  if (!input) return;

  input.addEventListener("change", async event => {
    const files = Array.from(event.target.files || []);
    uploadedEvidence = [];
    const acceptedFiles = [];
    const rejected = [];

    for (const file of files) {
      if (acceptedFiles.length >= REPORT_MAX_IMAGES) {
        rejected.push(`${file.name} (max ${REPORT_MAX_IMAGES} images allowed)`);
        continue;
      }

      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name} (not an image)`);
        continue;
      }

      if (file.size > REPORT_MAX_IMAGE_SIZE_BYTES) {
        rejected.push(`${file.name} (larger than 6MB)`);
        continue;
      }

      acceptedFiles.push(file);
    }

    for (const file of acceptedFiles) {

      const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = loadEvent => resolve(loadEvent.target?.result || "");
        reader.readAsDataURL(file);
      });

      uploadedEvidence.push({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl
      });
    }

    renderEvidencePreview();

    if (rejected.length) {
      alert(`Some files were skipped:\n- ${rejected.join("\n- ")}`);
    }

    if (!uploadedEvidence.length && files.length) {
      alert("No valid images selected. Use image files up to 6MB each.");
    }
  });
}

async function submitReport() {
  const type = document.querySelector("select")?.value;
  const description = document.querySelector("textarea")?.value.trim();
  const date = document.querySelector('input[type="date"]')?.value;
  const time = document.querySelector('input[type="time"]')?.value;
  const token = getToken();

  if (!type || type === "Select the type of incident" || !description) {
    alert("Please fill all fields");
    return;
  }

  if (!token) {
    alert("Please login first");
    goToLogin();
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const location = await fetchLocationDetails(lat, lon);

    try {
      const res = await fetch(`${API_BASE}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        },
        body: JSON.stringify({
          type,
          description,
          date,
          time,
          location: {
            lat,
            lon,
            name: location.fullName
          },
          evidence: uploadedEvidence.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: file.dataUrl
          }))
        })
      });

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { message: raw };
      }

      if (!res.ok) {
        alert(data.message || `Failed to submit report (HTTP ${res.status})`);
        return;
      }

      alert(data.message || "Report submitted successfully");
      uploadedEvidence = [];
      renderEvidencePreview();
    } catch (err) {
      console.error(err);
      alert("Could not reach backend. Make sure server is running on http://localhost:5000.");
    }
  }, () => {
    alert("Location access is required to submit a report.");
  });
}

function loadReportLocation() {
  if (!document.getElementById("reportMap") || typeof L === "undefined") return;

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const location = await fetchLocationDetails(lat, lon);
    const locationNameEl = document.getElementById("reportLocationName");
    if (locationNameEl) {
      locationNameEl.innerText = `📍 ${location.fullName}`;
    }

    if (reportMap) {
      reportMap.remove();
    }

    reportMap = L.map("reportMap").setView([lat, lon], 15);

    setTimeout(() => reportMap.invalidateSize(), 300);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(reportMap);

    reportMarker = L.marker([lat, lon]).addTo(reportMap).bindPopup(`📍 ${location.shortName}`).openPopup();
  }, () => {
    const reportMapEl = document.getElementById("reportMap");
    const locationNameEl = document.getElementById("reportLocationName");
    if (locationNameEl) {
      locationNameEl.innerText = "📍 Enable location access to detect your place name.";
    }
    if (reportMapEl) {
      reportMapEl.innerHTML = "<p class='empty-state'>Enable location access to preview the report map.</p>";
    }
  });
}

async function loadHistory() {
  const list = document.getElementById("historyList");
  const token = getToken();
  if (!list || !token) return;

  try {
    const res = await fetch(`${API_BASE}/history`, {
      headers: { Authorization: token }
    });
    const history = await res.json();

    if (!Array.isArray(history) || history.length === 0) {
      list.innerHTML = "<p class='empty-state'>No incident history yet.</p>";
      return;
    }

    list.innerHTML = history.map(item => `
      <div class="history-card">
        <h4>${item.title || "Safety Activity"}</h4>
        <p>${new Date(item.time).toLocaleString()}</p>
        <span>${item.description || "Recent account activity"}</span>
      </div>
    `).join("");
  } catch {
    list.innerHTML = "<p class='empty-state'>Failed to load history.</p>";
  }
}

function attachSearchEvents() {
  const searchInput = document.getElementById("searchInput");
  const routeSearchInput = document.getElementById("routeSearchInput");

  if (searchInput) {
    searchInput.addEventListener("keypress", event => {
      if (event.key === "Enter") {
        searchAreaLocation();
      }
    });
  }

  if (routeSearchInput) {
    routeSearchInput.addEventListener("keypress", event => {
      if (event.key === "Enter") {
        searchRouteDestination();
      }
    });
  }
}

function initializeMapControls() {
  const liveToggle = document.getElementById("liveToggle");
  if (liveToggle) {
    liveToggle.addEventListener("change", handleLiveToggle);
  }

  if (currentPage() === "map.html") {
    setShareStatus("Live sharing is off.");
    updateRouteCard(lastRouteData);
  }
}

function updateFakeCallClock() {
  const clockEl = document.getElementById("fakeCallClock");
  if (!clockEl || !fakeCallStartedAt) return;

  const seconds = Math.max(0, Math.floor((Date.now() - fakeCallStartedAt) / 1000));
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  clockEl.innerText = `${mins}:${secs}`;
}

function triggerIncomingCall(callerName) {
  const screen = document.getElementById("incomingCallScreen");
  const statusEl = document.getElementById("fakeCallStatus");
  const callerEl = document.getElementById("incomingCallerName");
  const initialEl = document.getElementById("incomingCallerInitial");

  if (callerEl) callerEl.innerText = callerName;
  if (initialEl) initialEl.innerText = callerName.charAt(0).toUpperCase();
  if (screen) screen.classList.add("active");
  if (statusEl) {
    statusEl.innerText = getLanguage() === "hi"
      ? `${callerName} की कॉल आ रही है।`
      : `${callerName} is calling now.`;
  }

  fakeCallStartedAt = Date.now();
  clearInterval(fakeCallTicker);
  updateFakeCallClock();
  fakeCallTicker = setInterval(updateFakeCallClock, 1000);
}

function startFakeCall() {
  const callerName = document.getElementById("fakeCallerName")?.value.trim() || "Safe Circle";
  const delay = Number(document.getElementById("fakeCallDelay")?.value || 0);
  const statusEl = document.getElementById("fakeCallStatus");

  clearTimeout(fakeCallTimeout);
  clearInterval(fakeCallTicker);
  fakeCallStartedAt = null;
  updateFakeCallClock();

  if (statusEl) {
    statusEl.innerText = delay === 0
      ? (getLanguage() === "hi" ? "कॉल तुरंत शुरू हो रही है।" : "Starting your fake call now.")
      : getLanguage() === "hi"
        ? `${delay} सेकंड में फेक कॉल आएगी।`
        : `Fake call will ring in ${delay} seconds.`;
  }

  fakeCallTimeout = setTimeout(() => triggerIncomingCall(callerName), delay * 1000);
}

function answerFakeCall() {
  const statusEl = document.getElementById("fakeCallStatus");
  if (statusEl) {
    statusEl.innerText = getLanguage() === "hi"
      ? "कॉल कनेक्ट हो गई। सुरक्षित जगह पर जाएं और कॉल का उपयोग बहाने की तरह करें।"
      : "Call connected. Use it as your exit cover and move to a safer spot.";
  }
}

function endFakeCall() {
  clearTimeout(fakeCallTimeout);
  clearInterval(fakeCallTicker);
  fakeCallStartedAt = null;

  const screen = document.getElementById("incomingCallScreen");
  const statusEl = document.getElementById("fakeCallStatus");
  if (screen) screen.classList.remove("active");
  if (statusEl) statusEl.innerText = t("fakeCall.ready");

  const clockEl = document.getElementById("fakeCallClock");
  if (clockEl) clockEl.innerText = "00:00";
}

function initializeFakeCallPage() {
  if (currentPage() !== "fake-call.html") return;

  const callerInput = document.getElementById("fakeCallerName");
  if (callerInput && !callerInput.value.trim()) {
    const user = getStoredUser();
    callerInput.value = user?.fullName ? `${user.fullName}'s contact` : "Safe Circle";
  }
}

function initializeSettingsPage() {
  if (currentPage() !== "settings.html") return;

  const user = getStoredUser();
  const settings = getAppSettings();

  const nameEl = document.getElementById("settingsUserName");
  const emailEl = document.getElementById("settingsUserEmail");
  const avatarEl = document.getElementById("settingsAvatar");

  if (nameEl) nameEl.innerText = user?.fullName || "User";
  if (emailEl) emailEl.innerText = user?.email || "No email found";
  if (avatarEl) avatarEl.innerText = (user?.fullName || "U").charAt(0).toUpperCase();

  const settingMap = {
    settingLocationReminder: "locationReminder",
    settingSafetyAlerts: "safetyAlerts",
    settingLiveSharing: "liveSharing",
    settingDarkMode: "darkMode"
  };

  Object.entries(settingMap).forEach(([id, key]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.checked = Boolean(settings[key]);
    input.addEventListener("change", event => {
      const nextSettings = getAppSettings();
      nextSettings[key] = event.target.checked;
      saveAppSettings(nextSettings);
      if (key === "darkMode") {
        applyTheme();
        applyTranslations();
      }
    });
  });

  const languageSelect = document.getElementById("settingLanguage");
  if (languageSelect) {
    languageSelect.value = settings.language || "en";
    languageSelect.addEventListener("change", event => {
      const nextSettings = getAppSettings();
      nextSettings.language = event.target.value;
      saveAppSettings(nextSettings);
      applyTheme();
      applyTranslations();
      initializeFakeCallPage();
      updateRouteCard(lastRouteData);
      if (activeSafetyData) {
        updateSafetyUI(activeSafetyData.safetyIndex, activeSafetyData.status);
      }
    });
  }
}

function initializeProfilePage() {
  if (currentPage() !== "profile.html") return;

  const user = getStoredUser();
  const fullName = user?.fullName || "User";
  const email = user?.email || "No email found";
  const phone = user?.phone || "No phone added";

  const avatar = fullName.charAt(0).toUpperCase();

  const profileNameEl = document.getElementById("profileUserName");
  const profileFullNameEl = document.getElementById("profileFullName");
  const profileEmailEl = document.getElementById("profileEmail");
  const profilePhoneEl = document.getElementById("profilePhone");
  const profileAvatarEl = document.getElementById("profileAvatar");
  const editNameEl = document.getElementById("editProfileName");
  const editPhoneEl = document.getElementById("editProfilePhone");

  if (profileNameEl) profileNameEl.innerText = fullName;
  if (profileFullNameEl) profileFullNameEl.innerText = fullName;
  if (profileEmailEl) profileEmailEl.innerText = email;
  if (profilePhoneEl) profilePhoneEl.innerText = phone;
  if (profileAvatarEl) profileAvatarEl.innerText = avatar;
  if (editNameEl) editNameEl.value = fullName === "User" ? "" : fullName;
  if (editPhoneEl) editPhoneEl.value = user?.phone || "";
}

async function loadDashboardSafetySnapshot() {
  if (!document.getElementById("dashboardSafetyScore")) return;

  if (!navigator.geolocation) {
    updateSafetyUI(50, "moderate");
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const data = await fetchSafetyZones(lat, lon);
    updateSafetyUI(data.safetyIndex, data.status);
    renderZoneList(data);
  }, () => {
    updateSafetyUI(50, "moderate");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme();
  applyTranslations();

  if (!checkAuth()) {
    return;
  }

  const dateEl = document.getElementById("currentDate");
  if (dateEl) {
    dateEl.innerText = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  if (isProtectedPage()) {
    await fetchProfile();
  }

  renderGreeting();
  loadContacts();
  loadHistory();
  initMap();
  initSOSMap();
  loadDashboardSafetySnapshot();
  loadReportLocation();
  initializeEvidenceUpload();
  initializePasswordToggles();
  initializePasswordCriteria();
  initializeGoogleLogin();
  attachSearchEvents();
  initializeMapControls();
  initializeSettingsPage();
  initializeProfilePage();
  initializeFakeCallPage();
  initializeTransportationPage();

  if (currentPage() === "sos.html" && readSOSIntent() === "auto-send") {
    clearSOSIntent();
    setTimeout(() => activateSOS(), 250);
  }
});
