import { PrismaClient, LocationArea, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const mapsUrl = (name: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name} Dubai`,
  )}`

const RESTAURANTS: Prisma.RestaurantCreateInput[] = [
  {
    name: 'Operation Falafel',
    cuisineType: 'Lebanese',
    area: LocationArea.JLT,
    priceMin: 30,
    priceMax: 55,
    phone: '+971 4 431 7778',
    googleMapsUrl: mapsUrl('Operation Falafel JLT'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Operation Falafel')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Operation Falafel')}`,
    isActive: true,
    isFeatured: true,
    tags: ['halal', 'quick', 'vegetarian-friendly', 'cheap'],
    ratingScore: 8.6,
    averageCalories: 650,
  },
  {
    name: 'Salt',
    cuisineType: 'American Burgers',
    area: LocationArea.MARINA,
    priceMin: 45,
    priceMax: 70,
    phone: '+971 50 916 6338',
    googleMapsUrl: mapsUrl('Salt Dubai Marina'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Salt Burgers')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Salt Burgers')}`,
    isActive: true,
    isFeatured: true,
    tags: ['halal', 'comfort', 'high-protein', 'date-night'],
    ratingScore: 8.9,
    averageCalories: 900,
  },
  {
    name: 'Comptoir 102',
    cuisineType: 'Healthy / Organic',
    area: LocationArea.OTHER,
    priceMin: 60,
    priceMax: 90,
    phone: '+971 4 385 4555',
    googleMapsUrl: mapsUrl('Comptoir 102 Jumeirah'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Comptoir 102')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Comptoir 102')}`,
    isActive: true,
    tags: ['healthy', 'vegetarian-friendly', 'date-night'],
    ratingScore: 8.4,
    averageCalories: 450,
  },
  {
    name: 'Ravi Restaurant',
    cuisineType: 'Pakistani',
    area: LocationArea.OTHER,
    priceMin: 20,
    priceMax: 40,
    phone: '+971 4 331 5353',
    googleMapsUrl: mapsUrl('Ravi Restaurant Satwa'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Ravi Restaurant')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Ravi Restaurant')}`,
    isActive: true,
    tags: ['halal', 'cheap', 'comfort', 'late-night', 'high-protein'],
    ratingScore: 8.8,
    averageCalories: 800,
  },
  {
    name: 'Arabian Tea House',
    cuisineType: 'Emirati',
    area: LocationArea.OTHER,
    priceMin: 35,
    priceMax: 60,
    phone: '+971 4 353 5071',
    googleMapsUrl: mapsUrl('Arabian Tea House Al Fahidi'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Arabian Tea House')}`,
    isActive: true,
    tags: ['halal', 'comfort', 'date-night', 'vegetarian-friendly'],
    ratingScore: 8.3,
    averageCalories: 700,
  },
  {
    name: 'Shawarma Station',
    cuisineType: 'Lebanese Fast Food',
    area: LocationArea.OTHER,
    priceMin: 15,
    priceMax: 30,
    phone: '+971 4 396 8484',
    googleMapsUrl: mapsUrl('Shawarma Station Dubai'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Shawarma Station')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Shawarma Station')}`,
    isActive: true,
    tags: ['halal', 'quick', 'cheap', 'late-night'],
    ratingScore: 7.9,
    averageCalories: 600,
  },
  {
    name: 'Tom & Serg',
    cuisineType: 'Australian Café / Brunch',
    area: LocationArea.OTHER,
    priceMin: 55,
    priceMax: 85,
    phone: '+971 56 474 6812',
    googleMapsUrl: mapsUrl('Tom and Serg Al Quoz'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Tom and Serg')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Tom and Serg')}`,
    isActive: true,
    tags: ['healthy', 'date-night', 'vegetarian-friendly', 'comfort'],
    ratingScore: 8.5,
    averageCalories: 750,
  },
  {
    name: 'Pitfire Pizza',
    cuisineType: 'American',
    area: LocationArea.JLT,
    priceMin: 50,
    priceMax: 75,
    phone: '+971 4 421 5216',
    googleMapsUrl: mapsUrl('Pitfire Pizza JLT'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Pitfire Pizza')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Pitfire Pizza')}`,
    isActive: true,
    tags: ['halal', 'comfort', 'quick', 'vegetarian-friendly'],
    ratingScore: 8.2,
    averageCalories: 1000,
  },
  {
    name: 'Sushi Counter',
    cuisineType: 'Japanese',
    area: LocationArea.DIFC,
    priceMin: 80,
    priceMax: 130,
    phone: '+971 4 355 1152',
    googleMapsUrl: mapsUrl('Sushi Counter DIFC'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Sushi Counter')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Sushi Counter')}`,
    isActive: true,
    tags: ['healthy', 'high-protein', 'date-night', 'quick'],
    ratingScore: 8.7,
    averageCalories: 500,
  },
  {
    name: 'Zaroob',
    cuisineType: 'Levantine Street Food',
    area: LocationArea.OTHER,
    priceMin: 25,
    priceMax: 50,
    phone: '+971 4 327 6060',
    googleMapsUrl: mapsUrl('Zaroob Sheikh Zayed Road'),
    talabatUrl: `https://www.talabat.com/uae/${slug('Zaroob')}`,
    deliverooUrl: `https://deliveroo.ae/menu/dubai/${slug('Zaroob')}`,
    isActive: true,
    tags: ['halal', 'cheap', 'late-night', 'quick', 'vegetarian-friendly'],
    ratingScore: 8.6,
    averageCalories: 650,
  },
]

async function main() {
  console.log('🌱 Seeding Jou3an database...')

  // Clean slate (respect FK order: DailyPick references Restaurant).
  await prisma.dailyPick.deleteMany()
  await prisma.decisionSession.deleteMany()
  await prisma.restaurant.deleteMany()

  const created = []
  for (const data of RESTAURANTS) {
    created.push(await prisma.restaurant.create({ data }))
  }
  console.log(`✅ Seeded ${created.length} restaurants`)

  // Today's Daily Top 3 — the first three restaurants.
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.dailyPick.upsert({
    where: { date: today },
    update: {
      themeLabel: 'What Dubai Is Eating Right Now',
      result1Id: created[0].id,
      result2Id: created[1].id,
      result3Id: created[2].id,
      isLive: true,
    },
    create: {
      date: today,
      themeLabel: 'What Dubai Is Eating Right Now',
      result1Id: created[0].id,
      result2Id: created[1].id,
      result3Id: created[2].id,
      isLive: true,
    },
  })
  console.log(
    `✅ Seeded today's DailyPick: ${created[0].name}, ${created[1].name}, ${created[2].name}`,
  )
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
