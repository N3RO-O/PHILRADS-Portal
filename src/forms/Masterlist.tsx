import { Box, duplicateRows, In, Page, useForm } from './kit';

const CALIBRI = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
export const MASTERLIST_ROWS = 15;

/**
 * Masterlist (MASTERLIST.xlsx): beneficiaries of a response, A4 landscape. The workbook's two
 * sheets (PSS, and Food and NFIs) are the same layout with a different COMMODITIES line, so they
 * are one form here with Commodities filled in. A name already listed is flagged.
 */
export function Masterlist({ rows = MASTERLIST_ROWS }: { rows?: number }) {
  const { values } = useForm();
  const dupes = duplicateRows(values, 'row', 'name', rows);
  const b = '0.75pt solid #000';
  const th = { border: b, fontWeight: 700, fontSize: '7pt', textAlign: 'center' as const, verticalAlign: 'middle' as const, padding: '0.4mm 0.6mm', lineHeight: 1.1 };
  const td = { border: b, height: '7.4mm', fontSize: '8.5pt', padding: 0 };
  const lab = { fontWeight: 700, whiteSpace: 'nowrap' as const };
  return (
    <Page paper="a4" landscape pad={[8, 8, 8, 8]} font={CALIBRI} size="8.5pt">
      <div style={{ textAlign: 'center' }}>
        <img src="/forms/logo-wide.png" alt="PHILRADS, Philippine Relief and Development Services, Inc." style={{ width: '58mm' }} />
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12pt', marginTop: '1mm' }}>
        <In k="response" align="center" bold placeholder="7.8 MAGNITUDE EARTHQUAKE RESPONSE" upper style={{ width: '150mm' }} />
      </div>
      <p style={{ margin: '1.5mm 0', fontSize: '7.5pt', fontStyle: 'italic', textAlign: 'center' }}>
        To the participant: By filling out this sheet, you are consenting to PHILRADS collecting, using, and storing your data for the Project. All information provided will be managed by PHILRADS following the Data Privacy Act of 2012. For questions or comments, contact us at feedback.philrads@gmail.com or call/ text us at 0919 0607859 (Smart).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '26mm 1fr', rowGap: '0.6mm', fontSize: '7.5pt' }}>
        <span style={lab}>IMPAIRMENT:</span>
        <span>PHYSICAL (P), SENSORIAL HEARING (SH), SENSORIAL VISUAL (SV), INTELLECTUAL (I), PSYCHOLOGICAL (PS), MULTIPLE (Specify)</span>
        <span style={lab}>VULNERABILITY:</span>
        <span>
          (1)Female-Headed HH, (2)Senior Citizen, (3)Solo Parent (4)Child-headed HH (5)Out of School youth (6)Persons w/ Severe Medical Condition (7)Pregnant/Lactating Women, (8)IP HH
        </span>
        <span style={lab}>COMMODITIES:</span>
        <In k="commodities" placeholder="e.g. Food Packs and Non-Food Items (WASH Kits with Solar Light), or PSS" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '6mm', rowGap: '0.6mm', marginTop: '1mm', fontSize: '8pt' }}>
        {(
          [
            ['PROVINCE:', 'province'],
            ['BARANGAY:', 'barangay'],
            ['MUNICIPALITY:', 'municipality'],
            ['DATE:', 'date'],
          ] as const
        ).map(([label, k]) => (
          <div key={k} style={{ display: 'flex', gap: '1.5mm' }}>
            <span style={lab}>{label}</span>
            <In k={k} className="ff-line" style={{ flex: 1 }} />
          </div>
        ))}
      </div>

      <table style={{ width: '100%', marginTop: '2mm', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '3.5%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '4%' }} />
          <col style={{ width: '4%' }} />
          <col style={{ width: '7%' }} />
          {Array.from({ length: 8 }, (_, i) => (
            <col key={i} style={{ width: '3.2%' }} />
          ))}
          <col style={{ width: '6%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '3.6%' }} />
          <col style={{ width: '3.6%' }} />
          <col style={{ width: '8.4%' }} />
          <col style={{ width: '6.3%' }} />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={2} style={th}>NAME OF BENEFICIARY</th>
            <th rowSpan={2} style={th}>AGE</th>
            <th rowSpan={2} style={th}>SEX M/F</th>
            <th rowSpan={2} style={th}>IMPAIREMENT</th>
            <th colSpan={4} style={th}>FEMALE</th>
            <th colSpan={4} style={th}>MALE</th>
            <th rowSpan={2} style={th}>NO. OF HOUSE HOLD MEMBER</th>
            <th rowSpan={2} style={th}>REMARKS(Vulnerability with in the family)</th>
            <th colSpan={2} style={th}>Are you willing to be / to share photograph?</th>
            <th rowSpan={2} style={th}>Contact Number</th>
            <th rowSpan={2} style={th}>SIGNATURE</th>
          </tr>
          <tr>
            <th style={th}>#</th>
            <th style={th}>Complete Name</th>
            {['<5', '5-17', '18-49', '>50', '<5', '5-17', '18-49', '>50'].map((a, i) => (
              <th key={i} style={th}>
                {a}
              </th>
            ))}
            <th style={th}>Yes</th>
            <th style={th}>No</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => {
            const n = i + 1;
            const dupeOf = dupes.get(n);
            const r = (f: string) => `row.${n}.${f}`;
            return (
              <tr key={n}>
                <td style={{ ...td, textAlign: 'center' }}>{n}</td>
                <td style={td} className={dupeOf ? 'ff-dupe' : undefined} title={dupeOf ? `Same name as row ${dupeOf}` : undefined}>
                  <In k={r('name')} upper />
                </td>
                <td style={td}><In k={r('age')} align="center" numeric /></td>
                <td style={td}><In k={r('sex')} align="center" upper /></td>
                <td style={td}><In k={r('impairment')} align="center" upper /></td>
                {['f5', 'f17', 'f49', 'f50', 'm5', 'm17', 'm49', 'm50'].map((f) => (
                  <td key={f} style={td}>
                    <In k={r(f)} align="center" numeric />
                  </td>
                ))}
                <td style={td}><In k={r('hh')} align="center" numeric /></td>
                <td style={td}><In k={r('remarks')} /></td>
                <td style={{ ...td, textAlign: 'center' }}><Box k={r('photoYes')} /></td>
                <td style={{ ...td, textAlign: 'center' }}><Box k={r('photoNo')} /></td>
                <td style={td}><In k={r('contact')} align="center" /></td>
                <td style={td} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </Page>
  );
}
