import {
  setWorkerUrl,
} from "maplibre-gl";

import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import MapLibre, {
  Popup,
  NavigationControl,
  useControl,
} from "react-map-gl/maplibre";

import "maplibre-gl/dist/maplibre-gl.css";
import "./NetworkGraph.css";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MapboxOverlay,
} from "@deck.gl/mapbox";

import {
  ScatterplotLayer,
  ArcLayer,
} from "@deck.gl/layers";

import { API_BASE_URL } from "../api";

setWorkerUrl(maplibreWorker);


/* =========================================================
   CONFIGURATION
========================================================= */

const CARTO_STYLE_URL = `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json${
  import.meta.env.VITE_CARTO_API_KEY
    ? `?key=${import.meta.env.VITE_CARTO_API_KEY}`
    : ""
}`;

const DEMO_WALLET =
  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";


/* =========================================================
   DEMO LOCATIONS
========================================================= */

const JUNNAR_DEMO_WALLET =
  "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

const DEMO_LOCATIONS = {
  [DEMO_WALLET.toLowerCase()]: {
    lat: 20.5937,
    lng: 78.9629,
    label: "Suspect Wallet",
    type: "wallet",
  },

  [JUNNAR_DEMO_WALLET.toLowerCase()]: {
    lat: 19.2088,
    lng: 73.8750,
    label: "Junnar, Maharashtra",
    type: "wallet",
  },

  "0xtornadocashpool0000000000000000000001": {
    lat: 6.9271,
    lng: 79.8612,
    label: "Mixer Service",
    type: "mixer",
  },

  "0xintermediaryhopalpha00000000000000002": {
    lat: 51.1657,
    lng: 10.4515,
    label: "Intermediary Wallet",
    type: "intermediary",
  },

  "0xbinancehotwallet000000000000000000003": {
    lat: 48.8566,
    lng: 2.3522,
    label: "Exchange",
    type: "exchange",
  },

  "0xvictimprotocolcontract0000000000004": {
    lat: 52.52,
    lng: 13.405,
    label: "Victim Protocol",
    type: "victim",
  },
};


/* =========================================================
   HELPERS
========================================================= */

function normalizeAddress(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function shortAddress(address) {
  if (!address) {
    return "Unknown";
  }

  const value = String(address);

  return (
    value.slice(0, 8) +
    "…" +
    value.slice(-4)
  );
}


function riskLevelToClass(riskLevel) {
  const value =
    String(riskLevel || "").toLowerCase();

  if (
    [
      "low",
      "medium",
      "high",
      "critical",
    ].includes(value)
  ) {
    return `risk-${value}`;
  }

  return "risk-unknown";
}


function RiskBadge({ riskLevel }) {
  if (!riskLevel) {
    return null;
  }

  return (
    <span
      className={`risk-badge ${riskLevelToClass(
        riskLevel
      )}`}
    >
      {riskLevel}
    </span>
  );
}


/* =========================================================
   TRANSACTION HELPERS
========================================================= */

function getSender(tx) {
  return (
    tx?.sender ||
    tx?.from ||
    tx?.source ||
    ""
  );
}


function getReceiver(tx) {
  return (
    tx?.receiver ||
    tx?.to ||
    tx?.destination ||
    ""
  );
}


function getHash(tx) {
  return (
    tx?.hash ||
    tx?.txHash ||
    tx?.transactionHash ||
    tx?.id ||
    ""
  );
}


/* =========================================================
   VASP HELPERS
========================================================= */

function normalizeVaspAddress(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    return {
      address: entry,
      lat: null,
      lng: null,
    };
  }

  if (typeof entry === "object") {
    return {
      address:
        entry.address ||
        entry.wallet ||
        entry.walletAddress ||
        entry.value ||
        "",

      lat:
        entry.lat ??
        entry.latitude ??
        null,

      lng:
        entry.lng ??
        entry.longitude ??
        null,
    };
  }

  return null;
}


function findVasp(address, vasps) {
  const target =
    normalizeAddress(address);

  for (const vasp of vasps || []) {
    const addresses =
      Array.isArray(vasp.addresses)
        ? vasp.addresses
        : [];

    for (const item of addresses) {
      const normalized =
        normalizeVaspAddress(item);

      if (
        normalized &&
        normalizeAddress(
          normalized.address
        ) === target
      ) {
        return {
          ...vasp,
          matchedAddress: normalized,
        };
      }
    }
  }

  return null;
}


/* =========================================================
   ADDRESS LOCATION
========================================================= */

function getNodeLocation(
  address,
  vasps
) {
  const normalized =
    normalizeAddress(address);

  const vasp =
    findVasp(address, vasps);

  /* VASP location */
  if (
    vasp?.matchedAddress?.lat != null &&
    vasp?.matchedAddress?.lng != null
  ) {
    return {
      lat: Number(
        vasp.matchedAddress.lat
      ),

      lng: Number(
        vasp.matchedAddress.lng
      ),

      source: "vasp",

      vasp,
    };
  }


  /* Demo location */
  const demo =
    DEMO_LOCATIONS[normalized];

  if (demo) {
    return {
      ...demo,
      source: "demo",
      vasp,
    };
  }


  /*
     Wallet addresses do not inherently
     contain geographic coordinates.

     Unknown addresses therefore receive
     a stable pseudo-location only for
     visualization.
  */

  return {
    ...hashAddressToCoords(
      normalized
    ),

    source: "estimated",

    vasp,
  };
}


/* =========================================================
   DETERMINISTIC DEMO LOCATION
========================================================= */

function hashAddressToCoords(address) {
  let hash = 0;

  for (
    let i = 0;
    i < address.length;
    i++
  ) {
    hash =
      (
        hash * 31 +
        address.charCodeAt(i)
      ) >>> 0;
  }

  const lat =
    (hash % 12000) / 100 - 60;

  const lng =
    ((hash >>> 8) % 34000) / 100 - 170;

  return {
    lat,
    lng,
  };
}


/* =========================================================
   DECK.GL OVERLAY
========================================================= */

function DeckGLOverlay(props) {
  const overlay = useControl(
    () =>
      new MapboxOverlay({
        ...props,
        interleaved: false,
      })
  );

  overlay.setProps(props);

  return null;
}


/* =========================================================
   ZOOM INFORMATION
========================================================= */

function getZoomInfo(zoom) {
  if (zoom < 4) {
    return {
      level: 1,
      title: "World View",
      message:
        "Zoom in to see states and regions",
    };
  }

  if (zoom < 7) {
    return {
      level: 2,
      title: "State / Region View",
      message:
        "Zoom in to see cities",
    };
  }

  if (zoom < 11) {
    return {
      level: 3,
      title: "City View",
      message:
        "Zoom in to see roads",
    };
  }

  if (zoom < 16) {
    return {
      level: 4,
      title: "Road View",
      message:
        "Zoom in to see buildings",
    };
  }

  return {
    level: 5,
    title: "Building View",
    message:
      "Maximum geographic detail",
  };
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function NetworkGraph({
  walletAddress: initialWalletAddress = "",
}) {

  /* -------------------------------------------------------
     MAP REFERENCE
  ------------------------------------------------------- */

  const mapRef = useRef(null);


  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  const [
    walletAddress,
    setWalletAddress,
  ] = useState(
    initialWalletAddress ||
    DEMO_WALLET
  );


  const [
    searchAddress,
    setSearchAddress,
  ] = useState(
    initialWalletAddress ||
    DEMO_WALLET
  );


  const [
    transactions,
    setTransactions,
  ] = useState([]);


  const [
    vasps,
    setVasps,
  ] = useState([]);


  const [
    selectedNode,
    setSelectedNode,
  ] = useState(null);


  const [
    zoom,
    setZoom,
  ] = useState(3);


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  /* =======================================================
     LOAD VASPs
  ======================================================= */

  useEffect(() => {

    async function loadVASPs() {

      try {

        const response =
          await fetch(
            `${API_BASE_URL}/vasps`
          );


        if (!response.ok) {

          throw new Error(
            "Unable to load VASP data"
          );

        }


        const data =
          await response.json();


        setVasps(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (error) {

        console.error(
          "VASP loading error:",
          error
        );

      }
    }


    loadVASPs();

  }, []);


  /* =======================================================
     LOAD TRANSACTIONS
  ======================================================= */

  useEffect(() => {

    async function loadTransactions() {

      if (!walletAddress) {

        setTransactions([]);

        return;
      }


      try {

        setLoading(true);

        setError("");


        const response =
          await fetch(
            `${API_BASE_URL}/transactions/${walletAddress}`
          );


        if (!response.ok) {

          throw new Error(
            "Unable to fetch transactions"
          );

        }


        const data =
          await response.json();


        if (Array.isArray(data)) {

          setTransactions(data);

        } else {

          setTransactions(
            Array.isArray(
              data.transactions
            )
              ? data.transactions
              : []
          );

        }

      } catch (error) {

        console.error(
          "Transaction loading error:",
          error
        );


        setError(
          "Unable to load transactions. Check that the API server is running."
        );


        setTransactions([]);

      } finally {

        setLoading(false);

      }

    }


    loadTransactions();

  }, [walletAddress]);


  /* =======================================================
     INVESTIGATE WALLET
  ======================================================= */

  const handleInvestigate = () => {

    const address =
      searchAddress.trim();


    if (!address) {

      alert(
        "Please enter a wallet address."
      );

      return;
    }


    setWalletAddress(address);

    setSelectedNode(null);
  };


  /* =======================================================
     BUILD NODES
  ======================================================= */

  const nodes = useMemo(() => {

    const nodeMap =
      new Map();


    transactions.forEach((tx) => {

      const sender =
        getSender(tx);

      const receiver =
        getReceiver(tx);


      [
        sender,
        receiver,
      ].forEach((address) => {

        if (!address) {
          return;
        }


        const normalized =
          normalizeAddress(address);


        if (
          nodeMap.has(normalized)
        ) {
          return;
        }


        const location =
          getNodeLocation(
            address,
            vasps
          );


        if (!location) {
          return;
        }


        let type =
          "wallet";


        if (location.vasp) {

          type =
            "exchange";

        } else if (
          normalized.includes(
            "tornado"
          ) ||
          normalized.includes(
            "mixer"
          )
        ) {

          type =
            "mixer";

        } else if (
          normalized.includes(
            "victim"
          )
        ) {

          type =
            "victim";

        } else if (
          normalized.includes(
            "intermediary"
          )
        ) {

          type =
            "intermediary";

        }


        nodeMap.set(
          normalized,
          {
            id: normalized,

            address,

            lat:
              location.lat,

            lng:
              location.lng,

            type,

            vasp:
              location.vasp,

            source:
              location.source,
          }
        );

      });

    });


    /* -----------------------------------------------------
       Always show investigated wallet
    ----------------------------------------------------- */

    if (walletAddress) {

      const normalized =
        normalizeAddress(
          walletAddress
        );


      if (
        !nodeMap.has(normalized)
      ) {

        const location =
          getNodeLocation(
            walletAddress,
            vasps
          );


        if (location) {

          nodeMap.set(
            normalized,
            {
              id: normalized,

              address:
                walletAddress,

              lat:
                location.lat,

              lng:
                location.lng,

              type: "wallet",

              vasp:
                location.vasp,

              source:
                location.source,
            }
          );

        }
      }
    }


    return Array.from(
      nodeMap.values()
    );

  }, [
    transactions,
    vasps,
    walletAddress,
  ]);


  /* =======================================================
     BUILD TRANSACTION PATHS
  ======================================================= */

  const paths = useMemo(() => {

    return transactions
      .map((tx) => {

        const sender =
          getSender(tx);

        const receiver =
          getReceiver(tx);


        const senderNode =
          nodes.find(
            (node) =>
              node.id ===
              normalizeAddress(
                sender
              )
          );


        const receiverNode =
          nodes.find(
            (node) =>
              node.id ===
              normalizeAddress(
                receiver
              )
          );


        if (
          !senderNode ||
          !receiverNode
        ) {
          return null;
        }


        return {

          id:
            getHash(tx) ||
            `${sender}-${receiver}`,

          positions: [

            [
              senderNode.lat,
              senderNode.lng,
            ],

            [
              receiverNode.lat,
              receiverNode.lng,
            ],

          ],

          transaction:
            tx,
        };

      })

      .filter(Boolean);

  }, [
    transactions,
    nodes,
  ]);


  /* =======================================================
     CONVERT PATHS FOR DECK.GL

     Existing paths:
     [latitude, longitude]

     deck.gl:
     [longitude, latitude]
  ======================================================= */

  const deckPaths = useMemo(() => {

    return paths

      .filter(
        (path) =>
          path.positions &&
          path.positions.length >= 2
      )

      .map((path) => {

        const start =
          path.positions[0];

        const end =
          path.positions[
            path.positions.length - 1
          ];


        return {

          id:
            path.id,

          sourcePosition: [
            start[1],
            start[0],
          ],

          targetPosition: [
            end[1],
            end[0],
          ],

          transaction:
            path.transaction,
        };

      });

  }, [paths]);


  /* =======================================================
     TRANSACTION ARC LAYER

     ONE layer only.

     This prevents the duplicated/double strings
     that were happening when multiple ArcLayers
     rendered the same transactions.
  ======================================================= */

  const arcLayer = useMemo(() => {

    return new ArcLayer({

      id:
        "transaction-arcs",

      data:
        deckPaths,


      getSourcePosition:
        (d) =>
          d.sourcePosition,


      getTargetPosition:
        (d) =>
          d.targetPosition,


      getSourceColor:
        [34, 211, 238, 220],


      getTargetColor:
        [255, 107, 107, 220],


      getWidth:
        1.5,


      widthUnits:
        "pixels",


      widthMinPixels:
        1,


      widthMaxPixels:
        2,


      /*
        Keep the transaction path flat.

        greatCircle false:
        direct projected connection.

        getHeight 0:
        no raised/3D arc.
      */

      greatCircle:
        false,


      getHeight:
        0,


      pickable:
        true,


      parameters: {
        depthTest:
          false,
      },

    });

  }, [deckPaths]);


  /* =======================================================
     NETWORK NODES

     ONE node layer only.
  ======================================================= */

  const nodeLayer = useMemo(() => {

    return new ScatterplotLayer({

      id:
        "transaction-nodes",


      data:
        nodes,


      /*
        deck.gl expects:
        [longitude, latitude]
      */

      getPosition:
        (d) => [
          d.lng,
          d.lat,
        ],


      /* Small screen-based nodes */

      radiusUnits:
        "pixels",


      radiusMinPixels:
        2,


      radiusMaxPixels:
        10,


      getRadius:
        (d) => {

          /* Main wallet */

          if (
            d.id ===
            normalizeAddress(
              walletAddress
            )
          ) {
            return 7;
          }


          /* Exchange */

          if (
            d.type ===
            "exchange"
          ) {
            return 4;
          }


          /* Mixer */

          if (
            d.type ===
            "mixer"
          ) {
            return 4;
          }


          /* Normal node */

          return 3;
        },


      /*
        Keep your existing colors.
      */

      getFillColor:
        (d) => {

          /* Main wallet */

          if (
            d.id ===
            normalizeAddress(
              walletAddress
            )
          ) {
            return [
              255,
              79,
              94,
              255,
            ];
          }


          /* Exchange */

          if (
            d.type ===
            "exchange"
          ) {
            return [
              107,
              220,
              156,
              255,
            ];
          }


          /* Mixer */

          if (
            d.type ===
            "mixer"
          ) {
            return [
              232,
              92,
              115,
              255,
            ];
          }


          /* Victim */

          if (
            d.type ===
            "victim"
          ) {
            return [
              74,
              168,
              255,
              255,
            ];
          }


          /* Intermediary */

          if (
            d.type ===
            "intermediary"
          ) {
            return [
              245,
              196,
              83,
              255,
            ];
          }


          /* Normal */

          return [
            34,
            211,
            238,
            255,
          ];
        },


      stroked:
        true,


      getLineColor:
        [
          255,
          255,
          255,
          150,
        ],


      getLineWidth:
        1,


      lineWidthUnits:
        "pixels",


      lineWidthMinPixels:
        0.5,


      lineWidthMaxPixels:
        1,


      filled:
        true,


      pickable:
        true,


      autoHighlight:
        false,


      onClick:
        ({ object }) => {

          if (object) {

            setSelectedNode(
              object
            );

          }

        },

    });

  }, [
    nodes,
    walletAddress,
  ]);


  /* =======================================================
     ALL DECK.GL LAYERS

     ONLY ONE array.
  ======================================================= */

  const deckLayers = useMemo(() => {

    return [
      arcLayer,
      nodeLayer,
    ];

  }, [
    arcLayer,
    nodeLayer,
  ]);


  /* =======================================================
     ZOOM INFORMATION

     ONLY ONE declaration.
  ======================================================= */

  const zoomInfo =
    getZoomInfo(zoom);


  /* =======================================================
     SELECTED NODE → MOVE MAP

     ONLY ONE effect.
  ======================================================= */

  useEffect(() => {

    if (!selectedNode) {
      return;
    }


    const map =
      mapRef.current?.getMap();


    if (!map) {
      return;
    }


    map.easeTo({

      center: [
        selectedNode.lng,
        selectedNode.lat,
      ],

      zoom:
        Math.max(
          map.getZoom(),
          7
        ),

      duration:
        1200,

    });

  }, [
    selectedNode,
  ]);


  /* =======================================================
     ZOOM CONTROLS
  ======================================================= */

  const zoomIn = () => {

    const map =
      mapRef.current?.getMap();


    if (map) {
      map.zoomIn();
    }

  };


  const zoomOut = () => {

    const map =
      mapRef.current?.getMap();


    if (map) {
      map.zoomOut();
    }

  };


  const zoomNext = () => {

    const map =
      mapRef.current?.getMap();


    if (!map) {
      return;
    }


    map.easeTo({

      zoom:
        Math.min(
          map.getZoom() + 4,
          18
        ),

      duration:
        700,

    });

  };


  /* =======================================================
     SELECTED NODE VASP LINKS
  ======================================================= */

  const selectedVaspLinks =
    Array.isArray(
      selectedNode?.vasp?.addresses
    )
      ? selectedNode.vasp.addresses.length
      : null;


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="network-page">


      {/* =================================================
          HEADER
      ================================================= */}

      <div className="network-header">

        <div>

          <div className="network-eyebrow">
            BLOCKCHAIN INTELLIGENCE
          </div>


          <h1>
            Network Graph
          </h1>


          <p>
            Visualize transaction flows,
            intermediary wallets and VASP
            relationships across geographic
            locations.
          </p>

        </div>


        <div className="network-level">

          <span className="network-level-number">
            {zoomInfo.level}
          </span>


          <div>

            <strong>
              {zoomInfo.title}
            </strong>


            <small>
              {zoomInfo.message}
            </small>

          </div>

        </div>

      </div>


      {/* =================================================
          MAIN GRAPH PANEL
      ================================================= */}

      <div className="network-panel">


        {/* =================================================
            SEARCH
        ================================================= */}

        <div className="network-search">

          <input
            id="suspectWalletAddress"
            name="suspectWalletAddress"
            type="text"

            value={
              searchAddress
            }

            onChange={(event) =>
              setSearchAddress(
                event.target.value
              )
            }

            onKeyDown={(event) => {

              if (
                event.key ===
                "Enter"
              ) {

                handleInvestigate();

              }

            }}

            placeholder="Enter suspect wallet address"
          />


          <button
            onClick={
              handleInvestigate
            }
          >
            Investigate
          </button>

        </div>


        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (

          <div className="network-loading">

            Loading blockchain
            transaction data...

          </div>

        )}


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (

          <div className="network-error">

            {error}

          </div>

        )}


        {/* =================================================
            MAP
        ================================================= */}

        <div className="network-map-container">

          <MapLibre

            ref={mapRef}

            mapStyle={
              CARTO_STYLE_URL
            }


            onLoad={(event) => {

              const map =
                event.target;


              const layers =
                map.getStyle()
                  .layers || [];


              /* =================================================
                 REFERENCE MAP COLORS

                 Only the MapLibre base map is adjusted here.

                 Dashboard/CSS colors are untouched.
              ================================================= */

              layers.forEach(
                (layer) => {

                  const id =
                    String(
                      layer.id || ""
                    ).toLowerCase();


                  const sourceLayer =
                    String(
                      layer[
                        "source-layer"
                      ] || ""
                    ).toLowerCase();


                  try {

                    /* -----------------------------------------
                       Deep navy background
                    ----------------------------------------- */

                    if (
                      layer.type ===
                      "background"
                    ) {

                      map.setPaintProperty(
                        layer.id,
                        "background-color",
                        "#01050A"
                      );

                      return;
                    }


                    /* -----------------------------------------
                       Dark blue water
                    ----------------------------------------- */

                    if (
                      layer.type ===
                        "fill" &&
                      (
                        sourceLayer.includes(
                          "water"
                        ) ||
                        id.includes(
                          "water"
                        )
                      )
                    ) {

                      map.setPaintProperty(
                        layer.id,
                        "fill-color",
                        "#061827"
                      );


                      map.setPaintProperty(
                        layer.id,
                        "fill-opacity",
                        1
                      );


                      return;
                    }


                    /* -----------------------------------------
                       Dark blue land
                    ----------------------------------------- */

                    if (
                      layer.type ===
                        "fill" &&
                      (
                        sourceLayer.includes(
                          "land"
                        ) ||
                        sourceLayer.includes(
                          "landcover"
                        ) ||
                        sourceLayer.includes(
                          "landuse"
                        ) ||
                        sourceLayer.includes(
                          "natural"
                        ) ||
                        sourceLayer.includes(
                          "park"
                        ) ||
                        id.includes(
                          "land"
                        ) ||
                        id.includes(
                          "landcover"
                        ) ||
                        id.includes(
                          "landuse"
                        )
                      )
                    ) {

                      map.setPaintProperty(
                        layer.id,
                        "fill-color",
                        "#0A2133"
                      );


                      map.setPaintProperty(
                        layer.id,
                        "fill-opacity",
                        0.88
                      );


                      return;
                    }


                    /* -----------------------------------------
                       Subtle blue roads
                    ----------------------------------------- */

                    if (
                      layer.type ===
                        "line" &&
                      (
                        sourceLayer.includes(
                          "road"
                        ) ||
                        sourceLayer.includes(
                          "transport"
                        ) ||
                        id.includes(
                          "road"
                        ) ||
                        id.includes(
                          "transport"
                        )
                      )
                    ) {

                      map.setPaintProperty(
                        layer.id,
                        "line-color",
                        "#0A3047"
                      );


                      map.setPaintProperty(
                        layer.id,
                        "line-opacity",
                        0.42
                      );


                      return;
                    }


                    /* -----------------------------------------
                       Cyan boundaries
                    ----------------------------------------- */

                    if (
                      layer.type ===
                        "line" &&
                      (
                        sourceLayer.includes(
                          "boundary"
                        ) ||
                        sourceLayer.includes(
                          "admin"
                        ) ||
                        id.includes(
                          "boundary"
                        ) ||
                        id.includes(
                          "admin"
                        ) ||
                        id.includes(
                          "border"
                        )
                      )
                    ) {

                      map.setPaintProperty(
                        layer.id,
                        "line-color",
                        "#087DBA"
                      );


                      map.setPaintProperty(
                        layer.id,
                        "line-opacity",
                        0.62
                      );


                      map.setPaintProperty(
                        layer.id,
                        "line-width",
                        0.7
                      );


                      return;
                    }


                    /* -----------------------------------------
                       Cyan geographic labels
                    ----------------------------------------- */

                    if (
                      layer.type ===
                        "symbol" &&
                      layer.layout &&
                      layer.layout[
                        "text-field"
                      ] &&
                      (
                        sourceLayer.includes(
                          "place"
                        ) ||
                        sourceLayer.includes(
                          "country"
                        ) ||
                        sourceLayer.includes(
                          "admin"
                        ) ||
                        id.includes(
                          "place"
                        ) ||
                        id.includes(
                          "country"
                        ) ||
                        id.includes(
                          "label"
                        )
                      )
                    ) {

                      map.setPaintProperty(
                        layer.id,
                        "text-color",
                        "#46BDEB"
                      );


                      map.setPaintProperty(
                        layer.id,
                        "text-halo-color",
                        "#00121E"
                      );


                      map.setPaintProperty(
                        layer.id,
                        "text-halo-width",
                        1
                      );


                      map.setPaintProperty(
                        layer.id,
                        "text-opacity",
                        0.82
                      );

                    }


                    /* -----------------------------------------
                       Subtle 3D buildings
                    ----------------------------------------- */

                    if (
                      layer.type ===
                      "fill-extrusion"
                    ) {

                      map.setPaintProperty(
                        layer.id,
                        "fill-extrusion-color",
                        "#08304A"
                      );


                      map.setPaintProperty(
                        layer.id,
                        "fill-extrusion-opacity",
                        0.55
                      );

                    }

                  } catch (error) {

                    /*
                      Ignore individual CARTO layers
                      whose paint properties cannot be
                      modified after load.
                    */

                  }

                }
              );

            }}


            workerUrl={
              maplibreWorker
            }


            initialViewState={{
              longitude: 20,
              latitude: 20,
              zoom: 2,
              pitch: 35,
              bearing: 0,
            }}


            minZoom={2}

            maxZoom={19}


            style={{
              width: "100%",
              height: "600px",
            }}


            onMove={(event) => {

              setZoom(
                event.viewState.zoom
              );

            }}

          >


            {/* =========================================
                MAP CONTROLS
            ========================================= */}

            <NavigationControl

              position="top-left"

              showCompass={
                true
              }

              showZoom={
                true
              }

            />


            {/* =========================================
                DECK.GL
            ========================================= */}

            <DeckGLOverlay
              layers={
                deckLayers
              }
            />


            {/* =========================================
                POPUP
            ========================================= */}

            {selectedNode && (

              <Popup

                longitude={
                  selectedNode.lng
                }

                latitude={
                  selectedNode.lat
                }

                closeButton={
                  true
                }

                closeOnClick={
                  false
                }

                onClose={() =>
                  setSelectedNode(
                    null
                  )
                }

                anchor="bottom"

              >

                <div className="map-popup">


                  <span className="popup-title">

                    {
                      selectedNode.vasp?.name ||
                      selectedNode.type ||
                      "Blockchain Address"
                    }

                  </span>


                  <div className="popup-address">

                    {shortAddress(
                      selectedNode.address
                    )}

                  </div>


                  {selectedNode.source ===
                    "estimated" && (

                    <div className="popup-estimated-note">

                      Location estimated —
                      not a verified address

                    </div>

                  )}


                  <div className="popup-row">

                    <span className="popup-row-label">
                      Type
                    </span>


                    <span className="popup-row-value">

                      {
                        selectedNode.vasp?.type ||
                        selectedNode.type ||
                        "Wallet"
                      }

                    </span>

                  </div>


                  {selectedNode.vasp?.country && (

                    <div className="popup-row">

                      <span className="popup-row-label">
                        Country
                      </span>


                      <span className="popup-row-value">

                        {
                          selectedNode.vasp.country
                        }

                      </span>

                    </div>

                  )}


                  {selectedNode.vasp?.riskLevel && (

                    <div className="popup-row">

                      <span className="popup-row-label">
                        Risk Level
                      </span>


                      <RiskBadge
                        riskLevel={
                          selectedNode.vasp
                            .riskLevel
                        }
                      />

                    </div>

                  )}


                  {selectedVaspLinks != null && (

                    <div className="popup-row">

                      <span className="popup-row-label">
                        VASP Links
                      </span>


                      <span className="popup-row-value">

                        {
                          selectedVaspLinks
                        }

                      </span>

                    </div>

                  )}

                </div>

              </Popup>

            )}

          </MapLibre>


          {/* =================================================
              LEVEL INDICATOR
          ================================================= */}

          <div className="network-map-top">

            <div className="map-level-badge">

              <span>
                LEVEL {zoomInfo.level}
              </span>


              <strong>
                {zoomInfo.title}
              </strong>

            </div>

          </div>


          {/* =================================================
              CUSTOM ZOOM CONTROLS
          ================================================= */}

          <div className="network-custom-controls">

            <button
              onClick={
                zoomIn
              }
              title="Zoom in"
            >
              +
            </button>


            <button
              onClick={
                zoomOut
              }
              title="Zoom out"
            >
              −
            </button>


            <button
              onClick={
                zoomNext
              }
              title="Next geographic level"
            >
              ◎
            </button>

          </div>


          {/* =================================================
              LEGEND
          ================================================= */}

          <div className="network-legend">

            <div className="legend-title">
              INVESTIGATION LAYERS
            </div>


            <div>

              <span className="legend-dot suspicious"></span>

              Suspicious Address

            </div>


            <div>

              <span className="legend-dot vasp"></span>

              VASP / Exchange

            </div>


            <div>

              <span className="legend-dot path"></span>

              Transaction Path

            </div>


            <div>

              <span className="legend-dot estimated"></span>

              Estimated location

            </div>

          </div>


          {/* =================================================
              NEXT LEVEL
          ================================================= */}

          <button

            className="network-next-level"

            onClick={
              zoomNext
            }

          >

            {
              zoomInfo.message
            }

            <span>
              →
            </span>

          </button>

        </div>

      </div>


      {/* =================================================
          SELECTED NODE DETAILS
      ================================================= */}

      {selectedNode && (

        <div className="network-details">


          <div className="network-details-header">

            <div>

              <span>
                SELECTED NODE
              </span>


              <h2>

                {
                  selectedNode.vasp?.name ||
                  "Blockchain Address"
                }

              </h2>

            </div>


            <button
              onClick={() =>
                setSelectedNode(
                  null
                )
              }
            >
              ×
            </button>

          </div>


          <div className="network-details-grid">


            {/* ADDRESS */}

            <div>

              <label>
                BLOCKCHAIN ADDRESS
              </label>


              <code>
                {
                  selectedNode.address
                }
              </code>

            </div>


            {/* TYPE */}

            <div>

              <label>
                TYPE
              </label>


              <strong>

                {
                  selectedNode.vasp?.type ||
                  selectedNode.type ||
                  "Wallet"
                }

              </strong>

            </div>


            {/* COUNTRY */}

            <div>

              <label>
                COUNTRY
              </label>


              <strong>

                {
                  selectedNode.vasp?.country ||
                  "Not available"
                }

              </strong>

            </div>


            {/* RISK */}

            <div>

              <label>
                RISK LEVEL
              </label>


              <RiskBadge

                riskLevel={
                  selectedNode.vasp?.riskLevel ||
                  "unknown"
                }

              />

            </div>


            {/* LOCATION SOURCE */}

            <div>

              <label>
                LOCATION SOURCE
              </label>


              <strong>

                {
                  selectedNode.source ===
                  "estimated"
                    ? "Estimated"
                    : selectedNode.source ===
                      "vasp"
                    ? "VASP Data"
                    : "Demo Data"
                }

              </strong>

            </div>

          </div>

        </div>

      )}

    </div>

  );
}
