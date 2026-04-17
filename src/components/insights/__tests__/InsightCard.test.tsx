// src/components/insights/__tests__/InsightCard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { InsightCard } from "../InsightCard";
import type { AthleteInsightWire } from "@/lib/insights/types";

function fixture(overrides: Partial<AthleteInsightWire> = {}): AthleteInsightWire {
  return {
    id: "i1",
    athleteId: "a1",
    category: "TRAINING_PATTERN",
    metric: "m1",
    event: "SHOT_PUT",
    title: "Your best shot put throws follow 8kg shot weeks",
    body: "Weeks with more 8kg shot sessions tend to produce stronger throws.",
    detail: "Pattern strength: Medium — based on 12 weeks of data.",
    confidenceBand: "MEDIUM",
    dataPoints: 12,
    coefficient: 0.68,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    readByCoachAt: null,
    readByAthleteAt: null,
    dismissedAt: null,
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: null,
    computedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  static last: MockIntersectionObserver | null = null;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    MockIntersectionObserver.last = this;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting, target: document.body } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

describe("InsightCard", () => {
  beforeEach(() => {
    (
      global as unknown as { IntersectionObserver: typeof MockIntersectionObserver }
    ).IntersectionObserver = MockIntersectionObserver;
  });

  it("renders title, body, detail, band label", () => {
    render(
      <InsightCard insight={fixture()} role="ATHLETE" onMarkRead={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(screen.getByText("Your best shot put throws follow 8kg shot weeks")).toBeInTheDocument();
    expect(screen.getByText(/Weeks with more 8kg shot sessions/)).toBeInTheDocument();
    expect(screen.getByText(/Pattern strength: Medium/)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM/i)).toBeInTheDocument();
  });

  it("shows NEW dot when unread for caller's role", () => {
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: null })}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByTestId("insight-new-dot")).toBeInTheDocument();
  });

  it("hides NEW dot when already read for caller's role", () => {
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: "2026-04-01T00:00:00.000Z" })}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.queryByTestId("insight-new-dot")).toBeNull();
  });

  it("evidence button only renders for COACH role", () => {
    const { rerender } = render(
      <InsightCard
        insight={fixture()}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
        onShowEvidence={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /evidence/i })).toBeNull();

    rerender(
      <InsightCard
        insight={fixture()}
        role="COACH"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
        onShowEvidence={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /evidence/i })).toBeInTheDocument();
  });

  it("fires onMarkRead once on viewport entry for unread insight", () => {
    const onMarkRead = vi.fn();
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: null })}
        role="ATHLETE"
        onMarkRead={onMarkRead}
        onDismiss={vi.fn()}
      />
    );
    act(() => {
      MockIntersectionObserver.last?.trigger(true);
    });
    expect(onMarkRead).toHaveBeenCalledTimes(1);
    expect(onMarkRead).toHaveBeenCalledWith("i1");

    act(() => {
      MockIntersectionObserver.last?.trigger(true);
    });
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("does not fire onMarkRead for already-read insight", () => {
    const onMarkRead = vi.fn();
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: "2026-04-01T00:00:00.000Z" })}
        role="ATHLETE"
        onMarkRead={onMarkRead}
        onDismiss={vi.fn()}
      />
    );
    act(() => {
      MockIntersectionObserver.last?.trigger(true);
    });
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("dismiss click fires onDismiss with insight id", () => {
    const onDismiss = vi.fn();
    render(
      <InsightCard insight={fixture()} role="ATHLETE" onMarkRead={vi.fn()} onDismiss={onDismiss} />
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("i1");
  });
});
