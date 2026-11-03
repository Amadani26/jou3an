/**
 * The marketing page's ONLY food data: generic dishes, not businesses.
 *
 * ⚠️ ZERO-RISK RULE. No real restaurant names, logos or identities appear in
 * any marketing section — a card here is "Chicken shawarma · Lebanese · JLT",
 * never a venue. Areas are Dubai neighbourhoods (places, not businesses) and
 * prices are plausible AED brackets, not quotes from anyone's menu. The only
 * place real venues may appear is the live demo, fetched from our API.
 *
 * `score` is OUR 0–10 scale (the app's own ratingScore convention), rendered
 * in our own neutral chip — never a Google star, count or badge.
 *
 * `photo` keys map to public/brand/dishes/<key>.webp — Pexels, commercial-use
 * licence, credited in client/ASSET_CREDITS.md. Cards without a photo render
 * as cuisine-coded colour fields.
 */
export type Dish = {
  dish: string
  cuisine: string
  area: string
  price: string
  score: number
  photo?: string
  /** Cuisine-coded accent for colour-field cards — muted, never fighting the red. */
  tone: string
}

export const DISHES: readonly Dish[] = [
  { dish: 'Chicken shawarma', cuisine: 'Lebanese', area: 'JLT', price: 'AED 20–35', score: 9.1, photo: 'shawarma', tone: '#8a6a3b' },
  { dish: 'Salmon nigiri set', cuisine: 'Japanese', area: 'DIFC', price: 'AED 120–180', score: 9.4, photo: 'sushi', tone: '#7d4646' },
  { dish: 'Smash burger', cuisine: 'American', area: 'Al Quoz', price: 'AED 45–65', score: 8.8, photo: 'burger', tone: '#6f4a33' },
  { dish: 'Chicken biryani', cuisine: 'Pakistani', area: 'Deira', price: 'AED 25–40', score: 9.0, photo: 'biryani', tone: '#80592b' },
  { dish: 'Margherita pizza', cuisine: 'Italian', area: 'City Walk', price: 'AED 55–75', score: 8.9, photo: 'pizza', tone: '#5f6b3a' },
  { dish: 'Poke bowl', cuisine: 'Healthy', area: 'Dubai Marina', price: 'AED 55–80', score: 8.6, photo: 'salad', tone: '#3f6b55' },
  { dish: 'Tonkotsu ramen', cuisine: 'Japanese', area: 'Downtown', price: 'AED 60–85', score: 9.2, photo: 'ramen', tone: '#7d4646' },
  { dish: 'Lamb kebab skewers', cuisine: 'Turkish', area: 'Business Bay', price: 'AED 70–110', score: 8.7, photo: 'skewers', tone: '#74402e' },
  { dish: 'Saffron pancakes', cuisine: 'Emirati', area: 'Jumeirah', price: 'AED 30–45', score: 8.5, photo: 'pancakes', tone: '#5a5f8c' },
  { dish: 'Falafel platter', cuisine: 'Lebanese', area: 'Satwa', price: 'AED 18–28', score: 8.8, tone: '#8a6a3b' },
  { dish: 'Butter chicken', cuisine: 'Indian', area: 'Karama', price: 'AED 35–55', score: 9.0, tone: '#8c5a2b' },
  { dish: 'Pad thai', cuisine: 'Thai', area: 'JBR', price: 'AED 50–70', score: 8.4, tone: '#4f7355' },
  { dish: 'Beef pho', cuisine: 'Vietnamese', area: 'Barsha', price: 'AED 40–60', score: 8.6, tone: '#476a6a' },
  { dish: 'Mixed grill', cuisine: 'Emirati', area: 'Al Fahidi', price: 'AED 80–120', score: 8.9, tone: '#5a5f8c' },
  { dish: 'Truffle tagliatelle', cuisine: 'Italian', area: 'DIFC', price: 'AED 95–140', score: 9.1, tone: '#5f6b3a' },
  { dish: 'Fish tacos', cuisine: 'Mexican', area: 'Dubai Marina', price: 'AED 45–65', score: 8.3, tone: '#7a6230' },
  { dish: 'Mansaf', cuisine: 'Jordanian', area: 'Mirdif', price: 'AED 45–70', score: 8.7, tone: '#6e5a3a' },
  { dish: 'Dim sum basket', cuisine: 'Chinese', area: 'Downtown', price: 'AED 60–90', score: 8.8, tone: '#753f4e' },
  { dish: 'Acai bowl', cuisine: 'Healthy', area: 'Kite Beach', price: 'AED 40–55', score: 8.2, tone: '#3f6b55' },
  { dish: 'Mutton haleem', cuisine: 'Pakistani', area: 'Satwa', price: 'AED 22–35', score: 8.9, tone: '#80592b' },
  { dish: 'Wood-oven manakish', cuisine: 'Lebanese', area: 'Al Quoz', price: 'AED 15–25', score: 8.5, tone: '#8a6a3b' },
  { dish: 'Katsu curry', cuisine: 'Japanese', area: 'Business Bay', price: 'AED 55–75', score: 8.6, tone: '#7d4646' },
  { dish: 'Shakshuka', cuisine: 'Levantine', area: 'Jumeirah', price: 'AED 35–50', score: 8.4, tone: '#875339' },
  { dish: 'Karak and baid tamat', cuisine: 'Emirati', area: 'Deira', price: 'AED 8–15', score: 8.8, tone: '#5a5f8c' },
]

/** The three the collapse resolves to — picked for story, not score order. */
export const SURVIVOR_INDEXES = [0, 6, 4] as const

/** The reasoning chips the survivors carry, in the app's own voice. */
export const SURVIVOR_REASONS = [
  'Close to you · Under AED 60',
  'You keep going back to Japanese',
  'Casual, open now',
] as const
