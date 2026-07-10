import { Fragment, useEffect, useRef, useState } from 'react';

const JOIN_OPTIONS = ['AND', 'OR', 'NOT'];
const VALUE_LOGIC_OPTIONS = ['OR', 'AND', 'NOT'];

function splitValues(condition) {
  if (condition.op !== 'in' && condition.op !== 'excludes' && condition.op !== 'includes all of') return null;
  const sep = condition.op === 'includes all of' ? ' and ' : ', ';
  return condition.value.split(sep).map((v) => v.trim());
}

function opToLogic(op) {
  if (op === 'excludes') return 'NOT';
  if (op === 'includes all of') return 'AND';
  return 'OR';
}
function logicToOp(logic, valueCount) {
  if (valueCount === 1) return logic === 'NOT' ? '≠' : '=';
  if (logic === 'NOT') return 'excludes';
  if (logic === 'AND') return 'includes all of';
  return 'in';
}

// Highlights the matched portion of `text` for the query string.
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

// Unified editor: renders as a positioned popover outside .qnode (so overflow:hidden
// on the chip never clips it). For fields with a known pick-list, typing filters
// those options into a suggestion dropdown. For free-text fields, suggestions are
// absent and the user types + Enter to add tags.
function ValueEditor({ fieldName, condition, options, onSave, onCancel }) {
  const existingValues = splitValues(condition);
  const [tags, setTags] = useState(() => existingValues || [condition.value]);
  const [logic, setLogic] = useState(() => opToLogic(condition.op));
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggIdx, setSuggIdx] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Dismiss on click outside the popover.
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onCancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = (val) => {
    setDraft(val);
    setSuggIdx(-1);
    if (val.trim() && options) {
      const q = val.trim().toLowerCase();
      setSuggestions(
        options.filter((o) => o.toLowerCase().includes(q) && !tags.includes(o)).slice(0, 7)
      );
    } else {
      setSuggestions([]);
    }
  };

  const pickSuggestion = (val) => {
    if (!val || tags.includes(val)) return;
    setTags((prev) => [...prev, val]);
    setDraft('');
    setSuggestions([]);
    setSuggIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const addDraft = () => {
    const v = draft.trim();
    if (!v || tags.includes(v)) { setDraft(''); setSuggestions([]); return; }
    setTags((prev) => [...prev, v]);
    setDraft('');
    setSuggestions([]);
    setSuggIdx(-1);
  };

  const removeTag = (idx) => setTags((prev) => prev.filter((_, i) => i !== idx));

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggIdx((i) => Math.max(i - 1, -1)); return; }
      if (e.key === 'Enter' && suggIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[suggIdx]); return; }
    }
    if (e.key === 'Enter') { e.preventDefault(); addDraft(); return; }
    if (e.key === 'Escape') { if (suggestions.length) { setSuggestions([]); } else { onCancel(); } return; }
    // Backspace on empty input removes the last tag.
    if (e.key === 'Backspace' && !draft && tags.length > 0) setTags((prev) => prev.slice(0, -1));
  };

  const save = () => {
    if (tags.length === 0) return onCancel();
    const op = logicToOp(logic, tags.length);
    if (tags.length === 1) return onSave({ value: tags[0], op });
    const sep = logic === 'AND' ? ' and ' : ', ';
    onSave({ value: tags.join(sep), op });
  };

  return (
    <div className="qval-edit-multi" ref={wrapRef}>
      {/* Header shows which field is being edited */}
      <div className="qval-edit-header">
        <span className="qval-edit-field-label">{fieldName}</span>
        <span className="qval-edit-hint">Enter or ↑↓ to select</span>
      </div>

      {tags.length > 1 && (
        <div className="value-logic-row">
          <span className="value-logic-label">Match</span>
          <div className="value-logic-seg">
            {VALUE_LOGIC_OPTIONS.map((o) => (
              <button key={o} type="button" data-logic={o} className={logic === o ? 'active' : ''} onClick={() => setLogic(o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="value-tags" style={{ marginBottom: 8 }}>
          {tags.map((v, i) => (
            <span key={`${v}-${i}`} className="value-tag">
              {v}
              <button onClick={() => removeTag(i)}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div className="qval-autocomplete-wrap">
        <div className="value-tag-input-row">
          <input
            ref={inputRef}
            type="text"
            placeholder={options ? `Search ${fieldName}…` : 'Type a value, press Enter…'}
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {!options && (
            <button className="btn btn-sm" onMouseDown={(e) => { e.preventDefault(); addDraft(); }}>
              Add
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
          <ul className="qval-suggestions">
            {suggestions.map((s, idx) => (
              <li
                key={s}
                className={suggIdx === idx ? 'active' : ''}
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
              >
                <Highlight text={s} query={draft} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="qval-edit-multi-actions">
        <button className="btn btn-sm btn-primary" onClick={save}>Done</button>
      </div>
    </div>
  );
}

export default function SearchBuilder({ open, conditions, setConditions, onRunSearch, onClear, blankCondition, valueOptions }) {
  const [editingIndex, setEditingIndex] = useState(null);

  const setJoin = (index, join) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, join } : c)));
  };

  const setValue = (index, { value, op }) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, value, op } : c)));
  };

  const removeCondition = (index) => {
    setConditions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next[0]) delete next[0].join;
      return next;
    });
    setEditingIndex(null);
  };

  const addBlankCondition = () => {
    setConditions((prev) => [...prev, { ...blankCondition, join: prev.length ? 'AND' : undefined }]);
  };

  const clearAll = () => {
    setConditions([]);
    onClear?.();
    setEditingIndex(null);
  };

  const joinClass = (join) => (join === 'OR' ? 'or' : join === 'NOT' ? 'not' : '');

  return (
    <div className={`qbuilder ${open ? 'open' : ''}`}>
      <div className="qbuilder-head">
        <h3>Search builder</h3>
        <button className="btn btn-ghost btn-sm" onClick={clearAll}>
          Clear all
        </button>
      </div>

      <div className="qchain">
        {conditions.map((c, i) => (
          <Fragment key={`${c.field}-${i}`}>
            {i > 0 && (
              <div className="qbond">
                <div className="qbond-seg">
                  {JOIN_OPTIONS.map((o) => (
                    <span
                      key={o}
                      className={`qbond-tag ${joinClass(o)} ${c.join === o ? 'active' : ''}`}
                      onClick={() => setJoin(i, o)}
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* qnode-wrap has position:relative so the popover positions against
                it, NOT against .qnode which has overflow:hidden that would clip it. */}
            <div className="qnode-wrap">
              <div className="qnode">
                <span className="qseg qfield">{c.field}</span>
                <span className="qseg qop">{c.op}</span>
                <span
                  className={`qseg qval${editingIndex === i ? ' editing' : ''}`}
                  title="Click to edit"
                  onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                >
                  {c.value}
                  <svg className="qval-pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </span>
                <button className="qnode-remove" onClick={() => removeCondition(i)}>
                  ✕
                </button>
              </div>
              {editingIndex === i && (
                <ValueEditor
                  fieldName={c.field}
                  condition={c}
                  options={valueOptions[c.field]}
                  onSave={(value) => {
                    setValue(i, value);
                    setEditingIndex(null);
                  }}
                  onCancel={() => setEditingIndex(null)}
                />
              )}
            </div>
          </Fragment>
        ))}
      </div>

      <div className="qbuilder-actions">
        <button className="qadd" onClick={addBlankCondition}>
          + Add condition
        </button>
        <button className="btn btn-primary btn-sm" onClick={onRunSearch}>
          Run search
        </button>
      </div>
    </div>
  );
}
