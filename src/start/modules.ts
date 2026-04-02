import express, { Application } from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import path from 'path';
import { handlerError } from '../middleware/handle-error.middleware';
import routes from '../api/routes';

export const modules = async (app: Application) => {
  app.use(express.json());
  app.use(fileUpload());
  app.use(
    cors({
      origin: '*',
    }),
  );

  // Serve uploaded images publicly (no token required)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // `routes` is an array of Router instances.
  app.use(...routes);
  app.use(handlerError);
};
