/**
 * PDF "Relatorio de Vistoria - Diario de Campo" (2 paginas A4 retrato).
 *
 * Recriacao do design handoff (pdf-relatorio-vistoria) dentro do pipeline de
 * impressao client-side ja usado no app (mesma abordagem de
 * features/erosions/utils/erosionPdfTemplates.js: HTML + `@media print` +
 * window.print()). Sem endpoint novo, sem worker.
 *
 * Duas variacoes compartilham o mesmo markup; a classe no root muda o
 * tratamento visual: `pv--sobria` (institucional) | `pv--marca` (cabecalho azul).
 *
 * Cores/labels/retorno de criticidade vem das fontes canonicas
 * (buildCriticalitySummaryFromErosion / FREQUENCY_BY_CODE). A paleta literal das
 * bandas (PV_CRIT) espelha `src/styles.css` (--chart-criticality-*) para o texto
 * e as tintas de badge do handoff para bg/border, porque a janela de impressao
 * nao herda as CSS vars do app.
 */
import {
  buildCriticalitySummaryFromErosion,
  getCriticalityFrequencyLabel,
} from '../../shared/criticalitySummary';
import { getCriticalityCode, resolveErosionCriticality } from '../../../../shared/erosionHelpers';
import { formatHotelNote, hasHotelData } from './inspectionWorkflow';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* banda -> cores. text espelha --chart-criticality-* (styles.css);
   bg/border espelham as tintas de badge do handoff. */
const PV_CRIT = {
  C1: { text: '#166534', bg: '#ecfdf3', border: '#a7f3d0' },
  C2: { text: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
  C3: { text: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  C4: { text: '#7f1d1d', bg: '#fef2f2', border: '#fecaca' },
};

const STATUS_LABELS = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluida',
  cancelada: 'Cancelada',
};

const IMPACT_TO_CODE = {
  baixo: 'C1',
  medio: 'C2',
  médio: 'C2',
  alto: 'C3',
  'muito alto': 'C4',
};

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isBandCode(value) {
  return /^C[1-4]$/.test(String(value || '').toUpperCase());
}

function toDate(value) {
  if (value instanceof Date) return value;
  const iso = String(value ?? '').slice(0, 10);
  return new Date(`${iso}T00:00:00`);
}

function dateBR(value) {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function dateTimeBR(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

function weekdayBR(value) {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { weekday: 'long' });
}

function towerCode(ref) {
  const value = String(ref ?? '').trim();
  if (!value) return '—';
  if (value === '0') return 'T0';
  return `T-${value}`;
}

function towerNumbersOfDay(day) {
  const detailed = Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : [];
  if (detailed.length > 0) return detailed.map((tower) => tower?.numero);
  return Array.isArray(day?.torres) ? day.torres : [];
}

/** Resolve a banda C1-C4 de uma erosao pelas fontes canonicas, com fallback no impacto. */
function erosionBand(erosion) {
  const summary = buildCriticalitySummaryFromErosion(erosion);
  if (isBandCode(summary.criticidadeCodigo)) return summary.criticidadeCodigo.toUpperCase();
  const fromHelper = getCriticalityCode(resolveErosionCriticality(erosion));
  if (isBandCode(fromHelper)) return fromHelper;
  return IMPACT_TO_CODE[normalize(summary.impacto)] || 'C1';
}

function critColors(code) {
  return PV_CRIT[String(code || '').toUpperCase()] || PV_CRIT.C1;
}

function coordsLabel(erosion) {
  const lat = erosion?.latitude ?? erosion?.lat ?? erosion?.coordenadas?.lat;
  const lon = erosion?.longitude ?? erosion?.lng ?? erosion?.lon ?? erosion?.coordenadas?.lng;
  if (lat === undefined || lat === null || lon === undefined || lon === null) return '';
  return `${lat}, ${lon}`;
}

/** Index torreRef -> primeira erosao, para o ponto colorido no diario. */
function buildErosionByTower(erosions) {
  const map = new Map();
  (Array.isArray(erosions) ? erosions : []).forEach((erosion) => {
    const ref = String(erosion?.torreRef ?? erosion?.torreId ?? '').trim();
    if (ref && !map.has(ref)) map.set(ref, erosion);
  });
  return map;
}

function buildSintese(days, uniqueTowers, erosions) {
  const order = ['C4', 'C3', 'C2', 'C1'];
  const counts = order
    .map((code) => {
      const total = erosions.filter((erosion) => erosionBand(erosion) === code).length;
      return total > 0 ? `${total} ${code}` : null;
    })
    .filter(Boolean);
  const erosaoText = erosions.length > 0
    ? `${erosions.length} erosoes vinculadas${counts.length ? ` (${counts.join(' · ')})` : ''}`
    : 'nenhuma erosao vinculada';
  return `${days.length} dias em campo · ${uniqueTowers.length} torres vistoriadas · ${erosaoText}`;
}

function buildTrecho(uniqueTowers) {
  const numeric = uniqueTowers
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (numeric.length >= 2) {
    return `${towerCode(Math.min(...numeric))} → ${towerCode(Math.max(...numeric))}`;
  }
  if (uniqueTowers.length === 1) return towerCode(uniqueTowers[0]);
  return '—';
}

function defaultPhotos(erosions) {
  const out = [];
  (Array.isArray(erosions) ? erosions : []).forEach((erosion) => {
    const fotos = Array.isArray(erosion?.fotosPrincipais) ? erosion.fotosPrincipais : [];
    fotos.forEach((foto) => {
      out.push({
        titulo: String(foto?.caption || '').trim() || `${towerCode(erosion?.torreRef)} · ${erosion?.tipo || 'Erosao'}`,
        meta: [erosion?.id, foto?.fileName || foto?.mediaAssetId, coordsLabel(erosion)]
          .filter((part) => String(part || '').trim())
          .join(' · '),
        url: foto?.signedUrl || foto?.url || null,
      });
    });
  });
  return out;
}

function renderDay(day, idx, erosionByTower) {
  const dateLabel = day?.data ? dateBR(day.data) : `Dia ${idx + 1}`;
  const weekday = day?.data ? weekdayBR(day.data) : '';
  const towers = Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : [];

  const rowsHtml = towers.length > 0
    ? towers.map((tower) => {
      const ref = String(tower?.numero ?? '').trim();
      const erosion = ref ? erosionByTower.get(ref) : null;
      const obs = String(tower?.obs || '').trim() || 'Sem observacoes.';
      let erosaoCell;
      if (erosion) {
        const colors = critColors(erosionBand(erosion));
        erosaoCell = `<span class="pv-ers"><i class="pv-dot" style="background:${colors.text}"></i><span class="pv-mono">${escapeHtml(erosion.id || '')}</span></span>`;
      } else if (tower?.temErosao) {
        erosaoCell = `<span class="pv-ers"><i class="pv-dot" style="background:#94a3b8"></i><span class="pv-none">sem ID</span></span>`;
      } else {
        erosaoCell = '<span class="pv-none">—</span>';
      }
      const rowClass = erosion || tower?.temErosao ? ' class="pv-row-eros"' : '';
      return `<tr${rowClass}><td class="pv-mono pv-td-torre">${escapeHtml(towerCode(ref))}</td><td>${escapeHtml(obs)}</td><td>${erosaoCell}</td></tr>`;
    }).join('')
    : '<tr><td class="pv-none" colspan="3">Sem torres detalhadas neste dia.</td></tr>';

  const towersChip = (() => {
    const list = towerNumbersOfDay(day).map((value) => String(value ?? '').trim()).filter(Boolean);
    return list.length ? `Torres ${escapeHtml(list.join(', '))}` : '';
  })();

  const hotelHtml = hasHotelData(day)
    ? `<div class="pv-hotel"><span class="pv-label">Hospedagem</span><span>${escapeHtml(day?.hotelNome || '—')} · ${escapeHtml(day?.hotelMunicipio || '—')} · torre base ${escapeHtml(day?.hotelTorreBase || '—')} · logistica ${escapeHtml(formatHotelNote(day?.hotelLogisticaNota))} · reserva ${escapeHtml(formatHotelNote(day?.hotelReservaNota))} · estadia ${escapeHtml(formatHotelNote(day?.hotelEstadiaNota))}</span></div>`
    : '';

  return `
    <section class="pv-day">
      <div class="pv-day-head">
        <strong>Dia ${idx + 1} — ${escapeHtml(dateLabel)} ${weekday ? `<em>(${escapeHtml(weekday)})</em>` : ''}</strong>
        ${day?.clima ? `<span class="pv-chip pv-chip--sky">${escapeHtml(day.clima)}</span>` : ''}
        ${towersChip ? `<span class="pv-chip pv-chip--gray">${towersChip}</span>` : ''}
      </div>
      <table class="pv-table">
        <thead>
          <tr><th style="width:58px">Torre</th><th>Observacao de campo</th><th style="width:128px">Erosao</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${hotelHtml}
    </section>
  `;
}

function renderPage1(ctx) {
  const { doc, days, erosionByTower } = ctx;
  const daysHtml = days.length > 0
    ? days.map((day, idx) => renderDay(day, idx, erosionByTower)).join('')
    : '<div class="pv-none">Sem dias registados nesta vistoria.</div>';

  return `
    <div class="pv-page pv--${ctx.variant}">
      <header class="pv-head">
        <div class="pv-head-id">
          <img class="pv-logo pv-logo--light" src="/logo-geomonitor.svg" alt="GeoMonitor" />
          <img class="pv-logo pv-logo--dark" src="/logo-geomonitor-dark.svg" alt="GeoMonitor" />
          <h1 class="pv-title">Relatorio de Vistoria — Diario de Campo</h1>
          <p class="pv-subtitle">${escapeHtml(doc.empreendimentoNome)} · ${escapeHtml(doc.trecho)}</p>
        </div>
        <div class="pv-head-doc pv-mono">
          <span><b>DOC</b> ${escapeHtml(doc.codigo)}</span>
          <span><b>REV</b> ${escapeHtml(doc.rev)}</span>
          <span><b>EMISSAO</b> ${escapeHtml(doc.emissao)}</span>
        </div>
      </header>
      <div class="pv-body">
        <section class="pv-block">
          <div class="pv-sec"><span class="n pv-mono">1</span><span class="t">Identificacao</span></div>
          <div class="pv-ident">
            <div class="pv-field"><span class="pv-label">Empreendimento</span><span class="pv-value"><span class="pv-mono">${escapeHtml(doc.empreendimentoId)}</span> — ${escapeHtml(doc.empreendimentoNome)}</span></div>
            <div class="pv-field"><span class="pv-label">Trecho vistoriado</span><span class="pv-value">${escapeHtml(doc.trecho)}</span></div>
            <div class="pv-field"><span class="pv-label">Status</span><span class="pv-value"><span class="pv-status">${escapeHtml(doc.status)}</span></span></div>
            <div class="pv-field"><span class="pv-label">Periodo</span><span class="pv-value">${escapeHtml(doc.periodo)}</span></div>
            <div class="pv-field"><span class="pv-label">Dias em campo</span><span class="pv-value">${escapeHtml(doc.diasCampo)}</span></div>
            <div class="pv-field"><span class="pv-label">Responsavel</span><span class="pv-value">${escapeHtml(doc.responsavel)}</span></div>
            <div class="pv-field" style="grid-column:span 3"><span class="pv-label">Observacoes</span><span class="pv-value">${escapeHtml(doc.obs)}</span></div>
            <div class="pv-field" style="grid-column:span 3"><span class="pv-label">Sintese</span><span class="pv-value">${escapeHtml(doc.sintese)}</span></div>
          </div>
        </section>
        <section class="pv-block">
          <div class="pv-sec"><span class="n pv-mono">2</span><span class="t">Diario de campo</span></div>
          <div class="pv-days">${daysHtml}</div>
        </section>
      </div>
      <footer class="pv-footer">
        <span>Gerado em ${escapeHtml(doc.geradoEm)} · ${escapeHtml(doc.usuario)}</span>
        <span>${escapeHtml(doc.hash)}</span>
        <span>${escapeHtml(doc.codigo)} · Pagina 1 de 2</span>
      </footer>
    </div>
  `;
}

function renderPage2(ctx) {
  const { doc, erosions, photos } = ctx;

  const erosoesRows = erosions.length > 0
    ? erosions.map((erosion) => {
      const summary = buildCriticalitySummaryFromErosion(erosion);
      const code = erosionBand(erosion);
      const colors = critColors(code);
      const label = summary.impacto && summary.impacto !== '-' ? summary.impacto : (summary.criticidadeClasse || '');
      const score = summary.criticidadeScore !== '-' ? summary.criticidadeScore : (summary.score ?? '—');
      const retorno = getCriticalityFrequencyLabel(resolveErosionCriticality(erosion), summary.frequencia || '—');
      return `<tr>
        <td class="pv-mono pv-td-torre">${escapeHtml(erosion.id || '—')}</td>
        <td class="pv-mono">${escapeHtml(towerCode(erosion.torreRef))}</td>
        <td>${escapeHtml(erosion.tipo || '—')}</td>
        <td>${escapeHtml(erosion.estagio || '—')}</td>
        <td class="pv-mono">${escapeHtml(score)} pts</td>
        <td><span class="pv-badge" style="background:${colors.bg};border-color:${colors.border};color:${colors.text}">${escapeHtml(code)}${label ? ` · ${escapeHtml(label)}` : ''}</span></td>
        <td>${escapeHtml(retorno)}</td>
      </tr>`;
    }).join('')
    : '<tr><td class="pv-none" colspan="7">Nenhuma erosao vinculada a esta vistoria.</td></tr>';

  const fotosHtml = photos.length > 0
    ? photos.map((foto) => `
      <figure class="pv-foto">
        <div class="pv-slot">${foto.url ? `<img src="${escapeHtml(foto.url)}" alt="${escapeHtml(foto.titulo)}" />` : '<span>Foto curada da vistoria</span>'}</div>
        <figcaption>
          <strong>${escapeHtml(foto.titulo)}</strong>
          ${foto.meta ? `<span class="pv-mono">${escapeHtml(foto.meta)}</span>` : ''}
        </figcaption>
      </figure>
    `).join('')
    : '<div class="pv-none">Sem fotos curadas vinculadas a esta vistoria.</div>';

  return `
    <div class="pv-page pv--${ctx.variant}">
      <header class="pv-runhead">
        <span class="rt">Relatorio de Vistoria — Diario de Campo</span>
        <span class="rc pv-mono">${escapeHtml(doc.codigo)} · REV ${escapeHtml(doc.rev)}</span>
      </header>
      <div class="pv-body">
        <section class="pv-block">
          <div class="pv-sec"><span class="n pv-mono">3</span><span class="t">Erosoes identificadas</span><span class="c pv-mono">(${erosions.length})</span></div>
          <table class="pv-table pv-table--eros">
            <thead>
              <tr><th>Codigo</th><th>Torre</th><th>Feicao</th><th>Estagio</th><th>Score V3</th><th>Criticidade</th><th>Retorno</th></tr>
            </thead>
            <tbody>${erosoesRows}</tbody>
          </table>
          <p class="pv-note">Criticidade conforme Metodologia V3 — seis dimensoes (T·P·D·S·E·A) pontuadas 0/2/4/6; o retorno recomendado decorre da banda.</p>
        </section>
        <section class="pv-block">
          <div class="pv-sec"><span class="n pv-mono">4</span><span class="t">Anexo fotografico</span><span class="c pv-mono">(${photos.length})</span></div>
          <div class="pv-fotos">${fotosHtml}</div>
        </section>
      </div>
      <footer class="pv-footer">
        <span>Gerado em ${escapeHtml(doc.geradoEm)} · ${escapeHtml(doc.usuario)}</span>
        <span>${escapeHtml(doc.hash)}</span>
        <span>${escapeHtml(doc.codigo)} · Pagina 2 de 2</span>
      </footer>
    </div>
  `;
}

const PV_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-VariableFont_wght.ttf') format('truetype-variations');
  font-weight: 100 800; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Italic-VariableFont_wght.ttf') format('truetype-variations');
  font-weight: 100 800; font-style: italic; font-display: swap;
}
:root {
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', 'Menlo', monospace;
  --brand-100: #dbeafe; --brand-600: #2563eb; --brand-700: #1d4ed8;
  --slate-50: #f8fafc; --slate-100: #f1f5f9; --slate-200: #e2e8f0; --slate-300: #cbd5e1;
  --slate-400: #94a3b8; --slate-500: #64748b; --slate-600: #475569; --slate-700: #334155;
  --slate-800: #1e293b; --slate-850: #0f172a;
  --success: #16a34a; --success-light: #ecfdf3; --success-border: #a7f3d0;
  --info-light: #eff6ff; --info-border: #bfdbfe; --info-dark: #1d4ed8;
  --radius-sm: 6px; --radius-md: 10px; --radius-full: 9999px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #e2e8f0; }
@page { size: A4; margin: 0; }

/* ============ base da pagina A4 ============ */
.pv-page {
  width: 794px; height: 1123px; background: #ffffff;
  font-family: var(--font-sans); font-size: 12px; line-height: 1.45;
  color: var(--slate-700); display: flex; flex-direction: column; overflow: hidden;
  margin: 0 auto;
}
.pv-body { flex: 1; min-height: 0; padding: 0 52px; display: flex; flex-direction: column; gap: 20px; }
.pv-block { display: flex; flex-direction: column; gap: 10px; }
.pv-mono { font-family: var(--font-mono); }
.pv-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--slate-500); }
.pv-none { color: var(--slate-400); }
.pv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 22px; }
.pv-logo { height: 24px; display: block; margin-bottom: 14px; }
.pv-title { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: 0.005em; }
.pv-subtitle { margin: 3px 0 0; font-size: 12px; }
.pv-head-doc { display: flex; flex-direction: column; gap: 3px; font-size: 10px; text-align: right; white-space: nowrap; }
.pv-head-doc b { font-weight: 700; margin-right: 4px; }
.pv-runhead { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 20px; }
.pv-runhead .rt { font-size: 11px; font-weight: 700; }
.pv-runhead .rc { font-size: 10px; }
.pv-sec { display: flex; align-items: baseline; gap: 8px; padding-bottom: 5px; }
.pv-sec .n { font-size: 10px; font-weight: 700; }
.pv-sec .t { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.pv-sec .c { font-size: 10px; color: var(--slate-500); }
.pv-ident { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px; }
.pv-field { display: flex; flex-direction: column; gap: 2px; }
.pv-value { font-size: 12px; font-weight: 600; color: var(--slate-800); }
.pv-value .pv-mono { font-weight: 500; font-size: 11px; }
.pv-chip, .pv-badge, .pv-status {
  display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 700;
  line-height: 1; padding: 3px 8px; border-radius: var(--radius-full); border: 1px solid transparent; white-space: nowrap;
}
.pv-badge { border-radius: var(--radius-sm); }
.pv-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex: none; }
.pv-ers { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; }
.pv-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.pv-table th {
  text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--slate-500); padding: 4px 10px 4px 0; border-bottom: 1px solid var(--slate-300);
}
.pv-table td { padding: 5px 10px 5px 0; border-bottom: 1px solid var(--slate-200); vertical-align: top; color: var(--slate-700); }
.pv-td-torre { font-weight: 600; color: var(--slate-800); font-size: 10.5px; }
.pv-table--eros th, .pv-table--eros td { padding-right: 14px; }
.pv-note { margin: 2px 0 0; font-size: 10px; color: var(--slate-500); }
.pv-days { display: flex; flex-direction: column; gap: 12px; }
.pv-day { display: flex; flex-direction: column; gap: 6px; }
.pv-day-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pv-day-head strong { font-size: 12px; color: var(--slate-850); margin-right: 2px; }
.pv-day-head em { font-style: normal; font-weight: 400; color: var(--slate-500); }
.pv-hotel { display: flex; align-items: baseline; gap: 8px; font-size: 10.5px; color: var(--slate-600); }
.pv-fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 16px; }
.pv-foto { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.pv-foto figcaption { display: flex; flex-direction: column; gap: 1px; }
.pv-foto strong { font-size: 10.5px; color: var(--slate-800); }
.pv-foto .pv-mono { font-size: 9px; color: var(--slate-500); }
.pv-slot {
  width: 100%; height: 196px; border: 1px solid var(--slate-200); border-radius: var(--radius-sm);
  background: var(--slate-100); display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.pv-slot span { font-size: 10px; color: var(--slate-400); }
.pv-slot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pv-footer {
  margin: 0 52px; padding: 8px 0 0; display: flex; justify-content: space-between; align-items: baseline;
  gap: 16px; font-family: var(--font-mono); font-size: 8.5px; color: var(--slate-500); height: 42px; flex: none;
}

/* ============ VARIACAO A - SOBRIA ============ */
.pv--sobria .pv-head { margin: 0 52px 22px; padding: 26px 0 16px; border-top: 3px solid var(--slate-850); border-bottom: 1px solid var(--slate-800); }
.pv--sobria .pv-logo--dark { display: none; }
.pv--sobria .pv-logo--light { filter: grayscale(1) contrast(1.1); }
.pv--sobria .pv-title { color: var(--slate-850); }
.pv--sobria .pv-subtitle { color: var(--slate-600); }
.pv--sobria .pv-head-doc { color: var(--slate-600); }
.pv--sobria .pv-runhead { margin: 0 52px 20px; padding: 22px 0 8px; border-bottom: 1px solid var(--slate-300); }
.pv--sobria .pv-runhead .rt { color: var(--slate-800); }
.pv--sobria .pv-runhead .rc { color: var(--slate-500); }
.pv--sobria .pv-sec { border-bottom: 1px solid var(--slate-300); }
.pv--sobria .pv-sec .t, .pv--sobria .pv-sec .n { color: var(--slate-850); }
.pv--sobria .pv-chip, .pv--sobria .pv-status { background: #ffffff; border-color: var(--slate-300); color: var(--slate-600); }
.pv--sobria .pv-footer { border-top: 1px solid var(--slate-300); }

/* ============ VARIACAO B - COM MARCA ============ */
.pv--marca .pv-head { background: var(--brand-600); margin: 0 0 22px; padding: 24px 52px 22px; }
.pv--marca .pv-logo--light { display: none; }
.pv--marca .pv-title { color: #ffffff; }
.pv--marca .pv-subtitle { color: var(--brand-100); }
.pv--marca .pv-head-doc { color: var(--brand-100); }
.pv--marca .pv-head-doc b { color: #ffffff; }
.pv--marca .pv-runhead { background: var(--brand-600); margin: 0 0 20px; padding: 12px 52px; }
.pv--marca .pv-runhead .rt { color: #ffffff; }
.pv--marca .pv-runhead .rc { color: var(--brand-100); }
.pv--marca .pv-sec { border-bottom: 2px solid var(--brand-100); }
.pv--marca .pv-sec .t, .pv--marca .pv-sec .n { color: var(--brand-700); }
.pv--marca .pv-chip--sky { background: #e0f2fe; color: #0369a1; }
.pv--marca .pv-chip--gray { background: var(--slate-100); color: var(--slate-700); }
.pv--marca .pv-status { background: var(--success-light); border-color: var(--success-border); color: var(--success); }
.pv--marca .pv-day { border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: var(--slate-50); padding: 10px 14px 11px; }
.pv--marca .pv-day .pv-table th { border-bottom-color: var(--slate-300); }
.pv--marca .pv-row-eros td { background: #fef2f2; }
.pv--marca .pv-row-eros td:first-child { border-radius: 4px 0 0 4px; }
.pv--marca .pv-row-eros td:last-child { border-radius: 0 4px 4px 0; }
.pv--marca .pv-hotel { border: 1px solid var(--info-border); border-radius: var(--radius-sm); background: var(--info-light); padding: 5px 10px; color: var(--slate-700); }
.pv--marca .pv-hotel .pv-label { color: var(--info-dark); }
.pv--marca .pv-footer { border-top: 2px solid var(--brand-600); }

@media print {
  html, body { background: #ffffff; }
  .pv-page { margin: 0; page-break-after: always; box-shadow: none; }
  .pv-page:last-child { page-break-after: auto; }
}
`;

/**
 * Monta o documento HTML completo (2 paginas) do relatorio de vistoria.
 *
 * @param {object} params
 * @param {object} params.inspection  Vistoria (id, projetoId, dataInicio/Fim, status, obs, responsavel, detalhesDias[]).
 * @param {object} [params.project]   Empreendimento (nome) para o cabecalho.
 * @param {Array}  [params.erosions]  Erosoes ja filtradas pela vistoria.
 * @param {Array}  [params.photos]    Fotos curadas {titulo, meta, url}; default deriva de erosions[].fotosPrincipais.
 * @param {'sobria'|'marca'} [params.variant]  Variacao visual.
 * @param {Date}   [params.generatedAt]  Carimbo de geracao (injetavel p/ testes).
 * @param {string} [params.user]      Email/usuario que gerou.
 * @returns {string} HTML pronto para impressao.
 */
export function buildVistoriaPdfDocument({
  inspection = {},
  project = null,
  erosions = [],
  photos = null,
  variant = 'sobria',
  generatedAt = new Date(),
  user = '',
} = {}) {
  const safeVariant = variant === 'marca' ? 'marca' : 'sobria';
  const days = Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias : [];
  const erosionList = Array.isArray(erosions) ? erosions : [];
  const erosionByTower = buildErosionByTower(erosionList);

  const uniqueTowers = [
    ...new Set(
      days
        .flatMap((day) => towerNumbersOfDay(day))
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const statusKey = normalize(inspection?.status).replace(/\s+/g, '_');
  const doc = {
    codigo: String(inspection?.id || '—'),
    rev: String(inspection?.rev || '00'),
    emissao: dateBR(generatedAt),
    geradoEm: dateTimeBR(generatedAt),
    usuario: String(user || '—'),
    hash: String(inspection?.hash || '—'),
    empreendimentoId: String(inspection?.projetoId || '—'),
    empreendimentoNome: String(project?.nome || inspection?.projetoNome || inspection?.projetoId || '—'),
    trecho: buildTrecho(uniqueTowers),
    periodo: `${dateBR(inspection?.dataInicio)} – ${dateBR(inspection?.dataFim || inspection?.dataInicio)}`,
    diasCampo: String(days.length),
    responsavel: String(inspection?.responsavel || '—'),
    status: STATUS_LABELS[statusKey] || (inspection?.status ? String(inspection.status) : '—'),
    obs: String(inspection?.obs || '—'),
    sintese: buildSintese(days, uniqueTowers, erosionList),
  };

  const photoList = Array.isArray(photos) ? photos : defaultPhotos(erosionList);

  const ctx = {
    variant: safeVariant,
    doc,
    days,
    erosions: erosionList,
    erosionByTower,
    photos: photoList,
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatorio de Vistoria ${escapeHtml(doc.codigo)}</title>
<style>${PV_STYLE}</style>
</head>
<body>
${renderPage1(ctx)}
${renderPage2(ctx)}
</body>
</html>`;
}

/** Abre o HTML numa nova janela e dispara a impressao (mesmo padrao do modulo de erosoes). */
export function openVistoriaPrintWindow(documentHtml) {
  const win = window.open('', '_blank', 'width=1120,height=820');
  if (!win) throw new Error('Permita pop-up para exportar PDF.');

  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    if (typeof win.focus === 'function') win.focus();
    if (typeof win.print === 'function') win.print();
  };

  const doc = win.document;
  if (typeof doc?.open === 'function') doc.open();
  if (typeof doc?.write === 'function') doc.write(documentHtml);
  if (typeof doc?.close === 'function') doc.close();

  win.onload = () => {
    setTimeout(printOnce, 120);
  };
  setTimeout(printOnce, 450);
  return win;
}
