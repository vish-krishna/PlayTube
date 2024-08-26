import { ApiResponse } from '../utils/ApiResponse.js';

const appErrorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Something went wrong!';

    return res
        .status(statusCode)
        .json(new ApiResponse(statusCode, null, message));
};

export { appErrorHandler };
