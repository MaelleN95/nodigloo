import { describe, expect, it } from '@jest/globals';
import {
  isValidNickname,
  nicknameKey,
  normalizeNickname,
} from './nickname.js';

describe('normalizeNickname', () => {
  it('enlève les espaces autour du pseudo', () => {
    expect(normalizeNickname('  Alice  ')).toBe('Alice');
  });

  it('remplace les espaces multiples par un seul', () => {
    expect(normalizeNickname('Jo    Ann')).toBe('Jo Ann');
  });
});

describe('isValidNickname', () => {
  it('accepte un pseudo de 2 à 20 caractères', () => {
    expect(isValidNickname('Al')).toBe(true);
    expect(isValidNickname('a'.repeat(20))).toBe(true);
  });

  it('refuse un pseudo trop court ou trop long', () => {
    expect(isValidNickname('A')).toBe(false);
    expect(isValidNickname('a'.repeat(21))).toBe(false);
  });

  it('refuse un pseudo vide ou fait uniquement d\'espaces', () => {
    expect(isValidNickname('')).toBe(false);
    expect(isValidNickname('     ')).toBe(false);
  });

  it('mesure la longueur après nettoyage des espaces', () => {
    expect(isValidNickname('  A  ')).toBe(false);
    expect(isValidNickname('  Al  ')).toBe(true);
  });
});

describe('nicknameKey', () => {
  it('ignore la casse et les espaces autour', () => {
    expect(nicknameKey(' ALICE ')).toBe(nicknameKey('alice'));
  });

  it('distingue deux pseudos différents', () => {
    expect(nicknameKey('Alice')).not.toBe(nicknameKey('Alicia'));
  });
});
