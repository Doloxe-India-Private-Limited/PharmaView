import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Badge from './Badge.jsx';
import { looksNumeric } from '../utils/classify.js';

const MOCK_TOTAL_ROWS = 60;
const PAGE_WINDOW = 5;

function renderCell(cell) {
  if (cell && typeof cell === 'object' && 'badge' in cell) {
    return (
      <>
        <Badge value={cell.badge} />
        {cell.suffix}
      </>
    );
  }
  return cell;
}

function cellClassName(cell, isFirstColumn) {
  if (cell && typeof cell === 'object') return '';
  if (looksNumeric(cell)) return 'cell-mono';
  if (isFirstColumn) return 'cell-strong';
  return '';
}

function cellText(cell) {
  if (cell && typeof cell === 'object' && 'badge' in cell) return `${cell.badge}${cell.suffix || ''}`;
  return String(cell);
}

function getExpandedRows(view) {
  const base = view.rows;
  if (!base.length) return [];
  const out = [];
  for (let i = 0; i < MOCK_TOTAL_ROWS; i++) out.push(base[i % base.length]);
  return out;
}

// Highlight matched portion of text.
function Highlight({ text, query }) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="qval-match">{text.slice(idx, idx + query.trim().length)}</mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

// Match a column name to a valueOptions key — tries exact, then case-insensitive,
// then checks if any key word of length > 3 appears in the column name.
function findOptions(col, valueOptions) {
  if (!valueOptions || !col) return null;
  if (valueOptions[col]) return valueOptions[col];
  const colLower = col.toLowerCase();
  const keys = Object.keys(valueOptions);
  const ci = keys.find((k) => k.toLowerCase() === colLower);
  if (ci) return valueOptions[ci];
  // A key is fully contained in the col name (e.g. "HQ" in "HQ Country")
  // or the col is fully contained in a key (e.g. "Company" in "Company Name")
  const contained = keys.find(
    (k) => colLower.includes(k.toLowerCase()) || k.toLowerCase().includes(colLower)
  );
  if (contained) return valueOptions[contained];
  return null;
}

// Column filter input with type-ahead autocomplete. The suggestions dropdown is
// rendered via a portal so it escapes the table's overflow:auto scroll container.
function ColFilterInput({ col, value, onChange, valueOptions }) {
  const options = findOptions(col, valueOptions);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropStyle, setDropStyle] = useState({});
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const filtered = value.trim() && options
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 7)
    : [];

  // Recompute dropdown position whenever it opens or the window scrolls.
  const reposition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropStyle({ top: r.bottom + 2, left: r.left, minWidth: Math.max(r.width, 160) });
  };

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    return () => window.removeEventListener('scroll', reposition, true);
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        inputRef.current?.contains(e.target) ||
        dropRef.current?.contains(e.target)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (val) => {
    onChange(val);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKey = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(filtered[activeIdx]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        className="col-filter-input"
        placeholder="Filter…"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => { if (value.trim()) setOpen(true); }}
        onKeyDown={handleKey}
      />
      {open && filtered.length > 0 && createPortal(
        <ul
          ref={dropRef}
          className="col-filter-suggestions"
          style={{ position: 'fixed', zIndex: 300, ...dropStyle }}
        >
          {filtered.map((s, idx) => (
            <li
              key={s}
              className={activeIdx === idx ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              <Highlight text={s} query={value} />
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  );
}

export default function DataTable({ view, resultCount, hiddenCols, resetKey, valueOptions }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnFilters, setColumnFilters] = useState({});

  useEffect(() => {
    setPage(1);
    setColumnFilters({});
  }, [resetKey]);

  const allRows = getExpandedRows(view);
  const activeFilters = Object.entries(columnFilters).filter(([, val]) => val && val.trim());
  const filteredRows =
    activeFilters.length === 0
      ? allRows
      : allRows.filter((row) =>
          activeFilters.every(([idx, val]) =>
            cellText(row[Number(idx)]).toLowerCase().includes(val.trim().toLowerCase())
          )
        );

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIdx = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);

  const setColumnFilter = (idx, value) => {
    setColumnFilters((prev) => ({ ...prev, [idx]: value }));
    setPage(1);
  };

  const goToPage = (p) => setPage(Math.min(Math.max(p, 1), totalPages));

  const filtersActive = activeFilters.length > 0;
  const rangeStart = totalFiltered === 0 ? 0 : startIdx + 1;
  const rangeEnd = Math.min(startIdx + pageSize, totalFiltered);

  let winStart = Math.max(1, safePage - Math.floor(PAGE_WINDOW / 2));
  let winEnd = Math.min(totalPages, winStart + PAGE_WINDOW - 1);
  winStart = Math.max(1, winEnd - PAGE_WINDOW + 1);
  const pageNumbers = [];
  for (let p = winStart; p <= winEnd; p++) pageNumbers.push(p);

  return (
    <>
      <div className="tablefoot">
        <span>
          {filtersActive
            ? `Showing ${rangeStart}–${rangeEnd} of ${totalFiltered} rows matching your column filters`
            : `Showing ${rangeStart}–${rangeEnd} of ${totalFiltered} loaded rows · ${resultCount} total matching records`}
        </span>
        <div className="pagectrl">
          <button disabled={safePage <= 1} onClick={() => goToPage(1)} title="First page">«</button>
          <button disabled={safePage <= 1} onClick={() => goToPage(safePage - 1)} title="Previous page">‹ Prev</button>
          <div className="page-numbers">
            {winStart > 1 && (
              <>
                <button onClick={() => goToPage(1)}>1</button>
                {winStart > 2 && <span className="page-ellipsis">…</span>}
              </>
            )}
            {pageNumbers.map((p) => (
              <button key={p} className={p === safePage ? 'active' : ''} onClick={() => goToPage(p)}>
                {p}
              </button>
            ))}
            {winEnd < totalPages && (
              <>
                {winEnd < totalPages - 1 && <span className="page-ellipsis">…</span>}
                <button onClick={() => goToPage(totalPages)}>{totalPages}</button>
              </>
            )}
          </div>
          <button disabled={safePage >= totalPages} onClick={() => goToPage(safePage + 1)} title="Next page">Next ›</button>
          <button disabled={safePage >= totalPages} onClick={() => goToPage(totalPages)} title="Last page">»</button>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      <div className="table-scroll-area">
        <table className="data">
          <thead>
            <tr>
              {view.cols.map(
                (col, i) =>
                  !hiddenCols.has(i) && (
                    <th key={col}>
                      {col}
                      <span className="sort">▾</span>
                    </th>
                  )
              )}
            </tr>
            <tr className="col-filter-row">
              {view.cols.map(
                (col, i) =>
                  !hiddenCols.has(i) && (
                    <th key={col}>
                      <ColFilterInput
                        col={col}
                        value={columnFilters[i] || ''}
                        onChange={(val) => setColumnFilter(i, val)}
                        valueOptions={valueOptions}
                      />
                    </th>
                  )
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={view.cols.length} style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 28 }}>
                  No rows match your column filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map(
                    (cell, cIdx) =>
                      !hiddenCols.has(cIdx) && (
                        <td key={cIdx} className={cellClassName(cell, cIdx === 0)}>
                          {renderCell(cell)}
                        </td>
                      )
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
