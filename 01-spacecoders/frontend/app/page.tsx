"use client";

import React, { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", { autoConnect: false });

export default function GameArena() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [role, setRole] = useState("spectator");
  const [matchState, setMatchState] = useState("WAITING");
  const [pauseInitiator, setPauseInitiator] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [code, setCode] = useState<string>(`// Write your code logic here!
`);

  useEffect(() => {
    socket.connect();

    socket.on("role_assigned", (assignedRole) => setRole(assignedRole));

    socket.on("match_state_change", (data) => {
      setMatchState(data.matchState);
      setPauseInitiator(data.pauseInitiator);
      if (role === "player1") setIsReady(data.playerReady.player1);
      else if (role === "player2") setIsReady(data.playerReady.player2);
    });

    socket.on("game_state_update", (state) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#0c111d";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

      if (state.timeLeft !== undefined) {
        ctx.fillStyle = state.isOvertime ? "#ef4444" : "#f8fafc";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "center";

        const timerText = state.isOvertime
          ? `OVERTIME: ${Math.ceil(state.timeLeft)}`
          : Math.ceil(state.timeLeft).toString();

        ctx.fillText(timerText, canvas.width / 2, 40);
        ctx.textAlign = "left";
      }

      const drawSpacecraft = (playerState: any, mainColor: string, accentColor: string) => {
        if (!playerState || playerState.health <= 0) return;
        ctx.save();
        ctx.translate(playerState.x, playerState.y);
        ctx.rotate(playerState.angle || 0);

        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -11);
        ctx.lineTo(-12, 11);
        ctx.closePath();
        ctx.fillStyle = mainColor; ctx.fill();
        ctx.strokeStyle = accentColor; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "#1e293b"; ctx.fillRect(playerState.x - 20, playerState.y - 25, 40, 4);
        ctx.fillStyle = mainColor === "#38bdf8" ? "#10b981" : "#ef4444";
        ctx.fillRect(playerState.x - 20, playerState.y - 25, (playerState.health / 100) * 40, 4);
      };

      drawSpacecraft(state.player1, "#38bdf8", "#0ea5e9");
      drawSpacecraft(state.player2, "#f87171", "#ef4444");

      if (state.lasers) {
        state.lasers.forEach((laser: any) => {
          ctx.beginPath();
          ctx.arc(laser.x, laser.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = "#facc15"; ctx.fill();
        });
      }

      if (state.player1 && state.player1.health <= 0 && state.player2 && state.player2.health <= 0) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#facc15"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center";
        ctx.fillText("MUTUAL DESTRUCTION - DRAW", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
      } else if (state.player1 && state.player1.health <= 0) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f87171"; ctx.font = "bold 26px monospace";
        ctx.fillText("PLAYER 2 WINS", canvas.width / 2 - 100, canvas.height / 2);
      } else if (state.player2 && state.player2.health <= 0) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#34d399"; ctx.font = "bold 26px monospace";
        ctx.fillText("PLAYER 1 WINS", canvas.width / 2 - 100, canvas.height / 2);
      } else if (state.timeLeft <= 0 && state.isOvertime) {
        // Overtime expired and both ships still have active health values
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#facc15"; ctx.font = "bold 26px monospace";
        ctx.textAlign = "center";
        ctx.fillText("TIME UP - DRAW", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
      }
    });

    return () => {
      socket.off("role_assigned");
      socket.off("match_state_change");
      socket.off("game_state_update");
      socket.disconnect();
    };
  }, [role]);

  const isEditing = matchState === "WAITING" ? !isReady : matchState === "PAUSED" ? pauseInitiator === role : false;

  const handleStartMatch = () => {
    socket.emit("submit_code", code);
    socket.emit("trigger_start");
  };

  const handleImplementChanges = () => {
    socket.emit("submit_code", code);
  };

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100vh", backgroundColor: "#020617", color: "#f8fafc", fontFamily: "monospace" }}>

      <div style={{ width: "25%", borderRight: "2px solid #1e293b", padding: "16px", overflowY: "auto", backgroundColor: "#0f172a" }}>
        <h2 style={{ fontSize: "1.2rem", color: "#34d399", marginBottom: "16px" }}>API Manual</h2>

        <h3 style={{ color: "#94a3b8", borderBottom: "1px solid #334155", paddingBottom: "4px", marginBottom: "8px" }}>Properties</h3>
        <div style={{ marginBottom: "12px", fontSize: "0.85rem" }}>
          <div style={{ marginBottom: "8px" }}><code style={{ color: "#38bdf8" }}>spacecraft.position</code><div style={{ color: "#cbd5e1" }}>Current coords: {`{x, y}`}</div></div>
          <div style={{ marginBottom: "8px" }}><code style={{ color: "#38bdf8" }}>spacecraft.velocity</code><div style={{ color: "#cbd5e1" }}>Current speed/vector: {`{x, y}`}</div></div>
          <div style={{ marginBottom: "8px" }}><code style={{ color: "#38bdf8" }}>spacecraft.direction</code><div style={{ color: "#cbd5e1" }}>Facing angle in degrees.</div></div>
          <div style={{ marginBottom: "8px" }}><code style={{ color: "#38bdf8" }}>spacecraft.health</code><div style={{ color: "#cbd5e1" }}>Current hull integrity (0-100).</div></div>
          <div style={{ marginBottom: "8px" }}><code style={{ color: "#38bdf8" }}>spacecraft.enemy</code><div style={{ color: "#cbd5e1" }}>Object containing enemy's {`position, velocity, direction, health`}.</div></div>
        </div>

        <h3 style={{ color: "#94a3b8", borderBottom: "1px solid #334155", paddingBottom: "4px", marginBottom: "8px" }}>Methods</h3>
        <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div><code style={{ color: "#eab308" }}>distanceTo(obj)</code><div style={{ color: "#cbd5e1" }}>Distance to any object with a position.</div></div>
          <div><code style={{ color: "#eab308" }}>lookAt(target?)</code><div style={{ color: "#cbd5e1" }}>Rotates to face target {`{x,y}`}. Defaults to enemy.</div></div>
          <div><code style={{ color: "#eab308" }}>moveTo(target)</code><div style={{ color: "#cbd5e1" }}>Thrusts ship toward target {`{x,y}`}.</div></div>
          <div><code style={{ color: "#eab308" }}>shoot(angle?)</code><div style={{ color: "#cbd5e1" }}>Fires laser. Defaults to current direction.</div></div>
          <div><code style={{ color: "#eab308" }}>shootAt(target)</code><div style={{ color: "#cbd5e1" }}>Fires laser directly at target {`{x,y}`}.</div></div>
          <div><code style={{ color: "#eab308" }}>face(degrees)</code><div style={{ color: "#cbd5e1" }}>Rotates ship to a specific angle.</div></div>
          <div><code style={{ color: "#eab308" }}>getProjectiles()</code><div style={{ color: "#cbd5e1" }}>Returns array of incoming enemy lasers.</div></div>
          <div><code style={{ color: "#eab308" }}>circleAround(radius)</code><div style={{ color: "#cbd5e1" }}>Orbits the enemy at a given radius distance.</div></div>
        </div>
      </div>

      <div style={{ width: "35%", display: "flex", flexDirection: "column", borderRight: "2px solid #1e293b", padding: "16px" }}>
        <h2 style={{ fontSize: "1.2rem", color: "#38bdf8", marginBottom: "4px" }}>TACTICAL SCRIPTER</h2>
        <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "16px" }}>
          Role: <strong style={{ color: role === 'player1' ? '#38bdf8' : '#f87171' }}>{role.toUpperCase()}</strong>
        </p>

        <div style={{ flexGrow: 1, border: "1px solid #334155", borderRadius: "6px", overflow: "hidden" }}>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              automaticLayout: true,
              readOnly: !isEditing,
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              wordBasedSuggestions: "off",
              snippetSuggestions: "none",
              parameterHints: { enabled: false }
            }}
          />
        </div>

        {role !== "spectator" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>

            {matchState === "WAITING" && (
              <button onClick={handleStartMatch} disabled={isReady} style={{ padding: "12px", backgroundColor: isReady ? "#334155" : "#16a34a", color: isReady ? "#94a3b8" : "#ffffff", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: isReady ? "not-allowed" : "pointer", textTransform: "uppercase" }}>
                {isReady ? "Waiting for Opponent..." : "Start Match"}
              </button>
            )}

            {matchState === "RUNNING" && (
              <button onClick={() => socket.emit("trigger_pause")} style={{ padding: "12px", backgroundColor: "#eab308", color: "#000000", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", textTransform: "uppercase" }}>
                Change Code
              </button>
            )}

            {matchState === "PAUSED" && (
              pauseInitiator === role ? (
                <button onClick={handleImplementChanges} style={{ padding: "12px", backgroundColor: "#2563eb", color: "#ffffff", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", textTransform: "uppercase" }}>
                   Implement Changes
                </button>
              ) : (
                <div style={{ padding: "12px", backgroundColor: "#334155", color: "#f8fafc", fontWeight: "bold", textAlign: "center", borderRadius: "6px", border: "1px solid #475569" }}>
                  Opponent is modifying code...
                </div>
              )
            )}

            {(matchState === "ENDED" || matchState === "PAUSED") && (
              <button
                onClick={() => socket.emit("trigger_reset")}
                disabled={matchState === "PAUSED"}
                style={{
                  padding: "12px",
                  backgroundColor: matchState === "PAUSED" ? "#334155" : "#dc2626",
                  color: matchState === "PAUSED" ? "#94a3b8" : "#ffffff",
                  fontWeight: "bold",
                  border: "none",
                  borderRadius: "6px",
                  cursor: matchState === "PAUSED" ? "not-allowed" : "pointer",
                  textTransform: "uppercase"
                }}
              >
                Reset Match
              </button>
            )}

          </div>
        )}
      </div>

      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "16px", backgroundColor: "#020617" }}>
        <div style={{ marginBottom: "16px", fontSize: "0.85rem", letterSpacing: "1px" }}>
          <span style={{ color: matchState === "ENDED" ? "#ef4444" : matchState === "RUNNING" ? "#22c55e" : "#f59e0b", fontWeight: "bold" }}>
            STATUS: {matchState === "WAITING" ? "AWAITING PLAYERS" : matchState === "RUNNING" ? "MATCH RUNNING" : matchState === "PAUSED" ? "MATCH PAUSED" : "MATCH CONCLUDED - RESET REQUIRED"}
          </span>
        </div>

        <canvas ref={canvasRef} width={800} height={600} style={{ border: "2px solid #1e293b", borderRadius: "8px", backgroundColor: "#0c111d" }} />
      </div>

    </div>
  );
}