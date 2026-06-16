const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const exercises = [
    { name: 'Running', caloriesBurnedPerMin: 11.4 },
    { name: 'Walking', caloriesBurnedPerMin: 4.3 },
    { name: 'Cycling', caloriesBurnedPerMin: 8.5 },
    { name: 'Weightlifting', caloriesBurnedPerMin: 3.5 },
    { name: 'Swimming', caloriesBurnedPerMin: 8.0 }
  ];

  for (const ex of exercises) {
    await prisma.exercise.create({ data: ex });
  }
  console.log('Exercises seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
