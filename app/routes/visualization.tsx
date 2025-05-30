import React, { useEffect, useState, useRef } from "react";
import Wave from "react-wavify";

// --- Energy estimation functions ---
function estimateLlmEnergyConsumption(tokens: number): number {
  const ENERGY_PER_1000_TOKENS_KWH = 0.0003; // kWh per 1,000 tokens (adjust as needed)
  const energyUsedKwh = (tokens / 1000) * ENERGY_PER_1000_TOKENS_KWH;
  return energyUsedKwh;
}

function estimateTokens(textLength: number): number {
  return Math.ceil(textLength / 4);
}

function estimateWaterUsageLiters(kWh: number): number {
  const waterUsageEffectiveness = 1; // liters per kWh
  return kWh * waterUsageEffectiveness;
}

function formatMicroLiters(liters: number) {
  const microLiters = liters * 1_000_000;
  if (microLiters < 1) return "<1";
  if (microLiters < 1000) return microLiters.toFixed(0);
  if (microLiters < 1000000) return (microLiters / 1000).toFixed(2) + "k";
  return microLiters.toExponential(2);
}

// New: format micro kWh for display
function formatMicroKwh(kwh: number) {
  const microKwh = kwh * 1_000_000;
  if (microKwh < 1) return "<1";
  if (microKwh < 1000) return microKwh.toFixed(0);
  if (microKwh < 1000000) return (microKwh / 1000).toFixed(2) + "k";
  return microKwh.toExponential(2);
}

const bc = new BroadcastChannel("tesi-gpt");

export default function WaterColumns() {
  const [energyUsed, setEnergyUsed] = useState(0);
  const [animatedEnergyUsed, setAnimatedEnergyUsed] = useState(0);
  const animationRef = useRef<number | null>(null);

  // --- Water usage state ---
  const [waterUsed, setWaterUsed] = useState(0);
  const [animatedWaterUsed, setAnimatedWaterUsed] = useState(0);

  // --- Bulb state ---
  const [bulbOn, setBulbOn] = useState(false);
  const [bulbCountdown, setBulbCountdown] = useState(0);
  const bulbTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bulbIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // When a new message is received, update energy/water and trigger bulb
  useEffect(() => {
    bc.onmessage = (event) => {
      // Estimate tokens for prompt and response
      const promptTokens = estimateTokens(event.data.promptChars || 0);
      const responseTokens = estimateTokens(event.data.responseChars || 0);
      const totalTokens = promptTokens + responseTokens;
      const energy = estimateLlmEnergyConsumption(totalTokens);
      setEnergyUsed(energy);
      const water = estimateWaterUsageLiters(energy);
      setWaterUsed(water);
      console.log(`Energy used: ${energy} kWh, Water used: ${water} liters`);

      // --- Bulb logic ---
      // Calculate seconds the bulb should be on
      const BULB_POWER_KW = 0.01;
      let seconds = Math.round((energy / BULB_POWER_KW) * 3600);
      // Clamp to a reasonable range (e.g., max 60s, min 1s)
      if (seconds > 60) seconds = 60;
      if (seconds < 1) seconds = 1;

      setBulbOn(true);
      setBulbCountdown(seconds);

      // Clear previous timers
      if (bulbTimeoutRef.current) clearTimeout(bulbTimeoutRef.current);
      if (bulbIntervalRef.current) clearInterval(bulbIntervalRef.current);

      // Countdown interval
      bulbIntervalRef.current = setInterval(() => {
        setBulbCountdown((prev) => {
          if (prev <= 1) {
            setBulbOn(false);
            if (bulbIntervalRef.current) clearInterval(bulbIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Timeout to turn off bulb
      bulbTimeoutRef.current = setTimeout(() => {
        setBulbOn(false);
        setBulbCountdown(0);
        setEnergyUsed(0);
        setWaterUsed(0);
        if (bulbIntervalRef.current) clearInterval(bulbIntervalRef.current);
      }, seconds * 1000);
    };
    return () => {
      bc.close();
      if (bulbTimeoutRef.current) clearTimeout(bulbTimeoutRef.current);
      if (bulbIntervalRef.current) clearInterval(bulbIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth animation for water level (based on energy animation)
  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    const duration = 600; // ms
    const start = animatedWaterUsed;
    const end = waterUsed;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Use easeInOutQuad for a smoother transition
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress;
      const value = start + (end - start) * eased;
      setAnimatedEnergyUsed(value);

      // Animate water usage in sync
      const waterStart = estimateWaterUsageLiters(start);
      const waterEnd = estimateWaterUsageLiters(end);
      const waterValue = waterStart + (waterEnd - waterStart) * eased;
      setAnimatedWaterUsed(waterValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setAnimatedEnergyUsed(end); // Ensure it ends exactly at the target
        setAnimatedWaterUsed(waterEnd);
      }
    }
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energyUsed]);

  // For visualization, set a max water value (e.g., 0.01 liters)
  const minWater = 0.00002;
  const maxWater = 0.00005;

  // Map animatedWaterUsed in [minWater, maxWater] to [0, 1] for column height
  const normalized = Math.max(
    0.1,
    Math.min((animatedWaterUsed - minWater) / (maxWater - minWater), 1)
  );

  const maxHeight = 250;
  const col1Height = normalized * maxHeight;
  const col2Height = normalized > 0.1 ? Math.min(Math.sqrt(normalized), 1) * maxHeight : col1Height;

  // Wave wrapper style
  const waveWrapperStyle = (height: number) => ({
    position: "absolute" as const,
    left: 0,
    bottom: 0,
    width: "100%",
    height: `${height}px`,
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
    zIndex: 1,
    background: "none",
  });

  // Column container style
  const columnContainerStyle = {
    width: "6rem",
    height: "18rem",
    border: "4px solid #60a5fa",
    background: "#fff",
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
    position: "relative" as const,
    marginBottom: "0.5rem",
  };

  // Water background fill for under the wave (now only 10% of the wave height)
  const waterBgStyle = (height: number) => ({
    position: "absolute" as const,
    left: 0,
    bottom: 0,
    width: "100%",
    height: `${height * 0.1}px`,
    background: "linear-gradient(120deg, #2563eb 60%, #38bdf8 100%)",
    zIndex: 0,
    pointerEvents: "none",
  });

  // --- Bulb SVG ---
  function Bulb({ on }: { on: boolean }) {
    return (
      <svg
        width="48"
        height="72"
        viewBox="0 0 48 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          display: "block",
          filter: on ? "drop-shadow(0 0 16px #fde047)" : "none",
          transition: "filter 0.2s",
        }}
      >
        <ellipse
          cx="24"
          cy="28"
          rx="20"
          ry="24"
          fill={on ? "#fde047" : "#d1d5db"}
          stroke="#fbbf24"
          strokeWidth="3"
        />
        <rect
          x="18"
          y="52"
          width="12"
          height="10"
          rx="4"
          fill="#a3a3a3"
        />
        <rect
          x="20"
          y="62"
          width="8"
          height="6"
          rx="3"
          fill="#6b7280"
        />
        {/* Filament */}
        <path
          d="M20 44 Q24 48 28 44"
          stroke={on ? "#f59e42" : "#a3a3a3"}
          strokeWidth="2"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <main className="flex flex-col items-center justify-start h-screen bg-blue-50">
      {/* Bulb UI on the left */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          zIndex: 10,
          background: "rgba(255,255,255,0.95)",
          borderRadius: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          padding: "1rem",
          maxWidth: "220px",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Header instead of speech bubble */}
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.05rem",
              color: "#92400e",
              marginBottom: "0.7rem",
              textAlign: "center",
            }}
          >
            Electricity Used for this Prompt
          </div>
          <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
            <Bulb on={bulbOn} />
          </div>
        </div>
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            color: "#92400e",
            marginBottom: "0.2rem",
            textAlign: "center",
          }}
        >
          {formatMicroKwh(animatedEnergyUsed)} μkWh
        </div>
        <div
          style={{
            fontSize: "0.98rem",
            color: bulbOn ? "#f59e42" : "#a3a3a3",
            fontWeight: 500,
            textAlign: "center",
            minHeight: "1.5em",
          }}
        >
          {bulbOn
            ? `Bulb on: ${bulbCountdown}s`
            : "Bulb off"}
        </div>
        <div
          style={{
            fontSize: "0.85rem",
            color: "#78716c",
            textAlign: "center",
            marginTop: "0.2rem",
          }}
        >
          (1 bulb = 10W)
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-4 mt-10">
        Estimated Water Used for this Prompt
      </h1>
      <div className="flex gap-12">
        <div className="flex flex-col items-center">
          <div style={columnContainerStyle}>
            <div style={waterBgStyle(col1Height)} />
            <div style={waveWrapperStyle(col1Height)}>
              <Wave
                fill="url(#waterGradient1)"
                paused={false}
                style={{ width: "100%", height: "100%" }}
                options={{
                  height: 10,
                  amplitude: 10,
                  speed: 0.1,
                  points: 2,
                }}
              >
                <defs>
                  <linearGradient
                    id="waterGradient1"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
              </Wave>
            </div>
          </div>
          <span className="mt-2 text-blue-800 font-semibold">With SiNR</span>
        </div>
        <div className="flex flex-col items-center">
          <div style={columnContainerStyle}>
            <div style={waterBgStyle(col2Height)} />
            <div style={waveWrapperStyle(col2Height)}>
              <Wave
                fill="url(#waterGradient2)"
                paused={false}
                style={{ width: "100%", height: "100%" }}
                options={{
                  height: 10,
                  amplitude: 10,
                  speed: 0.1,
                  points: 2,
                }}
              >
                <defs>
                  <linearGradient
                    id="waterGradient2"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
              </Wave>
            </div>
          </div>
          <span className="mt-2 text-blue-800 font-semibold">
            Without SiNR
          </span>
        </div>
      </div>
      <div className="mt-5 text-lg font-medium text-gray-800">
        Estimated Water Used (in Microliters):{" "}
        <span className="font-bold">
          {formatMicroLiters(animatedWaterUsed)} μL
        </span>
        <div className="flex flex-col items-center mt-4">
          <div className="flex items-center justify-center">
            <span className="mr-2 text-blue-900 font-medium">35 μL =</span>
            <span style={{ display: "flex", alignItems: "flex-end", height: 24 }}>
              <svg
                width="18"
                height="24"
                viewBox="0 0 18 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block" }}
              >
                <path
                  d="M9 2C9 2 2 11.5 2 16C2 19.3137 5.13401 22 9 22C12.866 22 16 19.3137 16 16C16 11.5 9 2 9 2Z"
                  fill="#38bdf8"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* --- Perspective Section Below Water Level --- */}
      <div
        className="mt-8 flex flex-col items-center justify-center"
        style={{
          background: "rgba(255,255,255,0.95)",
          position: "absolute",
          bottom: "2rem",
          borderRadius: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          padding: "1.2rem 2rem",
          maxWidth: 520,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-900 font-bold text-lg">1,000,000,000 queries</span>
          <span className="text-gray-700 text-lg">ChatGPT receives per day</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="14" fill="#2563eb" />
            <text x="14" y="19" textAnchor="middle" fontSize="15" fill="#fff" fontWeight="bold">1Bn</text>
          </svg>
          <span className="text-blue-900 font-bold text-lg">× 30 μL</span>
          <span className="text-gray-700 text-lg">per query</span>
          <span className="text-blue-900 font-bold text-lg">=</span>
          <span className="text-blue-900 font-bold text-lg">30,000 L</span>
          <span className="text-gray-700 text-lg">of water</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-yellow-900 font-bold text-lg">&gt;150</span>
          <span className="text-gray-700 text-lg">European households/day</span>
        </div>
      </div>

      {/* Feedback form: */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          right: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          zIndex: 10,
          background: "rgba(255,255,255,0.95)",
          borderRadius: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          padding: "1rem",
          maxWidth: "220px",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Speech bubble */}
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%) translateY(10px)", // bring closer to image
              background: "#2563eb",
              color: "#fff",
              padding: "0.5rem 1rem",
              borderRadius: "1rem",
              fontSize: "0.95rem",
              fontWeight: 500,
              textAlign: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
              maxWidth: "180px",
              lineHeight: 1.3,
              zIndex: 2,
              whiteSpace: "pre-line",
            }}
          >
            Please fill out the form to give us feedback!
            {/* Speech bubble tail */}
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "100%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderTop: "12px solid #2563eb",
                zIndex: 1,
              }}
            />
          </div>
          <img
            src="/user.png"
            alt="Mireia"
            style={{
              width: "90px",
              borderRadius: "40%",
              marginBottom: "0.5rem",
              marginTop: "1.5rem",
            }}
          />
        </div>
        <img
          src="/google_form.jpeg"
          alt="Google Form"
          style={{
            width: "120px",
            borderRadius: "0.5rem",
            marginBottom: "0.5rem",
            marginTop: "0.5rem",
          }}
        />
      </div>
    </main>
  );
}