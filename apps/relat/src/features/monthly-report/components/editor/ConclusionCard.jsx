import AppIcon from '@app/components/AppIcon';
import { Button, Textarea } from '@app/components/ui';
import StepCard from './StepCard';
import { conclusaoTemplate } from '../../utils/templates';

/**
 * Card 3 — Conclusao (secao 3 do documento), com texto-modelo padrao.
 */
export default function ConclusionCard({ report, onChangeConclusao }) {
  function applyTemplate() {
    if (report.conclusao && report.conclusao.trim() && !window.confirm('Substituir o texto atual pelo texto-modelo?')) {
      return;
    }
    onChangeConclusao(conclusaoTemplate());
  }

  return (
    <StepCard
      id="sec-conc"
      number={3}
      title="Conclusão"
      actions={(
        <Button variant="outline" size="sm" onClick={applyTemplate}>
          <AppIcon name="wand-2" className="w-[15px] h-[15px] mr-1.5" />
          Usar texto-modelo
        </Button>
      )}
    >
      <Textarea
        id="conclusao-text"
        rows={5}
        placeholder="Escreva a conclusão do relatório…"
        value={report.conclusao || ''}
        onChange={(e) => onChangeConclusao(e.target.value)}
      />
    </StepCard>
  );
}
