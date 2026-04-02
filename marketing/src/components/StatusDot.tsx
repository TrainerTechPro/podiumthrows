import React from "react";
import { STATUS_COLORS } from "../lib/tokens";

type Props = {
  status: "optimal" | "marginal" | "concerning";
  size?: number;
};

export const StatusDot: React.FC<Props> = ({ status, size = 8 }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: STATUS_COLORS[status],
        flexShrink: 0,
      }}
    />
  );
};
