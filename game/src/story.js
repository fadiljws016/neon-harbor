// story.js — the words. Madame Volt talks like the harbour is listening,
// because in Bahía Noche it usually is.

export const VOLT = { name: 'Madame Volt', color: '#ff4fa3', tag: 'MV' };
export const ROCCO = { name: 'Rocco "Rayo" Vidal', color: '#57d7e8', tag: 'RR' };
export const INES = { name: 'Inés "La Red" Mora', color: '#ffb35e', tag: 'IM' };
export const PDP = { name: 'PDP Dispatch', color: '#9fc4e8', tag: 'PDP' };

export const DIALOGUES = {
  intro: [
    { who: VOLT, text: 'Rayo. You came back to my city smelling of rain and bad decisions.' },
    { who: ROCCO, text: 'And if quiet is not on the menu, Madame?' },
    { who: VOLT, text: 'Then we order loud. A container sleeps at the marina with my name misspelled on it. Fetch it before the PDP learn to read.' },
    { who: ROCCO, text: 'Consider it already moving.' },
  ],
  cargo_done: [
    { who: VOLT, text: 'Pretty work. The Strip is paying double tonight — go be somebody\'s bad idea at speed.' },
  ],
  strip_done: [
    { who: INES, text: 'You drive like the road owes you money, Rayo. The shipyard crews are hiring guns, not drivers. Tonight you are both.' },
  ],
  ambush_done: [
    { who: VOLT, text: 'Alive, then. Drink something warm. The rain over Alto Mirador is hiding a friend of mine — go check on her.' },
  ],
  rain_done: [
    { who: INES, text: 'The warehouse kings crowned themselves while you played umbrella. Time to knock the crowns off, one dock at a time.' },
  ],
  kings_done: [
    { who: VOLT, text: 'We need to talk about my debt, Rayo. Not the money kind. The kind with a funeral scheduled.' },
  ],
  debt_done: [
    { who: PDP, text: 'All units: citywide blackout in effect. The harbour is dark and so are we.' },
    { who: VOLT, text: 'Dark is just neon with its eyes closed. Move, Rayo.' },
  ],
  blackout_done: [
    { who: INES, text: 'LUCERO-1 is hunting on a full tank and a grudge. Ground it, and the night is ours again.' },
  ],
  finale: [
    { who: VOLT, text: 'The harbour sleeps, the Sirena sign still burns, and you are still standing. That is the whole recipe, Rayo.' },
    { who: ROCCO, text: 'Same time tomorrow, Madame?' },
    { who: VOLT, text: 'In Bahía Noche, there is only ever tonight.' },
  ],
};

export function dialogueFor(key) {
  return DIALOGUES[key] || null;
}
