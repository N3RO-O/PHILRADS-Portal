import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, RotateCcw } from 'lucide-react';
import { GuestSection } from './guestUi';

type Guide = 'bag' | 'plan' | 'typhoon' | 'flood' | 'earthquake';
const GUIDES: { key: Guide; label: string }[] = [
  { key: 'bag', label: 'Go bag' },
  { key: 'plan', label: 'Family plan' },
  { key: 'typhoon', label: 'Typhoon' },
  { key: 'flood', label: 'Flood' },
  { key: 'earthquake', label: 'Earthquake' },
];

/** Packed for three days, for everyone in the house. Ticks are kept on this phone. */
const BAG = [
  { id: 'water', text: 'Drinking water for three days', note: 'About 4 litres a person a day' },
  { id: 'food', text: 'Ready-to-eat food for three days', note: 'Canned goods with a can opener, biscuits' },
  { id: 'meds', text: 'Medicines you take every day', note: 'With a copy of the prescription' },
  { id: 'aid', text: 'First aid kit' },
  { id: 'light', text: 'Flashlight and spare batteries' },
  { id: 'radio', text: 'Battery radio', note: 'For PAGASA bulletins when the power and signal are out' },
  { id: 'power', text: 'Charged power bank and phone cable' },
  { id: 'docs', text: 'IDs and important papers in a waterproof pouch', note: 'Birth certificates, land titles, insurance' },
  { id: 'cash', text: 'Cash in small bills', note: 'Shops and ATMs may be closed' },
  { id: 'clothes', text: 'Change of clothes and a raincoat' },
  { id: 'sleep', text: 'Blanket or mat' },
  { id: 'hygiene', text: 'Soap, toothbrush, sanitary pads, diapers', note: 'What each person needs' },
  { id: 'masks', text: 'Face masks and alcohol' },
  { id: 'whistle', text: 'Whistle', note: 'To call for help if you are trapped' },
];
const PLAN = [
  { id: 'center', text: 'Know your nearest evacuation center and the way there', note: 'Ask your barangay hall' },
  { id: 'meet', text: 'Agree on a meeting place if the family is apart' },
  { id: 'contacts', text: 'Write family and emergency numbers on paper', note: 'Phones die and lose signal' },
  { id: 'out', text: 'Pick one relative outside the area everyone checks in with' },
  { id: 'care', text: 'Decide who helps the elderly, children and anyone with a disability' },
  { id: 'pets', text: 'Plan for your animals' },
  { id: 'practice', text: 'Walk the route once with the whole family' },
];

const STEPS: Record<'typhoon' | 'flood' | 'earthquake', { lead: string; before: string[]; during: string[]; after: string[] }> = {
  typhoon: {
    lead: 'Follow PAGASA’s wind signal for your province. The higher the number, the stronger the wind expected.',
    before: [
      'Pack your go bag and charge phones and power banks.',
      'Tie down or bring in anything the wind can throw. Trim loose branches.',
      'Store drinking water and fill containers for washing.',
      'If your house is weak or near the sea, a river or a slope, leave early when your barangay tells you to.',
    ],
    during: [
      'Stay inside, away from windows and glass.',
      'Unplug appliances. Use flashlights, not candles.',
      'Listen to the radio for updates. The calm in the eye does not mean it is over.',
    ],
    after: [
      'Wait for authorities to say it is safe before going home.',
      'Keep away from fallen power lines and damaged buildings.',
      'Boil or treat drinking water until the supply is declared safe.',
      'Check on neighbours, especially older people living alone.',
    ],
  },
  flood: {
    lead: 'Floods rise fast after heavy rain, even far from where it fell. Water you can’t see the bottom of is never safe.',
    before: [
      'Know if your area floods, and the higher ground nearest you.',
      'Move valuables, papers and electrical things up high.',
      'Turn off the main power switch if water may enter the house.',
    ],
    during: [
      'Go to higher ground or the evacuation center when told. Don’t wait.',
      'Never walk, swim or drive through floodwater. Thirty centimetres of moving water can sweep a car away.',
      'Stay away from rivers, drains and canals.',
    ],
    after: [
      'Don’t touch electrical things while wet or standing in water.',
      'Throw away food that touched floodwater.',
      'Watch for leptospirosis: see a health worker if you get a fever after wading in floodwater.',
    ],
  },
  earthquake: {
    lead: 'When the ground shakes: Duck, Cover and Hold until it stops.',
    before: [
      'Fasten tall furniture and heavy things to the wall.',
      'Know the safe spots in each room: under a sturdy table, away from windows.',
      'If you live near the coast, know the way to high ground.',
    ],
    during: [
      'Duck, cover under a sturdy table, and hold on.',
      'Outside: move away from buildings, posts and wires.',
      'Don’t run out while it is shaking, and don’t use the lift.',
    ],
    after: [
      'Expect aftershocks. Leave damaged buildings carefully.',
      'Near the sea and it shook hard or long? Go to high ground now. Don’t wait for a warning.',
      'Check for gas leaks and fires. Use text messages to keep lines free.',
    ],
  },
};

const KEY = 'philrads.guest.prepare.v1';
function readTicks(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function Checklist({ items, ticks, onTick, what }: { items: { id: string; text: string; note?: string }[]; ticks: Set<string>; onTick: (id: string) => void; what: string }) {
  const done = items.filter((i) => ticks.has(i.id)).length;
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} aria-label={`${what}: ${done} of ${items.length}`}>
          <div className={`h-full rounded-full transition-[width] duration-500 ease-glide ${done === items.length ? 'bg-status-in' : 'bg-uplift'}`} style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <span className="text-xs font-semibold tabular-nums text-ink-soft">
          {done} of {items.length}
        </span>
      </div>
      <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((i) => {
          const on = ticks.has(i.id);
          return (
            <li key={i.id}>
              <label className="tap flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-raised">
                <input type="checkbox" className="peer sr-only" checked={on} onChange={() => onTick(i.id)} />
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-uplift ${
                    on ? 'border-status-in bg-status-in text-[#0f1a12]' : 'border-ink-mute/60 bg-surface-sunken'
                  }`}
                  aria-hidden
                >
                  {on && <Check className="h-3.5 w-3.5 animate-pop-in" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold transition-colors ${on ? 'text-ink-soft line-through decoration-ink-mute/60' : 'text-ink'}`}>{i.text}</span>
                  {i.note && <span className="block text-xs text-muted">{i.note}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Steps({ guide }: { guide: 'typhoon' | 'flood' | 'earthquake' }) {
  const g = STEPS[guide];
  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink">{g.lead}</p>
      {(
        [
          ['Before', g.before],
          ['During', g.during],
          ['After', g.after],
        ] as const
      ).map(([when, list]) => (
        <div key={when}>
          <h4 className="text-sm font-semibold text-ink">{when}</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {list.map((t) => (
              <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-mute" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Be prepared: a go bag and a family plan to tick off (kept on this phone), and what to do before,
 * during and after a typhoon, a flood and an earthquake. All of it works without a signal.
 */
export function PrepareSection() {
  const [guide, setGuide] = useState<Guide>('bag');
  const [ticks, setTicks] = useState(() => new Set(readTicks()));
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...ticks]));
    } catch {
      /* private browsing: ticks last for this visit */
    }
  }, [ticks]);
  const tick = (id: string) =>
    setTicks((t) => {
      const n = new Set(t);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const list = guide === 'bag' ? BAG : guide === 'plan' ? PLAN : null;
  const ticked = list?.some((i) => ticks.has(i.id));

  return (
    <GuestSection id="prepare" title="Be prepared" lead="Ready before the next disaster. Works offline.">
      <div role="tablist" aria-label="Guides" className="mb-5 flex flex-wrap gap-2">
        {GUIDES.map((g) => (
          <button key={g.key} type="button" role="tab" aria-selected={guide === g.key} aria-pressed={guide === g.key} className="chip min-h-9" onClick={() => setGuide(g.key)}>
            {g.label}
          </button>
        ))}
      </div>
      <div key={guide} className="animate-fade-in" role="tabpanel">
        {guide === 'bag' && <p className="mb-4 text-sm text-ink-soft">One bag by the door with what your family needs for three days if you have to leave quickly.</p>}
        {guide === 'plan' && (
          <p className="mb-4 text-sm text-ink-soft">
            Agree on these together, before anything happens. The <Link to="/guest/map" className="font-semibold text-uplift hover:underline">Live Map</Link> shows PHILRADS sites near you.
          </p>
        )}
        {list ? <Checklist items={list} ticks={ticks} onTick={tick} what={guide === 'bag' ? 'Go bag' : 'Family plan'} /> : <Steps guide={guide as 'typhoon' | 'flood' | 'earthquake'} />}
        {list && ticked && (
          <button type="button" className="hit mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink" onClick={() => setTicks((t) => new Set([...t].filter((id) => !list.some((i) => i.id === id))))}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Untick all
          </button>
        )}
      </div>
      <p className="mt-6 text-xs text-muted">Based on public guidance from NDRRMC, PAGASA, PHIVOLCS and the Philippine Red Cross. Always follow your local officials.</p>
    </GuestSection>
  );
}
