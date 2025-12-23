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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Accept', 'Cache-Control', 'cache-control', 'Pragma', 'x-token']
  };

  app.use(cors(corsOptions));

  // Enable compression for better performance
  app.use(compression());

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

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs (was 100)
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
      return false;
    }
  });

  // Authentication rate limiting (stricter)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit login attempts (was 5)
    message: {
      error: 'Too many login attempts, please try again later.'
    },
    skipSuccessfulRequests: true
  });

  // Apply general rate limiting
  app.use(limiter);

  // Apply auth rate limiting to auth routes
  app.use('/api/auth', authLimiter);
  app.use('/api/authRoutes', authLimiter);

  console.log('🔒 Security middleware initialized');
};

export default securityMiddleware;