import { amount, duplicateRows, In, Page, peso, useForm } from './kit';

const CALIBRI = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
export const DISTRIBUTION_ROWS = 10;

/** Distribution List – Volunteer Allowance (PDF template): A4 landscape, 10 people per sheet. */
export function DistributionList({ rows = DISTRIBUTION_ROWS }: { rows?: number }) {
  const { values } = useForm();
  const dupes = duplicateRows(values, 'row', 'name', rows);
  const total = Array.from({ length: rows }, (_, i) => amount(values[`row.${i + 1}.amount`])).reduce((s, n) => s + n, 0);
  const th = { border: '0.75pt solid #000', fontWeight: 700, fontSize: '8pt', textAlign: 'center' as const, verticalAlign: 'middle' as const, padding: '0.5mm 1mm', lineHeight: 1.15 };
  const td = { border: '0.75pt solid #000', height: '11.2mm', fontSize: '9pt', padding: 0 };
  const field = (label: string, k: string, w: string) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2mm', height: '5.4mm' }}>
      <span style={{ width: '24mm', fontWeight: 700, fontSize: '7.5pt' }}>{label}</span>
      <In k={k} className="ff-line" style={{ width: w, fontSize: '9pt' }} />
    </div>
  );
  return (
    <Page paper="a4" landscape pad={[18, 17, 10, 19]} font={CALIBRI} size="9pt">
      <div style={{ textAlign: 'center' }}>
        <img src="/forms/logo-wide.png" alt="PHILRADS, Philippine Relief and Development Services, Inc." style={{ width: '62mm' }} />
        <div style={{ fontWeight: 700, fontSize: '11pt', marginTop: '0.5mm' }}>Distribution List</div>
      </div>
      <div style={{ marginTop: '4mm' }}>
        {field('Date', 'date', '70mm')}
        {field('Purpose/Activity:', 'purpose', '235mm')}
        {field('Project:', 'project', '235mm')}
      </div>
      <table style={{ width: '100%', marginTop: '4mm', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '9.4%' }} />
          <col style={{ width: '26.1%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '10.5%' }} />
          <col style={{ width: '15%' }} />
        </colgroup>
        <thead>
          <tr style={{ height: '12mm' }}>
            <th style={th}>No.</th>
            <th style={th}>Name</th>
            <th style={th}>
              Organization
              <div style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '7pt' }}>(if applicable)</div>
            </th>
            <th style={th}>Contact Number</th>
            <th style={th}>
              Particulars
              <div style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '7pt' }}>(Meal allowance, transpo allowance, etc.)</div>
            </th>
            <th style={th}>Amount</th>
            <th style={th}>Signature / Thumbmark</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => {
            const n = i + 1;
            const dupeOf = dupes.get(n);
            return (
              <tr key={n}>
                <td style={{ ...td, textAlign: 'center', fontSize: '7.5pt' }}>{n}</td>
                <td style={td} className={dupeOf ? 'ff-dupe' : undefined} title={dupeOf ? `Same name as row ${dupeOf}` : undefined}>
                  <In k={`row.${n}.name`} />
                </td>
                <td style={td}><In k={`row.${n}.org`} align="center" /></td>
                <td style={td}><In k={`row.${n}.contact`} align="center" /></td>
                <td style={td}><In k={`row.${n}.particulars`} align="center" /></td>
                <td style={td}><In k={`row.${n}.amount`} align="right" numeric /></td>
                <td style={td} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', borderBottom: '2.2pt double #000', padding: '1.5mm 0 1mm', fontWeight: 700, fontSize: '8pt' }}>
        <span style={{ marginLeft: '61.5%', width: '13%', textAlign: 'center' }}>TOTAL</span>
        <span style={{ width: '10.5%', textAlign: 'right', paddingRight: '1mm' }}>{peso(total)}</span>
      </div>
    </Page>
  );
}
