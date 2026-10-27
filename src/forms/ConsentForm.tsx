import { Box, In, Line, Page } from './kit';

const CALIBRI = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';

/**
 * Image/Story Consent Form (Consent Form (with AAR Japan logo).docx; "Image use consent form
 * (Adult and Under 18).docx" is the same file): US Letter, on the PHILRADS letterhead.
 */
export function ConsentForm() {
  const gap = { marginTop: '6mm' };
  return (
    <Page paper="letter" pad={[12.7, 15, 30, 18]} bg="/forms/letterhead.png" font={CALIBRI} size="11pt">
      {/* The letterhead's own logo row is covered by the form's: PHILRADS and AAR Japan side by side. */}
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: '36mm', background: '#fff' }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4mm', marginTop: '2mm' }}>
        <img src="/forms/logo-wide.png" alt="PHILRADS, Philippine Relief and Development Services, Inc." style={{ width: '70mm' }} />
        <img src="/forms/aar-japan.png" alt="AAR Japan, Association for Aid and Relief, Japan" style={{ width: '64mm' }} />
      </div>

      <div style={{ position: 'relative', marginTop: '10mm', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '12pt' }}>IMAGE/STORY CONSENT FORM</div>
        <div>For gaining written consent for the use of material from an individual who disclosing sensitive personal data.</div>
      </div>

      <div style={{ position: 'relative', marginTop: '6mm', fontWeight: 700 }}>PLEASE TICK OPTIONS AS APPROPRIATE, AND COMPLETE WRITTEN SECTIONS IN BLOCK CAPITALS.</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '1mm', marginLeft: '5mm' }}>
        <span>1.&nbsp;&nbsp; I,</span>
        <Line k="fullName" w="105mm" />
        <span>(full name) agree to PHILRADS:</span>
      </div>

      <div style={{ position: 'relative', ...gap, display: 'flex', gap: '30mm' }}>
        <Box k="photo" size="5.5mm">Taking my photograph</Box>
        <Box k="video" size="5.5mm">Making video/other recording</Box>
      </div>
      <div style={{ position: 'relative', marginTop: '1mm', display: 'flex', alignItems: 'flex-end' }}>
        <Box k="speaking" size="5.5mm">Speaking to me and recording my words at</Box>
        <Line k="venue" w="62mm" />
        <span>(Choice of venue)</span>
      </div>
      <div style={{ position: 'relative', marginTop: '1mm', display: 'flex', alignItems: 'flex-end', gap: '1mm' }}>
        <span style={{ whiteSpace: 'nowrap' }}>If at an event, event title:</span>
        <Line k="eventTitle" w="100mm" />
      </div>

      <div style={{ position: 'relative', marginTop: '12mm' }}>
        2.&nbsp;&nbsp; I understand that images and/or information about me and those named above will be used for the following purposes:
      </div>
      <div style={{ position: 'relative', ...gap, display: 'flex', gap: '30mm' }}>
        <Box k="educational" size="5.5mm">Educational</Box>
        <Box k="promotional" size="5.5mm">Promotional</Box>
      </div>
      <div style={{ position: 'relative', marginTop: '3mm', display: 'flex', alignItems: 'center', gap: '3mm' }}>
        <Box k="other" size="5.5mm">Other (Specify)</Box>
        <span style={{ border: '0.75pt solid #000', width: '110mm', height: '8.5mm', display: 'flex', alignItems: 'center', background: '#fff' }}>
          <In k="otherSpecify" />
        </span>
      </div>
      <div style={{ position: 'relative', marginTop: '9mm' }}>
        <Box k="confirm" size="5.5mm">I confirm that I agree to PHILRADS carrying out the above</Box>
      </div>

      <div style={{ position: 'relative', marginTop: '9mm', display: 'flex', gap: '1mm' }}>
        <div style={{ width: '67mm', height: '41mm', border: '0.75pt solid #000', textAlign: 'center', paddingTop: '1mm', background: '#fff' }}>Signature or thumb print</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5mm', width: '100mm', fontSize: '10pt' }}>
          {(
            [
              ['Date:', 'date'],
              ['Location:', 'location'],
            ] as const
          ).map(([label, k]) => (
            <div key={k} style={{ border: '0.75pt solid #000', height: '11mm', display: 'flex', gap: '1mm', padding: '1mm 3mm', background: '#fff' }}>
              <span>{label}</span>
              <In k={k} style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: '14mm', marginLeft: '-6mm', display: 'flex', alignItems: 'flex-end', gap: '1mm' }}>
        <span>Template reviewed and approved:</span>
        <Line k="reviewedBy" w="38mm" />
      </div>
      <div style={{ position: 'relative', marginLeft: '58mm', display: 'flex', alignItems: 'flex-end', gap: '1mm' }}>
        <span>Date:</span>
        <In k="reviewedDate" w="30mm" />
      </div>
    </Page>
  );
}
