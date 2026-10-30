import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authFetch, BASE_URL } from '../lib/api';
import { fetchMe, getLastStore, setAgenteApi, setLastStore } from './api.js';

// Sesión del Agente: el server del bot firma un token para la API de TURNOS-YOGA
// (GET /api/agente/session), así el admin entra sin otro login. Vence a las 12 h:
// si la API responde 401 se pide uno nuevo.
const AgenteContext = createContext(null);

async function fetchSession() {
  const res = await authFetch(BASE_URL + '/api/agente/session');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo abrir el Agente');
  setAgenteApi(data.apiUrl);
  return data.token;
}

export function AgenteProvider({ children }) {
  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null); // { stores, pauta, entradas }
  const [storeKey, setStoreKey] = useState(null);
  const [error, setError] = useState('');
  const renewing = useRef(false);

  const start = useCallback(async () => {
    setError('');
    try {
      const t = await fetchSession();
      const data = await fetchMe(t);
      const last = getLastStore();
      setMe({ stores: data.stores, pauta: Boolean(data.pauta), entradas: Boolean(data.entradas) });
      setStoreKey((cur) => cur || (data.stores.some((s) => s.key === last) ? last : data.stores[0]?.key || null));
      setToken(t);
      if (!data.stores.length) setError('No hay tiendas configuradas en el Agente');
    } catch (err) {
      setError(err.message);
    } finally {
      renewing.current = false;
    }
  }, []);

  useEffect(() => { start(); }, [start]);

  const handleError = useCallback((err) => {
    if (err?.unauthorized) {
      if (!renewing.current) {
        renewing.current = true;
        start();
      }
    } else if (err) {
      setError(err.message);
    }
  }, [start]);

  const switchStore = useCallback((key) => {
    setLastStore(key);
    setStoreKey(key);
  }, []);

  const value = { token, me, storeKey, switchStore, error, setError, handleError, retry: start };
  return <AgenteContext.Provider value={value}>{children}</AgenteContext.Provider>;
}

export function useAgente() {
  return useContext(AgenteContext);
}
