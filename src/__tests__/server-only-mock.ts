// Stand-in for the `server-only` package during vitest runs. The real
// module throws if imported outside an RSC context, which kills any test
// that touches a server-only-marked file. The marker is enforcement for
// the bundler, not a runtime requirement, so tests get an empty no-op.
export {};
