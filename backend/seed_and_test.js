const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  try {
    console.log("--- 1. Seeding Categories ---");
    const categoryNames = ["Groceries", "Rent", "Entertainment", "Utilities", "Transport"];
    for (const name of categoryNames) {
      const exists = await prisma.expenseCategory.findFirst({ where: { name } });
      if (!exists) {
        await prisma.expenseCategory.create({ data: { name } });
      }
    }
    console.log("Categories seeded successfully.");

    const groceriesCategory = await prisma.expenseCategory.findFirst({ where: { name: "Groceries" } });
    const categoryId = groceriesCategory.id;

    console.log("\n--- 2. Registering User ---");
    const registerRes = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        profile: {
          age: 25,
          gender: "MALE",
          heightCm: 180,
          weightKg: 75,
          activityLevel: "MODERATELY_ACTIVE",
          weightGoal: "MAINTAIN_WEIGHT",
          monthlyBudgetLimit: 1500
        }
      })
    });
    const registerData = await registerRes.json();
    if (registerRes.status === 400 && registerData.error === 'Email already in use') {
        console.log("User already exists, proceeding to login...");
    } else {
        console.log("Register Response:", registerData);
    }

    console.log("\n--- 3. Logging in ---");
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123"
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("Login Token Received: [HIDDEN_FOR_SECURITY]");

    console.log("\n--- 4. Adding Expense ($50 Groceries) ---");
    const expenseRes = await fetch("http://localhost:5000/api/budget", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        categoryId: categoryId,
        amount: 50.00,
        description: "Test Grocery Shopping",
        date: new Date().toISOString()
      })
    });
    const expenseData = await expenseRes.json();
    console.log("Expense Response:", expenseData);

    console.log("\n--- 5. Fetching Budget Forecast ---");
    const forecastRes = await fetch("http://localhost:5000/api/budget/forecast", {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${token}`
      }
    });
    const forecastData = await forecastRes.json();
    console.log("Forecast Response (JSON):");
    console.log(JSON.stringify(forecastData, null, 2));

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
