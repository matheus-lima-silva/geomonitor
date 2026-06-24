import AppIcon from '../../../components/AppIcon';
import { followupStageStates } from '../utils/followupCampaigns';

const STEP_CIRCLE = {
  done: 'bg-emerald-500 text-white',
  active: 'bg-brand-600 text-white ring-4 ring-brand-100',
  late: 'bg-rose-600 text-white ring-4 ring-rose-100',
  todo: 'bg-white border border-slate-300 text-slate-400',
};

const STEP_LABEL = {
  done: 'text-emerald-700',
  active: 'text-brand-700 font-bold',
  late: 'text-rose-700 font-bold',
  todo: 'text-slate-400',
};

/* Pipeline horizontal de 5 etapas (Planejamento → Emissão) com conectores
   coloridos por estado. Espelha o FupPipeline do kit. */
function FollowupPipeline({ campaign, due, effectiveStage }) {
  const steps = followupStageStates(campaign, due, effectiveStage);
  return (
    <ol className="flex items-start m-0 p-0 list-none" aria-label="Etapas da campanha">
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex-1 flex flex-col items-center gap-1.5">
          {index > 0 ? (
            <span
              aria-hidden="true"
              className={`absolute top-4 h-0.5 w-full ${steps[index - 1].state === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`}
              style={{ left: '-50%' }}
            />
          ) : null}
          <span className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${STEP_CIRCLE[step.state]}`}>
            <AppIcon name={step.state === 'done' ? 'check' : step.icon} size={14} />
          </span>
          <span className={`text-2xs font-semibold uppercase tracking-wide ${STEP_LABEL[step.state]}`}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

export default FollowupPipeline;
