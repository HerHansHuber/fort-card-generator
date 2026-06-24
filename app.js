const THEMES = {
  castle: { label: 'Castle', icon: '🏰', places: ['royal reading room', 'dragon lookout', 'knight training hall'] },
  space: { label: 'Space station', icon: '🚀', places: ['moon lab', 'comet shelter', 'alien welcome dock'] },
  jungle: { label: 'Jungle base', icon: '🌿', places: ['rainforest lookout', 'animal rescue hut', 'hidden waterfall camp'] },
  ocean: { label: 'Ocean cave', icon: '🌊', places: ['submarine cave', 'coral tunnel', 'mermaid map room'] },
  dino: { label: 'Dinosaur dig', icon: '🦖', places: ['fossil tent', 'raptor-safe hideout', 'volcano research base'] },
  reading: { label: 'Cozy reading den', icon: '📚', places: ['book nook', 'story cave', 'quiet cloud fort'] }
};

const MATERIALS = {
  blankets: 'blankets',
  pillows: 'pillows',
  chairs: 'chairs',
  cardboard: 'cardboard boxes',
  clothespins: 'clothespins or clips',
  lights: 'a torch or battery string lights',
  books: 'heavy books used only as floor weights',
  cushions: 'sofa cushions'
};

const MISSIONS = [
  'Build a doorway that can open and close without the roof falling down.',
  'Make one secret window and explain what it is used for.',
  'Create a two-room fort with a quiet zone and an adventure zone.',
  'Design a roof that stays up after three gentle pillow taps.',
  'Add a sign, flag, or symbol that shows who lives in the fort.',
  'Make the inside comfortable enough for a 10-minute story break.',
  'Build a tunnel entrance that a stuffed animal can travel through.',
  'Invent a fort rule that keeps everyone safe and kind.'
];

const STEM = [
  'Test one change: move a support, then compare which version is sturdier.',
  'Count how many contact points touch the floor. More points usually means more stability.',
  'Find the widest triangle shape in the fort. Triangles help structures stay strong.',
  'Try a low roof and a high roof. Which one sags less?',
  'Use gentle airflow from a hand fan. What part moves first?',
  'Measure the longest wall with footsteps, books, or hand spans.'
];

const STORY = [
  'Who needs this shelter before sunset, and what are they carrying?',
  'A tiny visitor knocks on the entrance. What do they ask for?',
  'The fort has one magic button. What happens when it is pressed?',
  'A map is hidden inside. Where does it lead?',
  'The weather changes outside the fort. What problem must the builders solve?',
  'The fort receives a message from another world. What does it say?'
];

const CALM = [
  'Add a soft corner for breathing, reading, or squeezing a pillow.',
  'Choose a password that is kind, silly, and easy to remember.',
  'Take a builder break: three slow breaths before adding the roof.',
  'Use quiet voices inside for one minute and notice how the fort feels.'
];

const ACTIVE = [
  'Create a delivery route around the fort without touching the walls.',
  'Time a 30-second rescue mission for three stuffed animals.',
  'Add a safe obstacle path leading to the entrance.',
  'Do a builder parade around the outside before the final inspection.'
];

const SAFETY = [
  'Keep faces uncovered and leave an air gap.',
  'No heavy objects above heads.',
  'Ask a grown-up before using lights, high furniture, or outdoor sticks.',
  'Keep climbing feet on the floor unless a grown-up says otherwise.'
];

function hashSeed(input) {
  const text = String(input || 'fort').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed) {
  let value = hashSeed(seed) || 1;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function sample(list, random, count) {
  const copy = [...list];
  const output = [];
  while (copy.length && output.length < count) {
    output.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return output;
}

function titleCase(text) {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function generateCards(options = {}) {
  const count = Math.min(Math.max(Number(options.count) || 4, 1), 12);
  const selectedMaterials = (options.materials && options.materials.length ? options.materials : ['blankets', 'pillows', 'chairs'])
    .map((key) => MATERIALS[key] || key);
  const random = rng(`${options.seed || Date.now()}|${options.age}|${options.space}|${options.energy}|${selectedMaterials.join(',')}`);
  const themeKeys = Object.keys(THEMES);
  const cards = [];

  for (let index = 0; index < count; index += 1) {
    const themeKey = options.theme && options.theme !== 'surprise' ? options.theme : pick(themeKeys, random);
    const theme = THEMES[themeKey] || THEMES.castle;
    const place = pick(theme.places, random);
    const energyPrompt = options.energy === 'active' ? pick(ACTIVE, random) : options.energy === 'calm' ? pick(CALM, random) : pick([...CALM, ...ACTIVE], random);
    const ageTwist = options.age === 'preschool'
      ? 'Grown-up helper: offer two choices and keep the build under 15 minutes.'
      : options.age === 'older'
        ? 'Upgrade: draw a quick floor plan before rebuilding a stronger version.'
        : 'Builder tip: inspect, improve, then explain what changed.';
    const spaceTwist = options.space === 'outdoor'
      ? 'Outdoor note: check for mud, bugs, sharp sticks, and weather first.'
      : options.space === 'tiny'
        ? 'Tiny-space note: build low, leave walking paths clear, and use fewer supports.'
        : 'Indoor note: protect furniture and keep exits clear.';

    cards.push({
      number: index + 1,
      theme: theme.label,
      icon: theme.icon,
      title: `${titleCase(place)} Mission`,
      mission: pick(MISSIONS, random),
      materials: sample(selectedMaterials, random, Math.min(4, selectedMaterials.length)),
      stem: pick(STEM, random),
      story: pick(STORY, random),
      energy: energyPrompt,
      ageTwist,
      spaceTwist,
      safety: pick(SAFETY, random)
    });
  }

  return cards;
}

function getOptionsFromForm() {
  return {
    age: document.querySelector('#age').value,
    space: document.querySelector('#space').value,
    energy: document.querySelector('#energy').value,
    theme: document.querySelector('#theme').value,
    count: document.querySelector('#count').value,
    seed: document.querySelector('#seed').value || new Date().toISOString().slice(0, 10),
    materials: [...document.querySelectorAll('#materials input:checked')].map((input) => input.value)
  };
}

function setFormFromUrl() {
  const params = new URLSearchParams(window.location.search);
  for (const id of ['age', 'space', 'energy', 'theme', 'count', 'seed']) {
    if (params.has(id)) document.querySelector(`#${id}`).value = params.get(id);
  }
  if (params.has('materials')) {
    const selected = new Set(params.get('materials').split(',').filter(Boolean));
    document.querySelectorAll('#materials input').forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }
}

function cardTemplate(card) {
  return `
    <article class="card">
      <span class="card__theme">${card.icon} ${card.theme} #${card.number}</span>
      <h3>${card.title}</h3>
      <p><strong>Mission:</strong> ${card.mission}</p>
      <p class="card__label">Use</p>
      <ul>${card.materials.map((item) => `<li>${item}</li>`).join('')}</ul>
      <p class="card__label">Try this</p>
      <p>${card.stem}</p>
      <p class="card__label">Story spark</p>
      <p>${card.story}</p>
      <p class="card__label">Movement / mood</p>
      <p>${card.energy}</p>
      <p class="card__label">Build notes</p>
      <p>${card.ageTwist} ${card.spaceTwist}</p>
      <p><strong>Safety:</strong> ${card.safety}</p>
    </article>`;
}

function render() {
  const options = getOptionsFromForm();
  const cards = generateCards(options);
  document.querySelector('#cards').innerHTML = cards.map(cardTemplate).join('');
  const params = new URLSearchParams({
    age: options.age,
    space: options.space,
    energy: options.energy,
    theme: options.theme,
    count: String(options.count),
    seed: options.seed,
    materials: options.materials.join(',')
  });
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

function setup() {
  setFormFromUrl();
  document.querySelector('#generator-form').addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });
  document.querySelector('#randomize').addEventListener('click', () => {
    document.querySelector('#seed').value = Math.random().toString(36).slice(2, 10);
    render();
  });
  document.querySelector('#print').addEventListener('click', () => window.print());
  document.querySelector('#copy-link').addEventListener('click', async () => {
    await navigator.clipboard.writeText(window.location.href);
    document.querySelector('#copy-link').textContent = 'Copied!';
    setTimeout(() => { document.querySelector('#copy-link').textContent = 'Copy share link'; }, 1400);
  });
  render();
}

if (typeof document !== 'undefined') setup();
