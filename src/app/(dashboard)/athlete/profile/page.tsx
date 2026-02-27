import { redirect } from "next/navigation";

// Athlete profile is managed from the Settings page
export default function AthleteProfilePage() {
  redirect("/athlete/settings");
}
