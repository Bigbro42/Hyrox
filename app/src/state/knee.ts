import { today } from '../domain/dates';
import { kneePoints, kneeStatus, type KneeStatus } from '../domain/knee';
import { useAppState, type AppState } from './store';

export function kneeOf(state: AppState): KneeStatus {
  const { sessions, knee, settings } = state.data;
  return kneeStatus(kneePoints(sessions, knee), settings, today());
}

export function useKnee(): KneeStatus {
  return kneeOf(useAppState());
}
