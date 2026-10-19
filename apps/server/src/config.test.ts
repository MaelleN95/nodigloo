import { describe, expect, it } from '@jest/globals';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('utilise les valeurs par défaut quand rien n\'est défini', () => {
    expect(loadConfig({})).toEqual({
      port: 3001,
      allowedOrigins: ['http://localhost:8080'],
      nodeEnv: 'development',
    });
  });

  it('lit le port et le mode d\'exécution', () => {
    const config = loadConfig({ PORT: '4000', NODE_ENV: 'production' });

    expect(config.port).toBe(4000);
    expect(config.nodeEnv).toBe('production');
  });

  it('découpe la liste des origines et ignore les espaces et les vides', () => {
    const config = loadConfig({
      CLIENT_ORIGINS: ' http://a.test , http://b.test,, ',
    });

    expect(config.allowedOrigins).toEqual(['http://a.test', 'http://b.test']);
  });

  it('refuse un port invalide', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('PORT invalide');
    expect(() => loadConfig({ PORT: '0' })).toThrow('PORT invalide');
    expect(() => loadConfig({ PORT: '70000' })).toThrow('PORT invalide');
  });
});
