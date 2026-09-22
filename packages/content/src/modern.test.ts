import { describe, expect, it } from 'vitest';
import { loadPack } from './index.js';

const classic = loadPack('classic');
const modern = loadPack('modern-western');

describe('modern-western content', () => {
  it('gives every location a distinct modern name and three original greetings and farewells', () => {
    expect(modern.locations).toHaveLength(16);
    for (const location of modern.locations) {
      const prefix = `location.${location.id}`;
      expect(modern.i18n[`${prefix}.name`]).not.toBe(classic.i18n[`${prefix}.name`]);
      for (const kind of ['greeting', 'farewell']) {
        for (let index = 1; index <= 3; index++) {
          const key = `${prefix}.${kind}.${index}`;
          expect(modern.i18n[key]).toBeTruthy();
          expect(modern.i18n[key]).not.toBe(classic.i18n[key]);
        }
      }
    }
  });

  it('modernizes all inherited job and degree labels plus meals and clothing', () => {
    for (const entries of [classic.jobs, classic.degrees, classic.meals, classic.clothing]) {
      for (const entry of entries) {
        const key = 'titleKey' in entry ? entry.titleKey : entry.nameKey;
        expect(modern.i18n[key]).toBeTruthy();
        expect(modern.i18n[key]).not.toBe(classic.i18n[key]);
      }
    }
  });

  it('contains all required modern durable items with names, descriptions and visuals', () => {
    const required = [
      'smartphone',
      'laptop',
      'tablet',
      'smart-tv',
      'game-console',
      'e-reader',
      'noise-cancelling-headphones',
      'refrigerator',
      'freezer',
      'air-fryer',
      'robot-vacuum',
      'massage-chair',
      'bike',
      'phone-case',
      'gym-card',
    ];
    for (const id of required) {
      const item = modern.itemById[id];
      expect(item, id).toBeDefined();
      expect(modern.i18n[item!.nameKey]).toBeTruthy();
      expect(item!.descKey).toBeDefined();
      expect(modern.i18n[item!.descKey!]).toBeTruthy();
      expect(modern.visuals[`item:${id}`]).toBeDefined();
    }
    expect(modern.itemById['massage-chair']!.replaces).toBe('hot-tub');
    expect(modern.itemById['massage-chair']!.unlocks).toContain('noRelaxDecay');
    expect(modern.itemById.laptop!.unlocks).toContain('onlineStudy');
    expect(modern.itemById.tablet!.unlocks).not.toContain('onlineStudy');
    expect(modern.itemById['gym-card']!.unlocks).toContain('gymCard');
  });

  it('keeps automation exposure within the GDD occupation bands', () => {
    for (const id of [
      'bank-teller',
      'rent-office-records-clerk',
      'factory-picker',
      'factory-packer',
    ]) {
      expect(modern.jobById[id]!.automationRiskBp).toBeGreaterThanOrEqual(3_000);
      expect(modern.jobById[id]!.automationRiskBp).toBeLessThanOrEqual(5_000);
    }
    for (const id of [
      'clothing-boutique-tailor',
      'electronics-store-repair-technician',
      'factory-machinist-s-helper',
    ]) {
      expect(modern.jobById[id]!.automationRiskBp).toBe(1_000);
    }
    for (const job of modern.jobs) {
      if (/manager|teacher|lecturer|professor/.test(job.id)) {
        expect(job.automationRiskBp, job.id).toBe(500);
      }
    }
  });
});
