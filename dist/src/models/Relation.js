"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.relations = void 0;
const User_1 = __importDefault(require("./User"));
const AiSession_1 = __importDefault(require("./AiSession"));
const AiPost_1 = __importDefault(require("./AiPost"));
const relations = () => {
    // User -> AI sessions
    User_1.default.hasMany(AiSession_1.default, { foreignKey: "userId" });
    AiSession_1.default.belongsTo(User_1.default, { foreignKey: "userId" });
    // Session -> AI turns
    AiSession_1.default.hasMany(AiPost_1.default, { foreignKey: "sessionId" });
    AiPost_1.default.belongsTo(AiSession_1.default, { foreignKey: "sessionId" });
};
exports.relations = relations;
