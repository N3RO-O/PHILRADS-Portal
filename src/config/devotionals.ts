/**
 * A short reflection for each Verse of the Day ("Read more"), written for PHILRADS staff and
 * volunteers: what the verse says, what it means for relief and development work, one thing to do
 * today, and a short prayer. Original text, keyed by the verse's reference in config/verse.ts.
 */
export interface Devotional {
  title: string;
  reflection: string[];
  today: string;
  prayer: string;
}

export const DEVOTIONALS: Record<string, Devotional> = {
  'Colossians 3:23 (NLT)': {
    title: 'Work that no one sees',
    reflection: [
      'Much of our work is never photographed: counting sacks in a warehouse, checking a beneficiary list a third time, answering the same question for the tenth family. Paul tells us that every one of those tasks has an audience of One.',
      'Working "for the Lord" does not mean working harder to be noticed. It means doing the ordinary well because the people we serve matter to God, whether or not a donor report ever mentions it.',
    ],
    today: 'Pick one small, unseen task today and do it with care, as an offering.',
    prayer: 'Lord, let my work today be done for you, in the small things as much as the big ones. Amen.',
  },
  'Galatians 6:9 (NLT)': {
    title: 'When the harvest is slow',
    reflection: [
      'Recovery after a disaster is slow. Livelihoods take seasons to rebuild, and progress can be hard to see from week to week. It is easy to grow tired of doing good when the results are not yet visible.',
      'Paul promises that the harvest comes "at just the right time", which is God’s timing, not ours. Our part is to keep planting faithfully and to not give up on the people and communities we walk with.',
    ],
    today: 'Encourage a teammate who is carrying a long, slow project.',
    prayer: 'Father, renew my strength when I am weary, and help me trust your timing for the harvest. Amen.',
  },
  'Matthew 25:40 (NLT)': {
    title: 'The face behind the list',
    reflection: [
      'A distribution list can have hundreds of names. Jesus reminds us that each one is a brother or sister, and that when we serve them, we serve him.',
      'This changes how we queue people, how we speak at a registration table and how we handle a complaint. Dignity is not an extra; it is how we meet Christ in the people we serve.',
    ],
    today: 'Learn and use the name of one person you serve or work with today.',
    prayer: 'Lord Jesus, help me see you in every person I meet today, and treat them with your kindness. Amen.',
  },
  'Micah 6:8 (NLT)': {
    title: 'Three simple requirements',
    reflection: [
      'Micah strips faith down to three things: do what is right, love mercy and walk humbly with God. Justice, compassion and humility belong together.',
      'In humanitarian work, doing right means fair targeting and honest reporting; loving mercy means going the extra step for the most vulnerable; walking humbly means remembering that communities are the experts in their own lives.',
    ],
    today: 'Before deciding something that affects a community, ask for their view first.',
    prayer: 'God, teach me to act justly, love mercy and walk humbly with you today. Amen.',
  },
  'Isaiah 41:10 (NLT)': {
    title: 'Held up in the storm',
    reflection: [
      'We are often the ones sent into fear: after typhoons, earthquakes and floods. We carry other people’s grief and our own exhaustion. God speaks directly to that: do not be afraid, I am with you.',
      'His promise is not that hard days will not come, but that we will not face them alone. He strengthens, he helps and he holds us up.',
    ],
    today: 'Name one worry to God and hand it over before you start your work.',
    prayer: 'Lord, when I am afraid or discouraged, hold me up with your strong hand. Amen.',
  },
  'Philippians 4:13 (NLT)': {
    title: 'Strength for every circumstance',
    reflection: [
      'Paul wrote this from prison, after learning to be content with much and with little. It is not a promise of success in everything, but of strength in whatever comes.',
      'Some deployments feel impossible: too few kits, too many families, too little time. Christ gives the strength to do our part faithfully, and the peace to leave the rest to him.',
    ],
    today: 'Face the hardest task on your list first, asking Christ for strength.',
    prayer: 'Christ, be my strength today in whatever I face, in plenty and in want. Amen.',
  },
  'Proverbs 3:27 (NLT)': {
    title: 'Good within reach',
    reflection: [
      'This proverb is practical: when it is in your power to help, help. Delay can be its own kind of refusal.',
      'Our systems, approvals and reports exist to serve people well, not to slow help down. Where we can safely act today, we should not make people wait for tomorrow.',
    ],
    today: 'Look for one request you can answer today instead of next week.',
    prayer: 'Lord, open my eyes to the good within my reach, and give me willing hands. Amen.',
  },
  '1 John 3:18 (NLT)': {
    title: 'Love that shows up',
    reflection: [
      'John says love is proven by actions, not words alone. Food packs, hygiene kits and shelter repairs are love made visible.',
      'The same is true inside our team: covering for a tired colleague, finishing what we promised, listening well. Our care for one another is part of our witness.',
    ],
    today: 'Do one practical thing for a teammate without being asked.',
    prayer: 'God, let my love today be seen in what I do, not only in what I say. Amen.',
  },
  'Psalm 46:1 (NLT)': {
    title: 'A refuge in trouble',
    reflection: [
      'The psalmist describes earth shaking and waters roaring: the kind of disasters we respond to. In the middle of it, God is a refuge and strength, always ready to help.',
      'Before we are helpers, we are people who need help. Resting in God is not a luxury; it is how responders keep going without breaking.',
    ],
    today: 'Take five quiet minutes to pray before your busiest hour.',
    prayer: 'Lord, be my refuge and strength today, and the refuge of every family facing trouble. Amen.',
  },
  'Hebrews 13:16 (NLT)': {
    title: 'Sacrifices that please God',
    reflection: [
      'The writer of Hebrews calls doing good and sharing a sacrifice that pleases God. Generosity is worship.',
      'Every donor gift, every volunteer hour and every staff member’s extra effort is part of that offering. We are stewards of what others have given in faith.',
    ],
    today: 'Thank a donor, partner church or volunteer for what they shared.',
    prayer: 'Father, make my work and my sharing a pleasing offering to you. Amen.',
  },
  'Isaiah 58:10 (NLT)': {
    title: 'Light in dark places',
    reflection: [
      'Isaiah connects feeding the hungry with light breaking into darkness. Care for people in trouble is not separate from spiritual life; it is where God’s light shines.',
      'In evacuation centres without power and communities cut off by floods, our presence can be that light, not because of us but because of the One who sends us.',
    ],
    today: 'Pray for one community you have served and ask how they are doing now.',
    prayer: 'Lord, let your light shine through our work into the darkest places. Amen.',
  },
  'Mark 10:45 (NLT)': {
    title: 'Leading by serving',
    reflection: [
      'Jesus, who had every right to be served, chose to serve. He redefines greatness as giving yourself for others.',
      'Whatever our role, coordinator, field staff or volunteer, the call is the same: lead by serving, and serve without needing a title.',
    ],
    today: 'Offer help with a task that is not part of your role.',
    prayer: 'Jesus, give me a servant’s heart like yours today. Amen.',
  },
  'Galatians 6:2 (NLT)': {
    title: 'Carrying it together',
    reflection: [
      'Some loads are too heavy for one person: grief, burnout, a family crisis, a deadline that will not move. Paul calls us to share each other’s burdens.',
      'A strong team is not one where no one struggles, but one where no one struggles alone.',
    ],
    today: 'Ask a teammate, "How can I help you this week?" and mean it.',
    prayer: 'Lord, make us a team that carries one another’s burdens. Amen.',
  },
  'Joshua 1:9 (NLT)': {
    title: 'Courage for the road',
    reflection: [
      'Joshua faced an unknown land and a huge responsibility. God did not remove the challenge; he commanded courage and promised his presence.',
      'Every deployment is a step into the unknown: roads, weather, security, needs. Courage comes from knowing who goes with us.',
    ],
    today: 'Pray for the team members who are in the field today.',
    prayer: 'Lord, go with us wherever we go, and make us strong and courageous. Amen.',
  },
  'Proverbs 19:17 (NLT)': {
    title: 'Lending to the Lord',
    reflection: [
      'This proverb says that helping the poor is like lending to God himself, and that he repays. Nothing given in compassion is wasted.',
      'We may never see the full fruit of a livelihood project or a cash grant, but God sees, and God remembers.',
    ],
    today: 'Remember one family you served and pray for their future.',
    prayer: 'Father, thank you that nothing given in your name is lost. Amen.',
  },
  '1 Peter 4:10 (NLT)': {
    title: 'Every gift has a place',
    reflection: [
      'Peter reminds us that God has given each person gifts to serve others. Logistics, counselling, accounting, driving, design and prayer are all gifts.',
      'A response needs all of them. No gift is too small, and no one’s contribution is the whole picture.',
    ],
    today: 'Thank a colleague for a gift you see in them.',
    prayer: 'Lord, help me use what you have given me to serve others well. Amen.',
  },
  'Matthew 5:16 (NLT)': {
    title: 'Good deeds that point upward',
    reflection: [
      'Jesus wants our good deeds seen, not so we get credit, but so people praise the Father. Our work is meant to point beyond ourselves.',
      'Honesty in reports, fairness in distribution and kindness under pressure are how our light shines in communities and among partners.',
    ],
    today: 'Do your work today in a way that would make someone thank God.',
    prayer: 'Father, let our good deeds bring praise to you, not to us. Amen.',
  },
  'Psalm 82:3 (NLT)': {
    title: 'Speaking up for the overlooked',
    reflection: [
      'God calls his people to give justice to the poor and the orphan and to uphold the rights of the oppressed. Care includes advocacy.',
      'In every response there are people easily missed: persons with disabilities, older people, children without guardians, families far from the road. Our assessments must find them.',
    ],
    today: 'Ask, "Who might we be missing?" in your next planning conversation.',
    prayer: 'Lord, give us eyes to see the overlooked and courage to stand with them. Amen.',
  },
  'Isaiah 40:31 (NLT)': {
    title: 'New strength',
    reflection: [
      'Humanitarian work runs on adrenaline until it does not. Isaiah points to a different source: those who trust in the LORD find new strength.',
      'Soaring, running and walking describe every pace of life. God meets us whether we are flying high on a good day or barely walking on a hard one.',
    ],
    today: 'Rest well tonight; rest is part of trusting God.',
    prayer: 'Lord, renew my strength as I trust in you, for the long road ahead. Amen.',
  },
  'Lamentations 3:22–23 (NLT)': {
    title: 'Mercy every morning',
    reflection: [
      'Lamentations was written amid ruin, yet the writer found that God’s mercies begin afresh each morning. Hope can be found even in the rubble.',
      'Yesterday’s mistakes and frustrations do not define today. Each morning is a new start for us, for our team and for the communities we serve.',
    ],
    today: 'Let go of one frustration from yesterday and begin fresh.',
    prayer: 'Faithful God, thank you for mercies that are new this morning. Amen.',
  },
  'Matthew 11:28 (NLT)': {
    title: 'Rest for the weary',
    reflection: [
      'Jesus invites the weary and heavy-laden to come to him. Those who care for others often forget they too need care.',
      'This invitation is for responders, coordinators and volunteers as much as anyone. Coming to Jesus is where real rest begins.',
    ],
    today: 'Take a real break today and spend part of it in prayer.',
    prayer: 'Jesus, I come to you tired. Give me your rest. Amen.',
  },
};

/** The reflection for a verse, if one has been written. */
export const devotionalFor = (reference: string): Devotional | null => DEVOTIONALS[reference] ?? null;
