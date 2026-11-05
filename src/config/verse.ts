/**
 * Verses shown on Home: one a day, chosen from the date (Manila time), so everyone sees the same
 * verse all day and it changes at midnight, never repeating the day before's.
 * About all of life (faith, family, friendship, rest, worry, grief, joy, health) as well as service.
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
  // All of life, not only work: worry, love, family, friendship, rest, grief, forgiveness, joy, health.
  { text: 'Don’t worry about anything; instead, pray about everything. Tell God what you need, and thank him for all he has done. Then you will experience God’s peace, which exceeds anything we can understand. His peace will guard your hearts and minds as you live in Christ Jesus.', reference: 'Philippians 4:6–7 (NLT)' },
  { text: 'Trust in the LORD with all your heart; do not depend on your own understanding. Seek his will in all you do, and he will show you which path to take.', reference: 'Proverbs 3:5–6 (NLT)' },
  { text: 'Love is patient and kind. Love is not jealous or boastful or proud or rude. It does not demand its own way. It is not irritable, and it keeps no record of being wronged.', reference: '1 Corinthians 13:4–5 (NLT)' },
  { text: 'The LORD is my shepherd; I have all that I need. He lets me rest in green meadows; he leads me beside peaceful streams. He renews my strength. He guides me along right paths, bringing honor to his name.', reference: 'Psalm 23:1–3 (NLT)' },
  { text: '‘For I know the plans I have for you,’ says the LORD. ‘They are plans for good and not for disaster, to give you a future and a hope.’', reference: 'Jeremiah 29:11 (NLT)' },
  { text: 'Instead, be kind to each other, tenderhearted, forgiving one another, just as God through Christ has forgiven you.', reference: 'Ephesians 4:32 (NLT)' },
  { text: 'The LORD is close to the brokenhearted; he rescues those whose spirits are crushed.', reference: 'Psalm 34:18 (NLT)' },
  { text: 'Always be joyful. Never stop praying. Be thankful in all circumstances, for this is God’s will for you who belong to Christ Jesus.', reference: '1 Thessalonians 5:16–18 (NLT)' },
  { text: 'And we know that God causes everything to work together for the good of those who love God and are called according to his purpose for them.', reference: 'Romans 8:28 (NLT)' },
  { text: 'For this is how God loved the world: He gave his one and only Son, so that everyone who believes in him will not perish but have eternal life.', reference: 'John 3:16 (NLT)' },
  { text: 'This is the day the LORD has made. We will rejoice and be glad in it.', reference: 'Psalm 118:24 (NLT)' },
  { text: 'A friend is always loyal, and a brother is born to help in time of need.', reference: 'Proverbs 17:17 (NLT)' },
  { text: 'So don’t worry about tomorrow, for tomorrow will bring its own worries. Today’s trouble is enough for today.', reference: 'Matthew 6:34 (NLT)' },
  { text: 'Give all your worries and cares to God, for he cares about you.', reference: '1 Peter 5:7 (NLT)' },
  { text: 'Rejoice in our confident hope. Be patient in trouble, and keep on praying.', reference: 'Romans 12:12 (NLT)' },
  { text: 'Be still, and know that I am God! I will be honored by every nation. I will be honored throughout the world.', reference: 'Psalm 46:10 (NLT)' },
  { text: 'Make allowance for each other’s faults, and forgive anyone who offends you. Remember, the Lord forgave you, so you must forgive others.', reference: 'Colossians 3:13 (NLT)' },
  { text: 'Thank you for making me so wonderfully complex! Your workmanship is marvelous—how well I know it.', reference: 'Psalm 139:14 (NLT)' },
  { text: 'You will keep in perfect peace all who trust in you, all whose thoughts are fixed on you!', reference: 'Isaiah 26:3 (NLT)' },
  { text: 'How wonderful and pleasant it is when brothers live together in harmony!', reference: 'Psalm 133:1 (NLT)' },
  { text: 'I pray that God, the source of hope, will fill you completely with joy and peace because you trust in him. Then you will overflow with confident hope through the power of the Holy Spirit.', reference: 'Romans 15:13 (NLT)' },
  { text: 'Then Jesus said, ‘Let’s go off by ourselves to a quiet place and rest awhile.’ He said this because there were so many people coming and going that Jesus and his apostles didn’t even have time to eat.', reference: 'Mark 6:31 (NLT)' },
  { text: 'A gentle answer deflects anger, but harsh words make tempers flare.', reference: 'Proverbs 15:1 (NLT)' },
  { text: 'For his anger lasts only a moment, but his favor lasts a lifetime! Weeping may last through the night, but joy comes with the morning.', reference: 'Psalm 30:5 (NLT)' },
  { text: 'Dear friend, I hope all is well with you and that you are as healthy in body as you are strong in spirit.', reference: '3 John 1:2 (NLT)' },
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
