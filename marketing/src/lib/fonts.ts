import { loadFont as loadChakra } from "@remotion/google-fonts/ChakraPetch";
import { loadFont as loadDM } from "@remotion/google-fonts/DMSans";
import { loadFont as loadIBM } from "@remotion/google-fonts/IBMPlexMono";

const chakra = loadChakra("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const dmSans = loadDM("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

const ibmPlex = loadIBM("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const FONT_HEADING = chakra.fontFamily;
export const FONT_BODY = dmSans.fontFamily;
export const FONT_MONO = ibmPlex.fontFamily;
