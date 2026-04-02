/** Smooth, no bounce — for UI panel reveals */
export const SMOOTH = { damping: 200 };

/** Snappy with minimal bounce — for data elements */
export const SNAPPY = { damping: 20, stiffness: 200 };

/** Bouncy entrance — for celebrations, logos */
export const BOUNCY = { damping: 8 };

/** Heavy settle — for large elements landing */
export const HEAVY = { damping: 15, stiffness: 80, mass: 2 };
