import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Link-preview image (Slack, iMessage, LinkedIn, X...). Rendered once at build time.
export const alt = "AgilePoker: free planning poker for agile teams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#F8F2E9";
const ACCENT = "#E7651C";
const INK = "#111111";
const MUTED = "#4B5563";
const CARD_BACK = "#063347";
const RED = "#DC2626";

const SPADE = "M12 2C9.5 6 4 8.6 4 13c0 2.8 2.3 4.6 4.7 4.3 1.2-.1 2.1-.7 2.6-1.6-.3 2.4-1.1 4.1-2.7 5.5h6.8c-1.6-1.4-2.4-3.1-2.7-5.5.5.9 1.4 1.5 2.6 1.6 2.4.3 4.7-1.5 4.7-4.3 0-4.4-5.5-7-8-11z";
const HEART = "M12 21s-8-5.2-8-11.2C4 6.6 6.4 4.5 9 4.5c1.4 0 2.5.7 3 1.7.5-1 1.6-1.7 3-1.7 2.6 0 5 2.1 5 5.3C20 15.8 12 21 12 21z";
const DIAMOND = "M12 2l7.5 10L12 22 4.5 12z";
const CLUB = "M12 2.5a4.2 4.2 0 0 0-3.4 6.7A4.2 4.2 0 1 0 10.8 17c-.3 1.9-1 3.3-2.3 4.5h7c-1.3-1.2-2-2.6-2.3-4.5a4.2 4.2 0 1 0 2.2-7.8A4.2 4.2 0 0 0 12 2.5z";

function Suit({ d, color, px = 46 }: { d: string; color: string; px?: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d={d} fill={color} />
    </svg>
  );
}

function Card({ value, rotate, left, top, back = false }: { value: string; rotate: number; left: number; top: number; back?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 210,
        height: 300,
        borderRadius: 18,
        transform: `rotate(${rotate}deg)`,
        background: back ? CARD_BACK : "#FFFFFF",
        border: back ? `10px solid #FFFFFF` : "2px solid #DDD5C8",
        boxShadow: "0 18px 40px rgba(60, 40, 20, 0.18)",
        display: "flex",
        alignItems: back ? "center" : "stretch",
        justifyContent: "center",
      }}
    >
      {back ? (
        <div style={{ display: "flex", width: 150, height: 240, borderRadius: 10, border: `3px solid ${ACCENT}`, alignItems: "center", justifyContent: "center" }}>
          <Suit d={SPADE} color={ACCENT} px={70} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "16px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 48 }}>
            <div style={{ fontSize: 64, lineHeight: 1, color: ACCENT, fontFamily: "Baskerville" }}>{value}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default async function OpengraphImage() {
  const font = (f: string) => readFile(join(process.cwd(), "assets/fonts", f));
  const [baskerville, inter400, inter600] = await Promise.all([
    font("LibreBaskerville-Regular.ttf"),
    font("Inter-400.ttf"),
    font("Inter-600.ttf"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, position: "relative", overflow: "hidden", fontFamily: "Inter" }}>
        {/* soft table glow behind the hand */}
        <div style={{ position: "absolute", right: -140, top: -60, width: 760, height: 760, borderRadius: 380, background: "rgba(231, 101, 28, 0.08)" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 84, width: 660 }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 26 }}>
            <Suit d={SPADE} color={INK} />
            <Suit d={HEART} color={RED} />
            <Suit d={CLUB} color={INK} />
            <Suit d={DIAMOND} color={RED} />
          </div>
          <div style={{ display: "flex", fontFamily: "Baskerville", fontSize: 104, letterSpacing: -3, lineHeight: 1 }}>
            <span style={{ color: INK }}>Agile</span>
            <span style={{ color: ACCENT }}>Poker</span>
          </div>
          <div style={{ fontSize: 36, color: MUTED, marginTop: 26, lineHeight: 1.3, fontFamily: "Inter" }}>
            Free planning poker for agile teams
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
            {["No sign-up", "Votes hidden until reveal", "Real time"].map(t => (
              <div key={t} style={{ display: "flex", fontSize: 21, fontWeight: 600, fontFamily: "Inter", color: ACCENT, border: `2px solid ${ACCENT}`, borderRadius: 999, padding: "9px 18px" }}>
                {t}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 26, color: MUTED, marginTop: 44, letterSpacing: 1, fontFamily: "Inter" }}>agilepoker.dev</div>
        </div>

        <div style={{ display: "flex", position: "relative", flex: 1 }}>
          <Card value="1" rotate={-16} left={20} top={180} />
          <Card value="2" rotate={-5} left={115} top={150} />
          <Card value="3" rotate={6} left={210} top={150} />
          <Card value="" rotate={17} left={300} top={180} back />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter400, style: "normal", weight: 400 },
        { name: "Inter", data: inter600, style: "normal", weight: 600 },
        { name: "Baskerville", data: baskerville, style: "normal", weight: 400 },
      ],
    },
  );
}
