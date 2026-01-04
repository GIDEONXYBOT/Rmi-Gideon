import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';

// Production security configuration
const securityMiddleware = (app) => {
  // CORS MUST come first, before all other middleware
  // Simple and permissive CORS for development/testing
  const corsOptions = {
    origin: true, // Allow all origins for now - this fixes CORS issues
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Accept', 'Cache-Control', 'cache-control', 'Pragma', 'x-token', 'X-TOKEN'],
    exposedHeaders: ['Content-Type', 'Authorization', 'x-token', 'X-TOKEN'],
    maxAge: 86400 // Cache preflight for 24 hours
  };

  app.use(cors(corsOptions));

  // Enable compression for better performance
  app.use(compression());

  // Concurrent request limiter to prevent server overload
  let activeRequests = 0;
  const maxConcurrentRequests = 100; // Allow up to 100 concurrent requests

  app.use((req, res, next) => {
    if (activeRequests >= maxConcurrentRequests) {
      console.log(`⚠️ Server busy: ${activeRequests} active requests, rejecting request to ${req.path}`);
      return res.status(503).json({
        error: 'Server is temporarily busy. Please try again in a moment.',
        retryAfter: 5
      });
    }

    activeRequests++;
    console.log(`📈 Active requests: ${activeRequests}`);

    res.on('finish', () => {
      activeRequests--;
      console.log(`📉 Active requests: ${activeRequests}`);
    });

    res.on('close', () => {
      activeRequests--;
      console.log(`📉 Active requests (closed): ${activeRequests}`);
    });

    next();
  });

  // Security headers with Helmet (adjusted for CORS and external data)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "ws:"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"]
      }
    },
    crossOriginEmbedderPolicy: false // Allow cross-origin requests for API
  }));

  // Rate limiting (more permissive for concurrent users)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Increased from 1000 to 5000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for GET requests (read-only operations)
      if (req.method === 'GET') {
        return true;
      }
      // Skip rate limiting for health checks
      if (req.path === '/api/health') {
        return true;
      }
      return false;
    },
    keyGenerator: (req) => {
      // Use IP + path combination to distribute load better
      return `${req.ip}-${req.path}`;
    }
  });

  // Authentication rate limiting (more permissive for multiple users)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes (reduced from 1 hour)
    max: 500, // Increased from 50 to 500 login attempts per 15 minutes
    message: {
      error: 'Too many login attempts, please try again later.'
    },
    skipSuccessfulRequests: true, // Don't count successful logins
    keyGenerator: (req) => {
      // Use a combination of IP and user agent to prevent abuse while allowing multiple users from same IP
      return `${req.ip}-${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`;
    },
    handler: (req, res) => {
      // Custom handler with retry information
      res.status(429).json({
        error: 'Too many login attempts, please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime - Date.now()) / 1000,
        limit: req.rateLimit.limit,
        remaining: req.rateLimit.remaining
      });
    }
  });

  // Apply general rate limiting
  app.use(limiter);

  // Apply auth rate limiting to auth routes
  app.use('/api/auth', authLimiter);
  app.use('/api/authRoutes', authLimiter);

  console.log('🔒 Security middleware initialized');
};

export default securityMiddleware;