// Shared popup-editor look used by the upload page and the saved-questions page.
export const EDITOR_STYLES = `
  .flag { font-size: 0.8rem; font-weight: 600; margin: 0; }
  .flag.bad { color: #c0392b; }
  .flag.ok { color: #1e8449; }
  .row-actions { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(2px); z-index: 1000; }
  .editor { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001; width: 80vw; max-width: 80vw; max-height: 90vh; overflow-y: auto; box-sizing: border-box; background: #f8fafd; border-radius: 16px; box-shadow: 0 24px 70px rgba(15, 23, 42, 0.4); padding: 0 28px 48px; display: grid; gap: 14px; align-content: start; color: #173b5b; scrollbar-width: thin; }
  .editor > h3:first-child { position: sticky; top: 0; z-index: 2; margin: 0 -28px; padding: 18px 28px; background: #fff; border-bottom: 1px solid #e1e8f0; border-radius: 16px 16px 0 0; font-size: 1.15rem; font-weight: 700; color: #12304d; }
  .editor h3, .editor h4 { margin: 0; }
  .editor h4 { margin-top: 10px; padding-bottom: 6px; border-bottom: 1px solid #e1e8f0; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4b6584; }
  .editor .editor-heading { display: flex; align-items: center; gap: 10px; }
  .editor > h3:first-child { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .editor .header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; white-space: nowrap; }
  .editor .editor-heading span:first-of-type { flex: 1; }
  .editor .editor-heading-icon { width: 30px; height: 30px; flex: 0 0 30px; padding: 7px; box-sizing: border-box; border-radius: 8px; background: #e3eefb; color: #2a5d8f; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
  .table-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; min-width: 34px; max-width: 34px; height: 34px; min-height: 34px; max-height: 34px; flex: 0 0 34px; align-self: center; box-sizing: border-box; padding: 0; line-height: 1; border: 1px solid #c9d6e4; border-radius: 8px; background: #fff; color: #35506b; cursor: pointer; }
  .table-icon-btn:hover { background: #eef4fb; color: #173b5b; }
  .table-icon-btn.danger { color: #b3261e; border-color: #f0caca; }
  .table-icon-btn.danger:hover { background: #fde4e4; }
  .table-icon-btn svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
  .editor .field { display: grid; gap: 6px; font-weight: 600; font-size: 0.82rem; color: #35506b; }
  .editor input:not([type='checkbox']):not([type='radio']), .editor select, .editor textarea { font: inherit; font-weight: 400; color: #173b5b; padding: 10px 12px; border: 1px solid #c9d6e4; border-radius: 10px; background: #fff; width: 100%; box-sizing: border-box; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
  .editor input:focus, .editor select:focus, .editor textarea:focus { outline: none; border-color: #2a5d8f; box-shadow: 0 0 0 3px rgba(42, 93, 143, 0.18); }
  .editor textarea { min-height: 76px; resize: vertical; line-height: 1.5; }
  .editor textarea.json { font-family: monospace; font-size: 0.8rem; }
  .editor .opt { display: grid; grid-template-columns: auto 28px 1fr 1fr; gap: 10px; align-items: center; padding: 10px 12px; background: #fff; border: 1px solid #e1e8f0; border-radius: 10px; }
  .editor .opt strong { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #e3eefb; color: #173b5b; font-size: 0.85rem; }
  .editor .assamese-input-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .editor .assamese-input-row input, .editor .assamese-input-row textarea { flex: 1; min-width: 0; width: auto; }
  .translate-field-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; min-width: 34px; height: 34px; flex: 0 0 34px; padding: 0; box-sizing: border-box; border: 1px solid #c9d6e4; border-radius: 8px; background: #fff; color: #2a5d8f; cursor: pointer; transition: background 0.15s ease; }
  .translate-field-btn:hover:not(:disabled) { background: #e3eefb; color: #173b5b; }
  .translate-field-btn:disabled { cursor: not-allowed; opacity: 0.55; }
  .editor .field-title-row { display: flex; align-items: center; gap: 8px; }
  .editor .field-title-row .translate-field-btn { width: 26px; min-width: 26px; height: 26px; flex: 0 0 26px; }
  .editor .field-title-row .translate-field-btn svg { width: 15px; height: 15px; }
  .translate-field-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }
  .editor .opt-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .editor .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .editor .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .editor .chip { border: 1px solid #c9d6e4; background: #fff; border-radius: 999px; padding: 6px 16px; cursor: pointer; font-size: 0.85rem; color: #35506b; transition: background 0.15s ease; }
  .editor .chip:hover { background: #eef4fb; }
  .editor .chip.on { background: #173b5b; color: #fff; border-color: #173b5b; }
  .mode-tabs { display: inline-flex; gap: 4px; padding: 4px; background: #e8eff7; border-radius: 10px; justify-self: start; }
  .mode-tabs button.on { background: #fff; box-shadow: 0 1px 3px rgba(16, 42, 67, 0.15); }
  .edit-error { margin: 0; padding: 10px 14px; border-radius: 8px; background: #fde4e4; color: #b3261e; font-size: 0.85rem; }
  .editor .flag.bad { padding: 10px 14px; border-radius: 8px; background: #fff1d6; color: #8a5a00; }
  .editor > .row-actions:last-child { position: sticky; bottom: 0; z-index: 2; justify-content: flex-end; margin: 0 -28px -24px; padding: 14px 28px; background: #fff; border-top: 1px solid #e1e8f0; border-radius: 0 0 16px 16px; }
`;
