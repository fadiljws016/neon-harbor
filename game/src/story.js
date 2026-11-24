// story.js — the people and the eight jobs of Bahía Noche. Rocco runs
// packages for Madame Volt; Bruno the crane boss wants the docks; La
// Sombra wants them both gone.

const CHARACTERS = {
  rocco: { name: 'Rocco "Rayo" Vidal', color: 0x2ad4e8, role: 'Dock courier' },
  volt: { name: 'Madame Volt', color: 0xff4fa3, role: 'Fixer, Club Sirena' },
  bruno: { name: 'Bruno "The Crane"', color: 0xff7847, role: 'Astillero boss' },
  sombra: { name: 'La Sombra', color: 0x8a93a8, role: 'Unknown' },
  tito: { name: 'Tito', color: 0xd8402e, role: 'Red shirt, Volt loyalist' },
};

// Stage types: goto / steal / deliverCar / timed / escape / fight / race /
// fare / takedown. `at` is the objective point; the engine reads them in
// order. Dialogue lines: {who, text}.
const MISSIONS = [
  {
    title: 'Midnight Cargo', giver: 'volt',
    intro: [
      { who: 'volt', text: 'Rocco. A blue-top sedan sits outside Bar Órbita with my cargo in the trunk. Its owner owes me. Bring it to the garage — quietly, if you can.' },
      { who: 'rocco', text: 'And if quiet is not on the menu?' },
      { who: 'volt', text: 'Then be loud somewhere else, cariño. Not on my street.' },
    ],
    stages: [
      { type: 'goto', at: 'sirena', objective: 'Head to Club Sirena on La Franja', next: 'Madame Volt is waiting under the sign' },
      { type: 'steal', at: 'raceStart', objective: 'Take the owed sedan by the boulevard', next: 'It is parked by Bar Órbita' },
      { type: 'deliverCar', at: 'garage', objective: 'Deliver the sedan to the Muelle garage', next: 'Tito takes it from there' },
      { type: 'escape', at: 'marinaGate', objective: 'Lose the patrol at the marina gate', next: 'Gone and forgotten' },
    ],
    reward: { cash: 400, respect: 40 },
  },
  {
    title: 'Strip Run', giver: 'volt',
    intro: [
      { who: 'volt', text: 'A Volt GT, my colours, my rules: run the strip end to end before the clock eats you. The boulevard is fastest.' },
    ],
    stages: [
      { type: 'goto', at: 'raceStart', objective: 'Reach the race start on the boulevard', next: 'The GT is warmed up' },
      { type: 'race', at: 'marinaGate', objective: 'Race the load to the marina gate', next: 'Beat the clock — the boulevard is fastest' },
      { type: 'timed', at: 'sirena', objective: 'Bring the GT back to Sirena', next: 'Volt is watching the door' },
    ],
    reward: { cash: 650, respect: 80 },
  },
  {
    title: 'Shipyard Ambush', giver: 'bruno',
    intro: [
      { who: 'bruno', text: 'You run for Volt, you bleed for Volt. My yard, midnight — bring her strongbox or bring her apologies.' },
      { who: 'rocco', text: 'I will bring her the yard, Bruno. Keep the cranes warm.' },
    ],
    stages: [
      { type: 'goto', at: 'containerYard', objective: 'Enter the Astillero container yard', next: 'Bruno\'s boys are waiting' },
      { type: 'fight', at: 'containerYard', objective: 'Survive the ambush in the yard', next: 'Shake any heat from the gunfight' },
      { type: 'escape', at: 'pdp', objective: 'Shake the PDP near the station', next: 'Gone and forgotten, like the strongbox' },
    ],
    reward: { cash: 900, respect: 120 },
  },
  {
    title: 'Rain Check', giver: 'volt',
    intro: [
      { who: 'volt', text: 'Fares, Rocco. Honest money, wet streets. Three pickups before the rain washes the night clean.' },
    ],
    stages: [
      { type: 'fare', at: 'mercado', objective: 'Pick up the fare at Mercado Nocturno', next: 'She is under the orange sign' },
      { type: 'fare', at: 'hospital', objective: 'Drop the nurse at the hospital', next: 'Quick, she is on shift' },
      { type: 'fare', at: 'lighthouse', objective: 'Take the keeper out to Isla Faro', next: 'Mind the quay road' },
    ],
    reward: { cash: 520, respect: 90 },
  },
  {
    title: 'Warehouse Kings', giver: 'sombra',
    intro: [
      { who: 'sombra', text: 'Two kings, one warehouse district. Bruno stores his teeth in the Mercado sheds. Take them. All of them.' },
    ],
    stages: [
      { type: 'goto', at: 'mercado', objective: 'Reach the Mercado sheds', next: 'The sheds are guarded' },
      { type: 'takedown', at: 'mercado', objective: 'Clear the warehouse guard', next: 'Every last one' },
      { type: 'deliverCar', at: 'garage', objective: 'Bring the loaded truck to the garage', next: 'Tito unloads, no questions' },
    ],
    reward: { cash: 1200, respect: 160 },
  },
  {
    title: 'Sirena\'s Debt', giver: 'volt',
    intro: [
      { who: 'volt', text: 'The PDP captain eats at my tables and bills my girls. Tonight the bill comes due, Rocco. His cruiser. My harbour. Your hands.' },
    ],
    stages: [
      { type: 'steal', at: 'pdp', objective: 'Steal the captain\'s cruiser at the PDP station', next: 'They will notice. Run.' },
      { type: 'escape', at: 'marina', objective: 'Lose the PDP at the marina docks', next: 'Between the boats, cariño' },
      { type: 'deliverCar', at: 'sirena', objective: 'Park the cruiser behind Club Sirena', next: 'A trophy for the alley' },
    ],
    reward: { cash: 1100, respect: 180 },
  },
  {
    title: 'Blackout', giver: 'sombra',
    intro: [
      { who: 'sombra', text: 'When the grid dies, the harbour belongs to whoever still has headlights. That will be you. Be at the substation when I kill the lights.' },
    ],
    stages: [
      { type: 'goto', at: 'cranes', objective: 'Reach the Astillero cranes', next: 'Wait for the dark' },
      { type: 'timed', at: 'mercado', objective: 'Run the blackout route to Mercado', next: 'Headlights only. No brakes.' },
      { type: 'fight', at: 'mercado', objective: 'Hold the Mercado corner', next: 'Bruno sends his answer' },
    ],
    reward: { cash: 1500, respect: 220 },
  },
  {
    title: 'Lucero Down', giver: 'volt',
    intro: [
      { who: 'volt', text: 'LUCERO-1 has watched my harbour for the last time. Draw her low over the yard, Rocco — and end the eye in the sky.' },
    ],
    stages: [
      { type: 'goto', at: 'containerYard', objective: 'Draw LUCERO-1 over the container yard', next: 'Get her attention. All of it.' },
      { type: 'takedown', at: 'containerYard', objective: 'Bring the fight to the yard crew', next: 'No witnesses under the cranes' },
      { type: 'escape', at: 'lighthouse', objective: 'Vanish to Isla Faro', next: 'The light will hide you' },
    ],
    reward: { cash: 2400, respect: 350 },
  },
];
