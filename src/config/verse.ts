/**
 * Verses shown on Home, one picked at random each visit (never the same twice in a row).
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

const LAST_KEY = 'philrads.verse.last';

/** A random verse, not the one shown last time. */
export function pickVerse(): Verse {
  let last = -1;
  try {
    last = Number(sessionStorage.getItem(LAST_KEY) ?? -1);
  } catch {
    /* storage unavailable */
  }
  let i = Math.floor(Math.random() * VERSES.length);
  if (i === last) i = (i + 1) % VERSES.length;
  try {
    sessionStorage.setItem(LAST_KEY, String(i));
  } catch {
    /* storage unavailable */
  }
  return VERSES[i];
}
