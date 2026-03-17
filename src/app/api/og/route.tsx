import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Podium Throws";
  const description =
    searchParams.get("description") ||
    searchParams.get("subtitle") ||
    "Elite Throws Coaching Platform";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)",
          position: "relative",
        }}
      >
        {/* Amber accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #f59e0b, transparent)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              color: "#f59e0b",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 400,
              color: "#a3a3a3",
              letterSpacing: "0.02em",
            }}
          >
            {description}
          </div>
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #f59e0b, transparent)",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400" },
    }
  );
}
