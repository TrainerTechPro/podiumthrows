import { AbsoluteFill } from "remotion";
import { COLORS } from "../lib/tokens";

type Props = {
  grain?: boolean;
  vignette?: boolean;
  vignetteIntensity?: number;
};

export const Background: React.FC<Props> = ({
  grain = true,
  vignette = true,
  vignetteIntensity = 0.07,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Subtle noise grain via SVG filter */}
      {grain && (
        <AbsoluteFill style={{ opacity: 0.03 }}>
          <svg width="100%" height="100%">
            <filter id="grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.65"
                numOctaves="3"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
          </svg>
        </AbsoluteFill>
      )}

      {/* Gold radial vignette */}
      {vignette && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, rgba(255,200,0,${vignetteIntensity}) 0%, transparent 70%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
