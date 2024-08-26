import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';

/**
 * Middleware to verify JSON Web Tokens (JWT) for authenticated requests.
 *
 * This middleware checks for an access token in the request's cookies or
 * Authorization header. If a token is found, it verifies the token using
 * the secret key stored in the environment variable `ACCESS_TOKEN_SECRET`.
 *
 * If the token is successfully verified, the decoded token payload is
 * extracted to obtain the user's `_id`, `email`, `username`, and `fullName`.
 * These details are then attached to the `req.user` object for use in
 * subsequent middleware and route handlers.
 *
 * If the token is missing, invalid, expired, or not yet valid, an `ApiError`
 * is thrown with a `401 Unauthorized` status and an appropriate error message.
 *
 * Error Handling:
 * - `NotBeforeError`: Thrown when the current time is before the "nbf" (not before) claim, indicating that the token is not yet valid.
 * - `TokenExpiredError`: Thrown when the current time is after the "exp" (expiration) claim, indicating that the token has expired.
 * - `JsonWebTokenError`: A generic error for invalid tokens, such as when the token signature is invalid or the token is malformed.
 *
 * Usage:
 * This middleware should be used for routes that require user authentication.
 * Ensure this middleware is added after any token verification logic and before
 * any route handlers that require the user to be authenticated.
 *
 * Example:
 * app.get('/protected-route', verifyJWT, (req, res) => {
 *   // Access `req.user` to use the authenticated user's details.
 *   res.json({ message: 'This is a protected route!', user: req.user });
 * });
 *
 * @param {object} req - Express request object, modified to include `req.user` with the authenticated user's details.
 * @param {object} _ - Express response object, unused in this middleware.
 * @param {function} next - Express next middleware function.
 */
const verifyJWT = asyncHandler(async (req, _, next) => {
    const accessToken =
        req.cookies?.accessToken ||
        req.header('Authorization')?.replace('Bearer ', '');

    if (!accessToken) {
        console.log('No access Token');
        throw new ApiError(401, 'Unauthorized request.');
    }

    try {
        const decodedToken = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET
        );

        console.log('DECODED TOKEN IN VERIFY JWT - ', decodedToken);

        const { _id, email, username, fullName } = decodedToken;

        if (!decodedToken || !_id || !email || !username || !fullName) {
            throw new ApiError(401, 'Unauthorised Request.');
        }

        req.user = {
            _id,
            email,
            username,
            fullName,
        };
        next();
    } catch (err) {
        // Handle JWT-specific errors
        let message = 'Unauthorised Request.';
        if (err instanceof jwt.NotBeforeError) {
            message = 'Token is not yet valid.';
        } else if (err instanceof jwt.TokenExpiredError) {
            message = 'Token has expired.';
        } else if (err instanceof jwt.JsonWebTokenError) {
            message = 'Invalid token.';
        }
        throw new ApiError(401, message);
    }
});

const verifyRefreshToken = asyncHandler(async (req, _, next) => {
    const incommingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incommingRefreshToken) {
        throw new ApiError(401, 'Unauthorized request');
    }

    try {
        const decodedRefreshToken = jwt.verify(
            incommingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        console.log(
            'decodedRefreshToken IN VERIFY JWT - ',
            decodedRefreshToken
        );

        if (!decodedRefreshToken || !decodedRefreshToken._id) {
            throw new ApiError(401, 'Unauthorised Request.');
        }

        req.user = {
            _id: decodedRefreshToken._id,
            refreshToken: incommingRefreshToken,
        };
        next();
    } catch (err) {
        // Handle JWT-specific errors
        let message = 'Unauthorised Request.';
        if (err instanceof jwt.NotBeforeError) {
            message = 'Refresh Token is not yet valid.';
        } else if (err instanceof jwt.TokenExpiredError) {
            message = 'Refresh Token has expired.';
        } else if (err instanceof jwt.JsonWebTokenError) {
            message = 'Invalid Refresh Token.';
        }
        throw new ApiError(401, message);
    }
});

/**
 * Middleware to attach user information to the request object for authenticated users.
 *
 * Usage:
 * This middleware should be used only for routes that require authentication. Ensure
 * that the token is verified before this middleware runs.
 */

const addUserInfo = asyncHandler(async (req, _, next) => {
    const userInfo = await User.findById(req.user?._id).select(
        '-password -refreshToken'
    );
    if (!userInfo) {
        throw new ApiError(401, 'Invalid access token');
    }

    req.userInfo = userInfo;
    next();
});

export { verifyJWT, verifyRefreshToken, addUserInfo };
