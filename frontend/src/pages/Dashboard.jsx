import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Map as MapLibreMap,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./Dashboard.css";
import { getDashboardStats } from "../../services/appData";


setWorkerUrl(maplibreWorker);

const CARTO_STYLE_URL = `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json${
  import.meta.env.VITE_CARTO_API_KEY
    ? `?key=${import.meta.env.VITE_CARTO_API_KEY}`
    : ""
}`;
const WORLD_LAND_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";

// Demonstration markers only. Connect these coordinates to your alert API for live incident locations.
const SAMPLE_ALERTS = [
  { id: "nyc", coordinates: [-74.006, 40.7128], place: "New York", type: "Exchange activity", severity: "high", amount: "$18,420" },
  { id: "lon", coordinates: [-0.1276, 51.5072], place: "London", type: "Flagged wallet cluster", severity: "medium", amount: "$6,205" },
  { id: "sg", coordinates: [103.8198, 1.3521], place: "Singapore", type: "Mixer interaction", severity: "high", amount: "$2,890" },
  { id: "mum", coordinates: [72.8777, 19.076], place: "Mumbai", type: "Unusual transaction flow", severity: "medium", amount: "$4,140" },
  { id: "sao", coordinates: [-46.6333, -23.5505], place: "São Paulo", type: "Wallet activity", severity: "low", amount: "$1,670" },
];

const SAMPLE_ROUTES = [
  { type: "Feature", properties: { id: "atlantic" }, geometry: { type: "LineString", coordinates: [[-74, 41], [-54, 48], [-34, 51], [-15, 51], [-1, 52]] } },
  { type: "Feature", properties: { id: "asia" }, geometry: { type: "LineString", coordinates: [[-1, 52], [20, 45], [43, 34], [67, 25], [104, 1]] } },
  { type: "Feature", properties: { id: "india" }, geometry: { type: "LineString", coordinates: [[72, 19], [82, 16], [94, 10], [104, 1]] } },
];

// Illustrative city-light clusters that add the luminous land detail from the reference.
const CITY_LIGHTS = [
  [-123.12,49.28,1],[-122.33,47.61,2],[-122.42,37.77,3],[-118.24,34.05,3],[-117.16,32.72,1],[-112.07,33.45,1],[-111.89,40.76,1],[-115.14,36.17,1],[-122.33,45.52,1],[-119.78,36.74,1],
  [-121.89,37.33,2],[-119.42,36.74,1],[-104.99,39.74,2],[-96.8,32.78,2],[-95.37,29.76,2],[-97.74,30.27,1],[-98.49,29.42,1],[-94.58,39.1,1],[-93.27,44.98,1],[-87.63,41.88,3],[-83.05,42.33,2],[-81.69,41.5,1],[-80.19,25.76,2],[-84.39,33.75,2],[-77.04,38.91,3],[-74.01,40.71,3],[-71.06,42.36,2],[-79.38,43.65,2],[-73.57,45.5,1],[-99.13,19.43,3],
  [-0.13,51.51,3],[-2.24,53.48,1],[2.35,48.86,3],[4.9,52.37,2],[8.68,50.11,2],[13.4,52.52,2],[12.5,41.9,2],[19.04,47.5,1],[21.01,52.23,1],[28.98,41.01,2],[31.24,30.04,2],[3.38,6.52,2],[36.82,-1.29,1],[28.05,-26.2,2],
  [72.88,19.08,3],[77.21,28.61,3],[77.59,12.97,2],[80.27,13.08,2],[88.36,22.57,2],[90.41,23.81,2],[67.01,24.86,2],[74.36,31.52,1],[116.4,39.9,3],[121.47,31.23,3],[113.26,23.13,2],[114.06,22.54,2],[114.17,22.32,2],[139.69,35.68,3],[135.5,34.69,2],[126.98,37.57,2],[121.56,25.04,1],[100.5,13.76,2],[103.82,1.35,2],[106.85,-6.21,2],[120.98,14.6,2],
  [-46.63,-23.55,3],[-43.2,-22.91,2],[-58.38,-34.6,2],[-70.67,-33.45,1],[-77.04,-12.05,1],[-74.08,4.71,1],[-79.52,8.98,1]
];

function applyMapPalette(map, { backdrop = false, transparent = false, solidGlobe = false } = {}) {
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    const id = String(layer.id || "").toLowerCase();
    const sourceLayer = String(layer["source-layer"] || "").toLowerCase();
    if (id.startsWith("tx-")) continue;
    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", transparent ? "rgba(0,0,0,0)" : "#020b1b");
      } else if (solidGlobe && ["symbol", "line", "circle", "fill-extrusion", "raster", "hillshade"].includes(layer.type)) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } else if (solidGlobe && layer.type === "fill") {
        map.setPaintProperty(layer.id, "fill-color", "#0b3d72");
        map.setPaintProperty(layer.id, "fill-opacity", 1);
      } else if (layer.type === "fill" && /(water|ocean|lake|river)/.test(`${id} ${sourceLayer}`)) {
        const waterColor = backdrop ? "#020b1b" : transparent ? "rgba(0,0,0,0)" : "#061a30";
        map.setPaintProperty(layer.id, "fill-color", waterColor);
        map.setPaintProperty(layer.id, "fill-opacity", transparent && !backdrop ? 0 : 1);
        map.setPaintProperty(layer.id, "fill-outline-color", waterColor);
      } else if (layer.type === "fill") {
        // The Natural Earth polygon below provides a consistent continent fill.
        map.setLayoutProperty(layer.id, "visibility", "none");
      } else if (layer.type === "line" && /(boundar|admin|border)/.test(`${id} ${sourceLayer}`)) {
        map.setLayoutProperty(layer.id, "visibility", "visible");
        map.setPaintProperty(layer.id, "line-color", "#061827");
        map.setPaintProperty(layer.id, "line-opacity", 1);
        map.setPaintProperty(layer.id, "line-width", 0.8);
      } else if (layer.type === "line" && /(road|transport)/.test(`${id} ${sourceLayer}`)) {
        map.setPaintProperty(layer.id, "line-color", backdrop ? "#164d72" : "#1d79a4");
        map.setPaintProperty(layer.id, "line-opacity", backdrop ? 0.4 : 0.64);
      } else if (layer.type === "symbol") {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    } catch {
      // Some hosted layers expose paint properties that cannot be changed.
    }
  }
}
function addActivityLayers(targetMap, popupRef) {
      if (targetMap.getSource("tx-routes")) return;
      targetMap.addSource("tx-routes", { type: "geojson", data: { type: "FeatureCollection", features: SAMPLE_ROUTES }, lineMetrics: true });
      targetMap.addLayer({
        id: "tx-route-glow", type: "line", source: "tx-routes",
        paint: { "line-color": "#10cdeb", "line-width": 5, "line-opacity": 0.14, "line-blur": 3 },
      });
      targetMap.addLayer({
        id: "tx-route-lines", type: "line", source: "tx-routes",
        paint: { "line-color": "#4de6f4", "line-width": 1.5, "line-opacity": 0.68, "line-dasharray": [2, 2] },
      });
      targetMap.addSource("tx-alerts", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: SAMPLE_ALERTS.map((alert) => ({
            type: "Feature",
            properties: { id: alert.id, place: alert.place, type: alert.type, severity: alert.severity, amount: alert.amount },
            geometry: { type: "Point", coordinates: alert.coordinates },
          })),
        },
      });
      targetMap.addLayer({
        id: "tx-alert-halo", type: "circle", source: "tx-alerts",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 4, 12],
          "circle-color": ["match", ["get", "severity"], "high", "#ff5975", "medium", "#ffba55", "#48dcea"],
          "circle-opacity": 0.2, "circle-blur": 0.8,
        },
      });
      targetMap.addLayer({
        id: "tx-alert-points", type: "circle", source: "tx-alerts",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.6, 5, 5],
          "circle-color": ["match", ["get", "severity"], "high", "#ff7184", "medium", "#ffd079", "#74edf3"],
          "circle-stroke-width": 1.2, "circle-stroke-color": "#e8fbff", "circle-opacity": 0.96,
        },
      });
      targetMap.on("click", "tx-alert-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const properties = feature.properties || {};
        const popup = document.createElement("div");
        popup.className = "tx-popup";
        const title = document.createElement("strong");
        title.textContent = properties.place || "Activity marker";
        const kind = document.createElement("span");
        kind.textContent = properties.type || "Sample activity";
        const value = document.createElement("b");
        value.textContent = `${properties.amount || ""} · ${properties.severity || "low"} risk`;
        popup.append(title, kind, value);
        popupRef.current?.remove();
        popupRef.current = new Popup({ closeButton: true, offset: 13, maxWidth: "240px" })
          .setLngLat(event.lngLat)
          .setDOMContent(popup)
          .addTo(targetMap);
      });
      targetMap.on("mouseenter", "tx-alert-points", () => { targetMap.getCanvas().style.cursor = "pointer"; });
      targetMap.on("mouseleave", "tx-alert-points", () => { targetMap.getCanvas().style.cursor = ""; });
}

function addCityLights(targetMap, { globe = false } = {}) {
  if (targetMap.getSource("tx-city-lights")) return;
  targetMap.addSource("tx-city-lights", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: CITY_LIGHTS.map(([longitude, latitude, power], index) => ({
        type: "Feature",
        properties: { power, id: `city-light-${index}` },
        geometry: { type: "Point", coordinates: [longitude, latitude] },
      })),
    },
  });
  targetMap.addLayer({
    id: "tx-city-light-glow",
    type: "circle",
    source: "tx-city-lights",
    paint: {
      "circle-radius": globe ? ["interpolate", ["linear"], ["get", "power"], 1, 3, 3, 8] : ["interpolate", ["linear"], ["get", "power"], 1, 2, 3, 4.5],
      "circle-color": "#00c8ff",
      "circle-opacity": globe ? 0.26 : 0.14,
      "circle-blur": 1,
    },
  });
  targetMap.addLayer({
    id: "tx-city-light-points",
    type: "circle",
    source: "tx-city-lights",
    paint: {
      "circle-radius": globe ? ["interpolate", ["linear"], ["get", "power"], 1, 0.9, 3, 1.65] : ["interpolate", ["linear"], ["get", "power"], 1, 0.55, 3, 1.05],
      "circle-color": "#b8faff",
      "circle-opacity": globe ? 0.88 : 0.58,
      "circle-blur": 0.2,
    },
  });
}

// CARTO's dark-matter basemap has no solid continent layer to recolor. Add
// actual land geometry; keep the globe's water transparent and the backdrop's water dark.
function addWorldLand(targetMap, { backdrop = false } = {}) {
  if (targetMap.getSource("tx-world-land")) return;

  targetMap.addSource("tx-world-land", {
    type: "geojson",
    data: WORLD_LAND_URL,
    attribution: "© Natural Earth",
  });

  const firstLineLayer = targetMap.getStyle()?.layers?.find(
    (layer) => layer.type === "line" && !String(layer.id).startsWith("tx-"),
  )?.id;

  targetMap.addLayer({
    id: "tx-world-land-fill",
    type: "fill",
    source: "tx-world-land",
    paint: {
      "fill-color": "#00F0EA",
      "fill-opacity": backdrop ? 0.3 : 0.42,
      "fill-outline-color": "#061827",
      "fill-antialias": true,
    },
  }, firstLineLayer);

  targetMap.addLayer({
    id: "tx-world-land-outline",
    type: "line",
    source: "tx-world-land",
    paint: {
      "line-color": "#061827",
      "line-opacity": 1,
      "line-width": 1.2,
    },
  });
}


const DEFAULT_STATS = {
  totalTransactions: 12847,
  suspiciousTransactions: 326,
  highRiskWallets: 84,
  monitoredWallets: 1248,
  fraudDetected: "486K",
  totalCases: 0,
  walletsTracked: 0,
  criticalCases: 0,
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

function getGlobeZoomForViewport(width = window.innerWidth, height = window.innerHeight) {
  let diameter;
  if (width <= 620) diameter = Math.min(height * 0.48, width * 0.84, 440);
  else if (width <= 900) diameter = Math.min(height * 0.68, width * 0.58, 580);
  else diameter = Math.min(height * 0.82, width * 0.48, 700);
  // Overscale the vector Earth to fill the larger glowing globe outline edge to edge.
  return Math.log2(Math.max(diameter, 180) / 512) + 1.62;
}

export default function Dashboard() {
  const mapContainerRef = useRef(null);
  const backgroundMapContainerRef = useRef(null);
  const backgroundMapRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [clock, setClock] = useState(new Date());
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [autoRotate, setAutoRotate] = useState(true);
  const [coordinates, setCoordinates] = useState({ longitude: 0, latitude: 22 });

  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        const response = await getDashboardStats();
        if (!active || !response) return;
        setStats({
          totalTransactions: response.totalTransactions ?? response.total_transactions ?? DEFAULT_STATS.totalTransactions,
          suspiciousTransactions: response.suspiciousTransactions ?? response.suspicious_transactions ?? DEFAULT_STATS.suspiciousTransactions,
          highRiskWallets: response.highRiskWallets ?? response.high_risk_wallets ?? DEFAULT_STATS.highRiskWallets,
          monitoredWallets: response.monitoredWallets ?? response.monitored_wallets ?? DEFAULT_STATS.monitoredWallets,
          fraudDetected: response.fraudDetected ?? response.fraud_detected ?? DEFAULT_STATS.fraudDetected,
          totalCases: response.totalCases ?? response.total_cases ?? DEFAULT_STATS.totalCases,
          walletsTracked: response.walletsTracked ?? response.wallets_tracked ?? DEFAULT_STATS.walletsTracked,
          criticalCases: response.criticalCases ?? response.critical_cases ?? DEFAULT_STATS.criticalCases,
        });
      } catch (error) {
        console.error("Dashboard API error:", error);
      }
    }
    loadStats();
    const clockTimer = window.setInterval(() => setClock(new Date()), 1000);
    return () => { active = false; window.clearInterval(clockTimer); };
  }, []);

  useEffect(() => {
    if (!backgroundMapContainerRef.current || backgroundMapRef.current) return undefined;
    const backdrop = new MapLibreMap({
      container: backgroundMapContainerRef.current,
      style: CARTO_STYLE_URL,
      center: [0, 14],
      zoom: 1.5,
      minZoom: 1,
      maxZoom: 3,
      projection: { type: "mercator" },
      renderWorldCopies: false,
      interactive: true,
      attributionControl: false,
    });
    backgroundMapRef.current = backdrop;
    backdrop.on("style.load", () => {
      applyMapPalette(backdrop, { backdrop: true });
      addWorldLand(backdrop, { backdrop: true });
      addCityLights(backdrop);
      addActivityLayers(backdrop, popupRef);
    });
    backdrop.on("load", () => {
      // Reapply after source tiles finish loading so the requested land fill persists.
      applyMapPalette(backdrop, { backdrop: true });
      const { width, height } = backgroundMapContainerRef.current.getBoundingClientRect();
      const worldWidth = Math.max(width, height * 2) * 1.02;
      backdrop.jumpTo({ center: [0, 14], zoom: Math.log2(worldWidth / 512) });
      backdrop.getCanvas().setAttribute("aria-label", "Interactive world map backdrop. Drag to pan and scroll to zoom.");
      backdrop.on("moveend", () => {
        const center = backdrop.getCenter();
        setCoordinates({ longitude: center.lng, latitude: center.lat });
      });
    });
    return () => {
      backdrop.remove();
      backgroundMapRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    let mapLoaded = false;
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: CARTO_STYLE_URL,
      center: [10, 22],
      zoom: getGlobeZoomForViewport(),
      minZoom: -2,
      maxZoom: 12,
      maxPitch: 65,
      projection: { type: "globe" },
      renderWorldCopies: false,
      interactive: false,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });
    mapRef.current = map;


    map.getCanvas().style.backgroundColor = "transparent";
    map.getCanvas().setAttribute("aria-label", "Interactive world map. Drag to explore, scroll to zoom, and use the map controls to tilt or rotate.");

    map.on("style.load", () => {
      try {
        map.setProjection({ type: "globe" });
        applyMapPalette(map, { transparent: true });
        addWorldLand(map);
        addCityLights(map, { globe: true });
        if (typeof map.setFog === "function") {
          map.setFog({
            color: "#061b32",
            "high-color": "#1a6c9c",
            "space-color": "rgba(0,0,0,0)",
            "horizon-blend": 0.12,
          });
        }
      } catch (error) {
        console.warn("Globe atmosphere could not be applied:", error);
      }

    });

    map.on("load", () => {
      // Keep the requested land and transparent-water palette after all globe tiles load.
      applyMapPalette(map, { transparent: true });
      mapLoaded = true;
      setMapReady(true);
      setMapError("");
    });

    map.on("error", (event) => {
      if (!mapLoaded && event?.error) setMapError("Map tiles are taking longer than expected. Check your connection.");
    });

    const resizeGlobe = () => {
      map.resize();
      map.setZoom(getGlobeZoomForViewport());
    };
    window.addEventListener("resize", resizeGlobe);

    const loadTimer = window.setTimeout(() => {
      if (!mapLoaded) setMapError("The live map needs an internet connection to load its map tiles.");
    }, 14000);

    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener("resize", resizeGlobe);
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Rotate the actual MapLibre globe slowly; the CSS scan alone only moves the overlay.
  useEffect(() => {
    if (!autoRotate || !mapReady || !mapRef.current) return undefined;

    let frameId;
    let previousFrame = 0;
    const rotateGlobe = (now) => {
      if (previousFrame) {
        const elapsed = Math.min(now - previousFrame, 50);
        const currentMap = mapRef.current;
        if (currentMap) {
          const center = currentMap.getCenter();
          const longitude = ((center.lng + elapsed * 0.003 + 180) % 360 + 360) % 360 - 180;
          currentMap.setCenter([longitude, center.lat]);
        }
      }
      previousFrame = now;
      frameId = window.requestAnimationFrame(rotateGlobe);
    };

    frameId = window.requestAnimationFrame(rotateGlobe);
    return () => window.cancelAnimationFrame(frameId);
  }, [autoRotate, mapReady]);

  const recenterGlobe = () => {
    mapRef.current?.easeTo({ center: [10, 22], zoom: getGlobeZoomForViewport(), pitch: 0, bearing: 0, duration: 900, essential: true });
    const bounds = backgroundMapContainerRef.current?.getBoundingClientRect();
    if (bounds && backgroundMapRef.current) {
      const worldWidth = Math.max(bounds.width, bounds.height * 2) * 1.02;
      backgroundMapRef.current.easeTo({ center: [0, 14], zoom: Math.log2(worldWidth / 512), duration: 900, essential: true });
    }
    setAutoRotate(true);
  };

  return (
    <>
    <section className="tx-dashboard-intro" aria-label="Smart India Hackathon introduction">
      <div className="tx-intro-kicker">SMART INDIA HACKATHON</div>
      <h2 className="tx-intro-title">
        <span>Trace every transaction.</span>
        <span>Trust every wallet.</span>
      </h2>
      <p className="tx-intro-description">
        TRACEX maps blockchain transactions in real time, surfacing suspicious wallets, mixer activity, and exchange links before they disappear.
      </p>
    </section>

    <main className={autoRotate ? "tx-dashboard" : "tx-dashboard tx-paused"}>
      <div className="tx-map tx-background-map" ref={backgroundMapContainerRef} aria-hidden="true" />
      <div className="tx-map tx-globe-map" ref={mapContainerRef} aria-hidden="true" />
      <div className="tx-globe-mesh" aria-hidden="true"><i className="tx-globe-scan" /><span /></div>
      <div className="tx-map-vignette" aria-hidden="true" />
      <div className="tx-map-grid" aria-hidden="true" />

      <div className="tx-topline">
        <div className="tx-network-status"><span className={mapReady ? "tx-live-dot" : "tx-live-dot waiting"} />{mapReady ? "GLOBAL NETWORK ONLINE" : "CONNECTING TO NETWORK"}</div>
        <div className="tx-top-actions">
          <span className="tx-clock"><b>{clock.toLocaleTimeString("en-IN", { hour12: false })}</b><small>NETWORK TIME · {clock.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase()}</small></span>
          <button className="tx-icon-button" onClick={recenterGlobe} title="Reset globe view" aria-label="Reset globe view">⌖</button>
        </div>
      </div>

      <section className="tx-brand-center" aria-label="TraceX blockchain fraud intelligence">
        <h1 className="tx-brand-wordmark" aria-label="TRACE X">
          <svg viewBox="0 0 940 100" role="img" aria-hidden="true" focusable="false">
            <g className="tx-logo-main" fillRule="evenodd">
              <path d="M0 4H118V25H72V96H46V25H0Z" />
              <path d="M160 4H224C258 4 278 21 278 45C278 64 266 76 246 81L280 96H245L211 79H188V96H160ZM188 24V59H222C241 59 251 53 251 42C251 30 241 24 222 24Z" />
              <path d="M322 96L363 4H399L442 96H410L401 75H363L354 96ZM371 58L381 32H390L400 58Z" />
              <path d="M359 62H405V76H359Z" fillRule="nonzero" />
              <path d="M606 4H548C512 4 488 22 488 49V52C488 80 512 96 548 96H606V75H550C528 75 516 69 516 52V49C516 32 528 25 550 25H606Z" />
              <path d="M648 4H770V25H676V42H755V58H676V75H770V96H648Z" />
            </g>
            <path className="tx-logo-accent" d="M812 4H843L876 39L909 4H940L893 50L940 96H909L876 61L843 96H812L859 50Z" />
          </svg>
        </h1>
        <p>BLOCKCHAIN FRAUD INTELLIGENCE PLATFORM</p>
      </section>

      <aside className="tx-hud">
        <section className="tx-hud-card tx-radar-card">
          <div className="tx-card-heading"><span>NETWORK ACTIVITY</span><b><i className="tx-live-dot"/>LIVE</b></div>
          <div className="tx-radar"><div className="tx-radar-sweep"/><span className="tx-radar-blip blip-one"/><span className="tx-radar-blip blip-two"/><span className="tx-radar-blip blip-three"/></div>
          <div className="tx-card-foot"><span>{formatNumber(stats.monitoredWallets)} WALLETS</span><span>14 CHAINS</span></div>
        </section>

        <section className="tx-hud-card tx-stats-card">
          <div className="tx-card-heading"><span>THREAT OVERVIEW</span><b>{mapReady ? "UPDATING" : "STANDBY"}</b></div>
          <div className="tx-stat-row"><span>TRANSACTIONS</span><strong>{formatNumber(stats.totalTransactions)}</strong></div>
          <div className="tx-stat-row"><span>HIGH RISK WALLETS</span><strong className="tx-warn">{formatNumber(stats.highRiskWallets)}</strong></div>
          <div className="tx-stat-row"><span>FLAGGED TRANSACTIONS</span><strong className="tx-alert">{formatNumber(stats.suspiciousTransactions)}</strong></div>

        </section>

        <section className="tx-hud-card tx-activity-card">
          <div className="tx-card-heading"><span>ACTIVITY ROUTES</span><b>SAMPLE DATA</b></div>
          <div className="tx-route-spark" aria-hidden="true"><svg viewBox="0 0 240 56" preserveAspectRatio="none"><polyline points="0,45 22,36 42,41 63,22 84,31 105,13 126,28 148,8 170,21 192,6 214,16 240,2"/></svg></div>
          <div className="tx-card-foot"><span>CLICK MAP MARKERS</span><span>5 SIGNALS</span></div>
        </section>

        <section className="tx-hud-card tx-wallet-card">
          <div className="tx-card-heading"><span>FRAUD DETECTED</span><b>API</b></div>
          <strong className="tx-risk-value">{stats.fraudDetected}</strong>
          <div className="tx-risk-caption">Reported by dashboard data</div>
        </section>
      </aside>

      <div className="tx-map-controls">
        <button onClick={() => setAutoRotate((value) => !value)} aria-label={autoRotate ? "Pause globe rotation" : "Resume globe rotation"}>
          <span>{autoRotate ? "Ⅱ" : "▶"}</span>{autoRotate ? "PAUSE ROTATION" : "RESUME ROTATION"}
        </button>
        <button onClick={recenterGlobe} aria-label="Recenter globe">RE-CENTER</button>
      </div>

      <div className="tx-map-legend"><span><i className="high"/>HIGH RISK</span><span><i className="medium"/>ELEVATED</span><span><i className="low"/>ACTIVITY</span></div>
      <div className="tx-coordinates">{Math.abs(coordinates.latitude).toFixed(1)}° {coordinates.latitude >= 0 ? "N" : "S"} &nbsp; / &nbsp; {Math.abs(coordinates.longitude).toFixed(1)}° {coordinates.longitude >= 0 ? "E" : "W"}</div>
      {mapError && !mapReady && <div className="tx-map-message" role="status">{mapError}</div>}
      <div className="tx-map-disclaimer">MAP: CARTO · SIGNAL POINTS ARE SAMPLE LOCATIONS</div>
    </main>

    <section className="tx-dashboard-lower" aria-label="TraceX platform features">
      <div className="tx-feature-grid">
        <Link className="tx-feature-item" to="/network" aria-label="Open graph-based analysis">
          <span className="tx-feature-icon" aria-hidden="true">⌘</span>
          <h3>Graph-based analysis</h3>
          <p>Follows funds across wallets and mixers automatically, turning millions of transactions into a readable map.</p>
        </Link>
        <Link className="tx-feature-item" to="/transactions" aria-label="Open multi-chain transaction coverage">
          <span className="tx-feature-icon" aria-hidden="true">⊖</span>
          <h3>Multi-chain coverage</h3>
          <p>Pulls from blockchain explorer APIs across chains, so an investigation never dead-ends at a chain boundary.</p>
        </Link>
        <Link className="tx-feature-item" to="/wallet-investigation" aria-label="Open automated risk scoring">
          <span className="tx-feature-icon" aria-hidden="true">✓</span>
          <h3>Automated risk scoring</h3>
          <p>Flags high-risk wallets the moment they surface, so investigators spend time on leads, not lookups.</p>
        </Link>
      </div>

      <section className="tx-investigation-status" aria-label="Live investigation status">
        <div className="tx-investigation-copy">
          <span>LIVE INVESTIGATION STATUS</span>
          <strong>TRACEX is monitoring the investigation network.</strong>
        </div>
        <div className="tx-investigation-counts">
          <div><strong>{formatNumber(stats.totalCases)}</strong><span>CASES</span></div>
          <div><strong>{formatNumber(stats.walletsTracked)}</strong><span>WALLETS</span></div>
          <div><strong>{formatNumber(stats.criticalCases)}</strong><span>CRITICAL</span></div>
        </div>
      </section>

      <section className="tx-investigation-cta" aria-label="Start an investigation">
        <span className="tx-cta-kicker">TRACEX</span>
        <h2>Built for real investigations.</h2>
        <p>Open-source, low-cost, and ready to scale — from a hackathon prototype to a production use management tool.</p>
        <nav className="tx-cta-actions" aria-label="Investigation links">
          <Link to="/wallet-investigation">View investigations</Link>
          <Link to="/reports">View reports</Link>
          <Link className="tx-cta-primary" to="/cases?new=true">Open new case</Link>
        </nav>
      </section>
    </section>
    </>
  );
}
