"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modules = void 0;
const express_1 = __importDefault(require("express"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const handle_error_middleware_1 = require("../middleware/handle-error.middleware");
const routes_1 = __importDefault(require("../api/routes"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const modules = async (app) => {
    // Set up rate limiter: maximum of 100 requests per 15 minutes
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: "Too many requests from this IP, please try again after 15 minutes.",
        standardHeaders: true,
        legacyHeaders: false,
    });
    // Apply to all requests
    app.use(limiter);
    app.use(express_1.default.json({ limit: "50mb" }));
    app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
    app.use((0, express_fileupload_1.default)({
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }));
    app.use((0, cors_1.default)({
        origin: "*",
    }));
    // Serve uploaded images publicly (no token required)
    app.use("/uploads", express_1.default.static(path_1.default.join(process.cwd(), "uploads")));
    // `routes` is an array of Router instances.
    app.use(...routes_1.default);
    app.use(handle_error_middleware_1.handlerError);
};
exports.modules = modules;
