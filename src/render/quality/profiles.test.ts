import { describe, expect, it } from 'vitest';
import { adjustForFps, initialProfile, profileFromQuery, PROFILE_ORDER, PROFILES } from './profiles';

describe('perfiles gráficos', () => {
  it('render por software o sin WebGL2 → RENDIMIENTO', () => {
    expect(initialProfile({ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', webgl2: true, cores: 16, memoryGB: 32 })).toBe('rendimiento');
    expect(initialProfile({ renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)', webgl2: true })).toBe('rendimiento');
    expect(initialProfile({ webgl2: false, cores: 16 })).toBe('rendimiento');
  });

  it('nunca arranca en ULTRA y es prudente en móviles', () => {
    expect(initialProfile({ webgl2: true, cores: 32, memoryGB: 64, maxTextureSize: 32768 })).toBe('alto');
    expect(initialProfile({ webgl2: true, cores: 8, memoryGB: 4, mobile: true })).not.toBe('alto');
    expect(initialProfile({ webgl2: true })).toBe('equilibrado');
  });

  it('ajuste por FPS medidos: un escalón cada vez y como máximo ALTO', () => {
    expect(adjustForFps('alto', 20)).toBe('equilibrado');
    expect(adjustForFps('rendimiento', 10)).toBe('rendimiento');
    expect(adjustForFps('equilibrado', 60)).toBe('alto');
    expect(adjustForFps('alto', 120)).toBe('alto');
    expect(adjustForFps('equilibrado', 45)).toBe('equilibrado');
  });

  it('parámetro de URL compatible con etapas previas', () => {
    expect(profileFromQuery('alta')).toBe('alto');
    expect(profileFromQuery('MEDIA')).toBe('equilibrado');
    expect(profileFromQuery('baja')).toBe('rendimiento');
    expect(profileFromQuery('ultra')).toBe('ultra');
    expect(profileFromQuery('x')).toBeNull();
    expect(profileFromQuery(null)).toBeNull();
  });

  it('los perfiles están ordenados por coste', () => {
    const cost = (p: (typeof PROFILE_ORDER)[number]) => PROFILES[p].shadowMapSize * (PROFILES[p].shadows ? 1 : 0) + PROFILES[p].particles * 1000 + PROFILES[p].flameSteps;
    for (let i = 1; i < PROFILE_ORDER.length; i++) expect(cost(PROFILE_ORDER[i])).toBeGreaterThan(cost(PROFILE_ORDER[i - 1]));
  });
});
