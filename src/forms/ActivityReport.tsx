import { Area, In, Page, PhotoSlot, SignLine, useForm } from './kit';

const CALIBRI = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const PAD: [number, number, number, number] = [10, 25.4, 25.4, 25.4];
export const ACTIVITY_BENEFICIARY_ROWS = 3;

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '8mm' }}>
      <img src="/forms/logo-activity.png" alt="PHILRADS, Philippine Relief and Development Services, Inc." style={{ width: '91mm' }} />
    </div>
  );
}

/**
 * Activity Report (ACTIVITY REPORT-Template.docx): A4, the overview table, highlights (A–D), the
 * list of beneficiaries, photos, and the signatures. The template's sample text shows as hints.
 */
export function ActivityReport({ rows = ACTIVITY_BENEFICIARY_ROWS }: { rows?: number }) {
  const { values } = useForm();
  const td = { border: '0.75pt solid #000', padding: '1.5mm 1.8mm', verticalAlign: 'top' as const, fontWeight: 700 };
  const head = (t: string) => <div style={{ fontWeight: 700, marginTop: '4mm' }}>{t}</div>;
  // The beneficiary table's columns are whatever the first row says (the template leaves them blank).
  const cols = [1, 2, 3, 4, 5];
  const seen = new Map<string, number>();
  return (
    <>
      <Page paper="a4" pad={PAD} font={CALIBRI} size="12pt">
        <Logo />
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '11pt' }}>ACTIVITY REPORT</div>
        <table style={{ width: '100%', marginTop: '8mm', tableLayout: 'fixed', fontSize: '11pt' }}>
          <colgroup>
            <col style={{ width: '38%' }} />
            <col />
          </colgroup>
          <tbody>
            <tr style={{ height: '20mm' }}>
              <td style={td}>Activity Description (Overview)</td>
              <td style={{ ...td, verticalAlign: 'middle' }}><Area k="overview" minH="6mm" placeholder="e.g. Shelter Rehabilitation" /></td>
            </tr>
            {(
              [
                ['Date Covered', 'dateCovered', 'e.g. May 4-22, 2026'],
                ['Donor/ Partner', 'donor', ''],
                ['Location', 'location', 'e.g. Mahayahay, Iligan City'],
              ] as const
            ).map(([label, k, ph]) => (
              <tr key={k} style={{ height: '10mm' }}>
                <td style={td}>{label}</td>
                <td style={td}><In k={k} bold placeholder={ph || undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '7mm' }}>
          <b>Highlights of the activity:</b> (Include process done, beneficiaries if applicable, changes/ decision making, challenges)
        </div>
        {head('A. Process Done')}
        <Area k="process" minH="40mm" placeholder="• An initial ocular inspection and damage assessment of houses…" style={{ lineHeight: 1.6 }} />
        {head('B. Beneficiaries')}
        <Area k="beneficiaries" minH="25mm" placeholder="• A total of 10 families received assistance…" style={{ lineHeight: 1.6 }} />
      </Page>

      <Page paper="a4" pad={PAD} font={CALIBRI} size="12pt">
        <Logo />
        <div style={{ fontWeight: 700 }}>C. Changes / Decision Making</div>
        <Area k="changes" minH="10mm" style={{ lineHeight: 1.6 }} />
        {head('D. Challenges')}
        <Area k="challenges" minH="22mm" placeholder="• Access to some houses was difficult…" style={{ lineHeight: 1.6 }} />
        <div style={{ fontWeight: 700, marginTop: '6mm' }}>List of Beneficiaries:</div>
        <table style={{ width: '100%', marginTop: '6mm', tableLayout: 'fixed', fontSize: '10.5pt' }}>
          <tbody>
            {Array.from({ length: rows + 1 }, (_, r) => {
              const name = String(values[`ben.${r}.1`] ?? '').trim().toLowerCase();
              const dupeOf = r > 0 && name ? seen.get(name) : undefined;
              if (r > 0 && name && !dupeOf) seen.set(name, r);
              return (
                <tr key={r} style={{ height: '8.5mm' }}>
                  {cols.map((c) => (
                    <td
                      key={c}
                      style={{ border: '1pt solid #000', padding: 0 }}
                      className={c === 1 && dupeOf ? 'ff-dupe' : undefined}
                      title={c === 1 && dupeOf ? `Same name as row ${dupeOf}` : undefined}
                    >
                      <In k={`ben.${r}.${c}`} bold={r === 0} align={r === 0 ? 'center' : undefined} placeholder={r === 0 ? ['Name', 'Address', 'Sex', 'Age', 'Assistance'][c - 1] : undefined} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: '10mm' }}>Photo Documentation:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginTop: '2mm' }}>
          {[1, 2].map((i) => (
            <PhotoSlot key={i} k={`photo.${i}`} h="55mm" />
          ))}
        </div>
        <div style={{ marginTop: '12mm' }}>Prepared by:</div>
        <div style={{ marginTop: '10mm', width: '70mm' }}>
          <In k="preparedBy" className="ff-line" align="center" placeholder="Name" />
        </div>
      </Page>

      <Page paper="a4" pad={PAD} font={CALIBRI} size="12pt">
        <Logo />
        <div style={{ marginTop: '2mm' }}>Approved by:</div>
        <div style={{ marginTop: '12mm' }}>
          <SignLine w="85mm" />
        </div>
        <div style={{ marginTop: '2mm' }}>Program Manager/ President</div>
      </Page>
    </>
  );
}
