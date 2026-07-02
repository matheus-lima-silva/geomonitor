import { useState } from 'react';
import PlantListView from './components/plants/PlantListView';
import PaecFichaPage from './components/PaecFichaPage';

/**
 * Entrada do modulo PAEC no portal relat: alterna entre a lista de usinas e
 * o editor da ficha selecionada. `onExit` volta para o hub do portal.
 */
export default function PaecPage({ onExit }) {
  const [plantId, setPlantId] = useState(null);

  if (plantId) {
    return <PaecFichaPage plantId={plantId} onExit={() => setPlantId(null)} />;
  }
  return <PlantListView onOpenPlant={setPlantId} onExit={onExit} />;
}
