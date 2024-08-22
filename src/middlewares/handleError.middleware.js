import { ApiResponse } from '../utils/ApiResponse.js';

const handleError = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Something went wrong!';
    return res
        .status(statusCode)
        .json(new ApiResponse(statusCode, message, null));
};

export { handleError };
