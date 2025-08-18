import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import taskRoutes from './routes/tasks';
import voiceRoutes from './routes/voice';
import proposalRoutes from './routes/proposals';
import calendarRoutes from './routes/calendar';

// Import middleware
import { authenticateToken } from './middleware/auth';
import { setupVoiceSocket } from './sockets/voice';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
	cors: {
		origin: process.env.CLIENT_URL || "http://localhost:3000",
		methods: ["GET", "POST"]
	},
	path: "/ws"
});

// Expose io globally for workers
;(global as any).socketIO = io;

// Initialize Prisma with retry mechanism
let prisma: PrismaClient

async function initializePrisma() {
  const maxRetries = 5
  const retryDelay = 2000
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[PRISMA] Attempt ${attempt}/${maxRetries}: Initializing Prisma client...`)
      
      prisma = new PrismaClient({
        log: process.env.PRISMA_DEBUG === 'true'
          ? ['query', 'info', 'warn', 'error']
          : ['info', 'warn', 'error']
      })
      
      // Test the connection
      await prisma.$connect()
      console.log('[PRISMA] ✅ Prisma client initialized successfully')
      return prisma
      
    } catch (error) {
      console.error(`[PRISMA] ❌ Attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        console.error('[PRISMA] 💥 All retry attempts failed. Exiting...')
        process.exit(1)
      }
      
      console.log(`[PRISMA] ⏳ Waiting ${retryDelay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }
}

// Initialize Prisma before starting the server
const prismaPromise = initializePrisma()

// Export prisma for use in other modules
export { prismaPromise }
export const getPrisma = () => prisma

// Middleware
app.use(cors({
	origin: process.env.CLIENT_URL || "http://localhost:3000",
	credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Lightweight API request logging (dev/debug only)
const ENABLE_API_LOG = process.env.NODE_ENV === 'development' || process.env.API_DEBUG === 'true'
if (ENABLE_API_LOG) {
  app.use((req, res, next) => {
    const start = Date.now()
    const id = Math.random().toString(36).slice(2, 8)
    const path = req.originalUrl
    console.log(`[API] ▶ ${id} ${req.method} ${path}`)
    res.on('finish', () => {
      const ms = Date.now() - start
      const status = res.statusCode
      console.log(`[API] ◀ ${id} ${req.method} ${path} -> ${status} in ${ms}ms`)
    })
    next()
  })
}

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: process.env.NODE_ENV === 'development' ? 10000 : 100 // higher in dev to avoid throttling during HMR
});

// Avoid noisy throttling in development
if (process.env.NODE_ENV !== 'development') {
	app.use('/api', limiter);
}

// Health check
app.get('/health', (req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', authenticateToken, boardRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/voice', authenticateToken, voiceRoutes);
app.use('/api/proposals', authenticateToken, proposalRoutes);
app.use('/api/calendar', authenticateToken, calendarRoutes);

// Socket.IO setup
io.use(async (socket, next) => {
	try {
		const token = socket.handshake.auth.token;
		if (!token) {
			return next(new Error('Authentication error'));
		}
		
		// Development bypass
		if (process.env.NODE_ENV === 'development' && token === 'dev-token-bypass') {
		socket.data.userId = 'dev-user-1';
		socket.data.user = {
			id: 'dev-user-1',
			email: 'dev@taskeradhd.local',
			displayName: 'Dev User'
		};
		return next();
		}
		
		// Verify token and attach user to socket
		const { verifyToken } = await import('./utils/jwt');
		const decoded = verifyToken(token);
		
		const user = await getPrisma().user.findUnique({
			where: { id: decoded.userId }
		});
		
		if (!user) {
			return next(new Error('User not found'));
		}
		
		socket.data.userId = user.id;
		socket.data.user = user;
		next();
	} catch (err) {
		next(new Error('Authentication error'));
	}
});

// Setup voice socket handlers
setupVoiceSocket(io);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
	console.error(err.stack);
	res.status(500).json({ 
		error: 'Something went wrong!',
		...(process.env.NODE_ENV === 'development' && { details: err.message })
	});
});

// 404 handler
app.use('*', (req, res) => {
	res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3001;

// Wait for Prisma to be ready before starting the server
prismaPromise.then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 TaskerADHD server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch((error) => {
  console.error('❌ Failed to initialize Prisma:', error);
  process.exit(1);
});

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
	console.log(`${signal} received, shutting down gracefully`);
	
	try {
		// Close Redis connections and workers (optional if Redis is disabled)
		const { redis, shapingWorker } = await import('./services/queue');
		if (shapingWorker) {
			console.log('Closing queue workers...');
			await shapingWorker.close();
		} else {
			console.log('Queue worker not initialized, skipping.');
		}
		if (redis) {
			console.log('Closing Redis connection...');
			await redis.quit();
		} else {
			console.log('Redis not configured, skipping.');
		}
		console.log('✅ Queue services shut down (if enabled)');
	} catch (error) {
		console.error('Error shutting down queue services:', error);
	}
	
	try {
		// Disconnect from database
		console.log('Disconnecting from database...');
		if (prisma) {
			await prisma.$disconnect();
			console.log('✅ Database disconnected');
		} else {
			console.log('Prisma client not initialized, skipping disconnect');
		}
	} catch (error) {
		console.error('Error disconnecting from database:', error);
	}
	
	// Close HTTP server
	server.close(() => {
		console.log('✅ HTTP server closed');
		console.log('Process terminated gracefully');
		process.exit(0);
	});
	
	// Force exit after 10 seconds if server doesn't close
	setTimeout(() => {
		console.warn('Forcing process exit after timeout');
		process.exit(1);
	}, 10000);
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
	await gracefulShutdown('SIGTERM');
});

process.on('SIGINT', async () => {
	await gracefulShutdown('SIGINT');
});
