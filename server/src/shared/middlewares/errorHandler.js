import logger from "../config/logger.js"
import ResponseFormatter from "../utils/responseFormatter.js"

// Agent
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || res.statusCode || 500;
    if (statusCode < 400 || statusCode > 599) statusCode = 500;
    let message = err.message || "Internal server error";
    let errors = err.errors || null;

    logger.error('Error occurred:', {
        message: err.message,
        statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    if (err.name === "ValidationError") {
        statusCode = 400;
        errors = err.errors ? Object.values(err.errors).map((e) => e.message) : [err.message];
        message = errors.join(". ") || "Validation Error";
    } else if (err.name === 'MongoServerError' && err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
        const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
        message = `${formattedField} already exists`;
        errors = [message];
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    res.status(statusCode).json(ResponseFormatter.error(message, statusCode, errors));
};

export default errorHandler;