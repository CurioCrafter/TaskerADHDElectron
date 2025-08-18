import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getPrisma } from '../index';
import { generateToken, generateMagicLinkToken } from '../utils/jwt';
import { sendMagicLinkEmail } from '../utils/email';

const router = express.Router();

// Magic link request schema
const MagicLinkRequestSchema = z.object({
  email: z.string().email().toLowerCase()
});

// Magic link verify schema
const MagicLinkVerifySchema = z.object({
  token: z.string().min(1)
});

// POST /api/auth/magic-link/start
router.post('/magic-link/start', async (req, res) => {
  try {
    const { email } = MagicLinkRequestSchema.parse(req.body);

    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store magic link token
    await getPrisma().magicLink.create({
      data: {
        email,
        token,
        expiresAt
      }
    });

    // Send email with magic link
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/verify?token=${token}`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 Magic link for ${email}: ${magicLink}`);
      
      // In development, return the link directly for instant access
      return res.json({ 
        message: 'Development mode: Use the link below',
        devToken: token,
        magicLink: magicLink,
        devMode: true
      });
    }

    // In production, send actual email
    await sendMagicLinkEmail(email, magicLink);

    res.json({ message: 'Magic link sent! Check your email.' });
  } catch (error) {
    console.error('Magic link start error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// POST /api/auth/magic-link/verify
router.post('/magic-link/verify', async (req, res) => {
  try {
    const { token } = MagicLinkVerifySchema.parse(req.body);

    // Find and validate magic link
    const magicLink = await getPrisma().magicLink.findUnique({
      where: { token }
    });

    if (!magicLink) {
      return res.status(400).json({ error: 'Invalid or expired magic link' });
    }

    if (magicLink.used) {
      return res.status(400).json({ error: 'Magic link has already been used' });
    }

    if (new Date() > magicLink.expiresAt) {
      return res.status(400).json({ error: 'Magic link has expired' });
    }

    // Mark magic link as used
    await getPrisma().magicLink.update({
      where: { token },
      data: { used: true }
    });

    // Find or create user
    let user = await getPrisma().user.findUnique({
      where: { email: magicLink.email }
    });

    if (!user) {
      user = await getPrisma().user.create({
        data: {
          email: magicLink.email,
          displayName: magicLink.email.split('@')[0] // Default display name
        }
      });

      // Create default board for new user
      await getPrisma().board.create({
        data: {
          name: 'My Tasks',
          ownerId: user.id,
          columns: {
            create: [
              { name: 'Inbox', position: 0 },
              { name: 'To Do', position: 1 },
              { name: 'Doing', position: 2 },
              { name: 'Done', position: 3 }
            ]
          },
          members: {
            create: {
              userId: user.id,
              role: 'OWNER'
            }
          }
        }
      });
    }

    // Generate JWT
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email
    });

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Magic link verify error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request format',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to verify magic link' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Development bypass
    if (process.env.NODE_ENV === 'development' && token === 'dev-token-bypass') {
      const devUser = {
        id: 'dev-user-1',
        email: 'dev@taskeradhd.local',
        displayName: 'Dev User',
        createdAt: new Date().toISOString()
      };
      return res.json({ user: devUser });
    }

    const { verifyToken } = await import('../utils/jwt');
    const decoded = verifyToken(token);

    const user = await getPrisma().user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Since we're using stateless JWT, logout is handled client-side
  // by removing the token from storage
  res.json({ message: 'Logged out successfully' });
});

export default router;
