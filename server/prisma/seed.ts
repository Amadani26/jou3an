import { PrismaClient, LocationArea, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const mapsUrl = (name: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name} Dubai`,
  )}`

type SeedRestaurant = Omit<
  Prisma.RestaurantCreateInput,
  'googleMapsUrl'
> & { googleMapsUrl?: string | null }

const RESTAURANTS: SeedRestaurant[] = [
  // ---- Lebanese (3) ----
  {
    name: 'Allo Beirut',
    cuisineType: 'Lebanese',
    area: LocationArea.JLT,
    priceMin: 35,
    priceMax: 70,
    phone: null,
    googleMapsUrl: mapsUrl('Allo Beirut JLT'),
    tags: ['halal', 'late-night', 'comfort-food', 'quick'],
    ratingScore: 4.6,
    averageCalories: 720,
  },
  {
    name: 'Em Sherif Café',
    cuisineType: 'Lebanese',
    area: LocationArea.DIFC,
    priceMin: 90,
    priceMax: 180,
    phone: null,
    googleMapsUrl: mapsUrl('Em Sherif Cafe DIFC'),
    tags: ['halal', 'date-night', 'dine-in'],
    ratingScore: 4.7,
    averageCalories: 850,
  },
  {
    name: 'Al Nafoorah',
    cuisineType: 'Lebanese',
    area: LocationArea.DOWNTOWN,
    priceMin: 110,
    priceMax: 220,
    phone: null,
    googleMapsUrl: null,
    tags: ['halal', 'date-night', 'dine-in', 'vegetarian-friendly'],
    ratingScore: 4.5,
    averageCalories: 780,
  },

  // ---- Japanese (3) ----
  {
    name: 'Zuma',
    cuisineType: 'Japanese',
    area: LocationArea.DIFC,
    priceMin: 150,
    priceMax: 320,
    phone: null,
    googleMapsUrl: mapsUrl('Zuma DIFC'),
    tags: ['date-night', 'dine-in', 'high-protein'],
    ratingScore: 4.8,
    averageCalories: 640,
  },
  {
    name: 'Reif Japanese Kushiyaki',
    cuisineType: 'Japanese',
    area: LocationArea.MARINA,
    priceMin: 45,
    priceMax: 110,
    phone: null,
    googleMapsUrl: mapsUrl('Reif Japanese Kushiyaki'),
    tags: ['high-protein', 'quick', 'dine-in'],
    ratingScore: 4.7,
    averageCalories: 560,
  },
  {
    name: 'Tomo',
    cuisineType: 'Japanese',
    area: LocationArea.BUSINESS_BAY,
    priceMin: 90,
    priceMax: 200,
    phone: null,
    googleMapsUrl: null,
    tags: ['date-night', 'dine-in', 'high-protein'],
    ratingScore: 4.5,
    averageCalories: 600,
  },

  // ---- Indian (3) ----
  {
    name: 'Rang Mahal by Atul Kochhar',
    cuisineType: 'Indian',
    area: LocationArea.DOWNTOWN,
    priceMin: 100,
    priceMax: 210,
    phone: null,
    googleMapsUrl: mapsUrl('Rang Mahal Downtown Dubai'),
    tags: ['halal', 'date-night', 'vegetarian-friendly', 'dine-in'],
    ratingScore: 4.6,
    averageCalories: 820,
  },
  {
    name: 'Tresind',
    cuisineType: 'Indian',
    area: LocationArea.BUSINESS_BAY,
    priceMin: 120,
    priceMax: 260,
    phone: null,
    googleMapsUrl: null,
    tags: ['vegetarian-friendly', 'date-night', 'dine-in'],
    ratingScore: 4.8,
    averageCalories: 760,
  },
  {
    name: 'Mint Leaf of London',
    cuisineType: 'Indian',
    area: LocationArea.DIFC,
    priceMin: 95,
    priceMax: 190,
    phone: null,
    googleMapsUrl: mapsUrl('Mint Leaf of London DIFC'),
    tags: ['halal', 'vegetarian-friendly', 'dine-in'],
    ratingScore: 4.5,
    averageCalories: 800,
  },

  // ---- American (2) ----
  {
    name: 'Pickl',
    cuisineType: 'American',
    area: LocationArea.JLT,
    priceMin: 35,
    priceMax: 65,
    phone: null,
    googleMapsUrl: mapsUrl('Pickl JLT'),
    tags: ['comfort-food', 'quick', 'late-night', 'high-protein'],
    ratingScore: 4.5,
    averageCalories: 900,
  },
  {
    name: 'SALT',
    cuisineType: 'American',
    area: LocationArea.MARINA,
    priceMin: 40,
    priceMax: 80,
    phone: null,
    googleMapsUrl: null,
    tags: ['comfort-food', 'quick', 'late-night'],
    ratingScore: 4.3,
    averageCalories: 880,
  },

  // ---- Italian (2) ----
  {
    name: "Roberto's",
    cuisineType: 'Italian',
    area: LocationArea.DIFC,
    priceMin: 120,
    priceMax: 250,
    phone: null,
    googleMapsUrl: mapsUrl("Roberto's DIFC"),
    tags: ['date-night', 'dine-in', 'vegetarian-friendly'],
    ratingScore: 4.6,
    averageCalories: 780,
  },
  {
    name: 'BiCE',
    cuisineType: 'Italian',
    area: LocationArea.MARINA,
    priceMin: 90,
    priceMax: 190,
    phone: null,
    googleMapsUrl: mapsUrl('BiCE Marina Dubai'),
    tags: ['date-night', 'dine-in', 'comfort-food'],
    ratingScore: 4.4,
    averageCalories: 810,
  },

  // ---- Mexican (1) ----
  {
    name: 'Maiz Tacos',
    cuisineType: 'Mexican',
    area: LocationArea.JLT,
    priceMin: 30,
    priceMax: 55,
    phone: null,
    googleMapsUrl: mapsUrl('Maiz Tacos JLT'),
    tags: ['quick', 'comfort-food', 'vegetarian-friendly', 'delivery-only'],
    ratingScore: 4.4,
    averageCalories: 650,
  },

  // ---- Emirati (2) ----
  {
    name: 'Milas',
    cuisineType: 'Emirati',
    area: LocationArea.DOWNTOWN,
    priceMin: 55,
    priceMax: 120,
    phone: null,
    googleMapsUrl: mapsUrl('Milas Dubai Mall'),
    tags: ['halal', 'comfort-food', 'dine-in', 'vegetarian-friendly'],
    ratingScore: 4.3,
    averageCalories: 740,
  },
  {
    name: 'Al Fanar Restaurant & Cafe',
    cuisineType: 'Emirati',
    area: LocationArea.BUSINESS_BAY,
    priceMin: 50,
    priceMax: 110,
    phone: null,
    googleMapsUrl: null,
    tags: ['halal', 'comfort-food', 'dine-in'],
    ratingScore: 4.4,
    averageCalories: 760,
  },

  // ---- Chinese (2) ----
  {
    name: 'Hutong',
    cuisineType: 'Chinese',
    area: LocationArea.DIFC,
    priceMin: 110,
    priceMax: 230,
    phone: null,
    googleMapsUrl: mapsUrl('Hutong DIFC'),
    tags: ['date-night', 'dine-in', 'high-protein'],
    ratingScore: 4.6,
    averageCalories: 690,
  },
  {
    name: 'Din Tai Fung',
    cuisineType: 'Chinese',
    area: LocationArea.DOWNTOWN,
    priceMin: 45,
    priceMax: 95,
    phone: null,
    googleMapsUrl: mapsUrl('Din Tai Fung Dubai Mall'),
    tags: ['quick', 'comfort-food', 'dine-in'],
    ratingScore: 4.5,
    averageCalories: 700,
  },

  // ---- Thai (2) ----
  {
    name: 'Pai Thai',
    cuisineType: 'Thai',
    area: LocationArea.MARINA,
    priceMin: 100,
    priceMax: 210,
    phone: null,
    googleMapsUrl: null,
    tags: ['date-night', 'dine-in'],
    ratingScore: 4.6,
    averageCalories: 620,
  },
  {
    name: 'Little Bangkok',
    cuisineType: 'Thai',
    area: LocationArea.JLT,
    priceMin: 35,
    priceMax: 70,
    phone: null,
    googleMapsUrl: mapsUrl('Little Bangkok JLT'),
    tags: ['quick', 'comfort-food', 'halal', 'vegetarian-friendly'],
    ratingScore: 4.3,
    averageCalories: 680,
  },

  // ---- Mediterranean (2) ----
  {
    name: 'Gaia',
    cuisineType: 'Mediterranean',
    area: LocationArea.DIFC,
    priceMin: 130,
    priceMax: 270,
    phone: null,
    googleMapsUrl: mapsUrl('Gaia DIFC'),
    tags: ['date-night', 'dine-in', 'vegetarian-friendly'],
    ratingScore: 4.7,
    averageCalories: 640,
  },
  {
    name: 'Nammos Dubai',
    cuisineType: 'Mediterranean',
    area: LocationArea.MARINA,
    priceMin: 150,
    priceMax: 320,
    phone: null,
    googleMapsUrl: null,
    tags: ['date-night', 'dine-in'],
    ratingScore: 4.4,
    averageCalories: 660,
  },

  // ---- Healthy / bowls (3) ----
  {
    name: 'Kcal',
    cuisineType: 'Healthy',
    area: LocationArea.JLT,
    priceMin: 35,
    priceMax: 65,
    phone: null,
    googleMapsUrl: mapsUrl('Kcal JLT'),
    tags: ['healthy', 'high-protein', 'quick', 'delivery-only'],
    ratingScore: 4.2,
    averageCalories: 480,
  },
  {
    name: 'The Sum of Us',
    cuisineType: 'Healthy',
    area: LocationArea.BUSINESS_BAY,
    priceMin: 45,
    priceMax: 90,
    phone: null,
    googleMapsUrl: mapsUrl('The Sum of Us Business Bay'),
    tags: ['healthy', 'vegetarian-friendly', 'dine-in'],
    ratingScore: 4.6,
    averageCalories: 520,
  },
  {
    name: 'Wild & The Moon',
    cuisineType: 'Healthy',
    area: LocationArea.DIFC,
    priceMin: 40,
    priceMax: 85,
    phone: null,
    googleMapsUrl: mapsUrl('Wild and The Moon DIFC'),
    tags: ['healthy', 'vegetarian-friendly', 'quick'],
    ratingScore: 4.3,
    averageCalories: 450,
  },
]

async function main() {
  console.log('🌱 Seeding Jou3an database...')

  // Clean slate (respect FK order)
  await prisma.dailyPick.deleteMany()
  await prisma.decisionSession.deleteMany()
  await prisma.restaurant.deleteMany()

  const created = []
  for (const r of RESTAURANTS) {
    const restaurant = await prisma.restaurant.create({ data: r })
    created.push(restaurant)
  }
  console.log(`✅ Seeded ${created.length} restaurants`)

  // Pick 3 high-rated, diverse spots for today's DailyPick
  const [pick1, pick2, pick3] = [
    created.find((c) => c.name === 'Reif Japanese Kushiyaki')!,
    created.find((c) => c.name === 'Allo Beirut')!,
    created.find((c) => c.name === 'Pickl')!,
  ]

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.dailyPick.upsert({
    where: { date: today },
    update: {
      themeLabel: 'What Dubai Is Eating Right Now',
      result1Id: pick1.id,
      result2Id: pick2.id,
      result3Id: pick3.id,
      isLive: true,
    },
    create: {
      date: today,
      themeLabel: 'What Dubai Is Eating Right Now',
      result1Id: pick1.id,
      result2Id: pick2.id,
      result3Id: pick3.id,
      isLive: true,
    },
  })
  console.log('✅ Seeded today\'s DailyPick')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
