// Banemodellen bruker kilometer og sekunder.
const EARTH_MU = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;
const J2 = 1.08262668e-3;
const DEG = Math.PI / 180;
const MIN_ELEVATION_DEG = 5;

const STATION = { lat: 69.6619, lon: 18.9422 };

function parseTLE(text) {
  const lines = text.trim().split("\n").map((l) => l.trimEnd());
  const [l1, l2] = lines.length >= 3 ? lines.slice(1) : lines;

  // I TLE står datoen som år og dagnummer. Brøkdelen av dagen gir klokkeslettet.
  const year = 2000 + Number(l1.slice(18, 20));
  const dayOfYear = Number(l1.slice(20, 32));
  const epoch = Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86400000;

  return {
    epoch,
    inclination: Number(l2.slice(8, 16)) * DEG,
    raan: Number(l2.slice(17, 25)) * DEG,
    eccentricity: Number("0." + l2.slice(26, 33)),
    argPerigee: Number(l2.slice(34, 42)) * DEG,
    meanAnomaly: Number(l2.slice(43, 51)) * DEG,
    orbitsPerDay: Number(l2.slice(52, 63)),
  };
}

function createOrbit(tle) {
  const radiansPerSecond = (tle.orbitsPerDay * 2 * Math.PI) / 86400;
  const semiMajorAxisKm = Math.cbrt(EARTH_MU / (radiansPerSecond * radiansPerSecond));
  const e = tle.eccentricity;
  const semiLatusRectum = semiMajorAxisKm * (1 - e * e);
  const j2Factor = 1.5 * J2 * (EARTH_RADIUS_KM / semiLatusRectum) ** 2 * radiansPerSecond;
  const raanRate = -j2Factor * Math.cos(tle.inclination);
  const argRate = j2Factor * (2 - 2.5 * Math.sin(tle.inclination) ** 2);

  function position(t) {
    const elapsedSeconds = (t - tle.epoch) / 1000;
    const M = tle.meanAnomaly + radiansPerSecond * elapsedSeconds;

    // Løs Keplers ligning med Newtons metode.
    let E = M;
    for (let k = 0; k < 6; k++) {
      E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }

    const trueAnomaly = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    const r = semiMajorAxisKm * (1 - e * Math.cos(E));
    const latitudeArgument = tle.argPerigee + argRate * elapsedSeconds + trueAnomaly;
    const raan = tle.raan + raanRate * elapsedSeconds;
    const inclination = tle.inclination;

    const x = r * (Math.cos(raan) * Math.cos(latitudeArgument) - Math.sin(raan) * Math.sin(latitudeArgument) * Math.cos(inclination));
    const y = r * (Math.sin(raan) * Math.cos(latitudeArgument) + Math.cos(raan) * Math.sin(latitudeArgument) * Math.cos(inclination));
    const z = r * Math.sin(latitudeArgument) * Math.sin(inclination);

    // Kartet følger jordrotasjonen.
    const theta = gmst(t);
    return {
      x: x * Math.cos(theta) + y * Math.sin(theta),
      y: -x * Math.sin(theta) + y * Math.cos(theta),
      z,
      r,
      speedKmPerSecond: Math.sqrt(EARTH_MU * (2 / r - 1 / semiMajorAxisKm)),
    };
  }

  return { position, periodMinutes: (2 * Math.PI) / radiansPerSecond / 60 };
}

function gmst(t) {
  const jd = t / 86400000 + 2440587.5;
  const deg = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  return (((deg % 360) + 360) % 360) * DEG;
}

function toLatLon(pos) {
  return {
    lat: Math.atan2(pos.z, Math.hypot(pos.x, pos.y)) / DEG,
    lon: Math.atan2(pos.y, pos.x) / DEG,
    alt: pos.r - EARTH_RADIUS_KM,
  };
}

function elevationFromStation(pos) {
  const phi = STATION.lat * DEG;
  const lam = STATION.lon * DEG;
  const sx = EARTH_RADIUS_KM * Math.cos(phi) * Math.cos(lam);
  const sy = EARTH_RADIUS_KM * Math.cos(phi) * Math.sin(lam);
  const sz = EARTH_RADIUS_KM * Math.sin(phi);
  const dx = pos.x - sx;
  const dy = pos.y - sy;
  const dz = pos.z - sz;

  const east = -Math.sin(lam) * dx + Math.cos(lam) * dy;
  const north = -Math.sin(phi) * Math.cos(lam) * dx - Math.sin(phi) * Math.sin(lam) * dy + Math.cos(phi) * dz;
  const up = Math.cos(phi) * Math.cos(lam) * dx + Math.cos(phi) * Math.sin(lam) * dy + Math.sin(phi) * dz;
  const range = Math.hypot(east, north, up);

  return Math.asin(up / range) / DEG;
}

// Til nedtellingen velger vi helst en passering godt over horisonten.
const GOOD_PASS_DEG = 15;
function findGoodPass(orbit, from) {
  let pass = findPass(orbit, from);
  for (let k = 0; pass && pass.maxEl < GOOD_PASS_DEG && k < 20; k++) {
    pass = findPass(orbit, pass.los + 60000);
  }
  return pass;
}

function findPass(orbit, from) {
  const elevation = (t) => elevationFromStation(orbit.position(t));
  const visible = (t) => elevation(t) > MIN_ELEVATION_DEG;
  const STEP = 20000;

  let t = from;
  if (visible(t)) {
    // Hvis satellitten er oppe allerede, må vi lete bakover etter starten.
    while (visible(t - STEP)) t -= STEP;
  } else {
    const limit = from + 2 * 86400000;
    while (!visible(t) && t < limit) t += STEP;
    if (t >= limit) return null;
  }
  const aos = refine(visible, t - STEP, t);

  let maxEl = 0;
  let s = aos;
  while (visible(s)) {
    maxEl = Math.max(maxEl, elevation(s));
    s += 10000;
  }
  const los = refine((x) => !visible(x), s - 10000, s);
  return { aos, los, maxEl };
}

// Snevr inn tidspunktet til omtrent ett sekund.
function refine(test, lo, hi) {
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2;
    if (test(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

const mapX = (lon) => lon + 180;
const mapY = (lat) => 90 - lat;

// Ved datolinjen hopper punktet til den andre kanten. Ellers får vi en strek tvers over kartet.
function trackPath(orbit, from, to) {
  let d = "";
  let prevLon = null;
  for (let t = from; t <= to; t += 30000) {
    const { lat, lon } = toLatLon(orbit.position(t));
    const jump = prevLon !== null && Math.abs(lon - prevLon) > 180;
    d += `${d === "" || jump ? "M" : "L"}${mapX(lon).toFixed(2)} ${mapY(lat).toFixed(2)}`;
    prevLon = lon;
  }
  return d;
}

// Dekningsområdet til stasjonen: der satellitten er minst 5° over horisonten
function footprintPath(altitude) {
  const el = MIN_ELEVATION_DEG * DEG;
  const rho = Math.acos((EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitude)) * Math.cos(el)) - el;
  const phi1 = STATION.lat * DEG;
  const lam1 = STATION.lon * DEG;
  let d = "";
  for (let b = 0; b <= 360; b += 5) {
    const br = b * DEG;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(rho) + Math.cos(phi1) * Math.sin(rho) * Math.cos(br));
    const lam2 = lam1 + Math.atan2(Math.sin(br) * Math.sin(rho) * Math.cos(phi1), Math.cos(rho) - Math.sin(phi1) * Math.sin(phi2));
    d += `${b === 0 ? "M" : "L"}${mapX(lam2 / DEG).toFixed(2)} ${mapY(phi2 / DEG).toFixed(2)}`;
  }
  return d + "Z";
}

const fmt = (v, dec = 0) => v.toLocaleString("nb-NO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtLat = (v) => `${fmt(Math.abs(v), 1)}° ${v >= 0 ? "N" : "S"}`;
const fmtLon = (v) => `${fmt(Math.abs(v), 1)}° ${v >= 0 ? "Ø" : "V"}`;

function fmtDuration(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return "under ett minutt";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} t ${min % 60} min`;
}

function startTracker() {
  const tleText = document.getElementById("tle")?.textContent;
  const overlay = document.getElementById("kart-overlay");
  const text = document.getElementById("sporing-tekst");
  if (!tleText || !overlay || !text) return;

  const tle = parseTLE(tleText);
  const orbit = createOrbit(tle);

  const alt0 = toLatLon(orbit.position(Date.now())).alt;
  svgEl("path", { d: footprintPath(alt0), class: "map-footprint" }, overlay);
  const track = svgEl("path", { class: "map-track" }, overlay);
  svgEl("circle", { cx: mapX(STATION.lon), cy: mapY(STATION.lat), r: 1, class: "map-station" }, overlay);
  const sat = svgEl("circle", { r: 1.8, class: "map-sat" }, overlay);

  let pass = null;
  let lastTrack = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function tick() {
    const now = Date.now();
    const pos = orbit.position(now);
    const geo = toLatLon(pos);

    if (!reducedMotion.matches || lastTrack === 0) {
      // Vis litt av banen bak satellitten og resten foran.
      if (now - lastTrack > 30000) {
        const orbitMs = orbit.periodMinutes * 60000;
        track.setAttribute("d", trackPath(orbit, now - orbitMs / 4, now + (orbitMs * 3) / 4));
        lastTrack = now;
      }
      sat.setAttribute("cx", mapX(geo.lon).toFixed(2));
      sat.setAttribute("cy", mapY(geo.lat).toFixed(2));
    }

    if (!pass || now > pass.los) pass = findGoodPass(orbit, now);
    const overTromso = elevationFromStation(pos) > MIN_ELEVATION_DEG;

    let next = "";
    if (overTromso) next = "Akkurat nå er den over Tromsø.";
    else if (pass) next = `Neste gang over Tromsø om ${fmtDuration(pass.aos - now)}.`;

    text.innerHTML =
      `<strong>HOJ-1</strong> er nå over ${fmtLat(geo.lat)} ${fmtLon(geo.lon)}, ` +
      `${fmt(geo.alt)} km opp, i ${fmt(pos.speedKmPerSecond * 3600)} km/t. ${next}`;
  }

  tick();
  setInterval(tick, 1000);
}

startTracker();
