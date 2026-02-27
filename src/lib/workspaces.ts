// -- Workspace Module Configuration --
// Central definition of all workspace modules for Podium Throws.
// Used by the settings page access control tab.

export type WorkspaceKey = "general" | "throws";

export interface WorkspaceModule {
  key: WorkspaceKey;
  label: string;
  shortLabel: string;
  color: string;
  colorHex: string;
  dotColor: string;
  isLocked: boolean;
  sortOrder: number;
}

export const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    key: "general",
    label: "General Training",
    shortLabel: "General",
    color: "primary",
    colorHex: "#D4A843",
    dotColor: "bg-amber-500",
    isLocked: false,
    sortOrder: 0,
  },
  {
    key: "throws",
    label: "Podium Throws",
    shortLabel: "Throws",
    color: "amber",
    colorHex: "#D4915A",
    dotColor: "bg-orange-500",
    isLocked: false,
    sortOrder: 1,
  },
];

export function getWorkspaceModule(key: WorkspaceKey): WorkspaceModule | undefined {
  return WORKSPACE_MODULES.find((m) => m.key === key);
}

export function getEnabledModules(enabledKeys: string[]): WorkspaceModule[] {
  return WORKSPACE_MODULES.filter((m) => enabledKeys.includes(m.key)).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}
