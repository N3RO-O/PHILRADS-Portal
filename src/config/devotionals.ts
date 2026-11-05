/**
 * A short reflection for each Verse of the Day ("Read more"), written for PHILRADS staff and
 * volunteers: what the verse says, what it means for work and for the rest of life (home, family,
 * friendship, rest, grief, health), one thing to do today, and a short prayer. Original text, keyed by the verse's reference in config/verse.ts.
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
  },  'Philippians 4:6–7 (NLT)': {
    title: 'Trading worry for prayer',
    reflection: [
      'Worry rarely stays in one corner of life. A bill, a sick parent, a child far from home, a decision we keep putting off: it follows us to bed and wakes up with us.',
      'Paul does not say our worries are small. He gives them somewhere to go. Name what you need, thank God for what he has already done, and let his peace stand guard over your heart.',
    ],
    today: 'Write down one worry, pray about it by name, and thank God for one thing beside it.',
    prayer: 'Lord, I give you what I keep carrying. Guard my heart and mind with your peace. Amen.',
  },
  'Proverbs 3:5–6 (NLT)': {
    title: 'When the way isn’t clear',
    reflection: [
      'Some choices have no obvious answer: where to live, whether to change paths, how to help someone we love. We think, ask, list pros and cons, and still don’t know.',
      'Trusting God doesn’t mean switching off our minds. It means bringing every part of the decision to him, and believing he will light the next step even when we can’t see the whole road.',
    ],
    today: 'Bring one decision you are facing to God in prayer before you decide.',
    prayer: 'Father, I don’t see the whole path. Show me the next step, and help me trust you with the rest. Amen.',
  },
  '1 Corinthians 13:4–5 (NLT)': {
    title: 'Love in ordinary moments',
    reflection: [
      'These words are read at weddings, but they are meant for Tuesday afternoons: the long queue, the tired spouse, the sibling who forgot again, the friend who said the wrong thing.',
      'Love here is less a feeling than a set of choices. Being patient one more time. Letting a small wrong go instead of keeping score. Every home and every friendship grows on choices like these.',
    ],
    today: 'Choose one person today and practise one line of this passage with them.',
    prayer: 'God of love, make me patient and kind at home and wherever I go today. Amen.',
  },
  'Psalm 23:1–3 (NLT)': {
    title: 'A shepherd who leads to rest',
    reflection: [
      'A shepherd does not drive the sheep until they drop. He leads them to grass and still water, because rest is part of the journey, not a reward at the end of it.',
      'Whatever this season holds, a full house, an empty one, a hard diagnosis or simply a busy week, the psalm reminds us we are cared for. Rest is a gift we are allowed to receive.',
    ],
    today: 'Make room for one quiet moment today: a walk, a slow meal, or ten minutes without your phone.',
    prayer: 'Good Shepherd, lead me to rest and renew my strength. Amen.',
  },
  'Jeremiah 29:11 (NLT)': {
    title: 'A future and a hope',
    reflection: [
      'God spoke these words to people far from home, in exile, told to settle in and wait. The promise came in the middle of a hard chapter, not after it.',
      'When life feels stuck, a job search, an illness, a family situation that won’t change, we can still hold on to this: God’s plans for us are for good, and he has not forgotten our future.',
    ],
    today: 'Tell someone who is waiting on something that you are praying for them.',
    prayer: 'Lord, in the waiting, remind me that you hold my future and my hope. Amen.',
  },
  'Ephesians 4:32 (NLT)': {
    title: 'Tenderhearted',
    reflection: [
      'It is easy to be kind to strangers and short with the people closest to us. Home is where we are most tired, and where small hurts pile up the fastest.',
      'Paul roots our kindness in what God has done for us. We forgive because we have been forgiven, not because the other person has earned it.',
    ],
    today: 'Say a kind word at home today, especially to someone you have been short with.',
    prayer: 'Father, soften my heart and help me forgive as you have forgiven me. Amen.',
  },
  'Psalm 34:18 (NLT)': {
    title: 'Close to the brokenhearted',
    reflection: [
      'Grief does not keep office hours. The loss of a parent, a friend, a pregnancy, a marriage or a dream can sit with us for a long time, even while life goes on around us.',
      'This verse does not tell the brokenhearted to cheer up. It tells them God is near: right there, in the middle of it.',
    ],
    today: 'Reach out to someone you know is grieving, even with a short message.',
    prayer: 'Lord, be close to everyone whose heart is broken today, and to me when mine is. Amen.',
  },
  '1 Thessalonians 5:16–18 (NLT)': {
    title: 'Thankful in all things',
    reflection: [
      'Paul says thankful in all circumstances, not for all circumstances. We don’t have to pretend a hard day is good to find something good within it.',
      'Gratitude is a habit more than a mood: a meal shared, a text from a friend, the rain stopping in time. Noticing these turns ordinary days into prayer.',
    ],
    today: 'Before you sleep tonight, name three things you are thankful for.',
    prayer: 'God, open my eyes to your gifts in today, the big ones and the small ones. Amen.',
  },
  'Romans 8:28 (NLT)': {
    title: 'Woven together for good',
    reflection: [
      'This verse does not say everything is good. Some things are simply painful. It says God is at work in all of it, weaving even the hard threads into something good.',
      'Looking back, many of us can see how a closed door or a hard year shaped us. That memory helps us trust him with the chapter we are in now.',
    ],
    today: 'Remember one hard season God brought you through, and thank him for it.',
    prayer: 'Lord, I trust you to work in all things, even the ones I don’t understand yet. Amen.',
  },
  'John 3:16 (NLT)': {
    title: 'This is how God loved',
    reflection: [
      'Before it is about anything we do, the Christian faith is about what God has done. He loved the world, not in general, but enough to give his Son.',
      'On days we feel unseen or not enough, this is the place to start again. We are loved first, fully and on purpose.',
    ],
    today: 'Spend a moment simply thanking God for his love, without asking for anything.',
    prayer: 'Father, thank you for loving me first and giving your Son for me. Amen.',
  },
  'Psalm 118:24 (NLT)': {
    title: 'This day, as it is',
    reflection: [
      'It is tempting to wait for a better day to be glad: after payday, after the exams, after the rainy season. The psalmist rejoices in this day, the one we actually have.',
      'Joy here is not denial. It is choosing to see today as a gift from God, with its ordinary moments of bread, sunlight and the people around us.',
    ],
    today: 'Do one small thing today purely for joy, and thank God for it.',
    prayer: 'Lord, thank you for today. Help me rejoice in it. Amen.',
  },
  'Proverbs 17:17 (NLT)': {
    title: 'Friends in time of need',
    reflection: [
      'Good friends show up when life falls apart: the ride to the hospital, the meal after a funeral, the call that comes just at the right time.',
      'We all need friends like that, and we can all be one. Loyalty is built in small acts long before the crisis comes.',
    ],
    today: 'Check in on a friend you haven’t talked to in a while.',
    prayer: 'God, thank you for my friends. Make me a loyal friend too. Amen.',
  },
  'Matthew 6:34 (NLT)': {
    title: 'One day at a time',
    reflection: [
      'Many of our worries live in a tomorrow that hasn’t happened yet: what if the money runs out, what if the test results are bad, what if the children struggle.',
      'Jesus doesn’t promise tomorrow will be easy. He invites us to live today with today’s strength, trusting God will give tomorrow’s strength when tomorrow comes.',
    ],
    today: 'When a worry about tomorrow comes up today, pray about it and set it down.',
    prayer: 'Jesus, help me live today well and trust you with tomorrow. Amen.',
  },
  '1 Peter 5:7 (NLT)': {
    title: 'He cares about you',
    reflection: [
      'Some cares are too heavy to carry alone, and some feel too small to mention. Peter says give them all to God, the heavy ones and the little ones.',
      'The reason is simple: he cares about you. Not just about the world or the church, but about you, and about what is weighing on you today.',
    ],
    today: 'Tell God plainly what is on your mind, the big and the small.',
    prayer: 'Father, I hand you my worries today, because you care for me. Amen.',
  },
  'Romans 12:12 (NLT)': {
    title: 'Hope, patience and prayer',
    reflection: [
      'Three short instructions for any season of life. Rejoice, because our hope is sure. Be patient, because trouble doesn’t last for ever. Keep praying, because God is listening.',
      'When a situation at home or in our health drags on, these three keep us steady while we wait.',
    ],
    today: 'Pick one long-running concern and keep praying for it today, even if nothing has changed yet.',
    prayer: 'Lord, keep my hope bright, my heart patient and my prayers going. Amen.',
  },
  'Psalm 46:10 (NLT)': {
    title: 'Be still',
    reflection: [
      'Our days are full of noise: notifications, traffic, news, the hum of our own thoughts. Being still can feel almost impossible.',
      'God invites us to stop and remember who he is. Stillness is not doing nothing. It is making room to know him.',
    ],
    today: 'Sit quietly for two minutes today, breathe slowly and remember that God is God.',
    prayer: 'Lord, quiet my heart so I can know you are near. Amen.',
  },
  'Colossians 3:13 (NLT)': {
    title: 'Making allowance',
    reflection: [
      'Everyone we live with has faults, and so do we. Families, friendships and teams only last when we make room for each other’s weak spots.',
      'Forgiveness is not pretending the hurt didn’t happen. It is choosing not to hold it against the other person, because we have been forgiven far more.',
    ],
    today: 'Is there someone you need to forgive? Take one step toward it today.',
    prayer: 'Lord, as you have forgiven me, help me forgive others. Amen.',
  },
  'Psalm 139:14 (NLT)': {
    title: 'Wonderfully made',
    reflection: [
      'Many of us are hard on ourselves: our looks, our pace, our mistakes. The psalmist looks at himself and gives thanks, because he is God’s workmanship.',
      'You are not an accident or a project to be fixed. You are made with care, by a God who knows you completely and loves you still.',
    ],
    today: 'Thank God for one thing about how he made you.',
    prayer: 'Creator God, thank you for making me. Help me see myself as you do. Amen.',
  },
  'Isaiah 26:3 (NLT)': {
    title: 'Perfect peace',
    reflection: [
      'Peace often feels like something that depends on circumstances: when the house is quiet, when the bills are paid, when the storm has passed.',
      'Isaiah points to a deeper peace that comes from where our thoughts rest. When our minds turn back to God, again and again, he keeps us steady.',
    ],
    today: 'When your mind races today, turn your thoughts to God with a short prayer.',
    prayer: 'Lord, keep my mind fixed on you and my heart in your peace. Amen.',
  },
  'Psalm 133:1 (NLT)': {
    title: 'Living in harmony',
    reflection: [
      'Harmony doesn’t mean everyone is the same. In music it means different notes sounding well together. Families and communities are like that too.',
      'It takes work: listening, apologising, making room. But the psalm says it is worth it: wonderful and pleasant.',
    ],
    today: 'Do one thing today to bring peace to a strained relationship.',
    prayer: 'God of peace, help my family and community live in harmony. Amen.',
  },
  'Romans 15:13 (NLT)': {
    title: 'Overflowing hope',
    reflection: [
      'Paul prays that we would be filled, completely, with joy and peace, so full that hope spills over to others.',
      'We can’t make that by trying harder. It comes from trusting God. And a hopeful person changes the room, at home, among friends and wherever they go.',
    ],
    today: 'Pray this verse for someone by name today.',
    prayer: 'God of hope, fill me with joy and peace, and let it overflow to others. Amen.',
  },
  'Mark 6:31 (NLT)': {
    title: 'Come away and rest',
    reflection: [
      'Jesus noticed his friends were too busy to eat, and his answer was rest. Not more effort, not a better schedule, but a quiet place and time together.',
      'Rest is not laziness. It is how God made us. Sleep, a day off and time with people we love are part of a faithful life.',
    ],
    today: 'Plan one real rest this week and keep it.',
    prayer: 'Jesus, when I am too busy, call me away to rest with you. Amen.',
  },
  'Proverbs 15:1 (NLT)': {
    title: 'A gentle answer',
    reflection: [
      'Arguments at home or online often turn on a single reply. A sharp word adds fuel; a gentle one takes the heat out.',
      'Gentleness is not weakness. It takes strength to answer softly when we feel attacked, and it often opens the door to real understanding.',
    ],
    today: 'The next time you feel provoked today, pause and answer gently.',
    prayer: 'Lord, guard my words and make them gentle. Amen.',
  },
  'Psalm 30:5 (NLT)': {
    title: 'Joy comes with the morning',
    reflection: [
      'There are nights of weeping: hospital corridors, long talks after bad news, silent tears no one else sees. The psalmist does not rush past them.',
      'But the night is not the end. God’s favour lasts a lifetime, and joy comes with the morning, sometimes slowly, but surely.',
    ],
    today: 'If today is a night season for you, tell one trusted person how you are really doing.',
    prayer: 'Lord, in my nights of weeping, hold me until your morning comes. Amen.',
  },
  '3 John 1:2 (NLT)': {
    title: 'Body and spirit',
    reflection: [
      'John prays for his friend’s health as well as his soul. God cares about our bodies: our sleep, our meals, our check-ups, our tired backs.',
      'Looking after our health is not selfish. It is part of caring for the life God gave us, so we can keep loving the people around us.',
    ],
    today: 'Do one thing for your health today: drink water, take a walk, or book that check-up.',
    prayer: 'Father, thank you for my body. Help me care for it, and give health to those who are sick. Amen.',
  },
};

/** The reflection for a verse, if one has been written. */
export const devotionalFor = (reference: string): Devotional | null => DEVOTIONALS[reference] ?? null;
