import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { appErrorHandler } from './middlewares/appErrorHandler.middleware.js';

const app = express();

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
);

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// import routes
import userRouter from './routes/user.routes.js';

app.use('/api/v1/users', userRouter);

app.use(appErrorHandler);

export { app };
