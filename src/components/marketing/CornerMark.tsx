/**
 * CornerMark — 12×12 L-shaped registration mark for engineering-drawing detail.
 * Position absolute in a corner of a relative-positioned parent.
 */
export default function CornerMark({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const size = 12;
  const color = "rgba(245, 158, 11, 0.3)";

  const positionStyles: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    pointerEvents: "none",
    zIndex: 2,
  };

  const borderStyle = `1px solid ${color}`;

  switch (position) {
    case "top-left":
      return (
        <div
          aria-hidden="true"
          style={{
            ...positionStyles,
            top: 8,
            left: 8,
            borderTop: borderStyle,
            borderLeft: borderStyle,
          }}
        />
      );
    case "top-right":
      return (
        <div
          aria-hidden="true"
          style={{
            ...positionStyles,
            top: 8,
            right: 8,
            borderTop: borderStyle,
            borderRight: borderStyle,
          }}
        />
      );
    case "bottom-left":
      return (
        <div
          aria-hidden="true"
          style={{
            ...positionStyles,
            bottom: 8,
            left: 8,
            borderBottom: borderStyle,
            borderLeft: borderStyle,
          }}
        />
      );
    case "bottom-right":
      return (
        <div
          aria-hidden="true"
          style={{
            ...positionStyles,
            bottom: 8,
            right: 8,
            borderBottom: borderStyle,
            borderRight: borderStyle,
          }}
        />
      );
  }
}
