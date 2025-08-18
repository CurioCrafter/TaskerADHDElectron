import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { getPrisma } from '../index';

// Extend Express Request type to include user
declare global {
	namespace Express {
		interface Request {
			user?: {
				id: string;
				email: string;
				displayName?: string;
			};
		}
	}
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

		if (!token) {
			return res.status(401).json({ error: 'Access token required' });
		}

		// Development bypass
		if (process.env.NODE_ENV === 'development' && token === 'dev-token-bypass') {
			// Ensure dev user exists in DB
			const devEmail = 'dev@taskeradhd.local';
			const devDisplayName = 'Dev User';

			const devUser = await getPrisma().user.upsert({
				where: { email: devEmail },
				update: { displayName: devDisplayName },
				create: { email: devEmail, displayName: devDisplayName }
			});

			// Ensure a default board exists with columns and membership
			const boardCount = await getPrisma().board.count({ where: { ownerId: devUser.id } });
			if (boardCount === 0) {
				await getPrisma().board.create({
					data: {
						name: 'My Tasks',
						ownerId: devUser.id,
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
								userId: devUser.id,
								role: 'OWNER'
							}
						}
					}
				});
			}

			req.user = {
				id: devUser.id,
				email: devUser.email,
				displayName: devUser.displayName || undefined
			};
			return next();
		}

		const decoded = verifyToken(token);
		
		// Fetch user from database to ensure they still exist
		const user = await getPrisma().user.findUnique({
			where: { id: decoded.userId },
			select: {
				id: true,
				email: true,
				displayName: true
			}
		});

		if (!user) {
			return res.status(401).json({ error: 'User not found' });
		}

		req.user = {
			...user,
			displayName: user.displayName || undefined
		};
		next();
	} catch (error) {
		console.error('Auth middleware error:', error);
		return res.status(403).json({ error: 'Invalid or expired token' });
	}
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader && authHeader.split(' ')[1];

		if (token) {
			// Development bypass
			if (process.env.NODE_ENV === 'development' && token === 'dev-token-bypass') {
				// Ensure dev user exists in DB
				const devEmail = 'dev@taskeradhd.local';
				const devDisplayName = 'Dev User';
							const devUser = await getPrisma().user.upsert({
				where: { email: devEmail },
				update: { displayName: devDisplayName },
				create: { email: devEmail, displayName: devDisplayName }
			});

				req.user = {
					id: devUser.id,
					email: devUser.email,
					displayName: devUser.displayName || undefined
				};
				return next();
			}

			const decoded = verifyToken(token);
			const user = await getPrisma().user.findUnique({
				where: { id: decoded.userId },
				select: {
					id: true,
					email: true,
					displayName: true
				}
			});
			
			if (user) {
				req.user = {
					...user,
					displayName: user.displayName || undefined
				};
			}
		}
		
		next();
	} catch (error) {
		// Continue without authentication for optional auth
		next();
	}
}
