import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getDailyToday,
  getMe,
  getRestaurant,
  patchDecisionSelect,
  postDecisionQuery,
  updatePreferences,
  type DecisionAction,
  type DecisionQueryInput,
  type PreferencesInput,
} from './api'

export function useDailyToday() {
  return useQuery({
    queryKey: ['daily', 'today'],
    queryFn: getDailyToday,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

export function useRestaurant(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id as string),
    enabled: Boolean(id),
    retry: false,
  })
}

export function useDecision() {
  return useMutation({
    mutationFn: (input: DecisionQueryInput) => postDecisionQuery(input),
  })
}

export function useSelectResult(sessionId: string | undefined) {
  return useMutation({
    mutationFn: (body: { selectedResultId: string; actionTaken: DecisionAction }) =>
      patchDecisionSelect(sessionId as string, body),
  })
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled,
    retry: false,
  })
}

export function useUpdatePreferences() {
  return useMutation({
    mutationFn: (body: PreferencesInput) => updatePreferences(body),
  })
}
