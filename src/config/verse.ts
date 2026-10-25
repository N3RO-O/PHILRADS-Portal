/**
 * Verses shown on Home: one a day, chosen from the date (Manila time), so everyone sees the same
 * verse all day and it changes at midnight, never repeating the day before's.
 * King James Version texts are public domain. Later this list can come from app_settings in Supabase.
 */
export interface Verse {
  text: string;
  reference: string;
}

export const VERSES: Verse[] = [
  { text: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.', reference: 'Colossians 3:23 (NIV)' },
  { text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.', reference: 'Galatians 6:9 (KJV)' },
  { text: 'Verily I say unto you, Inasmuch as ye have done it unto one of the least of these my brethren, ye have done it unto me.', reference: 'Matthew 25:40 (KJV)' },
  { text: 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?', reference: 'Micah 6:8 (KJV)' },
  { text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.', reference: 'Isaiah 41:10 (KJV)' },
  { text: 'I can do all things through Christ which strengtheneth me.', reference: 'Philippians 4:13 (KJV)' },
  { text: 'Withhold not good from them to whom it is due, when it is in the power of thine hand to do it.', reference: 'Proverbs 3:27 (KJV)' },
  { text: 'My little children, let us not love in word, neither in tongue; but in deed and in truth.', reference: '1 John 3:18 (KJV)' },
  { text: 'God is our refuge and strength, a very present help in trouble.', reference: 'Psalm 46:1 (KJV)' },
  { text: 'But to do good and to communicate forget not: for with such sacrifices God is well pleased.', reference: 'Hebrews 13:16 (KJV)' },
  { text: 'And if thou draw out thy soul to the hungry, and satisfy the afflicted soul; then shall thy light rise in obscurity, and thy darkness be as the noonday.', reference: 'Isaiah 58:10 (KJV)' },
  { text: 'For even the Son of man came not to be ministered unto, but to minister, and to give his life a ransom for many.', reference: 'Mark 10:45 (KJV)' },
  { text: 'Bear ye one another’s burdens, and so fulfil the law of Christ.', reference: 'Galatians 6:2 (KJV)' },
  { text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', reference: 'Joshua 1:9 (KJV)' },
  { text: 'He that hath pity upon the poor lendeth unto the LORD; and that which he hath given will he pay him again.', reference: 'Proverbs 19:17 (KJV)' },
  { text: 'As every man hath received the gift, even so minister the same one to another, as good stewards of the manifold grace of God.', reference: '1 Peter 4:10 (KJV)' },
  { text: 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.', reference: 'Matthew 5:16 (KJV)' },
  { text: 'Defend the poor and fatherless: do justice to the afflicted and needy.', reference: 'Psalm 82:3 (KJV)' },
  { text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', reference: 'Isaiah 40:31 (KJV)' },
  { text: 'It is of the LORD’s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.', reference: 'Lamentations 3:22–23 (KJV)' },
  { text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', reference: 'Matthew 11:28 (KJV)' },
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
