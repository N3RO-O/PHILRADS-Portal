import { Line, Page, SignLine } from './kit';

const SOURCE_SANS = '"Source Sans Pro", "Source Sans 3", Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const GEORGIA = 'Georgia, "Times New Roman", serif';

const EN: [string, string[]][] = [
  ['I.Respect and Protect', [
    'Treat children and vulnerable adults with dignity and respect—regardless of race, gender, religion, or background.',
    'Never use inappropriate, abusive, or sexually suggestive language or behavior.',
    'Never engage in any sexual activity with children (under 18) or vulnerable adults, including paying for sexual services.',
  ]],
  ['II.Safe Interaction', [
    'Avoid being alone with children or vulnerable adults—always ensure another adult is present when possible.',
    'Never invite unaccompanied children into my home, unless in an emergency.',
    'Do not sleep near unsupervised children, unless absolutely necessary and with supervisor approval.',
  ]],
  ['III.Responsible Use of Technology', [
    'Use phones, cameras, and social media responsibly—never to exploit or harm children or vulnerable adults.',
    'Never access or share child exploitation materials.',
  ]],
  ['IV.Labour and Discipline', [
    'Never use physical punishment.',
    'Do not employ children for inappropriate work that affects their health, safety, education, or development.',
    'Follow all local child labour laws.',
  ]],
  ['V.Reporting and Disclosure', [
    'Report any concerns about abuse, exploitation, or policy violations immediately.',
    'Disclose any criminal charges or convictions related to child or vulnerable adult abuse, past or present.',
  ]],
  ['VI.Using Images for Work: When taking or using photos/videos of children or vulnerable adults:', [
    'Respect local customs and restrictions.',
    'Get informed consent from the child/adult and their guardian.',
    'Ensure images are respectful, dignified, and appropriate.',
    'Do not include identifying information (e.g., names or locations) in filenames or descriptions when sharing.',
  ]],
];

const FIL: [string, string[]][] = [
  ['I. Paggalang at Pagprotekta', [
    'Tratuhin ang mga bata at mahihinang matatanda nang may dignidad at paggalang—anumang lahi, kasarian, relihiyon, o pinagmulan.',
    'Huwag gumamit ng hindi angkop, mapanakit, o may sekswal na pahiwatig na wika o kilos.Huwag makipagtalik o anumang sekswal na aktibidad sa mga bata (wala pang 18 taong gulang) o mahihinang matatanda, kabilang ang pagbabayad para sa sekswal na serbisyo.',
  ]],
  ['II. Ligtas na Pakikisalamuha', [
    'Iwasang mapag-isa kasama ang mga bata o mahihinang matatanda—siguraduhing may kasamang isa pang nakatatanda hangga’t maaari.',
    'Huwag anyayahan ang mga batang nag-iisa sa aking tahanan, maliban na lamang kung may emerhensiya.',
    'Huwag matulog malapit sa mga batang walang kasama, maliban kung talagang kinakailangan at may pahintulot ng superbisor.',
  ]],
  ['III. Responsableng Paggamit ng Teknolohiya', [
    'Gamitin ang cellphone, kamera, at social media nang may pananagutan—huwag gamitin para pagsamantalahan o saktan ang mga bata o mahihinang matatanda.',
    'Huwag mag-access o magbahagi ng materyales na naglalaman ng pagsasamantala sa mga bata.',
  ]],
  ['IV. Paggawa at Disiplina', [
    'Huwag gumamit ng pisikal na parusa.',
    'Huwag kumuha ng batang manggagawa sa hindi angkop na trabaho na nakakaapekto sa kanilang kalusugan, kaligtasan, edukasyon, o pag-unlad.',
    'Sumunod sa mga lokal na batas kaugnay ng child labor.',
  ]],
  ['V. Pag-uulat at Pagpapahayag', [
    'Agarang iulat ang anumang pang-aabuso, pagsasamantala, o paglabag sa polisiya.',
    'Isiwalat ang anumang kasong kriminal o hatol na may kaugnayan sa pang-aabuso sa bata o mahihinang matatanda, noon o ngayon.',
  ]],
  ['VI. Paggamit ng Imahe para sa Trabaho', [
    'Igalang ang lokal na kaugalian at restriksyon.',
    'Kumuha ng pahintulot mula sa bata/matatanda at sa kanilang magulang o tagapag-alaga.',
    'Tiyakin na ang mga larawan o bidyo ay may respeto, dignidad, at angkop.',
    'Huwag maglagay ng impormasyon na makakapagpakilala sa bata (hal. pangalan, lokasyon) sa file name o caption kapag ibinabahagi.',
  ]],
];

function Title() {
  return <div style={{ fontFamily: GEORGIA, fontSize: '20pt', fontWeight: 700, fontStyle: 'italic', textAlign: 'center', margin: '1mm 0 4mm' }}>Code of Conduct</div>;
}

function Rules({ items, italic }: { items: [string, string[]][]; italic?: boolean }) {
  return (
    <>
      {items.map(([head, list]) => (
        <div key={head} style={{ marginTop: italic ? '1.8mm' : '2.6mm' }}>
          <div style={italic ? { borderTop: head.startsWith('I.') ? '0.75pt solid #999' : undefined, paddingTop: head.startsWith('I.') ? '1mm' : undefined } : undefined}>{head}</div>
          <ul style={{ margin: italic ? '0' : '1.2mm 0 0', paddingLeft: '6mm', listStyle: 'none' }}>
            {list.map((t) => (
              <li key={t} style={{ position: 'relative', paddingLeft: '5mm', marginTop: '0.3mm' }}>
                <span style={{ position: 'absolute', left: 0 }}>●</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Code of Conduct (CODE OF CONDUCT.docx): A4 on the letterhead with "Serving People in Jesus
 * Name", English then Filipino. The name and date are typed once and appear in both.
 */
export function CodeOfConduct() {
  const pad: [number, number, number, number] = [37, 25.4, 26, 25.4];
  return (
    <>
      <Page paper="a4" pad={pad} bg="/forms/letterhead.png" font={SOURCE_SANS} size="10pt">
        <Title />
        <p style={{ margin: 0 }}>
          I, <Line k="name" w="56mm" />, confirm that I have read and understood the PHILRADS Safeguarding and Protection Policy. While working with the Philippine Relief and Development Services, Inc., I agree to:
        </p>
        <Rules items={EN} />
        <hr style={{ border: 0, borderTop: '0.75pt solid #999', margin: '4mm 0' }} />
        <p style={{ margin: 0 }}>By signing this, I agree to follow these rules and understand that any violation may lead to legal consequences and accountability for any harm caused.</p>
        <div style={{ marginTop: '3mm' }}>
          Signed: <SignLine w="55mm" />
        </div>
        <div>
          Date: <Line k="date" w="57mm" />
        </div>
      </Page>
      <Page paper="a4" pad={pad} bg="/forms/letterhead.png" font={GEORGIA} size="9.6pt" style={{ fontStyle: 'italic' }}>
        <Title />
        <p style={{ margin: 0 }}>
          Ako si, <Line k="name" w="62mm" />, ay nagpapatunay na aking nabasa at naunawaan ang PHILRADS Safeguarding and Protection Policy. Habang ako ay nakikipag-ugnayan sa Philippine Relief and Development Services, Inc., ako ay sumasang-ayon na:
        </p>
        <Rules items={FIL} italic />
        <hr style={{ border: 0, borderTop: '0.75pt solid #999', margin: '3mm 0' }} />
        <p style={{ margin: 0 }}>
          Sa pamamagitan ng pagpirma, ako ay sumasang-ayon na sundin ang mga alituntunin na ito at nauunawaan kong ang anumang paglabag ay maaaring magdulot ng legal na pananagutan para sa anumang pinsalang dulot nito.
        </p>
        <div style={{ marginTop: '3mm' }}>
          Lagda: <SignLine w="60mm" />
        </div>
        <div>
          Petsa: <Line k="date" w="62mm" />
        </div>
      </Page>
    </>
  );
}
