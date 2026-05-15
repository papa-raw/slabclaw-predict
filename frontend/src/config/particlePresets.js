/**
 * Anima Swarm -- Ambient Particle Presets
 * One preset per terrain type for tsParticles
 *
 * Usage:
 *   import { getParticlePreset } from '../config/particlePresets';
 *   <Particles options={getParticlePreset('sacred-grove')} />
 */

const baseConfig = {
  fullScreen: false,
  background: { color: 'transparent' },
  detectRetina: true,
  fpsLimit: 60,
};

const presets = {
  'sacred-grove': {
    ...baseConfig,
    particles: {
      number: { value: 35 },
      color: { value: ['#4ade80', '#fbbf24', '#22c55e'] },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.15, max: 0.7 },
        animation: { enable: true, speed: 0.4, minimumValue: 0.1, sync: false },
      },
      size: {
        value: { min: 1, max: 4 },
        animation: { enable: true, speed: 0.8, minimumValue: 0.5, sync: false },
      },
      move: {
        enable: true,
        speed: 0.3,
        direction: 'top',
        outModes: 'out',
        random: true,
        straight: false,
      },
      shadow: { enable: true, color: '#4ade80', blur: 8 },
    },
  },

  'volcanic-rift': {
    ...baseConfig,
    particles: {
      number: { value: 40 },
      color: { value: ['#ef4444', '#f97316', '#fbbf24'] },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.2, max: 0.9 },
        animation: { enable: true, speed: 1.2, minimumValue: 0.1, sync: false },
      },
      size: {
        value: { min: 1, max: 3 },
        animation: { enable: true, speed: 2, minimumValue: 0.3, sync: false },
      },
      move: {
        enable: true,
        speed: 0.8,
        direction: 'top',
        outModes: 'out',
        random: true,
        straight: false,
        gravity: { enable: false },
      },
      shadow: { enable: true, color: '#f97316', blur: 6 },
      life: {
        duration: { value: 3, sync: false },
        count: 0,
      },
    },
  },

  'crystal-cavern': {
    ...baseConfig,
    particles: {
      number: { value: 25 },
      color: { value: ['#818cf8', '#e879f9', '#c084fc', '#67e8f9'] },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.1, max: 0.6 },
        animation: { enable: true, speed: 0.3, minimumValue: 0.05, sync: false },
      },
      size: {
        value: { min: 1.5, max: 5 },
        animation: { enable: true, speed: 0.5, minimumValue: 1, sync: false },
      },
      move: {
        enable: true,
        speed: 0.15,
        direction: 'none',
        outModes: 'bounce',
        random: true,
        straight: false,
      },
      rotate: {
        value: { min: 0, max: 360 },
        animation: { enable: true, speed: 2, sync: false },
      },
      shadow: { enable: true, color: '#e879f9', blur: 12 },
    },
  },

  'deep-marsh': {
    ...baseConfig,
    particles: {
      number: { value: 20 },
      color: { value: ['#22d3ee', '#a3e635', '#2dd4bf'] },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.1, max: 0.5 },
        animation: { enable: true, speed: 0.25, minimumValue: 0.05, sync: false },
      },
      size: {
        value: { min: 2, max: 6 },
        animation: { enable: true, speed: 0.3, minimumValue: 1.5, sync: false },
      },
      move: {
        enable: true,
        speed: 0.2,
        direction: 'right',
        outModes: 'out',
        random: true,
        straight: false,
      },
      shadow: { enable: true, color: '#22d3ee', blur: 10 },
    },
  },

  'spirit-desert': {
    ...baseConfig,
    particles: {
      number: { value: 30 },
      color: { value: ['#fbbf24', '#f5f5f4', '#d4a052'] },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.1, max: 0.4 },
        animation: { enable: true, speed: 0.6, minimumValue: 0.05, sync: false },
      },
      size: {
        value: { min: 0.5, max: 2 },
        animation: { enable: false },
      },
      move: {
        enable: true,
        speed: 1.2,
        direction: 'left',
        outModes: 'out',
        random: true,
        straight: false,
      },
      shadow: { enable: true, color: '#fbbf24', blur: 4 },
    },
  },

  'frozen-tundra': {
    ...baseConfig,
    particles: {
      number: { value: 35 },
      color: { value: ['#e2e8f0', '#818cf8', '#cbd5e1'] },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.2, max: 0.6 },
        animation: { enable: true, speed: 0.2, minimumValue: 0.1, sync: false },
      },
      size: {
        value: { min: 1, max: 3.5 },
        animation: { enable: true, speed: 0.4, minimumValue: 0.5, sync: false },
      },
      move: {
        enable: true,
        speed: 0.4,
        direction: 'bottom',
        outModes: 'out',
        random: true,
        straight: false,
      },
      wobble: {
        enable: true,
        distance: 10,
        speed: 3,
      },
      shadow: { enable: true, color: '#818cf8', blur: 6 },
    },
  },

  'void-scar': {
    ...baseConfig,
    particles: {
      number: { value: 20 },
      color: { value: ['#7c3aed', '#a855f7', '#1e1b4b'] },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.1, max: 0.8 },
        animation: { enable: true, speed: 0.8, minimumValue: 0, sync: false },
      },
      size: {
        value: { min: 1, max: 3 },
        animation: { enable: true, speed: 1.5, minimumValue: 0.3, sync: false },
      },
      move: {
        enable: true,
        speed: 0.5,
        direction: 'inside',
        outModes: 'destroy',
        random: false,
        straight: false,
        attract: { enable: true, rotateX: 600, rotateY: 600 },
      },
      shadow: { enable: true, color: '#a855f7', blur: 14 },
    },
  },
};

/**
 * Get particle preset config for a terrain type
 * @param {string} terrainType - One of: sacred-grove, volcanic-rift, crystal-cavern,
 *                               deep-marsh, spirit-desert, frozen-tundra, void-scar
 * @returns {object} tsParticles config object
 */
export function getParticlePreset(terrainType) {
  return presets[terrainType] || presets['sacred-grove'];
}

/**
 * Get all terrain type names
 * @returns {string[]}
 */
export function getTerrainTypes() {
  return Object.keys(presets);
}

export default presets;
