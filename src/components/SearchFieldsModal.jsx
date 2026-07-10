import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';

const VALUE_LOGIC_OPTIONS = ['OR', 'AND', 'NOT'];

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

function fieldValueSummary(entry) {
  if (entry.type === 'num' || entry.type === 'date') {
    if (entry.rangeMin && entry.rangeMax) return `${entry.rangeMin} – ${entry.rangeMax}`;
    if (entry.rangeMin) return `≥ ${entry.rangeMin}`;
    if (entry.rangeMax) return `≤ ${entry.rangeMax}`;
    return 'Any';
  }
  if (entry.values.length === 0) return 'Any';
  const list =
    entry.values.length <= 2 ? entry.values.join(', ') : `${entry.values.slice(0, 2).join(', ')} +${entry.values.length - 2} more`;
  if (entry.valueLogic === 'NOT') return `NOT ${list}`;
  if (entry.valueLogic === 'AND' && entry.values.length > 1) return `ALL: ${list}`;
  return list;
}

// Lets the person choose how multiple values picked for THIS field combine —
// mirrors the AND/OR/NOT joiner between different fields in the search
// builder, but scoped to one field's own value set (e.g. "Trial Status is
// NOT Withdrawn, Terminated" vs. the default OR "is any of").
function ValueLogicRow({ fieldName, valueLogic, onSetValueLogic }) {
  return (
    <div className="value-logic-row">
      <span className="value-logic-label">Match</span>
      <div className="value-logic-seg">
        {VALUE_LOGIC_OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            data-logic={o}
            className={valueLogic === o ? 'active' : ''}
            onClick={() => onSetValueLogic(fieldName, o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// One field's row: the toggle button, and — when selected — its value picker.
// The picker adapts to the field's data type:
//   enum/txt with a known pick-list -> searchable multi-select checkboxes
//   enum/txt without one            -> free-text tag entry (type + Enter)
//   num/date                        -> a min/max range pair (AND/OR/NOT n/a)
function FieldRow({ field, entry, isOpen, onToggle, onClosePanel, onRemove, onToggleValue, onAddTextValue, onRemoveTextValue, onSetRange, onSetValueLogic, valueOptions }) {
  const [valueQuery, setValueQuery] = useState('');
  const textInputRef = useRef(null);
  const isSelected = !!entry;
  const options = valueOptions[field.n];

  return (
    <div className={`field-row-item ${isSelected ? 'selected' : ''} ${isOpen ? 'open' : ''}`}>
      <button className="field-row-toggle" onClick={() => onToggle(field)}>
        <span className="fcheck">✓</span>
        <span className={`ftype ${field.t}`}>{field.t}</span>
        <span className="field-row-name">{field.n}</span>
        <span className="field-row-summary">{isSelected ? fieldValueSummary(entry) : 'Any'}</span>
        <svg className="field-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isSelected && (
        <button
          className="field-row-clear"
          title={`Remove ${field.n}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(field.n);
          }}
        >
          ✕
        </button>
      )}

      {isSelected && isOpen && (field.t === 'num' || field.t === 'date') && (
        <div className="field-value-panel">
          <div className="range-input-row">
            <input
              type="text"
              placeholder={field.t === 'date' ? 'From (e.g. 2026-01-01)' : 'Min'}
              value={entry.rangeMin}
              onChange={(e) => onSetRange(field.n, 'rangeMin', e.target.value)}
            />
            <span>–</span>
            <input
              type="text"
              placeholder={field.t === 'date' ? 'To (e.g. 2026-12-31)' : 'Max'}
              value={entry.rangeMax}
              onChange={(e) => onSetRange(field.n, 'rangeMax', e.target.value)}
            />
          </div>
          <div className="field-value-panel-actions">
            <button className="btn btn-sm btn-primary" onClick={onClosePanel}>
              Done
            </button>
          </div>
        </div>
      )}

      {isSelected && isOpen && field.t !== 'num' && field.t !== 'date' && options && (
        <div className="field-value-panel">
          <ValueLogicRow fieldName={field.n} valueLogic={entry.valueLogic} onSetValueLogic={onSetValueLogic} />
          <div className="value-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder={`Search ${field.n} values…`}
              value={valueQuery}
              onChange={(e) => setValueQuery(e.target.value)}
              autoFocus
            />
            {valueQuery.trim() && (
              <button className="value-search-clear" onClick={() => setValueQuery('')} title="Clear">✕</button>
            )}
          </div>
          <div className="value-option-list">
            {(() => {
              const filtered = options.filter(
                (v) => !valueQuery.trim() || v.toLowerCase().includes(valueQuery.trim().toLowerCase())
              );
              if (filtered.length === 0) {
                return <div className="value-option-empty">No matches for "{valueQuery}"</div>;
              }
              return filtered.map((v) => (
                <label className="value-option" key={v}>
                  <input type="checkbox" checked={entry.values.includes(v)} onChange={() => onToggleValue(field.n, v)} />
                  <Highlight text={v} query={valueQuery} />
                </label>
              ));
            })()}
          </div>
          <div className="field-value-panel-actions">
            <button className="btn btn-sm btn-primary" onClick={onClosePanel}>
              Done
            </button>
          </div>
        </div>
      )}

      {isSelected && isOpen && field.t !== 'num' && field.t !== 'date' && !options && (
        <div className="field-value-panel">
          <ValueLogicRow fieldName={field.n} valueLogic={entry.valueLogic} onSetValueLogic={onSetValueLogic} />
          <div className="value-tag-input-row">
            <input
              ref={textInputRef}
              type="text"
              placeholder="Type a value and press Enter…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddTextValue(field.n, e.target.value);
                  e.target.value = '';
                }
              }}
            />
            <button
              className="btn btn-sm"
              onClick={() => {
                onAddTextValue(field.n, textInputRef.current.value);
                textInputRef.current.value = '';
              }}
            >
              Add
            </button>
          </div>
          {entry.values.length > 0 && (
            <div className="value-tags">
              {entry.values.map((v, i) => (
                <span className="value-tag" key={`${v}-${i}`}>
                  {v}
                  <button onClick={() => onRemoveTextValue(field.n, i)}>✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="field-value-panel-actions">
            <button className="btn btn-sm btn-primary" onClick={onClosePanel}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchFieldsModal({
  open,
  onClose,
  moduleKey,
  moduleLabel,
  onAddFields,
  fieldDefs,
  fieldTypeDefaultOp,
  fieldTypeDefaultVal,
  valueOptions,
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState({}); // { [fieldName]: { type, values, rangeMin, rangeMax, valueLogic } }
  const [openFieldName, setOpenFieldName] = useState(null); // the one field whose value panel is expanded

  const groups = fieldDefs[moduleKey] || {};

  const totalFields = useMemo(
    () => Object.values(groups).reduce((sum, fields) => sum + fields.length, 0),
    [groups]
  );

  useEffect(() => {
    if (open) {
      setSelected({});
      setOpenFieldName(null);
    }
  }, [open, moduleKey]);

  const q = query.trim().toLowerCase();
  const selectedCount = Object.keys(selected).length;

  // Clicking a field selects it (if not already) and opens its value panel,
  // collapsing whichever other field's panel was open. Clicking the same open
  // field again closes its panel.
  const toggleField = (field) => {
    setSelected((prev) => {
      if (prev[field.n]) return prev;
      return { ...prev, [field.n]: { type: field.t, values: [], rangeMin: '', rangeMax: '', valueLogic: 'OR' } };
    });
    setOpenFieldName((prev) => (prev === field.n ? null : field.n));
  };

  const closePanel = () => setOpenFieldName(null);

  const removeField = (fieldName) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    setOpenFieldName((prev) => (prev === fieldName ? null : prev));
  };
  const toggleValue = (fieldName, value) => {
    setSelected((prev) => {
      const entry = prev[fieldName];
      if (!entry) return prev;
      const values = entry.values.includes(value)
        ? entry.values.filter((v) => v !== value)
        : [...entry.values, value];
      return { ...prev, [fieldName]: { ...entry, values } };
    });
  };
  const addTextValue = (fieldName, raw) => {
    const value = (raw || '').trim();
    if (!value) return;
    setSelected((prev) => {
      const entry = prev[fieldName];
      if (!entry || entry.values.includes(value)) return prev;
      return { ...prev, [fieldName]: { ...entry, values: [...entry.values, value] } };
    });
  };
  const removeTextValue = (fieldName, idx) => {
    setSelected((prev) => {
      const entry = prev[fieldName];
      if (!entry) return prev;
      return { ...prev, [fieldName]: { ...entry, values: entry.values.filter((_, i) => i !== idx) } };
    });
  };
  const setRange = (fieldName, which, val) => {
    setSelected((prev) => {
      const entry = prev[fieldName];
      if (!entry) return prev;
      return { ...prev, [fieldName]: { ...entry, [which]: val } };
    });
  };
  const setValueLogic = (fieldName, logic) => {
    setSelected((prev) => {
      const entry = prev[fieldName];
      if (!entry) return prev;
      return { ...prev, [fieldName]: { ...entry, valueLogic: logic } };
    });
  };

  const confirmSelection = () => {
    const entries = Object.entries(selected);
    if (entries.length === 0) return;

    const fields = entries.map(([name, entry]) => {
      let op;
      let value;
      if (entry.type === 'num' || entry.type === 'date') {
        if (entry.rangeMin && entry.rangeMax) {
          op = 'between';
          value = `${entry.rangeMin} – ${entry.rangeMax}`;
        } else if (entry.rangeMin) {
          op = '≥';
          value = entry.rangeMin;
        } else if (entry.rangeMax) {
          op = '≤';
          value = entry.rangeMax;
        } else {
          op = fieldTypeDefaultOp[entry.type] || '=';
          value = fieldTypeDefaultVal[entry.type] || '(set value)';
        }
      } else if (entry.values.length === 0) {
        op = fieldTypeDefaultOp[entry.type] || '=';
        value = fieldTypeDefaultVal[entry.type] || '(set value)';
      } else if (entry.values.length === 1) {
        op = entry.valueLogic === 'NOT' ? '≠' : '=';
        value = entry.values[0];
      } else if (entry.valueLogic === 'AND') {
        op = 'includes all of';
        value = entry.values.join(' and ');
      } else if (entry.valueLogic === 'NOT') {
        op = 'excludes';
        value = entry.values.join(', ');
      } else {
        op = 'in';
        value = entry.values.join(', ');
      }
      return { field: name, op, value };
    });

    onAddFields(fields);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Search fields — ${moduleLabel}`}
      subtitle="Select one or more fields, choose specific values for each, then confirm to add them all to your search builder"
      footer={
        <>
          <span className="ai-cta-text">
            {selectedCount > 0
              ? `${selectedCount} field${selectedCount > 1 ? 's' : ''} selected · ${totalFields} searchable fields in ${moduleLabel}`
              : `${totalFields} searchable fields in ${moduleLabel}`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={selectedCount === 0} onClick={confirmSelection}>
              {selectedCount > 0 ? `Add ${selectedCount} selected field${selectedCount > 1 ? 's' : ''}` : 'Add selected fields'}
            </button>
          </div>
        </>
      }
    >
      <div className="search-box" style={{ marginBottom: 16, background: 'var(--bg)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input type="text" placeholder="Filter fields…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {Object.keys(groups).length === 0 && <div className="fields-empty">No indexed fields for this module yet.</div>}

      {Object.entries(groups).map(([groupName, fields]) => {
        const visible = fields.filter((f) => !q || f.n.toLowerCase().includes(q));
        if (visible.length === 0) return null;
        return (
          <div className="field-group" key={groupName}>
            <div className="field-group-title">
              {groupName} <span className="count">{fields.length}</span>
            </div>
            <div className="field-list">
              {visible.map((f) => (
                <FieldRow
                  key={f.n}
                  field={f}
                  entry={selected[f.n]}
                  isOpen={openFieldName === f.n}
                  onToggle={toggleField}
                  onClosePanel={closePanel}
                  onRemove={removeField}
                  onToggleValue={toggleValue}
                  onAddTextValue={addTextValue}
                  onRemoveTextValue={removeTextValue}
                  onSetRange={setRange}
                  onSetValueLogic={setValueLogic}
                  valueOptions={valueOptions}
                />
              ))}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}
