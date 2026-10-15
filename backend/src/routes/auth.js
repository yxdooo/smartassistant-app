const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');
const { 
  generateRegistrationOptions, 
  verifyRegistrationResponse, 
  generateAuthenticationOptions, 
  verifyAuthenticationResponse 
} = require('@simplewebauthn/server');

const router = express.Router();
const prisma = new PrismaClient();

const rpName = 'SmartAssistant Super App';
const rpID = 'localhost'; // In production, this should be your domain
const origin = `http://${rpID}:5173`; // Frontend URL

// Register
router.post('/register', async (req, res) => {
  const { email, password, profile } = req.body;
  
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: profile
        }
      },
      include: { profile: true }
    });

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user', details: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token, hasWebAuthn: !!user.webauthnCredentialID });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
});

// --- WEBAUTHN ---

// 1. Generate Registration Options (Called when user clicks "Setup FaceID/TouchID")
router.get('/webauthn/generate-registration', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.email,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: options.challenge }
    });

    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Verify Registration (Called after hardware returns credential)
router.post('/webauthn/verify-registration', authenticateToken, async (req, res) => {
  const body = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const expectedChallenge = user.currentChallenge;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (error) {
      console.error(error);
      return res.status(400).send({ error: error.message });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          webauthnCredentialID: Buffer.from(credentialID).toString('base64url'),
          webauthnPublicKey: Buffer.from(credentialPublicKey),
          webauthnCounter: counter,
          currentChallenge: null
        }
      });

      return res.json({ verified: true });
    }
    res.status(400).json({ verified: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate Authentication Options (Login without password)
router.post('/webauthn/generate-authentication', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.webauthnCredentialID) {
       return res.status(400).json({ error: 'User does not exist or has not set up Biometrics.' });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{
        id: Buffer.from(user.webauthnCredentialID, 'base64url'),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'preferred',
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: options.challenge }
    });

    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Verify Authentication
router.post('/webauthn/verify-authentication', async (req, res) => {
  const { email, credential } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid user' });

    const expectedChallenge = user.currentChallenge;

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: Buffer.from(user.webauthnCredentialID, 'base64url'),
          credentialPublicKey: user.webauthnPublicKey,
          counter: user.webauthnCounter,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          webauthnCounter: authenticationInfo.newCounter,
          currentChallenge: null
        }
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      return res.json({ verified: true, token });
    }
    
    res.status(400).json({ verified: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({
      ...profile,
      hasAiApiKey: !!profile.aiApiKey,
      aiProvider: profile.aiProvider || 'gemini',
      aiApiKey: profile.aiApiKey || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update Profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { isDarkMode, age, gender, heightCm, weightKg, activityLevel, weightGoal, monthlyBudgetLimit, aiApiKey, aiProvider } = req.body;
  try {
    const profile = await prisma.userProfile.update({
      where: { userId: req.user.userId },
      data: {
        ...(isDarkMode !== undefined && { isDarkMode }),
        ...(age !== undefined && { age: parseInt(age) }),
        ...(gender !== undefined && { gender }),
        ...(heightCm !== undefined && { heightCm: parseFloat(heightCm) }),
        ...(weightKg !== undefined && { weightKg: parseFloat(weightKg) }),
        ...(activityLevel !== undefined && { activityLevel }),
        ...(weightGoal !== undefined && { weightGoal }),
        ...(monthlyBudgetLimit !== undefined && { monthlyBudgetLimit: parseFloat(monthlyBudgetLimit) }),
        ...(aiApiKey !== undefined && { aiApiKey: aiApiKey ? aiApiKey.trim() : null }),
        ...(aiProvider !== undefined && { aiProvider: aiProvider || 'gemini' }),
      }
    });
    res.json({
      ...profile,
      hasAiApiKey: !!profile.aiApiKey,
      aiProvider: profile.aiProvider || 'gemini',
      aiApiKey: profile.aiApiKey || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
