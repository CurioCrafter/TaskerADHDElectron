import jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const TokenPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  iat: z.number().optional(),
  exp: z.number().optional()
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export function generateToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '7d', // Use literal string instead of environment variable
    issuer: 'taskeradhd',
    audience: 'taskeradhd-users'
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'taskeradhd',
      audience: 'taskeradhd-users'
    });
    
    return TokenPayloadSchema.parse(decoded);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    throw new Error('Token verification failed');
  }
}

export function generateMagicLinkToken(): string {
  return jwt.sign(
    { 
      type: 'magic-link',
      timestamp: Date.now()
    }, 
    JWT_SECRET, 
    { expiresIn: '15m' }
  );
}
