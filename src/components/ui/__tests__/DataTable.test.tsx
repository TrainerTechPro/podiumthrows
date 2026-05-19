import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { DataTable, type Column } from "../DataTable";

/* ─── Mocks ──────────────────────────────────────────────────────────────── */

// `next/navigation` isn't available in jsdom — stub to a no-op so the table
// can call useDataTable's URL helpers without crashing. Tests that exercise
// urlStateKey assert against the no-op write, not the URL itself.
const routerReplace = vi.fn();
const routerPush = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
  usePathname: () => "/test",
  useSearchParams: () => searchParams,
}));

afterEach(() => {
  cleanup();
  routerReplace.mockClear();
  routerPush.mockClear();
  searchParams = new URLSearchParams();
});

/* ─── Fixtures ───────────────────────────────────────────────────────────── */

type Row = { id: string; name: string; score: number; tag: string };

const ROWS: Row[] = [
  { id: "1", name: "Alice Anderson", score: 12.5, tag: "alpha" },
  { id: "2", name: "Bob Brown", score: 8.1, tag: "beta" },
  { id: "3", name: "Charlie Chen", score: 18.45, tag: "alpha" },
];

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "score", header: "Score", sortable: true, numeric: true },
  { key: "tag", header: "Tag" },
];

/* ─── Tests ──────────────────────────────────────────────────────────────── */

describe("DataTable", () => {
  it("renders all rows by default", () => {
    render(<DataTable data={ROWS} columns={COLUMNS} rowKey="id" />);
    expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
    expect(screen.getByText("Bob Brown")).toBeInTheDocument();
    expect(screen.getByText("Charlie Chen")).toBeInTheDocument();
  });

  it("filters rows by search query (case-insensitive, any column)", () => {
    render(<DataTable data={ROWS} columns={COLUMNS} rowKey="id" searchable />);
    const search = screen.getByLabelText("Search");
    fireEvent.change(search, { target: { value: "alpha" } });
    expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
    expect(screen.queryByText("Bob Brown")).not.toBeInTheDocument();
    expect(screen.getByText("Charlie Chen")).toBeInTheDocument();
  });

  it("shows the no-results variant when search has no matches", () => {
    render(<DataTable data={ROWS} columns={COLUMNS} rowKey="id" searchable />);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzzz" } });
    expect(screen.getByText(/No results for "zzzz"/i)).toBeInTheDocument();
  });

  it("renders the empty state CTA when data is empty", () => {
    render(
      <DataTable
        data={[]}
        columns={COLUMNS}
        rowKey="id"
        emptyTitle="No items"
        emptyAction={<button>Create one</button>}
      />
    );
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create one" })).toBeInTheDocument();
  });

  it("renders an error state distinct from empty", () => {
    const onRetry = vi.fn();
    render(
      <DataTable data={[]} columns={COLUMNS} rowKey="id" error="Network failed" onRetry={onRetry} />
    );
    expect(screen.getByText(/Couldn't load data/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("toggles sort direction on header click", () => {
    render(<DataTable data={ROWS} columns={COLUMNS} rowKey="id" />);
    const scoreHeader = screen.getByRole("columnheader", { name: /Score/i });
    fireEvent.click(scoreHeader); // asc
    let rows = screen.getAllByRole("row").slice(1); // skip header
    // asc: Bob (8.1) → Alice (12.5) → Charlie (18.45)
    expect(within(rows[0]).getByText("Bob Brown")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Charlie Chen")).toBeInTheDocument();

    fireEvent.click(scoreHeader); // desc
    rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Charlie Chen")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Bob Brown")).toBeInTheDocument();
  });

  it("applies tabular-nums to numeric columns", () => {
    render(<DataTable data={ROWS} columns={COLUMNS} rowKey="id" />);
    const scoreCells = screen.getAllByText(/^(12\.5|8\.1|18\.45)$/);
    for (const cell of scoreCells) {
      expect(cell.className).toMatch(/tabular-nums/);
    }
  });

  it("renders mobile cards when renderCard is provided", () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        rowKey="id"
        renderCard={(row) => <div data-testid={`card-${row.id}`}>{row.name}</div>}
      />
    );
    // Both the desktop table AND the mobile cards exist in the DOM; CSS hides
    // one or the other via Tailwind's md: breakpoint. We assert the card
    // testid is present so consumers know mobile rendering is wired.
    expect(screen.getByTestId("card-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-3")).toBeInTheDocument();
  });

  it("calls onRowClick when a row is clicked", () => {
    const onRowClick = vi.fn();
    render(<DataTable data={ROWS} columns={COLUMNS} rowKey="id" onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Bob Brown").closest("tr")!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it("paginates large datasets", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      score: i,
      tag: "x",
    }));
    render(<DataTable data={many} columns={COLUMNS} rowKey="id" pageSize={10} />);
    // Page 1: rows 0–9
    expect(screen.getByText("Row 0")).toBeInTheDocument();
    expect(screen.queryByText("Row 10")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Row 10")).toBeInTheDocument();
  });

  it("reads sort/page from URL when urlStateKey is set", () => {
    searchParams = new URLSearchParams("sort=score&dir=desc&page=1");
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      score: i,
      tag: "x",
    }));
    render(<DataTable data={many} columns={COLUMNS} rowKey="id" pageSize={10} urlStateKey="" />);
    // First row should be score=24 (desc)
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Row 24")).toBeInTheDocument();
  });

  it("writes a URL replace when urlStateKey is set and a sort header is clicked", () => {
    render(<DataTable data={ROWS} columns={COLUMNS} rowKey="id" urlStateKey="" />);
    fireEvent.click(screen.getByRole("columnheader", { name: /Name/i }));
    expect(routerReplace).toHaveBeenCalled();
    const [href] = routerReplace.mock.calls[0];
    expect(href).toContain("sort=name");
    expect(href).toContain("dir=asc");
  });

  it("expands a row inline when renderExpanded is provided and the row is clicked", () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        rowKey="id"
        renderExpanded={(row) => <div data-testid={`detail-${row.id}`}>Details: {row.name}</div>}
      />
    );
    // Closed initially
    expect(screen.queryByTestId("detail-2")).not.toBeInTheDocument();
    // Click row Bob
    fireEvent.click(screen.getByText("Bob Brown").closest("tr")!);
    expect(screen.getByTestId("detail-2")).toBeInTheDocument();
    // Click again to close
    fireEvent.click(screen.getByText("Bob Brown").closest("tr")!);
    expect(screen.queryByTestId("detail-2")).not.toBeInTheDocument();
  });

  it("renders a loading skeleton when loading is true", () => {
    const { container } = render(
      <DataTable data={[]} columns={COLUMNS} rowKey="id" loading skeletonRows={3} />
    );
    expect(container.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(0);
    // Should not render the empty state
    expect(screen.queryByText(/No data/i)).not.toBeInTheDocument();
  });
});
