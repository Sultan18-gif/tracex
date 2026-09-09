import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";


const DEMO_WALLET = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

const DEMO_TRANSACTIONS = [
  { sender: DEMO_WALLET, receiver: "0xTornadoCashPool0000000000000000000001", amount: 100, hash: "0x8f2a11c9e4d7a3b6f0912c88de44a9b1c7e3f2a91d0c5b8e7f1a2c3d4e5f6a91" },
  { sender: DEMO_WALLET, receiver: "0xIntermediaryHopAlpha00000000000000002", amount: 45, hash: "0x1a4b7d92e6c3f8091b5a2d7e4c9f0123456789abcdef0123456789abcdef012" },
  { sender: "0xIntermediaryHopAlpha00000000000000002", receiver: "0xBinanceHotWallet000000000000000000003", amount: 30, hash: "0x9c8801a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7081920a1b2c3d" },
  { sender: DEMO_WALLET, receiver: "0xVictimProtocolContract0000000000004", amount: 12, hash: "0x3e5f6071829a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c" },
];

// Known approximate locations for demo entities (e.g. which country an
// exchange or mixer relay is associated with). A raw wallet address has no
// inherent location — this only applies when you actually know something
// about the entity behind an address (exchange HQ, server region, etc).
// Add real entries here (or feed them from your backend) as { lat, lng, label }.
const NODE_LOCATIONS = {
  [DEMO_WALLET]: { lat: 40.7128, lng: -74.006, label: "New York, USA — investigated wallet (IP-linked)" },
  "0xTornadoCashPool0000000000000000000001": { lat: 48.8566, lng: 2.3522, label: "Paris, FR — mixer relay node" },
  "0xIntermediaryHopAlpha00000000000000002": { lat: 1.3521, lng: 103.8198, label: "Singapore — intermediary hop" },
  "0xBinanceHotWallet000000000000000000003": { lat: 35.6895, lng: 139.6917, label: "Tokyo, JP — exchange off-ramp" },
  "0xVictimProtocolContract0000000000004": { lat: 52.52, lng: 13.405, label: "Berlin, DE — victim protocol" },
};

export default function NetworkGraph({ walletAddress = "" }) {
  const graphRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const API_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

  useEffect(() => {
    if (!walletAddress) {
      // No address entered yet — show example data so the graph isn't empty.
      setIsDemo(true);
      setSelectedNode(null);
      setTransactions(DEMO_TRANSACTIONS);
      return;
    }

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setIsDemo(false);
        setSelectedNode(null);

        const response = await fetch(
          `${API_URL}/transactions/${walletAddress}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch transaction data");
        }

        const data = await response.json();

        setTransactions(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Network graph error:", error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [walletAddress, API_URL]);

  useEffect(() => {
    if (!graphRef.current) return;

    let isCancelled = false;
    let simulation;

    graphRef.current.innerHTML = "";

    const width = 900;
    const height = 500;

    const svg = d3
      .select(graphRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "500");

    // Base background
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#050b12");

    // Shared projection — used both for the land shapes and for pinning
    // any node that has a known real-world location.
    const projection = d3
      .geoMercator()
      .scale(width / 6.5)
      .translate([width / 2, height / 1.6]);

    // World map backdrop (decorative — wallet addresses have no real
    // geographic location by themselves; only entities we specifically
    // know something about, via NODE_LOCATIONS, get pinned on the map).
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
      .then((worldData) => {
        if (isCancelled) return;

        const land = topojson.feature(worldData, worldData.objects.land);
        const path = d3.geoPath().projection(projection);

        svg
          .append("path")
          .datum(land)
          .attr("d", path)
          .attr("fill", "#0d1b2a")
          .attr("stroke", "#00f0ff")
          .attr("stroke-width", 0.5)
          .attr("stroke-opacity", 0.35);
      })
      .catch((err) => {
        console.error("World map failed to load:", err);
      })
      .finally(() => {
        if (!isCancelled) drawGraphLayer();
      });

    function drawGraphLayer() {
      if (!transactions.length) {
        svg
          .append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#8fa6b5")
          .text(
            walletAddress
              ? "No transaction relationships found"
              : "Enter a wallet address to generate the network graph"
          );

        return;
      }

      const nodesMap = new Map();
      const links = [];

      transactions.forEach((tx) => {
        const sender = tx.sender || tx.from;
        const receiver = tx.receiver || tx.to;

        if (!sender || !receiver) return;

        if (!nodesMap.has(sender)) {
          nodesMap.set(sender, {
            id: sender,
            type: sender === (walletAddress || DEMO_WALLET) ? "investigated" : "wallet",
            location: NODE_LOCATIONS[sender] || null,
          });
        }

        if (!nodesMap.has(receiver)) {
          nodesMap.set(receiver, {
            id: receiver,
            type: receiver === (walletAddress || DEMO_WALLET) ? "investigated" : "wallet",
            location: NODE_LOCATIONS[receiver] || null,
          });
        }

        links.push({
          source: sender,
          target: receiver,
          amount: tx.amount || 0,
          hash: tx.hash || tx.txHash || tx.transactionHash || "unknown",
        });
      });

      const nodes = Array.from(nodesMap.values());

      // Pin any node with a known real-world location to its actual map
      // position, so it doesn't drift with the force simulation.
      nodes.forEach((d) => {
        if (d.location) {
          const [x, y] = projection([d.location.lng, d.location.lat]);
          d.fx = x;
          d.fy = y;
        }
      });

      simulation = d3
        .forceSimulation(nodes)
        .force(
          "link",
          d3
            .forceLink(links)
            .id((d) => d.id)
            .distance(140)
        )
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2));

      const link = svg
        .append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "#3a5363")
        .attr("stroke-width", 2);

      const node = svg
        .append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .style("cursor", "pointer")
        .on("click", (event, d) => setSelectedNode(d.id))
        .call(
          d3
            .drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded)
        );

      node
        .append("circle")
        .attr("r", (d) => (d.type === "investigated" ? 14 : 9))
        .attr("fill", (d) =>
          d.type === "investigated" ? "#e24b4a" : "#3ea36f"
        )
        .attr("stroke", (d) => (d.id === selectedNode ? "#00f0ff" : "none"))
        .attr("stroke-width", 2.5)
        .attr("filter", "drop-shadow(0 0 4px rgba(0,240,255,0.5))");

      node
        .append("text")
        .text((d) => `${d.id.slice(0, 8)}...`)
        .attr("x", 14)
        .attr("y", 4)
        .attr("fill", "#d6e0e6")
        .attr("font-size", "11px");

      node
        .filter((d) => !!d.location)
        .append("text")
        .text((d) => d.location.label.split(" — ")[0])
        .attr("x", 14)
        .attr("y", 18)
        .attr("fill", "#5d8aa8")
        .attr("font-size", "9px");

      simulation.on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

      function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
    }

    return () => {
      isCancelled = true;
      if (simulation) simulation.stop();
    };
  }, [transactions, walletAddress, selectedNode]);

  const relatedTransactions = selectedNode
    ? transactions.filter((tx) => {
        const sender = tx.sender || tx.from;
        const receiver = tx.receiver || tx.to;
        return sender === selectedNode || receiver === selectedNode;
      })
    : [];

  return (
    <div
      style={{
        padding: "2rem",
        minHeight: "100vh",
        background: "#050b12",
        color: "#ffffff",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
          }}
        >
          Blockchain Network Graph
        </h1>

        <p
          style={{
            margin: "0 0 25px",
            color: "#8fa6b5",
          }}
        >
          Visualize wallet-to-wallet transaction relationships
          during fraud investigation.
        </p>

        <div
          style={{
            background: "#07131d",
            border: "1px solid #173447",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Enter suspect wallet address"
              value={walletAddress}
              readOnly
              style={{
                flex: 1,
                minWidth: "280px",
                padding: "12px",
                background: "#050b12",
                border: "1px solid #173447",
                borderRadius: "7px",
                color: "#ffffff",
              }}
            />
          </div>

          {loading && (
            <p style={{ color: "#8fa6b5" }}>
              Loading blockchain transactions...
            </p>
          )}

          {isDemo && (
            <p style={{ color: "#f5c453", fontSize: "12px", marginBottom: "10px" }}>
              Showing example data — enter a real wallet address to search actual transactions.
            </p>
          )}

          <div
            ref={graphRef}
            style={{
              width: "100%",
              minHeight: "500px",
              background: "#050b12",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          />

          {selectedNode && (
            <div
              style={{
                marginTop: "16px",
                background: "#050b12",
                border: "1px solid #173447",
                borderRadius: "10px",
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: "#8fa6b5", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Selected wallet
                  </p>
                  <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: "13px", wordBreak: "break-all" }}>
                    {selectedNode}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "bold",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                    background: selectedNode === (walletAddress || DEMO_WALLET) ? "rgba(226,75,74,0.15)" : "rgba(62,163,111,0.15)",
                    color: selectedNode === (walletAddress || DEMO_WALLET) ? "#e24b4a" : "#3ea36f",
                  }}
                >
                  {selectedNode === (walletAddress || DEMO_WALLET) ? "Investigated" : "Connected"}
                </span>
              </div>

              {NODE_LOCATIONS[selectedNode] && (
                <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#5d8aa8" }}>
                  📍 {NODE_LOCATIONS[selectedNode].label}
                </p>
              )}

              <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#8fa6b5", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Related transactions ({relatedTransactions.length})
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {relatedTransactions.map((tx, i) => {
                  const sender = tx.sender || tx.from;
                  const receiver = tx.receiver || tx.to;
                  const isOutgoing = sender === selectedNode;

                  return (
                    <div
                      key={i}
                      style={{
                        background: "#07131d",
                        border: "1px solid #173447",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#8fa6b5", marginBottom: "4px" }}>
                        <span>{isOutgoing ? "Sent" : "Received"}</span>
                        <span>{tx.amount} {tx.currency || "ETH"}</span>
                      </div>
                      <div style={{ color: "#d6e0e6", wordBreak: "break-all" }}>
                        Tx hash: {tx.hash || tx.txHash || tx.transactionHash || "unavailable"}
                      </div>
                      <div style={{ color: "#5d7086", marginTop: "2px", wordBreak: "break-all" }}>
                        {isOutgoing ? "To: " : "From: "}
                        {isOutgoing ? receiver : sender}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "20px",
            marginTop: "15px",
            fontSize: "13px",
            color: "#8fa6b5",
          }}
        >
          <span>🔴 Investigated wallet</span>
          <span>🟢 Connected wallet</span>
          <span>━ Transaction relationship</span>
          <span>📍 Known location (exchange/mixer)</span>
        </div>
      </div>
    </div>
  );
}