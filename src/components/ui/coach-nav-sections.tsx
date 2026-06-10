/**
 * Coach sidebar nav builder — exported from a non-client file so server
 * components (coach/layout.tsx) can import it without webpack
 * client-boundary stripping. The Sidebar primitive consumes the returned
 * NavSection[]; this file just constructs them.
 *
 * See tasks/navigation-contract-2026-05-18.md.
 */

import {
  LayoutDashboard,
  Users,
  UsersRound,
  Target,
  Settings,
  CalendarRange,
  UserPlus,
  Library,
  Wrench,
  Megaphone,
  Video,
} from "lucide-react";
import type { NavItem, NavSection } from "./Sidebar";

const iconSize = { size: 20, strokeWidth: 1.75, "aria-hidden": true as const };

export function getCoachNavSections(
  { videoAnalysisEnabled }: { videoAnalysisEnabled: boolean } = { videoAnalysisEnabled: false }
): NavSection[] {
  const primary: NavItem[] = [
    {
      label: "Dashboard",
      href: "/coach/dashboard",
      icon: <LayoutDashboard {...iconSize} />,
      matchPaths: ["/coach/dashboard", "/coach/wellness"],
    },
    {
      label: "Athletes",
      href: "/coach/athletes",
      icon: <Users {...iconSize} />,
      matchPaths: [
        "/coach/athletes",
        "/coach/invitations",
        "/coach/competitions",
        "/coach/team",
        "/coach/teams",
        "/coach/event-groups",
        "/coach/goals",
        "/coach/athlete-logs",
        "/coach/hub",
        "/coach/throws/assessment",
      ],
      children: [
        {
          label: "Roster",
          href: "/coach/athletes",
          icon: <Users {...iconSize} />,
          matchPaths: ["/coach/athletes"],
        },
        {
          label: "Throws",
          href: "/coach/athletes/throws",
          icon: <Target {...iconSize} />,
          matchPaths: ["/coach/athletes/throws"],
        },
        {
          label: "Invitations",
          href: "/coach/athletes/invitations",
          icon: <UserPlus {...iconSize} />,
          matchPaths: ["/coach/athletes/invitations", "/coach/invitations"],
        },
        {
          label: "Groups",
          href: "/coach/athletes/groups",
          icon: <UsersRound {...iconSize} />,
          matchPaths: ["/coach/athletes/groups", "/coach/teams"],
        },
        {
          label: "Event Groups",
          href: "/coach/athletes/event-groups",
          icon: <UsersRound {...iconSize} />,
          matchPaths: ["/coach/athletes/event-groups", "/coach/event-groups"],
        },
        {
          label: "Goals",
          href: "/coach/athletes/goals",
          icon: <Target {...iconSize} />,
          matchPaths: ["/coach/athletes/goals", "/coach/goals"],
        },
        {
          label: "Announcements",
          href: "/coach/athletes/announcements",
          icon: <Megaphone {...iconSize} />,
          matchPaths: ["/coach/athletes/announcements", "/coach/team"],
        },
      ],
    },
    {
      label: "Calendar",
      href: "/coach/calendar",
      icon: <CalendarRange {...iconSize} />,
      matchPaths: [
        "/coach/calendar",
        "/coach/schedule",
        "/coach/practices",
        "/coach/availability",
        "/coach/throws/practice",
      ],
    },
    {
      label: "Builder",
      href: "/coach/builder",
      icon: <Wrench {...iconSize} />,
      matchPaths: [
        "/coach/builder",
        "/coach/throws/builder",
        "/coach/plans/new",
        "/coach/plans/generate",
      ],
    },
    {
      label: "Library",
      href: "/coach/library",
      icon: <Library {...iconSize} />,
      matchPaths: [
        "/coach/library",
        "/coach/exercises",
        "/coach/plans",
        "/coach/throws/library",
        "/coach/throws/drills",
        "/coach/videos/drills",
      ],
    },
  ];

  if (videoAnalysisEnabled) {
    primary.push({
      label: "Video",
      href: "/coach/video-analysis-2",
      icon: <Video {...iconSize} />,
      // "/coach/video-analysis" prefix-matches video-analysis-2 AND the
      // legacy v1 pages — both highlight this entry until v1 is retired.
      matchPaths: ["/coach/video-analysis", "/coach/videos", "/coach/throws/analyze"],
    });
  }

  return [
    { items: primary },
    {
      items: [
        {
          label: "Settings",
          href: "/coach/settings",
          icon: <Settings {...iconSize} />,
          matchPaths: ["/coach/settings", "/coach/integrations", "/coach/tools"],
        },
      ],
    },
  ];
}

export const COACH_NAV_SECTIONS: NavSection[] = getCoachNavSections();
