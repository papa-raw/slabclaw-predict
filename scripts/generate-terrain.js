import Replicate from 'replicate';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const replicate = new Replicate();
const OUT = './frontend/public/assets/terrain';

const TERRAINS = {
  forest: 'dark enchanted forest floor, ancient twisted roots, glowing bioluminescent mushrooms, moss-covered ground, top-down aerial view, dark fantasy painterly style, moody green and black palette, game terrain tile, seamless texture',
  desert: 'dark mystical desert sand dunes, faint golden spirit energy in the sand, cracked earth, scattered ancient bones, top-down aerial view, dark fantasy painterly style, warm amber and shadow palette, game terrain tile, seamless texture',
  ocean: 'deep dark ocean surface, bioluminescent creatures visible below, dark swirling water, subtle teal glow from depths, top-down aerial view, dark fantasy painterly style, deep indigo and cyan palette, game terrain tile, seamless texture',
  mountain: 'dark craggy mountain peaks, grey stone with crystal formations, snow-dusted obsidian rock, faint ethereal mist, top-down aerial view, dark fantasy painterly style, cool grey and silver palette, game terrain tile, seamless texture',
  grassland: 'dark mystical grassland, tall grass swaying, faint spirit wisps floating above, ancient stone circle partially hidden, top-down aerial view, dark fantasy painterly style, deep green and shadow palette, game terrain tile, seamless texture',
  tundra: 'frozen dark tundra, cracked ice sheets, aurora borealis reflection on ice, ancient frozen ruins beneath, top-down aerial view, dark fantasy painterly style, ice blue and dark purple palette, game terrain tile, seamless texture',
  volcanic: 'volcanic hellscape, glowing magma cracks in obsidian rock, ember particles rising, molten lava veins pulsing, top-down aerial view, dark fantasy painterly style, deep red and black palette, game terrain tile, seamless texture',
  coastal: 'dark mystical coastline, where dark water meets rocky shore, bioluminescent tide pools, weathered driftwood, top-down aerial view, dark fantasy painterly style, teal and dark stone palette, game terrain tile, seamless texture',
};

async function generateTerrain(name, prompt) {
  const path = `${OUT}/${name}.webp`;
  if (existsSync(path)) {
    console.log(`  [skip] ${name} — already exists`);
    return;
  }

  console.log(`  [gen] ${name}...`);
  try {
    const output = await replicate.run('black-forest-labs/flux-schnell', {
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'webp',
        output_quality: 90,
      },
    });

    const url = output[0]?.url?.() || output[0];
    if (!url) throw new Error('No output URL');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path, buf);
    console.log(`  [done] ${name} — ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('Generating terrain tiles via Replicate Flux (sequential, 12s delay)...\n');
const entries = Object.entries(TERRAINS);
for (const [name, prompt] of entries) {
  await generateTerrain(name, prompt);
  await new Promise(r => setTimeout(r, 12000));
}
console.log('\nDone.');
