import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Download, Search, X } from 'lucide-react';
import { num } from './analytics.mjs';
import { playerLink, useSnapshot } from './data.jsx';

const group = new Intl.NumberFormat('en-US');
export const count = value => num(value) === null ? '—' : group.format(Number(value));
export const fixed = (value, places = 2) => num(value) === null ? '—' : Number(value).toFixed(places);
export const signed = (value, places = 2) => num(value) === null ? '—' : (Number(value) > 0 ? '+' : '') + fixed(value, places);
export const percent = value => num(value) === null ? '—' : fixed(Number(value) * 100, 0) + '%';
export const titleCase = value => value ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ') : '—';
export const interval = (low, high) => num(low) == null || num(high) == null ? '—' : fixed(low) + ' to ' + fixed(high);
export const deltaClass = value => Number(value) < 0 ? 'negative' : Number(value) > 0 ? 'positive' : '';

export function PageHead({ kicker, title, description, actions }) {
  return <div className="page-head"><div>
    {kicker && <div className="eyebrow">{kicker}</div>}
    <h1>{title}</h1>{description && <p>{description}</p>}
  </div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function SectionHead({ title, description, action }) {
  return <div className="section-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

export function Panel({ title, subtitle, children, action, className = '', tourTarget }) {
  return <section className={'panel ' + className} data-tour={tourTarget}>
    {(title || action) && <div className="panel-head"><div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
    {children}
  </section>;
}

export function Metric({ label, value, detail, tone = '' }) {
  return <div className="metric"><span>{label}</span><strong className={tone}>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function Pill({ children, tone = '' }) {
  return <span className={'pill ' + tone}>{children}</span>;
}

export function Empty({ title = 'No observations in this view', detail = 'Adjust the filters to look for additional records.' }) {
  return <div className="empty"><strong>{title}</strong>{detail && <p>{detail}</p>}</div>;
}

export function ApiState({ result, children }) {
  if (result.error) return <div role="alert" className="empty"><strong>{result.error}</strong><button className="button" onClick={result.retry}>Retry</button></div>;
  if (result.loading) return <div role="status" aria-label="Loading evidence" className="skeleton"><i /><i /><i /></div>;
  return result.data ? children(result.data) : null;
}

export function TextLink({ to, children, primary = false }) {
  return <Link className={primary ? 'button primary' : 'text-link'} to={to}>{children}<ArrowUpRight size={15} aria-hidden="true" /></Link>;
}

export function Select({ label, value, options, onChange }) {
  return <label className="field"><span>{label}</span><div className="select-wrap">
    <select aria-label={label} value={value ?? ''} onChange={event => onChange(event.target.value)}>
      {options.map(option => typeof option === 'string'
        ? <option key={option} value={option}>{option}</option>
        : <option key={option.value} value={option.value}>{option.label}</option>)}
    </select><ChevronDown size={14} aria-hidden="true" />
  </div></label>;
}

export function Field({ label, value, onChange, type = 'text', ...props }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ''} onChange={event => onChange(event.target.value)} {...props} /></label>;
}

export function Toggle({ value, onChange, options, label }) {
  return <div className="toggle" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
export const disciplines = [{ value: 'batting', label: 'Batting' }, { value: 'bowling', label: 'Bowling' }];

export function PlayerName({ row, discipline, showId = false }) {
  return <Link className="player-link" to={playerLink(row.pid, discipline)}>
    <span>{row.player_name || row.name}</span>{showId && <small>#{row.pid}</small>}
  </Link>;
}

export function PlayerPicker({ value, onChange, players, exclude = [], label = 'Find a player', autofocus = false, clearable = true }) {
  const { registry } = useSnapshot();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(autofocus);
  const [active, setActive] = useState(0);
  const id = useId();
  const ref = useRef(null);
  const selected = registry.find(player => player.pid === Number(value));
  const blocked = new Set(exclude);
  const input = query.trim().toLowerCase();
  const available = (players || registry).filter(player => !blocked.has(player.pid) &&
    (!input || [player.pid, player.name, ...(player.aliases || [])].some(term => String(term).toLowerCase().includes(input))));
  const visible = available.slice(0, 10);
  const highlighted = Math.min(active, Math.max(0, visible.length - 1));
  const choose = player => {
    onChange(player.pid);
    setOpen(false);
    setQuery('');
  };
  useEffect(() => {
    const click = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', click);
    return () => document.removeEventListener('pointerdown', click);
  }, []);
  return <div className="field picker" ref={ref}>
    <label htmlFor={id}>{label}</label>
    <div className="picker-input"><Search size={16} aria-hidden="true" />
      <input id={id} role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls={id + '-options'}
        aria-activedescendant={open && visible.length ? id + '-' + highlighted : undefined}
        autoFocus={autofocus} placeholder={selected ? selected.name + ' · #' + selected.pid : 'Name or numeric ID'}
        value={open ? query : selected ? selected.name : query}
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive(Math.max(0, Math.min(Math.max(0, visible.length - 1), highlighted + (event.key === 'ArrowDown' ? 1 : -1))));
          }
          if (event.key === 'Enter' && open && visible[highlighted]) { event.preventDefault(); choose(visible[highlighted]); }
          if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); setQuery(''); }
          if (event.key === 'Tab') setOpen(false);
        }} />
      {selected && clearable && <button type="button" className="icon-button" aria-label="Clear selected player" onClick={() => { onChange(''); setQuery(''); }}><X size={15} /></button>}
    </div>
    {open && <ul className="picker-options" id={id + '-options'} role="listbox" aria-label={label}>
      {visible.map((player, index) => <li key={player.pid} id={id + '-' + index} role="option" aria-selected={index === highlighted}>
        <button type="button" tabIndex={-1} onClick={() => choose(player)}><span>{player.name}</span><small>#{player.pid}</small></button>
      </li>)}
      {!visible.length && <li className="picker-empty">No matching player</li>}
    </ul>}
  </div>;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function exportCsv(filename, columns, rows) {
  const headers = columns.map(column => escapeCsv(column.label));
  const lines = rows.map(row => columns.map(column => escapeCsv(column.exportValue ? column.exportValue(row) : column.value ? column.value(row) : row[column.key])).join(','));
  const blob = new Blob([[headers.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename + '.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Export({ name, columns, rows }) {
  return <button className="button small" type="button" disabled={!rows.length} onClick={() => exportCsv(name, columns, rows)}>
    <Download size={15} aria-hidden="true" /> CSV
  </button>;
}

export function Table({ columns, rows, label, rowKey, sort, setSort, empty, scroll = false }) {
  if (!rows.length) return <Empty title={empty} />;
  return <div className={'table-wrap' + (scroll ? ' table-scroll' : '')} tabIndex={0} role="region" aria-label={label}>
    <table aria-label={label}><thead><tr>{columns.map(column => {
      const selected = sort?.key === column.key;
      return <th key={column.key} scope="col" aria-sort={selected ? sort.direction === 'asc' ? 'ascending' : 'descending' : undefined}
        className={column.numeric ? 'numeric' : ''}>
        {setSort && column.sortable !== false
          ? <button onClick={() => setSort({ key: column.key, direction: selected && sort.direction === 'asc' ? 'desc' : 'asc' })}>
            {column.label}{selected && <ArrowDown size={12} className={sort.direction === 'asc' ? 'rotate-180' : ''} />}
          </button> : column.label}</th>;
    })}</tr></thead><tbody>
      {rows.map((row, index) => <tr key={rowKey?.(row) ?? row.pid ?? index}>
        {columns.map(column => <td key={column.key} className={(column.numeric ? 'numeric ' : '') + (column.className || '')}>
          {column.render ? column.render(row) : row[column.key] ?? '—'}
        </td>)}
      </tr>)}
    </tbody></table>
  </div>;
}

export function sortRows(rows, columns, sort) {
  if (!sort) return rows;
  const column = columns.find(item => item.key === sort.key);
  if (!column) return rows;
  const get = column.value || (row => row[column.key]);
  return [...rows].sort((a, b) => {
    const av = get(a), bv = get(b);
    if (av == null || av === '') return bv == null || bv === '' ? 0 : 1;
    if (bv == null || bv === '') return -1;
    const comparison = column.numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
    return sort.direction === 'desc' ? -comparison : comparison;
  });
}

export function Pager({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pager">
    <span>{count(total)} records <span className="muted">· Page {page} of {pages}</span></span>
    <div><button className="icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ArrowLeft size={17} /></button>
      <button className="icon-button" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}><ArrowRight size={17} /></button></div>
  </div>;
}
