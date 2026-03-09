import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";

export const { fontFamily: headingFont } = loadOutfit("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
});

export const { fontFamily: bodyFont } = loadDMSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
