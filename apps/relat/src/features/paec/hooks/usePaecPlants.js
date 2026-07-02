// Lista de usinas PAEC: carrega uma vez e expoe create() para o cadastro
// (a criacao ja retorna a ficha pronta para navegar direto ao editor).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPlants, createPlant } from '../services/paecService';

export function usePaecPlants() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPlants();
      if (mountedRef.current) setPlants(items);
    } catch (err) {
      if (mountedRef.current) setError(err?.message || 'Erro ao carregar as usinas.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const create = useCallback(async (data) => {
    const created = await createPlant(data);
    if (mountedRef.current) {
      setPlants((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    }
    return created;
  }, []);

  return { plants, loading, error, reload: load, create };
}
