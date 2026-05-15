#!/usr/bin/env node
/**
 * Anima Swarm -- Asset Generation Script
 * Generates terrain textures and spirit portraits via Replicate (Flux 1.1 Pro)
 *
 * Usage:
 *   node scripts/generate-assets.mjs [--terrain] [--spirits] [--all]
 *
 * Requires REPLICATE_API_TOKEN in environment (sourced from ~/.zshenv)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const ASSETS_DIR = join(PROJECT_ROOT, 'frontend', 'public', 'assets');

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const STYLE_PREFIX =
  'painterly illustration in the style of illuminated manuscripts and bioluminescent fantasy, ' +
  'watercolor wash textures with fine ink linework, rich deep colors with glowing accents, ' +
  'hand-drawn quality with slight texture grain, mythic ancient aesthetic, dark background';

const TERRAIN_PREFIX =
  'top-down hexagonal terrain tile for a strategy game, ' +
  STYLE_PREFIX +
  ', seamless edges, flat perspective looking straight down';

const CREATURE_PREFIX =
  'character portrait illustration, bust and shoulders view, three-quarter angle, dark background, ' +
  'painterly style with ink linework and selective cel-shading, bioluminescent rim lighting, ' +
  'mythic fantasy creature, strong silhouette, rich detail';

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const TERRAIN_PROMPTS = {
  'sacred-grove': `${TERRAIN_PREFIX}, ancient sacred forest grove, massive twisted tree roots with bioluminescent moss, golden firefly light scattered among dark emerald canopy, mushrooms with soft green glow at base, rich dark green and amber palette, spirit energy wisps floating between branches`,

  'volcanic-rift': `${TERRAIN_PREFIX}, volcanic rift terrain with cracked obsidian surface, glowing magma veins cutting through dark basalt rock, red and orange embers rising from fissures, smoke wisps at edges, molten lava glow illuminating jagged terrain, black and crimson palette`,

  'crystal-cavern': `${TERRAIN_PREFIX}, crystal cavern surface seen from above, clusters of translucent amethyst and quartz crystals emerging from dark stone, prismatic light refractions creating rainbow accents, deep indigo base with pink and violet crystal glow, geometric crystal facets catching light`,

  'deep-marsh': `${TERRAIN_PREFIX}, murky swamp marsh terrain, dark teal-green stagnant water with floating lily pads, phosphorescent algae creating cyan glow patterns, gnarled roots breaking the surface, fog wisps hovering above water, mysterious and eerie atmosphere`,

  'spirit-desert': `${TERRAIN_PREFIX}, ancient spirit desert with bone-white sand dunes, weathered stone ruins partially buried, amber spirit fire flickering above sand, wind-carved patterns in pale stone, scattered ancient glyphs with faint golden glow, warm desert tones with supernatural amber accents`,

  'frozen-tundra': `${TERRAIN_PREFIX}, frozen tundra ice field, pale blue-grey permafrost with cracks revealing deep blue ice beneath, delicate frost crystal patterns, aurora borealis reflections on ice surface casting purple and indigo hues, sparse frozen vegetation with ice crystals, cold ethereal atmosphere`,

  'void-scar': `${TERRAIN_PREFIX}, otherworldly void scar terrain, absolute darkness with fractures revealing violet rift energy beneath the surface, reality-warping distortion at edges, dark matter particles floating upward, eldritch geometric patterns in the cracks, deep black and electric purple palette, unsettling and alien`,
};

const SPIRIT_PROMPTS = {
  'ember-wyrm': `${CREATURE_PREFIX}, ember wyrm creature portrait, serpentine dragon with elongated neck and flickering flame mane, scales that shift from obsidian black to molten orange at the edges, eyes like twin furnaces burning amber-gold, wisps of smoke and ember particles rising from its body, internal glow visible through scale gaps like magma beneath stone, warm red and orange bioluminescent accents, fierce and ancient expression`,

  'moss-golem': `${CREATURE_PREFIX}, moss golem creature portrait, massive hulking figure made of ancient stone and living wood, face formed from gnarled bark with deep-set eyes glowing soft emerald green, thick moss and ferns growing across shoulders and head like a crown, bioluminescent mushrooms sprouting from joints and crevices casting warm golden light, roots and vines winding around its form, patient and wise expression, earth tones with green and amber glow accents`,

  'tide-wraith': `${CREATURE_PREFIX}, tide wraith creature portrait, ethereal aquatic spirit with translucent flowing form, face partially visible through swirling water and mist, eyes like deep ocean bioluminescence in piercing cyan, trailing tentacle-like appendages made of concentrated sea foam and current, barnacles and coral fragments embedded in its shifting form, cold teal and deep blue palette with bright cyan glow accents, haunting and mysterious expression`,

  'storm-raptor': `${CREATURE_PREFIX}, storm raptor creature portrait, majestic predatory bird with massive wingspan folded behind, feathers crackling with static electricity at the tips, eyes like ball lightning in brilliant white-violet, crown of storm cloud formations swirling above its head, talons visible at shoulder level with arcing electricity between them, plumage shifting from slate grey to electric purple, charged atmosphere around it, proud and fierce expression, violet and white bioluminescent accents`,

  'void-oracle': `${CREATURE_PREFIX}, void oracle creature portrait, enigmatic floating entity with an elongated skull-like head, multiple eyes arranged asymmetrically each glowing different shade of violet, body dissolving into dark matter particles at the edges, reality warping subtly around its form, ancient glyphs and sigils orbiting its head in slow rotation, robes or wrappings made of solidified darkness with purple rift energy bleeding through tears, unsettling cosmic wisdom in its gaze, deep black and electric violet palette`,
};

// ---------------------------------------------------------------------------
// Replicate API
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.replicate.com/v1';
const MODEL = 'black-forest-labs/flux-1.1-pro';

async function createPrediction(prompt) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not set. Source ~/.zshenv first.');

  const res = await fetch(`${API_BASE}/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',  // Synchronous mode -- waits for completion (up to 60s)
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '1:1',
        output_format: 'png',
        safety_tolerance: 5,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Replicate API error ${res.status}: ${body}`);
  }

  const prediction = await res.json();

  // If synchronous mode returned completed prediction
  if (prediction.status === 'succeeded' && prediction.output) {
    return prediction.output;
  }

  // Otherwise poll
  return pollPrediction(prediction.id);
}

async function pollPrediction(id) {
  const token = process.env.REPLICATE_API_TOKEN;
  const maxAttempts = 60;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${API_BASE}/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const prediction = await res.json();

    if (prediction.status === 'succeeded') return prediction.output;
    if (prediction.status === 'failed') throw new Error(`Prediction failed: ${prediction.error}`);
    if (prediction.status === 'canceled') throw new Error('Prediction canceled');
  }

  throw new Error('Prediction timed out');
}

async function downloadImage(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log(`  Saved: ${outPath}`);
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

async function generateTerrains() {
  const dir = join(ASSETS_DIR, 'terrain');
  console.log('\n=== Generating Terrain Textures ===\n');

  for (const [name, prompt] of Object.entries(TERRAIN_PROMPTS)) {
    const outPath = join(dir, `${name}.png`);
    if (existsSync(outPath)) {
      console.log(`  Skipping ${name} (already exists)`);
      continue;
    }

    console.log(`  Generating: ${name}...`);
    try {
      const output = await createPrediction(prompt);
      const imageUrl = typeof output === 'string' ? output : output[0] || output;
      await downloadImage(imageUrl, outPath);
    } catch (err) {
      console.error(`  FAILED ${name}: ${err.message}`);
    }
  }
}

async function generateSpirits() {
  const dir = join(ASSETS_DIR, 'spirits');
  console.log('\n=== Generating Spirit Portraits ===\n');

  for (const [name, prompt] of Object.entries(SPIRIT_PROMPTS)) {
    const outPath = join(dir, `${name}.png`);
    if (existsSync(outPath)) {
      console.log(`  Skipping ${name} (already exists)`);
      continue;
    }

    console.log(`  Generating: ${name}...`);
    try {
      const output = await createPrediction(prompt);
      const imageUrl = typeof output === 'string' ? output : output[0] || output;
      await downloadImage(imageUrl, outPath);
    } catch (err) {
      console.error(`  FAILED ${name}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const doAll = args.includes('--all') || args.length === 0;
const doTerrain = doAll || args.includes('--terrain');
const doSpirits = doAll || args.includes('--spirits');

console.log('Anima Swarm Asset Generator');
console.log(`Model: ${MODEL}`);
console.log(`Output: ${ASSETS_DIR}`);

if (doTerrain) await generateTerrains();
if (doSpirits) await generateSpirits();

console.log('\nDone.');
