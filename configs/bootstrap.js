// configs/bootstrap.js
import path from 'path';
import morgan from 'morgan';
import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import engine from 'ejs-mate';
import dotenv from 'dotenv';
import flash from 'connect-flash';
import FileStore from 'session-file-store';
import fs from 'fs';
import crypto from 'crypto';

import websiteRoutes from '../website/configs/routes.js';
import adminRoutes from '../admin/configs/routes.js';
import { notFoundHandler, viewFlash, viewEnv, viewSession, viewHelpers } from './middlewares.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FileStoreSession = FileStore(session);

dotenv.config();

// Detectar si estamos en Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

export default function bootstrap(app) {
  // Logs - solo en desarrollo o si está activado
  if (process.env.NODE_ENV !== 'production' || process.env.LOGGING === 'true') {
    app.use(morgan('dev'));
  }

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS middleware - Configurar para Vercel
  app.use((req, res, next) => {
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',') 
      : ['https://*.vercel.app', 'http://localhost:4000', 'http://localhost:3000'];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes('*') || (origin && allowedOrigins.some(allowed => origin.includes(allowed.replace('*', ''))))) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Configuración de sesiones - Adaptada para Vercel
  const sessionPath = isVercel 
    ? '/tmp/sessions' 
    : path.join(__dirname, '../../sessions');

  // Crear directorio de sesiones (solo en local)
  if (!isVercel && !fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  // Configuración de la sesión
  const sessionConfig = {
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: 'lax'
    }
  };

  // En Vercel, usar store con path de /tmp
  if (isVercel) {
    // Crear directorio temporal si no existe
    if (!fs.existsSync('/tmp/sessions')) {
      fs.mkdirSync('/tmp/sessions', { recursive: true });
    }
    
    sessionConfig.store = new FileStoreSession({
      path: '/tmp/sessions',
      retries: 0,
      ttl: 60 * 60 * 24,
      reapInterval: 60 * 60 // Limpiar cada hora
    });
  } else {
    // En local, usar el path normal
    sessionConfig.store = new FileStoreSession({
      path: sessionPath,
      retries: 0,
      ttl: 60 * 60 * 24
    });
  }

  app.use(session(sessionConfig));
  app.use(flash());

  // Middlewares
  app.use(viewFlash);
  app.use(viewEnv);
  app.use(viewSession);
  app.use(viewHelpers);

  // Vistas - Configurar rutas absolutas para Vercel
  const viewsPath = path.join(__dirname, '../views');
  app.engine('ejs', engine);
  app.set('view engine', 'ejs');
  app.set('views', [viewsPath]);

  // Archivos estáticos - Orden importante para Vercel
  const distPath = path.join(__dirname, '../public/dist');
  if (fs.existsSync(distPath)) {
    app.use('/dist', express.static(distPath));
  }
  
  const publicPath = path.join(__dirname, '../public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // Variables globales
  app.locals.siteTitle = process.env.SITE_TITLE || 'Mi sitio web';
  app.locals.adminEmail = process.env.ADMIN_EMAIL || 'admin@ejemplo.com';

  // Rutas Web
  app.use('/', adminRoutes);
  app.use('/', websiteRoutes);

  // Para SPA de React - Redirigir todas las rutas no encontradas al index.html
  /*
  app.get('/*', (req, res, next) => {
    // Verificar si es una ruta de API o archivo estático
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
      return next();
    }
    // Servir el index.html de React
    const indexPath = path.join(__dirname, '../public/dist/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });*/

  // Middleware 404
  app.use(notFoundHandler);
}