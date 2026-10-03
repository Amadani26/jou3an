/**
 * The budget vocabulary, shared by the taste quiz, Profile → Preferences and
 * the Decide flow's budget pill.
 *
 * One list, three surfaces — the same reason cuisines.ts exists. The labels are
 * what the user reads in all three places, and the values are what the server
 * stores on `User.budgetRange`.
 *
 * ⚠️ 'ANY' is the UI's spelling of "No budget"; it is stored as NULL. The
 * column is nullable precisely so that answer can be stored rather than
 * approximated by a band nobody chose.
 *
 * ⚠️ A band is a LEAN, NOT A CEILING. It moves the price-fit half of the
 * engine's context term (worth at most 0.1 of a restaurant's score) and filters
 * nothing — somewhere pricier can still win if it is the better pick. Never
 * write copy here that promises a cap.
 */
import type { BudgetRange } from './api'

/** What the UI works in: a band, or the explicit "no band" answer. */
export type BudgetChoice = BudgetRange | 'ANY'

export interface BudgetOption {
  value: BudgetChoice
  /**
   * The row's title, and the pill's label.
   *
   * ⚠️ It carries the numbers itself ("Under AED 100"), which is why no row
   * shows a separate AED column — the two read as the same fact printed twice.
   */
  label: string
  /** One line under the label. */
  sub: string
}

/** Mirrors BUDGET_BANDS in server/src/services/engine/filter.ts. */
export const BUDGET_OPTIONS: BudgetOption[] = [
  {
    value: 'ANY',
    label: 'No budget',
    sub: 'Price stays out of it',
  },
  {
    value: 'LOW',
    label: 'Under AED 100',
    sub: 'Quick bites and casual spots',
  },
  {
    value: 'MID',
    label: 'AED 100–200',
    sub: 'Most sit-down places',
  },
  {
    value: 'HIGH',
    label: 'AED 200+',
    sub: 'The nicer end of the scale',
  },
]

/** The stored column (null = no band) as the UI's choice. */
export const budgetChoiceOf = (stored: BudgetRange | null | undefined): BudgetChoice =>
  stored ?? 'ANY'

/** The UI's choice as the stored column — 'ANY' is null, not a band. */
export const budgetRangeOf = (choice: BudgetChoice): BudgetRange | null =>
  choice === 'ANY' ? null : choice

/** The short label for a choice — used by the pill and the Profile row. */
export const budgetLabel = (choice: BudgetChoice): string =>
  BUDGET_OPTIONS.find((o) => o.value === choice)?.label ?? 'No budget'
