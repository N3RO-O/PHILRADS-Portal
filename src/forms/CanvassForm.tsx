import { amount, In, Page, peso, SignLine, useForm, useText, Area } from './kit';

const ARIAL = 'Arial, Helvetica, sans-serif';
const PINK = '#da9694';
const ROWS = 11;

/** Canvass Form (Canvass Form.docx): A4, a supplier's offer with up to 11 items and totals. */
export function CanvassForm() {
  const { values } = useForm();
  const lineTotal = (i: number) => amount(values[`item.${i}.qty`]) * amount(values[`item.${i}.price`]);
  const subtotal = Array.from({ length: ROWS }, (_, i) => lineTotal(i + 1)).reduce((s, n) => s + n, 0);
  const extras = ['tax', 'shipping', 'other'].reduce((s, k) => s + amount(values[k]), 0);
  const prepared = useText('preparedBy');

  const th = { background: PINK, color: '#fff', fontWeight: 700, border: '0.75pt solid #000', textAlign: 'center' as const, fontSize: '10pt', padding: '0.8mm 1mm', lineHeight: 1.05 };
  const td = { border: '0.75pt solid #000', height: '9.3mm', padding: 0 };
  return (
    <Page paper="a4" pad={[11, 25.4, 12.7, 25.4]} font={ARIAL} size="10pt">
      <div style={{ textAlign: 'center' }}>
        <img src="/forms/logo-canvass.jpg" alt="PHILRADS, Philippine Relief and Development Services, Inc." style={{ width: '54mm' }} />
        <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '20pt', marginTop: '0.5mm' }}>CANVASS FORM</div>
      </div>

      <div style={{ marginTop: '7mm', fontWeight: 700, lineHeight: 1.3 }}>
        {(
          [
            ['Name of Offering/Selling Company:', 'company'],
            ['Address:', 'address'],
            ['Contact Number:', 'contact'],
            ['Date of Offer:', 'date'],
          ] as const
        ).map(([label, k]) => (
          <div key={k} style={{ display: 'flex', gap: '1.5mm' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
            <In k={k} style={{ fontWeight: 400, flex: 1 }} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '8mm', lineHeight: 1.2 }}>
        <div style={{ fontWeight: 700 }}>Phippine Relief and Development Services, Inc. (PHILRADS)</div>
        <div>#62 Molave St., Proj. 3, Quezon City, Manila</div>
        <div>Philippine Tel. No.: (02) 89136615</div>
        <div>Mobile: 09190607859</div>
        <div>E-mail: info@philrads.com</div>
      </div>

      <table style={{ width: '166mm', marginLeft: '-3mm', marginTop: '0.5mm', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '16.4mm' }} />
          <col style={{ width: '68.6mm' }} />
          <col style={{ width: '20.6mm' }} />
          <col style={{ width: '25mm' }} />
          <col style={{ width: '35.4mm' }} />
        </colgroup>
        <tbody>
          <tr style={{ height: '8mm' }}>
            <th colSpan={2} style={th}>Validity of Offer</th>
            <th colSpan={2} style={th}>Earliest Possible Delivery Date</th>
            <th style={th}>Mode of Delivery</th>
          </tr>
          <tr style={{ height: '5mm' }}>
            <td colSpan={2} style={{ ...td, height: '5mm' }}><In k="validity" align="center" /></td>
            <td colSpan={2} style={{ ...td, height: '5mm' }}><In k="delivery" align="center" /></td>
            <td style={{ ...td, height: '5mm' }}><In k="mode" align="center" /></td>
          </tr>
          <tr style={{ height: '7.5mm' }}>
            <th style={th}>ITEM #</th>
            <th style={th}>DESCRIPTION</th>
            <th style={th}>QTY</th>
            <th style={{ ...th, fontSize: '8pt' }}>UNIT PRICE/COST</th>
            <th style={th}>TOTAL</th>
          </tr>
          {Array.from({ length: ROWS }, (_, i) => {
            const n = i + 1;
            const total = lineTotal(n);
            return (
              <tr key={n}>
                <td style={{ ...td, textAlign: 'center' }}>{n}</td>
                <td style={td}><In k={`item.${n}.desc`} /></td>
                <td style={td}><In k={`item.${n}.qty`} align="center" numeric /></td>
                <td style={td}><In k={`item.${n}.price`} align="right" numeric /></td>
                <td style={{ ...td, background: '#f2f2f2', textAlign: 'right', paddingRight: '1.5mm' }}>{total ? peso(total) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', width: '166mm', marginLeft: '-3mm' }}>
        <div style={{ width: '85mm', marginTop: '5.5mm' }}>
          <div style={{ background: '#bfbfbf', border: '0.75pt solid #000', fontWeight: 700, padding: '0.6mm 2mm' }}>Comments or Special Instructions</div>
          <div style={{ borderLeft: '0.75pt solid #000', borderRight: '0.75pt solid #000', borderBottom: '0.75pt solid #000', minHeight: '23mm', padding: '0.5mm 1.5mm' }}>
            <div style={{ display: 'flex', gap: '1mm' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Terms of Payment:</span>
              <In k="terms" style={{ flex: 1 }} />
            </div>
            <Area k="comments" minH="15mm" />
          </div>
        </div>
        <table style={{ marginLeft: 'auto', tableLayout: 'fixed', width: '81mm' }}>
          <colgroup>
            <col style={{ width: '45.6mm' }} />
            <col style={{ width: '35.4mm' }} />
          </colgroup>
          <tbody>
            {(
              [
                ['SUBTOTAL', null],
                ['TAX', 'tax'],
                ['SHIPPING', 'shipping'],
                ['OTHER', 'other'],
              ] as const
            ).map(([label, k]) => (
              <tr key={label} style={{ height: '5.5mm' }}>
                <td style={{ textAlign: 'right', paddingRight: '2mm' }}>{label}</td>
                <td style={{ border: '0.75pt solid #000', background: k ? '#fff' : '#f2f2f2', textAlign: 'right', paddingRight: '1.5mm' }}>
                  {k ? <In k={k} align="right" numeric placeholder="-" /> : subtotal ? peso(subtotal) : ''}
                </td>
              </tr>
            ))}
            <tr style={{ height: '5.5mm' }}>
              <td style={{ textAlign: 'right', paddingRight: '2mm', fontWeight: 700, borderTop: '2pt solid #000' }}>TOTAL</td>
              <td style={{ border: '0.75pt solid #000', background: PINK, fontWeight: 700, paddingLeft: '1.5mm' }}>
                P <span style={{ float: 'right', paddingRight: '1mm' }}>{subtotal + extras ? peso(subtotal + extras) : ''}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', marginTop: '10mm', fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif', fontSize: '11pt' }}>
        <div style={{ width: '50%' }}>
          Prepared by:
          <div style={{ marginTop: '6mm', marginLeft: '12.5mm', width: '50mm', textAlign: 'center' }}>
            <In k="preparedBy" align="center" className="ff-line" placeholder={prepared ? undefined : 'Name'} />
            <div style={{ textAlign: 'left' }}>Printed name and Signature</div>
          </div>
        </div>
        <div style={{ width: '50%' }}>
          Selling Company:
          <div style={{ marginTop: '6mm', width: '52mm', textAlign: 'center' }}>
            <SignLine w="52mm" />
            <div style={{ textAlign: 'left' }}>Printed name and Signature</div>
          </div>
        </div>
      </div>
    </Page>
  );
}
