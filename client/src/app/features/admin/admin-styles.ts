// Shared styles for every admin screen.
export const ADMIN_STYLES = `
  :host { display: block; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #173b5b; }
  h2 { margin: 0 0 16px; color: #12304d; font-size: 1.25rem; font-weight: 600; line-height: 1.4; }
  .card { background: #fff; border: 1px solid #e1e8f0; border-radius: 16px; padding: 28px; margin-bottom: 28px; box-shadow: 0 1px 3px rgba(16, 42, 67, 0.06), 0 8px 24px rgba(16, 42, 67, 0.04); }
  .toolbar { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-bottom: 20px; }
  input, select, textarea { font: inherit; border: 1px solid #c9d6e4; border-radius: 8px; padding: 10px 14px; background: #fff; color: #173b5b; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #2a5d8f; box-shadow: 0 0 0 3px rgba(42, 93, 143, 0.2); }
  textarea { width: 100%; box-sizing: border-box; min-height: 90px; resize: vertical; }
  .search { min-width: 280px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #4b6584; background: #f4f7fb; padding: 14px 16px; border-bottom: 1px solid #e1e8f0; }
  td { padding: 16px; border-bottom: 1px solid #edf1f6; vertical-align: middle; line-height: 1.5; }
  tr:hover td { background: #fafcfe; }
  .scroll { overflow-x: auto; border: 1px solid #e1e8f0; border-radius: 12px; }
  .btn { border: 0; border-radius: 8px; padding: 10px 18px; font: inherit; font-weight: 600; cursor: pointer; background: #eef4fb; color: #173b5b; }
  .btn:hover { background: #dce8f5; }
  .btn.primary { background: #173b5b; color: #fff; }
  .btn.primary:hover { background: #1f4f7f; }
  .btn.danger { background: #fde4e4; color: #b3261e; }
  .btn.small { padding: 6px 12px; font-size: 0.8rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .actions { display: flex; flex-wrap: nowrap; gap: 8px; align-items: center; }
  .actions-cell { white-space: nowrap; width: 1%; }
  .badge { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: 0.75rem; font-weight: 600; background: #eef4fb; color: #173b5b; margin: 0 6px 6px 0; }
  .badge.green { background: #dcf5e6; color: #1f7a46; }
  .badge.red { background: #fde4e4; color: #b3261e; }
  .badge.amber { background: #fff1d6; color: #8a5a00; }
  .badge.purple { background: #efe4fb; color: #6b3fa0; }
  .muted { color: #5b6f86; }
  .pager { display: flex; gap: 14px; align-items: center; justify-content: flex-end; margin-top: 20px; color: #5b6f86; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 28px; }
  .field { display: grid; gap: 6px; font-weight: 600; font-size: 0.85rem; color: #35506b; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chip { border: 1px solid #c9d6e4; background: #fff; border-radius: 999px; padding: 6px 14px; cursor: pointer; font-size: 0.85rem; }
  .chip.on { background: #173b5b; color: #fff; border-color: #173b5b; }
  .error { color: #b3261e; margin: 12px 0; }
  .ok { color: #1f7a46; margin: 12px 0; }
  .empty { padding: 40px; text-align: center; color: #5b6f86; }
`;
