import type { CSSProperties, ReactNode } from 'react';
import { Area, Box, In, Page } from './kit';

/**
 * Rapid Needs Assessment (RNA- Rapid Needs Assessment.pdf, Humanitarian Country Team, September
 * 2022): A4, four pages, 17 sections. Grey rows are section titles, blue rows the "serious
 * problem?" screening questions, green rows the "most immediate need" questions, as on the form.
 */

const NARROW = '"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", Arial, sans-serif';
const BLUE = '#4472c4';
const GREEN = '#ebf1de';
const GREY = '#d9d9d9';
const B = '0.75pt solid #000';

const PAD: [number, number, number, number] = [8, 10, 18, 11];

function Footer() {
  return <div style={{ position: 'absolute', left: '20mm', bottom: '10mm', fontFamily: '"Century Gothic", "Segoe UI", sans-serif', fontSize: '7pt' }}>Rapid Assessment Form as of September 2022</div>;
}

/** A row of the big table. */
function R({ tone, children, style }: { tone?: 'blue' | 'green' | 'grey' | 'dark'; children: ReactNode; style?: CSSProperties }) {
  const bg = tone === 'blue' ? BLUE : tone === 'green' ? GREEN : tone === 'grey' ? GREY : tone === 'dark' ? '#7f7f7f' : '#fff';
  return (
    <div style={{ borderTop: B, background: bg, color: tone === 'blue' || tone === 'dark' ? '#fff' : '#000', padding: '0.25mm 1mm', ...style }}>
      {children}
    </div>
  );
}
function Sec({ children }: { children: ReactNode }) {
  return (
    <R tone="grey" style={{ fontWeight: 700, fontSize: '9pt', borderTop: '1.5pt solid #000' }}>
      {children}
    </R>
  );
}
/** Columns inside a row, split by a line. */
function Cols({ w, children }: { w: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: w }}>{children}</div>;
}
const Cell = ({ children, first }: { children: ReactNode; first?: boolean }) => <div style={{ borderLeft: first ? undefined : B, padding: '0 1mm' }}>{children}</div>;

/** A tick box with its label (each one ticked on its own, as on paper). */
const O = ({ k, children, w }: { k: string; children: ReactNode; w?: string }) => (
  <span style={{ display: 'inline-block', width: w, marginRight: w ? undefined : '3.5mm' }}>
    <Box k={k} size="2.5mm">
      {children}
    </Box>
  </span>
);
/** A short blank to write in. */
const W = ({ k, w = '22mm', align }: { k: string; w?: string; align?: 'center' | 'right' }) => <In k={k} w={w} align={align} className="ff-line" />;
const yesNo = (k: string, yes = 'Yes', no = 'No') => (
  <>
    <O k={`${k}.yes`}>{yes}</O>
    <O k={`${k}.no`}>{no}</O>
  </>
);
const screen = (k: string, skip: string) => (
  <>
    <O k={`${k}.yes`} w="16mm">Yes</O>
    <O k={`${k}.no`} w="34mm">No [Skip to section {skip}]</O>
    <O k={`${k}.dk`}>Do not know</O>
  </>
);
const need = (k: string, opts: string[]) => (
  <>
    {opts.map((o) => (
      <O key={o} k={`${k}.${o}`} w={o.length > 14 ? '30mm' : '22mm'}>
        {o}
      </O>
    ))}
    <O k={`${k}.others`}>Others</O>
    <W k={`${k}.othersText`} w="20mm" />
  </>
);

const Table = ({ children }: { children: ReactNode }) => <div style={{ border: '1pt solid #000', borderTop: 0 }}>{children}</div>;

export function RapidNeedsAssessment() {
  return (
    <>
      <Page paper="a4" pad={PAD} font={NARROW} size="8pt">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2.5pt solid #a6a6a6', borderRight: '2.5pt solid #a6a6a6', padding: '1mm 3mm 2mm 0', marginBottom: '3mm' }}>
          <div>
            <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: '20pt', color: '#4f81bd', lineHeight: 1 }}>RAPID NEEDS ASSESSMENT</div>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '7pt', color: '#7f7f7f', marginTop: '1.5mm' }}>Humanitarian Country Team</div>
          </div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '7pt', color: '#7f7f7f' }}>September 2022</div>
        </div>

        <Table>
          <Sec>Assessment team</Sec>
          <R>
            <Cols w="68fr 32fr">
              <Cell first>Organizations participating: <W k="team.orgs" w="60%" /></Cell>
              <Cell>Date: <W k="team.date" w="70%" /></Cell>
            </Cols>
          </R>
          <R>
            <Cols w="68fr 32fr">
              <Cell first>Name of team leader: <W k="team.leader" w="60%" /></Cell>
              <Cell>Type of disaster: <W k="team.disaster" w="55%" /></Cell>
            </Cols>
          </R>
          <R>
            <Cols w="34fr 34fr 32fr">
              <Cell first>Telephone number: <W k="team.phone" w="45%" /></Cell>
              <Cell>Email: <W k="team.email" w="70%" /></Cell>
              <Cell>Date of the disaster event (started): <W k="team.started" w="25%" /></Cell>
            </Cols>
          </R>

          <Sec>1. Key informant</Sec>
          <R>
            <Cols w="68fr 32fr">
              <Cell first>1.1 Name <W k="ki.name" w="80%" /></Cell>
              <Cell>1.2. <O k="ki.male">Male</O> <O k="ki.female">Female</O></Cell>
            </Cols>
          </R>
          <R>
            <Cols w="68fr 32fr">
              <Cell first>1.3 Position or title <W k="ki.position" w="75%" /></Cell>
              <Cell>1.4 Organization <W k="ki.org" w="55%" /></Cell>
            </Cols>
          </R>
          <R>
            <Cols w="68fr 32fr">
              <Cell first>1.5 Phone number <W k="ki.phone" w="75%" /></Cell>
              <Cell>1.6 Email <W k="ki.email" w="70%" /></Cell>
            </Cols>
          </R>

          <Sec>2. Geographic information</Sec>
          <R>
            <Cols w="68fr 32fr">
              <Cell first>2.1 Province: <W k="geo.province" w="75%" /></Cell>
              <Cell>2.3 Barangay: <W k="geo.barangay" w="60%" /></Cell>
            </Cols>
          </R>
          <R>
            <Cols w="68fr 32fr">
              <Cell first>2.2 Municipality/City: <W k="geo.city" w="70%" /></Cell>
              <Cell>2.4 GPS Coordinate (Decimal Degree): <W k="geo.gps" w="28%" /></Cell>
            </Cols>
          </R>

          <Sec>3. Demographic data / IDPs</Sec>
          <R>
            3.1 Are people displaced from their homes? <O k="3.1.yes">Yes [If yes, record the number of people displaced]</O> <O k="3.1.no">No</O>
          </R>
          <R style={{ padding: 0 }}>
            <Cols w="45fr 55fr">
              <div style={{ padding: '0.4mm 1mm' }}>
                3.2 Inside designated evacuation centres: <W k="3.2" w="30mm" />
                <div>
                  3.2.1 Is there a designated camp manager? <O k="3.2.1.yes">Yes</O> <O k="3.2.1.no">No</O>
                </div>
              </div>
              <div style={{ borderLeft: B }}>
                <div style={{ textAlign: 'center', borderBottom: B, padding: '0.4mm' }}>3.3 Outside designated evacuation centres</div>
                <Cols w="1fr 1fr">
                  <div style={{ textAlign: 'center', padding: '0.4mm' }}>3.3.1 Other public buildings (informal ECs)</div>
                  <div style={{ textAlign: 'center', padding: '0.4mm', borderLeft: B }}>3.3.2 Host families</div>
                </Cols>
              </div>
            </Cols>
          </R>
          <R style={{ padding: 0 }}>
            <Cols w="18fr 27fr 13.75fr 13.75fr 13.75fr 13.75fr">
              <div style={{ padding: '0.4mm 1mm' }}>
                3.2.2 Families: <W k="3.2.2" w="12mm" />
              </div>
              <div style={{ borderLeft: B, padding: '0.4mm 1mm' }}>
                3.2.3 Individuals: <W k="3.2.3" w="16mm" />
                <div style={{ display: 'grid', gridTemplateColumns: '18mm 1fr', border: B, marginTop: '0.5mm', width: '42mm' }}>
                  {['Men', 'Women', 'Pregnant Women', 'Lactating Women', 'PWD', 'Children', 'Older persons', 'Persons with chronic illness'].map((g, i) => (
                    <div key={g} style={{ display: 'contents' }}>
                      <span style={{ borderTop: i ? B : undefined, padding: '0 0.6mm', fontSize: '7pt', lineHeight: 1.05 }}>{g}</span>
                      <span style={{ borderTop: i ? B : undefined, borderLeft: B }}>
                        <In k={`3.2.3.${i}`} align="center" numeric />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {['3.3.1.f', '3.3.1.i', '3.3.2.f', '3.3.2.i'].map((k, i) => (
                <div key={k} style={{ borderLeft: B, padding: '0.4mm 1mm' }}>
                  {i % 2 ? 'Individuals:' : 'Families:'}
                  <In k={k} align="center" numeric />
                </div>
              ))}
            </Cols>
          </R>

          <Sec>4. Relief assistance</Sec>
          <R>
            4.1 Has the community/EC received any assistance? <span style={{ marginLeft: '18mm' }} />
            <O k="4.1.yes">Yes [If yes, continue with question 4.2.]</O> <O k="4.1.no">No [If No, skip to section 5]</O>
          </R>
          <R>
            4.2 What have the community/EC received? Select all that apply.
            <div>
              {['Blankets', 'Cooking utensils', 'Clothes', 'Food', 'Hygiene kits', 'Medicine', 'Mosquito nets', 'Tents', 'Water', 'Water kits', 'Voucher/Cash', 'Plastic sheeting', 'Jerry cans', 'Others'].map((o) => (
                <O key={o} k={`4.2.${o}`} w="26mm">
                  {o}
                </O>
              ))}
            </div>
          </R>
          <R>
            4.3 List organizations that provided assistance <W k="4.3" w="120mm" />
          </R>

          <Sec>5. Shelter</Sec>
          <R tone="blue">
            5.1 Based on observation, is shelter a serious problem in your community?
            <div>{screen('5.1', '6')}</div>
          </R>
          <R>
            5.2 Number and/or percentage of <u>destroyed</u> houses (irreparable) <W k="5.2.n" w="16mm" align="center" /># <O k="5.2.25">&lt;25%</O> <O k="5.2.50">26-50%</O> <O k="5.2.75">51-75%</O> <O k="5.2.100">&gt;75%</O>
          </R>
          <R>
            5.3 Number and/or percentage of <u>damaged</u> houses (e.g. walls, roof and column collapsed, hanging wall) (repairable)
            <div>
              <W k="5.3.n" w="16mm" align="center" /># <O k="5.3.25">&lt;25%</O> <O k="5.3.50">26-50%</O> <O k="5.3.75">51-75%</O> <O k="5.3.100">&gt;75%</O>
            </div>
          </R>
          <R tone="green">
            5.4 Based on current situation, please identify your most immediate need on shelter
            <div>{need('5.4', ['Shelter repair kits', 'GI sheets', 'Tarpaulins', 'Cash', 'Tents', 'Plastic sheeting'])}</div>
          </R>

          <Sec>6. Food security</Sec>
          <R tone="blue">
            6.1 Based on observation, is food a serious problem in your community/EC? {screen('6.1', '7')}
          </R>
          <R>
            6.2 Do people have access to food in their current location? <O k="6.2.yes">Yes</O> <O k="6.2.no">No</O>
          </R>
          <R>
            6.3 What are the main sources of food in the area? <O k="6.3.stocks">Household food stocks</O> <O k="6.3.garden">Household garden/farm</O>
            <div>
              <O k="6.3.market">Local market</O> <O k="6.3.lgu">Humanitarian aid from the local government</O> <O k="6.3.national">Humanitarian aid from the national government</O>
            </div>
            Other: <W k="6.3.other" w="35mm" />
          </R>
          <R>
            6.4 Is the local market operating? <O k="6.4.yes">Yes [Skip to section 7]</O> <O k="6.4.no">No</O>
          </R>
          <R>
            6.5 If No, what concerns do people have about the local market?
            <Cols w="1fr 1fr">
              <div>
                <O k="6.5.money">There is no money to buy commodities</O>
                <div><O k="6.5.supply">Supplies of commodities are not available at the market</O></div>
                <O k="6.5.other">Other, specify:</O> <W k="6.5.otherText" w="22mm" />
              </div>
              <div>
                <O k="6.5.prices">Prices of commodities have increased</O>
                <div><O k="6.5.destroyed">Market was destroyed/physically inaccessible</O></div>
              </div>
            </Cols>
          </R>
          <R tone="green">
            6.6 Based on current situation, please identify your most immediate food need
            <div>{need('6.6', ['Cooked food', 'Food pack', 'Cash', 'Fresh produce'])}</div>
          </R>

          <Sec>7. Water supply</Sec>
          <R tone="blue">
            7.1 Based on observation, is access to water that is safe for drinking or cooking a serious problem in your community/EC?
            <div>{screen('7.1', '8')}</div>
          </R>
        </Table>
        <Footer />
      </Page>

      <Page paper="a4" pad={[8, 10, 14, 11]} font={NARROW} size="8pt">
        <Table>
          <div style={{ borderTop: '1pt solid #000' }} />
          <R style={{ borderTop: 0, padding: 0 }}>
            <Cols w="62fr 38fr">
              <Cell first>
                7.2 What is the primary water source for domestic use?
                {['Open well', 'Bore hole /Hand pump', 'Stream/river', 'Storage/collection container', 'Piped water system', 'Other'].map((o) => (
                  <div key={o}><O k={`7.2.${o}`}>{o}</O></div>
                ))}
              </Cell>
              <Cell>
                7.3 What is the condition of this primary water source?
                {['Working', 'Damaged (Repair required for minimum supply)', 'Contaminated (or at risk of contamination)', 'Destroyed', 'Water Turbid'].map((o) => (
                  <div key={o}><O k={`7.3.${o}`}>{o}</O></div>
                ))}
              </Cell>
            </Cols>
          </R>
          <R>
            7.4 Do affected households have their own water containers with a lid to store water <span style={{ marginLeft: '6mm' }} />
            {yesNo('7.4')}
          </R>
          <R tone="green">
            7.5 Based on current situation, please identify your most immediate need on water
            <div>{need('7.5', ['Jerry cans', 'Bottled water', 'Water distribution', 'Cash'])}</div>
          </R>

          <Sec>8. Sanitation</Sec>
          <R tone="blue">
            8.1 Based on observation, is access to clean toilets a serious problem in your community/EC?
            <div>{screen('8.1', '9')}</div>
          </R>
          <R>
            8.2 Do affected families have access to functioning sanitary facilities (e.g. latrines)? {yesNo('8.2')}
            <div>8.3 Are there separate facilities for women and men? {yesNo('8.3')}</div>
          </R>
          <R style={{ padding: 0 }}>
            <Cols w="62fr 38fr">
              <Cell first>
                8.4 Do affected families have adequate personal hygiene supplies (e.g. soap, sanitary cloth/napkins)? {yesNo('8.4')}
              </Cell>
              <Cell>
                8.5 What is the community&apos;s level of knowledge of hygiene practices? <O k="8.5.vgood">Very Good</O> <O k="8.5.good">Good</O> <O k="8.5.fair">Fair</O> <O k="8.5.poor">Poor</O> <O k="8.5.vpoor">Very poor</O>
              </Cell>
            </Cols>
          </R>
          <R>
            8.6 Are evacuation centres and community shelters equipped with washing and sanitation facilities? {yesNo('8.6')}
          </R>
          <R tone="green">
            8.7 Based on current situation, please identify your most immediate need on sanitation
            <div>{need('8.7', ['Toilet facilities', 'Hygiene kit', 'Water', 'Cash'])}</div>
          </R>

          <Sec>9. Health</Sec>
          <R tone="blue">
            9.1 Based on observation, is inadequate health care a serious problem in your community/EC?
            <div>{screen('9.1', '10')}</div>
          </R>
          <R style={{ padding: 0 }}>
            <Cols w="62fr 38fr">
              <Cell first>
                9.2 What are the main health concerns?
                <div>
                  <O k="9.2.diarrhea" w="40mm">Diarrhea/dehydration</O> <O k="9.2.skin">Skin infections</O>
                </div>
                <div>
                  <O k="9.2.gi" w="40mm">Other gastro-intestinal illnesses</O> <O k="9.2.hyper">Hypertension</O>
                </div>
                <div>
                  <O k="9.2.resp" w="40mm">Respiratory infection</O> <O k="9.2.other">Other</O> <W k="9.2.otherText" w="20mm" />
                </div>
                <O k="9.2.trauma">Trauma</O>
              </Cell>
              <Cell>
                9.3 What is the level of availability of medicines and medical supplies in health facilities?
                {['Adequate', 'Basic', 'Inadequate'].map((o) => (
                  <div key={o}><O k={`9.3.${o}`}>{o}</O></div>
                ))}
              </Cell>
            </Cols>
          </R>
          <R>
            9.4 Which health facilities are functional?
            <div>
              <O k="9.4.bhsNo" w="62mm">Barangay health station without doctor</O> <O k="9.4.hospital" w="34mm">Hospital</O> <O k="9.4.birthing">Birthing facility</O>
            </div>
            <div>
              <O k="9.4.bhsDoc" w="62mm">Barangay health station with doctor</O> <O k="9.4.none">There are none</O>
            </div>
          </R>
          <R tone="green">
            9.5 Based on current situation, please identify your most immediate need on health
            <div>{need('9.5', ['Mobile clinics', 'Medicines', 'Health personnel', 'Cash'])}</div>
          </R>

          <Sec>10. Nutrition</Sec>
          <R tone="blue">
            10.1 Based on observation, is children’s nutrition a serious problem in your community/EC?
            <div>{screen('10.1', '11')}</div>
          </R>
          <R>
            10.2 Is there information on infants that are exclusively breastfed? {yesNo('10.2')}
            <div>
              10.3 If yes, what percentage of infants in this community are estimated to be breastfed exclusively?: <W k="10.3" w="14mm" align="center" />%
            </div>
            <div>10.4 Have infant milk products (e.g. milk formulas) and/or baby bottles/teats been distributed since the start of the emergency? {yesNo('10.4')}</div>
            <div>
              10.5 If yes, by whom? <W k="10.5" w="50mm" />
            </div>
          </R>
          <R>
            10.6 Are any of the following activities being continued without any disruption during the emergency??
            {[
              'Vitamin A capsule supplementation for children 6-59 months:',
              'Iron-Folic Acid tablet distribution for pregnant and lactating women:',
              'Multiple Micronutrient Powders/Iron Syrup/Iron Drops for children 6-23 months of age:',
              'Management of children with moderate and severe acute malnutrition:',
            ].map((t, i) => (
              <div key={t} style={{ display: 'flex', paddingLeft: '18mm' }}>
                <span style={{ width: '120mm' }}>{t}</span>
                <O k={`10.6.${i}.no`}>No</O> <O k={`10.6.${i}.yes`}>Yes</O>
              </div>
            ))}
          </R>
          <R tone="green">
            10.7 Based on current situation, please identify your most immediate need on nutrition
            <div>{need('10.7', ['Food', 'Bottled water', 'Food supplements', 'Cash'])}</div>
          </R>

          <Sec>11. Protection</Sec>
          <R tone="blue">
            11.1 Based on observation, is there a serious problem in your community/EC because people are not safe or protected where they live now?
            <div>{screen('11.1', '12')}</div>
          </R>
          <R>
            11.2 Have there been reported cases of separated and/or unaccompanied children (including orphans)? {yesNo('11.2')}
            <div>
              11.3 If yes, how many? Girls <W k="11.3.girls" w="8mm" align="center" /> Boys <W k="11.3.boys" w="8mm" align="center" />
            </div>
          </R>
          <R>
            11.4 Has there been any information (confirmed and unconfirmed) about cases of gender-based violence (GBV, e.g. rape, human trafficking, forced prostitution, intimate partner violence/domestic violence, sexual harassment, sexual abuse, verbal or psychosocial or economic abuse, physical abuse)? {yesNo('11.4')}
            <div>11.5 Have they been referred to service providers such as police, social workers, and legal aid? {yesNo('11.5')}</div>
            <div>11.6 What are the existing protection mechanisms present in evacuation sites/communal shelter?</div>
            <div>
              <O k="11.6.patrols" w="105mm">Security patrols (police, security patrol organised by affected population</O> <O k="11.6.female">Female police</O>
            </div>
            <div>
              <O k="11.6.vaw" w="105mm">Violence against Women (VAW) Desks</O> <O k="11.6.groups">Community protection groups</O>
            </div>
            <div>11.7 Is there an existing reporting mechanism for protection-related incidents? {yesNo('11.7')}</div>
            <div>
              11.8 If yes, which kind of incidents: <O k="11.8.general">General Protection Incidents</O> <O k="11.8.child">Child Protection Incidents</O> <O k="11.8.gbv">GBV Incidents</O>
            </div>
            <div>11.9 What services can be assessed by GBV/VAW survivors?</div>
            <div>
              {['Medical', 'Legal', 'Psycho-social', 'Shelter', 'Security (police protection)', 'Other'].map((o) => (
                <O key={o} k={`11.9.${o}`}>
                  {o}
                </O>
              ))}
            </div>
          </R>
          <R>
            11.10 Have some children shown extreme behavior changes that are worrying parents and caregivers (e.g. not eating, not speaking, not sleeping)? {yesNo('11.10')}
          </R>
          <R>
            11.11 Do children and women, especially the most vulnerable (i.e. indigenous peoples, female-headed households, persons with disabilities) -, have access to relief items? {yesNo('11.11')}
          </R>
        </Table>
        <Footer />
      </Page>

      <Page paper="a4" pad={[8, 10, 14, 11]} font={NARROW} size="8pt">
        <Table>
          <div style={{ borderTop: '1pt solid #000' }} />
          <R style={{ borderTop: 0 }}>
            11.12 Specialized protection needs
            <div>11.12.1 What are care arrangements for persons in need, e.g., unaccompanied children, elderly and persons with disabilities?</div>
            <div>
              <O k="11.12.1.family">Strong family support</O> <O k="11.12.1.integration">Integration of persons with special needs (PWSNs) in responses</O> <O k="11.12.1.priority">Prioritization of PWSNs in relief distribution</O>
            </div>
            <div>
              <O k="11.12.1.consult" w="40mm">Consultation with PSWNs</O> <O k="11.12.1.referral" w="40mm">Referral of needs</O> <O k="11.12.1.none">No support</O>
            </div>
            <O k="11.12.1.others">Others</O> <W k="11.12.1.othersText" w="25mm" />
            <div style={{ marginTop: '2mm' }}>11.12.2 What problems are arising related to housing, land, and property?</div>
            <div>
              <O k="11.12.2.eviction" w="40mm">Eviction from current location</O> <O k="11.12.2.hazard" w="70mm">Habitual residence located in geo-hazard areas</O> <O k="11.12.2.looting">Looting incidents</O>
            </div>
            <div>
              <O k="11.12.2.damaged" w="40mm">Totally damaged properties</O> <O k="11.12.2.none" w="70mm">None</O> <O k="11.12.2.noresp">No response</O>
            </div>
            <O k="11.12.2.others">Others</O> <W k="11.12.2.othersText" w="25mm" />
          </R>
          <R>
            11.13 Social Cohesion
            <div>11.13.1 How are relations between the host community and IDPs?</div>
            <div>
              <O k="11.13.1.noproblem">No problem</O> <O k="11.13.1.noresp">No response</O> <O k="11.13.1.resources">With tension due to competition on resources</O> <O k="11.13.1.congestion">With tension due to congestion</O>
            </div>
            <O k="11.13.1.others">Others</O> <W k="11.13.1.othersText" w="25mm" />
            <div style={{ marginTop: '2mm' }}>11.13.2 How are the issues being addressed by the community?</div>
            <div>
              <O k="11.13.2.barangay" w="40mm">Resolved at the barangay</O> <O k="11.13.2.community" w="62mm">Addressed by the community themselves</O> <O k="11.13.2.mediation">Mediation by community leader</O>
            </div>
            <div>
              <O k="11.13.2.not" w="40mm">Not being addressed</O> <O k="11.13.2.notreported" w="62mm">Not being addressed as the issues are not reported</O> <O k="11.13.2.others">Others</O> <W k="11.13.2.othersText" w="22mm" />
            </div>
          </R>
          <R tone="green">
            11.14 Based on current situation, please identify your most immediate need on protection
            <div>{need('11.14', ['Referral', 'Police authorities', 'Govt officials', 'Shelter'])}</div>
          </R>

          <Sec>12.Emergency education</Sec>
          <R tone="blue">
            12.1 Based on observation, is children’s education a serious problem?
            <div>{screen('12.1', '13')}</div>
          </R>
          <R style={{ padding: 0 }}>
            <Cols w="55fr 45fr">
              <Cell first>
                12.2 Number of classrooms are being used as evacuation centres: <W k="12.2" w="12mm" align="center" />
                <div>
                  12.3 Number of children are staying in the evacuation centres: <W k="12.3" w="12mm" align="center" />
                </div>
              </Cell>
              <Cell>
                12.4 Number of children are staying with host families? <W k="12.4" w="14mm" align="center" />
              </Cell>
            </Cols>
          </R>
          <R>
            12.5 Number and/or Percentage of <u>destroyed (irreparable)</u> classrooms <span style={{ float: 'right', textAlign: 'right' }}># <W k="12.5.n" w="40mm" /><br />% <W k="12.5.p" w="40mm" /></span>
            <div style={{ clear: 'both' }} />
          </R>
          <R>
            12.6 Number and/or Percentage of <u>damaged</u> (repairable) classrooms (Walls, roof and column collapsed, hanging wall etc.)
            <div>
              Usable: # <W k="12.6.un" w="22mm" /> <span style={{ marginLeft: '6mm' }}>Unusable: # <W k="12.6.xn" w="22mm" /></span>
            </div>
            <div style={{ paddingLeft: '9mm' }}>
              % <W k="12.6.up" w="22mm" /> <span style={{ marginLeft: '15mm' }}>% <W k="12.6.xp" w="22mm" /></span>
            </div>
          </R>
          <R>
            12.7 What are the most urgent educational needs right now in the area? Select all that apply.
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', paddingLeft: '4mm' }}>
              {['Safe space to hold classes', 'Replacing children’s school supplies', 'Securing water & sanitation facility at learning sites', 'Repair of damaged buildings', 'Replacing teaching supplies/kits', 'Other, specify', 'Replacing educational materials', 'Integrating affected children to other schools'].map((o, i) => (
                <span key={o}>
                  <O k={`12.7.${i}`}>{o}</O>
                  {o === 'Other, specify' && <W k="12.7.otherText" w="22mm" />}
                </span>
              ))}
            </div>
          </R>
          <R tone="green">
            12.8 Based on current situation, please identify your most immediate need on education
            <div>{need('12.8', ['Learning spaces', 'School kits', 'Repair schools', 'Cash'])}</div>
          </R>

          <Sec>13. Community engagement</Sec>
          <R tone="blue">
            13.1 Based on observation, is your community/EC receiving the information they need to cope with the evolving humanitarian situation?
            <div>{screen('13.1', '14')}</div>
          </R>
          <R>
            13.2 What are the main sources of information:{' '}
            {['Friends/neighbors/family', 'Community leader', 'Religious leader', 'Government official', 'Military official', 'TV (national/local)', 'Newspaper (national/local)', 'AM/FM radio', 'Aid worker', 'Community group', 'Others, specify'].map((o) => (
              <O key={o} k={`13.2.${o}`}>
                {o}
              </O>
            ))}
            <W k="13.2.otherText" w="20mm" />
          </R>
          <R tone="green">
            13.3 What do affected people want to know most?{' '}
            {['General situation', 'Situation at home', 'Information about family members', 'What aid is coming', 'Weather forecast', 'Health advice', 'Security information', 'Other, specify:'].map((o) => (
              <O key={o} k={`13.3.${o}`}>
                {o}
              </O>
            ))}
            <W k="13.3.otherText" w="22mm" />
          </R>

          <Sec>14. Emergency telecommunications</Sec>
          <R tone="blue">
            14.1 Has telecommunication services been disrupted or damaged in the area? <span style={{ marginLeft: '40mm' }} />
            {yesNo('14.1')}
          </R>
          <R style={{ padding: 0 }}>
            <Cols w="1fr 1fr 1fr">
              <Cell first>14.2 Are landline telephones working in the area? {yesNo('14.2')}</Cell>
              <Cell>
                14.3 Are mobile devices able to receive telecommunications signals? <O k="14.3.smart">Smart</O> <O k="14.3.globe">Globe</O> <O k="14.3.others">Others</O>
              </Cell>
              <Cell>4.4 Is there internet service? {yesNo('14.4')}</Cell>
            </Cols>
          </R>
          <R tone="green">
            14.5 Based on current situation, please identify your most immediate need on communication
            <div>{need('14.5', ['Network connection', 'Charging station', 'Communication lines', 'Cash'])}</div>
          </R>

          <Sec>15. Early Recovery and livelihood</Sec>
          <R tone="blue">
            15.1 Based on observation, are people unable to work because of the situation? <span style={{ marginLeft: '40mm' }} />
            {yesNo('15.1')}
          </R>
          <R>
            15.2 What is the main source of livelihood? <W k="15.2" w="60mm" />
          </R>
          <R tone="green">
            15.3 Based on current situation, please identify your most immediate need on livelihood/early recovery?
            <div>{need('15.3', ['Transport', 'Cash for Work', 'Debris clearance', 'Cash'])}</div>
          </R>

          <Sec>16. Access</Sec>
          <R tone="blue">
            16.1 Is accessibility a problem? {yesNo('16.1')}
          </R>
          <R>
            16.2 How can the community be reached?{' '}
            {['By car', 'By 4WD', 'By 6-10 Wheeler Trucks', 'By motorcycle', 'By foot', 'Boat', 'Airport'].map((o) => (
              <O key={o} k={`16.2.${o}`}>
                {o}
              </O>
            ))}
          </R>
          <R tone="green">
            16.3 Based on current situation, please identify your most immediate need on access
            <div>{need('16.3', ['Transport', 'Road repaid', 'Debris clearance', 'Cash'])}</div>
          </R>
          <R tone="blue" style={{ fontWeight: 700, fontSize: '9pt' }}>
            17. Overall situation <span style={{ fontWeight: 400, fontSize: '7.5pt' }}>(not to be asked to the key informant but as a concluding observation for the enumerator)</span>
          </R>
        </Table>
        <Footer />
      </Page>

      <Page paper="a4" pad={[8, 10, 14, 11]} font={NARROW} size="8pt">
        <div style={{ border: '1pt solid #000', background: '#7f7f7f', color: '#fff', padding: '1mm 2mm 3mm' }}>
          When you consider the general situation in the area, would you say:
          {[
            'A few persons are facing serious problem in the area',
            'Many persons are facing serious problem in the area',
            'As a result of the emergency, people will get sick and might even die',
            'As a result of the emergency, many people have already died',
          ].map((o, i) => (
            <div key={o}>
              <O k={`17.${i}`}>{o}</O>
            </div>
          ))}
          <div style={{ marginTop: '3mm' }}>Please provide general justification for the answer:</div>
          <div style={{ borderBottom: '0.75pt dashed #fff' }}>
            <Area k="17.why" minH="9mm" />
          </div>
        </div>
        <Footer />
      </Page>
    </>
  );
}
