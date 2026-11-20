import {
  INITIAL_BOOKS,
  INITIAL_MEMBERS,
  INITIAL_LOANS,
  INITIAL_RESERVATIONS,
  INITIAL_EST_STUDENTS,
} from './seedData';
import { generateCoherentDemoDataset, DemoDataset, REFERENCE_DATE } from './demoGenerator';

export { REFERENCE_DATE };

let cachedDataset: DemoDataset | null = null;

export function getEnrichedDemoDataset(): DemoDataset {
  if (!cachedDataset) {
    cachedDataset = generateCoherentDemoDataset(
      INITIAL_BOOKS,
      INITIAL_MEMBERS,
      INITIAL_EST_STUDENTS,
      INITIAL_LOANS,
      INITIAL_RESERVATIONS
    );
  }
  return cachedDataset;
}
