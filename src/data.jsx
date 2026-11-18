import { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const Snapshot = createContext(null);
export const useSnapshot = () => useContext(Snapshot);

export function useApi(path) {
  const [result, setResult] = useState({ path: null });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const abort = new AbortController();
    fetch('/api' + path, { signal: abort.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Evidence could not be loaded.');
        return body;
      })
      .then(data => setResult({ path, attempt, data }))
      .catch(error => {
        if (error.name !== 'AbortError') setResult({ path, attempt, error: error.message });
      });
    return () => abort.abort();
  }, [path, attempt]);
  return {
    ...(result.path === path && result.attempt === attempt ? result : {}),
    loading: Boolean(path && (result.path !== path || result.attempt !== attempt)),
    retry: () => retry(count => count + 1),
  };
}

export function query(params) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== '')).toString();
}

export function useParamsState() {
  const [params, setParams] = useSearchParams();
  const patch = (values, replace = false) => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    return next;
  }, { replace, preventScrollReset: true });
  return [params, patch];
}

export function useDiscipline() {
  const [params, patch] = useParamsState();
  const stored = localStorage.getItem('prism-discipline');
  const explicit = params.get('d');
  useEffect(() => {
    if (explicit === 'batting' || explicit === 'bowling') localStorage.setItem('prism-discipline', explicit);
  }, [explicit]);
  const value = explicit || stored;
  const discipline = value === 'bowling' ? 'bowling' : 'batting';
  return [discipline, (next, changes = {}) => {
    localStorage.setItem('prism-discipline', next);
    patch({ d: next, ...changes });
  }];
}

export const playerLink = (id, discipline) => '/players/' + id + '?d=' + discipline;
export const comparisonLink = (discipline, ids) => '/compare?' + query({ d: discipline, ids: ids.join(',') });
export const matchLink = (match, params = {}) => '/matches/' + match + (query(params) ? '?' + query(params) : '');
