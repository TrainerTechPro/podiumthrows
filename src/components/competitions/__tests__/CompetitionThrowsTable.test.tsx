import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompetitionThrowsTable } from "../CompetitionThrowsTable";
import { ToastProvider } from "@/components/ui/Toast";

function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const baseMeet = {
  id: "m1",
  athleteId: "a1",
  event: "SHOT_PUT",
  format: "THREE_PLUS_THREE" as const,
  madeFinals: false,
  result: null,
  name: "Test",
};

describe("CompetitionThrowsTable — base rendering", () => {
  it("renders 3 prelim rows for THREE_PLUS_THREE", () => {
    renderWithToast(
      <CompetitionThrowsTable meet={baseMeet} throws={[]} onSave={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getAllByTestId(/^throw-row-PRELIM-/)).toHaveLength(3);
    expect(screen.queryAllByTestId(/^throw-row-FINALS-/)).toHaveLength(0);
  });

  it("shows finals section when madeFinals=true", () => {
    renderWithToast(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, madeFinals: true }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/^throw-row-FINALS-/)).toHaveLength(3);
  });

  it("renders 4 rows for FOUR_STRAIGHT", () => {
    renderWithToast(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, format: "FOUR_STRAIGHT" }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/^throw-row-PRELIM-/)).toHaveLength(4);
  });

  it("shows legacy banner when result != null and no throws", () => {
    renderWithToast(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, result: 17.5 }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId("legacy-banner")).toBeInTheDocument();
    expect(screen.getByText(/17.5m/)).toBeInTheDocument();
  });

  it("hides legacy banner when throws exist", () => {
    renderWithToast(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, result: 17.5 }}
        throws={[
          {
            id: "t1",
            round: "PRELIM",
            attemptInRound: 1,
            distance: 18,
            isFoul: false,
            isPass: false,
            foulType: null,
            notes: null,
            videoUrl: null,
            wireLength: null,
          },
        ]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.queryByTestId("legacy-banner")).toBeNull();
  });
});

describe("CompetitionThrowsTable — interactions", () => {
  it("switching to Foul reveals foulType picker", async () => {
    const user = userEvent.setup();
    renderWithToast(
      <CompetitionThrowsTable meet={baseMeet} throws={[]} onSave={vi.fn()} onDelete={vi.fn()} />
    );
    const row = screen.getByTestId("throw-row-PRELIM-1");
    const foulBtn = row.querySelector('[data-type="FOUL"]') as HTMLElement;
    await user.click(foulBtn);
    expect(row.querySelector('[data-testid="foul-type-picker"]')).not.toBeNull();
  });

  it("saves on row blur when distance + Mark selected", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithToast(
      <CompetitionThrowsTable meet={baseMeet} throws={[]} onSave={onSave} onDelete={vi.fn()} />
    );
    const row = screen.getByTestId("throw-row-PRELIM-1");
    await user.click(row.querySelector('[data-type="MARK"]') as HTMLElement);
    const input = row.querySelector('input[data-testid="distance-input"]') as HTMLInputElement;
    await user.type(input, "18.42");
    fireEvent.blur(row);
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            round: "PRELIM",
            attemptInRound: 1,
            distance: 18.42,
            isFoul: false,
            isPass: false,
          })
        );
      },
      { timeout: 2000 }
    );
  });
});
