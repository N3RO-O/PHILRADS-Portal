import type { ReactNode } from 'react';
import { Area, Box, In, Line, Page } from './kit';

const GOTHIC = '"Century Gothic", "URW Gothic", "Avant Garde", "Gill Sans", "Segoe UI", sans-serif';

function Header() {
  return (
    <div style={{ position: 'absolute', top: '4mm', left: 0, right: 0, textAlign: 'center' }}>
      <img src="/forms/logo-wide.png" alt="PHILRADS, Philippine Relief and Development Services, Inc." style={{ width: '96mm' }} />
    </div>
  );
}
function Footer() {
  return (
    <div style={{ position: 'absolute', left: '25.4mm', right: '25.4mm', bottom: '12mm', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ fontWeight: 700, fontSize: '9pt' }}>MARAMING SALAMAT SA IYONG FEEDBACK!</div>
      <div style={{ fontSize: '9pt' }}>Mahalaga ang iyong opinyon upang mas mapaglingkuran naming nang mas maayos ang mga komunidad.</div>
    </div>
  );
}

/** A numbered question: bold, with its choices under it. */
function Q({ n, q, children }: { n: number; q: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '3mm', marginTop: '3.5mm' }}>
      <span style={{ width: '4mm', textAlign: 'right' }}>{n}.</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{q}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2mm', marginTop: '0.8mm' }}>{children}</div>
      </div>
    </div>
  );
}
const C = ({ k, children }: { k: string; children: ReactNode }) => (
  <Box k={k} size="2.8mm">
    {children}
  </Box>
);

/** Feedback & Complaint Form (Feedback & Complaint Form.docx): US Letter, two columns, Filipino. */
export function FeedbackForm() {
  const col = { width: '78mm' };
  return (
    <>
      <Page paper="letter" pad={[30, 25.4, 30, 25.4]} font={GOTHIC} size="9.5pt">
        <Header />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={col}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'flex-end', gap: '1mm' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Pangalan ng Organisasyon:</span>
              <Line k="org" />
            </div>
            <div style={{ fontWeight: 700 }}>Pangalan ng Proyekto/Interbensyon:</div>
            <Line k="project" w="60mm" />
            {(
              [
                ['Lokasyon:', 'location'],
                ['Petsa:', 'date'],
              ] as const
            ).map(([l, k]) => (
              <div key={k} style={{ fontWeight: 700, display: 'flex', alignItems: 'flex-end', gap: '1mm' }}>
                <span>{l}</span>
                <Line k={k} w="57mm" />
              </div>
            ))}

            <div style={{ fontWeight: 700, marginTop: '4mm' }}>SEKSYON 1: IMPORMASYON NG SUMASAGOT (Opsyonal)</div>
            <div style={{ marginTop: '3mm', display: 'flex', alignItems: 'flex-end', gap: '1mm' }}>
              <b>Pangalan:</b>
              <Line k="name" />
            </div>
            <div style={{ marginTop: '3mm', lineHeight: 1.9 }}>
              <b>Kasarian: </b>
              <C k="sex.male">Lalaki</C> <C k="sex.female">Babae</C> <C k="sex.none">Mas gusto na huwag sabihin</C>
              <span style={{ marginLeft: '6mm', fontWeight: 700 }}>Edad:</span> <In k="age" w="14mm" className="ff-line" />
            </div>
            <div style={{ marginTop: '2mm', lineHeight: 1.9 }}>
              <b>Pagkakaugnay: </b>
              <C k="rel.beneficiary">Benepisyaryo</C> <C k="rel.partner">Kasosyo</C> <C k="rel.volunteer">Boluntaryo</C> <C k="rel.staff">Kawani</C> <C k="rel.other">Iba pa:</C>{' '}
              <In k="rel.otherText" w="22mm" className="ff-line" />
            </div>

            <div style={{ fontWeight: 700, marginTop: '3mm' }}>SEKSYON 2: FEEDBACK SA HUMANITARIAN RESPONSE</div>
            <Q n={1} q="Paano mo nalaman ang tungkol sa tulong na ibinigay?">
              <C k="q1.leader">Pinuno ng komunidad</C>
              <C k="q1.staff">Field staff</C>
              <C k="q1.poster">Poster/anunsyo</C>
              <C k="q1.word">Salita ng ibang tao</C>
              <span>
                <C k="q1.other">Iba pa:</C> <In k="q1.otherText" w="24mm" className="ff-line" />
              </span>
            </Q>
            <Q n={2} q="Anong uri ng tulong ang natanggap mo?">
              <span style={{ lineHeight: 2 }}>
                <C k="q2.food">Food</C> <C k="q2.shelter">Shelter</C> <C k="q2.wash">WASH (Water, Sanitation, Hygiene)</C> <C k="q2.nfi">NFIs (Non-Food Items)</C> <C k="q2.health">Health Services</C>{' '}
                <C k="q2.pss">Psychosocial Support</C> <C k="q2.cash">Cash/Voucher Assistance</C> <C k="q2.other">Other:</C> <In k="q2.otherText" w="24mm" className="ff-line" />
              </span>
            </Q>
            <Q n={3} q="Naihatid ba ang tulong sa tamang oras at naaayon sa iyong pangangailangan?">
              <C k="q3.yes">Oo</C>
              <C k="q3.no">Hindi</C>
              <C k="q3.partly">Bahagya lamang (pakipaliwanag):</C>
              <Line k="q3.explain" w="58mm" />
            </Q>
          </div>

          <div style={col}>
            <Q n={4} q="Malinaw at madaling maintindihan ba ang impormasyong ibinigay sa iyo?">
              <span>
                <C k="q4.yes">Oo</C> <C k="q4.no">Hindi</C>
              </span>
            </Q>
            <Q n={5} q="Naramdaman mo bang ikaw ay iginagalang at tinrato nang may dignidad ng staff o boluntaryo?">
              <C k="q5.yes">Oo</C>
              <C k="q5.no">Hindi</C>
              <i>Kung hindi, pakipaliwanag:</i>
              <Line k="q5.explain" w="58mm" />
            </Q>
            <Q n={6} q="Pantay at walang diskriminasyon ba ang pagbibigay ng tulong?">
              <C k="q6.yes">Oo</C>
              <C k="q6.no">Hindi</C>
              <i>Kung hindi, pakipaliwanag:</i>
              <Line k="q6.explain" w="58mm" />
            </Q>
            <Q n={7} q="Binigyan ka ba ng pagkakataon upang magbigay ng opinyon o reklamo?">
              <C k="q7.yes">Oo</C>
              <C k="q7.no">Hindi</C>
              <Box k="q7.unsure" size="2.8mm" className="ff-check-top">
                Hindi ako alam kung paano magbigay ng feedback o reklamo
              </Box>
            </Q>
            {(
              [
                [8, 'Ano ang mga naging maayos sa isinagawang response?', 'q8'],
                [9, 'Ano ang maaaring pagbutihin sa mga susunod na response?', 'q9'],
                [10, 'Karagdagang komento o mungkahi:', 'q10'],
              ] as const
            ).map(([n, q, k]) => (
              <div key={k}>
                <Q n={n} q={q}>
                  <Area k={k} minH="7mm" />
                </Q>
                <hr style={{ border: 0, borderTop: '2pt solid #a6a6a6', margin: '1mm 0 0' }} />
              </div>
            ))}
            <div style={{ fontWeight: 700, marginTop: '6mm' }}>SEKSYON 3: KUMPIDENSIYALIDAD AT PAHINTULOT</div>
          </div>
        </div>
        <Footer />
      </Page>
      <Page paper="letter" pad={[30, 25.4, 30, 25.4]} font={GOTHIC} size="9.5pt">
        <Header />
        <div style={{ width: '78mm' }}>
          <Box k="consent" size="2.8mm" className="ff-check-top">
            Sumasang-ayon ako na maaaring gamitin (nang hindi binabanggit ang aking pangalan) ang aking feedback upang mapabuti ang mga susunod na humanitarian response.
          </Box>
        </div>
        <Footer />
      </Page>
    </>
  );
}
