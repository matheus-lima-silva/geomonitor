import AppIcon from '@app/components/AppIcon';
import { Button, Textarea } from '@app/components/ui';
import StepCard from './StepCard';
import { introTemplate } from '../../utils/templates';

/**
 * Card 1 — Introducao (secao 1 do documento). "Usar texto-modelo" preenche
 * com periodo + nomes dos engenheiros + dados do contrato; pede confirmacao
 * quando ja existe texto.
 */
export default function IntroCard({ report, settings, onChangeIntro }) {
  function applyTemplate() {
    const text = introTemplate({
      refYear: report.refYear,
      refMonth: report.refMonth,
      engineers: report.engineers,
      contrato: settings?.contrato || {},
    });
    if (report.intro && report.intro.trim() && !window.confirm('Substituir o texto atual pelo texto-modelo?')) {
      return;
    }
    onChangeIntro(text);
  }

  return (
    <StepCard
      id="sec-intro"
      number={1}
      title="Introdução"
      subtitle="Texto livre — entra como a seção 1 do relatório. O texto-modelo já preenche período e nomes dos engenheiros."
      actions={(
        <Button variant="outline" size="sm" onClick={applyTemplate}>
          <AppIcon name="wand-2" className="w-[15px] h-[15px] mr-1.5" />
          Usar texto-modelo
        </Button>
      )}
    >
      <Textarea
        id="intro-text"
        rows={7}
        placeholder="Escreva a introdução do relatório…"
        value={report.intro || ''}
        onChange={(e) => onChangeIntro(e.target.value)}
      />
    </StepCard>
  );
}
