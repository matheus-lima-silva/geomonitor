import { useEffect, useState } from 'react';
import { listReportCompounds } from '../../../services/reportCompoundService';
import { listArchives } from '../../../services/reportArchiveService';

function shortSha(sha) {
  const value = String(sha || '').trim();
  return value ? value.slice(0, 12) : '';
}

/* Carrega, uma única vez, os compounds de relatório e os respectivos archives
   para montar a timeline de Emissões do dashboard de Acompanhamentos. Degrada
   para { emissions: [], error } sem quebrar a tela quando a API falha. */
export function useFollowupCampaignFacets({ enabled = true } = {}) {
  const [state, setState] = useState({ emissions: [], loading: Boolean(enabled), error: '' });

  useEffect(() => {
    if (!enabled) {
      setState({ emissions: [], loading: false, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: '' }));

    (async () => {
      try {
        const compounds = await listReportCompounds();
        const list = Array.isArray(compounds) ? compounds : [];
        const perCompound = await Promise.all(list.map(async (compound) => {
          try {
            const archives = await listArchives(compound.id);
            return (Array.isArray(archives) ? archives : []).map((archive) => ({
              id: String(archive.id),
              compoundName: compound.nome || compound.id,
              version: archive.version,
              deliveredAt: archive.deliveredAt || '',
              deliveredBy: archive.deliveredBy || '',
              sha: shortSha(archive.deliveredSha256 || archive.generatedSha256),
              hasDelivered: Boolean(archive.deliveredMediaId || archive.deliveredAt),
            }));
          } catch {
            return [];
          }
        }));
        if (cancelled) return;
        const emissions = perCompound
          .flat()
          .filter((emission) => emission.hasDelivered)
          .sort((a, b) => String(b.deliveredAt).localeCompare(String(a.deliveredAt)));
        setState({ emissions, loading: false, error: '' });
      } catch (err) {
        if (!cancelled) setState({ emissions: [], loading: false, error: err?.message || 'erro' });
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  return state;
}

export default useFollowupCampaignFacets;
