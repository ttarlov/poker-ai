import { ImageResponse } from "next/og";

// Home-screen icon for iOS. Same mark as app/icon.svg, drawn at 180px.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#E7651C" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect x="17" y="9" width="30" height="44" rx="5" fill="#FFFFFF" transform="rotate(-8 32 31)" />
          <path fill="#063347" d="M32 17c-3.6 5.9-11 9.6-11 15.4 0 3.8 3.1 6.2 6.3 5.8 1.7-.2 2.9-1 3.6-2.2-.4 3.3-1.5 5.6-3.7 7.5h9.6c-2.2-1.9-3.3-4.2-3.7-7.5.7 1.2 1.9 2 3.6 2.2 3.2.4 6.3-2 6.3-5.8C43 26.6 35.6 22.9 32 17z" />
        </svg>
      </div>
    ),
    size,
  );
}
