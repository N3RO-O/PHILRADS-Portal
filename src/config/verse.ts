/**
 * Verses shown on Home: one a day, chosen from the date (Manila time), so everyone sees the same
 * verse all day and it changes at midnight, never repeating the day before's.
 * New Living Translation (NLT), exact wording from Tyndale's official NLT API (api.nlt.to). Tyndale allows up to
 * 500 verses in non-salable media with "(NLT)" after each quotation; the full notice is: Scripture quotations are
 * taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation.
 * Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.
 * Unmatched speech marks from the surrounding passage are left out (the card adds its own); the words are unchanged.
 * Later this list can come from app_settings in Supabase.
 */
export interface Verse {
  text: string;
  reference: string;
}

export const VERSES: Verse[] = [
  { text: 'Work willingly at whatever you do, as though you were working for the Lord rather than for people.', reference: 'Colossians 3:23 (NLT)' },
  { text: 'So let’s not get tired of doing what is good. At just the right time we will reap a harvest of blessing if we don’t give up.', reference: 'Galatians 6:9 (NLT)' },
  { text: 'And the King will say, ‘I tell you the truth, when you did it to one of the least of these my brothers and sisters, you were doing it to me!’', reference: 'Matthew 25:40 (NLT)' },
  { text: 'No, O people, the LORD has told you what is good, and this is what he requires of you: to do what is right, to love mercy, and to walk humbly with your God.', reference: 'Micah 6:8 (NLT)' },
  { text: 'Don’t be afraid, for I am with you. Don’t be discouraged, for I am your God. I will strengthen you and help you. I will hold you up with my victorious right hand.', reference: 'Isaiah 41:10 (NLT)' },
  { text: 'For I can do everything through Christ, who gives me strength.', reference: 'Philippians 4:13 (NLT)' },
  { text: 'Do not withhold good from those who deserve it when it’s in your power to help them.', reference: 'Proverbs 3:27 (NLT)' },
  { text: 'Dear children, let’s not merely say that we love each other; let us show the truth by our actions.', reference: '1 John 3:18 (NLT)' },
  { text: 'God is our refuge and strength, always ready to help in times of trouble.', reference: 'Psalm 46:1 (NLT)' },
  { text: 'And don’t forget to do good and to share with those in need. These are the sacrifices that please God.', reference: 'Hebrews 13:16 (NLT)' },
  { text: 'Feed the hungry, and help those in trouble. Then your light will shine out from the darkness, and the darkness around you will be as bright as noon.', reference: 'Isaiah 58:10 (NLT)' },
  { text: 'For even the Son of Man came not to be served but to serve others and to give his life as a ransom for many.', reference: 'Mark 10:45 (NLT)' },
  { text: 'Share each other’s burdens, and in this way obey the law of Christ.', reference: 'Galatians 6:2 (NLT)' },
  { text: 'This is my command—be strong and courageous! Do not be afraid or discouraged. For the LORD your God is with you wherever you go.', reference: 'Joshua 1:9 (NLT)' },
  { text: 'If you help the poor, you are lending to the LORD—and he will repay you!', reference: 'Proverbs 19:17 (NLT)' },
  { text: 'God has given each of you a gift from his great variety of spiritual gifts. Use them well to serve one another.', reference: '1 Peter 4:10 (NLT)' },
  { text: 'In the same way, let your good deeds shine out for all to see, so that everyone will praise your heavenly Father.', reference: 'Matthew 5:16 (NLT)' },
  { text: 'Give justice to the poor and the orphan; uphold the rights of the oppressed and the destitute.', reference: 'Psalm 82:3 (NLT)' },
  { text: 'But those who trust in the LORD will find new strength. They will soar high on wings like eagles. They will run and not grow weary. They will walk and not faint.', reference: 'Isaiah 40:31 (NLT)' },
  { text: 'The faithful love of the LORD never ends! His mercies never cease. Great is his faithfulness; his mercies begin afresh each morning.', reference: 'Lamentations 3:22–23 (NLT)' },
  { text: 'Then Jesus said, ‘Come to me, all of you who are weary and carry heavy burdens, and I will give you rest.’', reference: 'Matthew 11:28 (NLT)' },
];

/** Small seeded random generator (mulberry32): the same seed always gives the same sequence. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The shuffled order for one cycle of VERSES.length days: every verse once, in a random order. */
function cycleOrder(cycle: number): number[] {
  const rand = seeded(cycle);
  const order = VERSES.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Today's verse: shuffled, the same all day (Manila time), and never the same two days running. */
export function verseOfTheDay(now = new Date()): Verse {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const cycle = Math.floor(dayNumber / VERSES.length);
  const order = cycleOrder(cycle);
  // A new cycle could start with the verse the last one ended on: swap its first two.
  if (order[0] === cycleOrder(cycle - 1)[VERSES.length - 1]) [order[0], order[1]] = [order[1], order[0]];
  return VERSES[order[dayNumber % VERSES.length]];
}
