import User from "./User";
import AiSession from "./AiSession";
import AiPost from "./AiPost";

export const relations = () => {
  // User -> AI sessions
  User.hasMany(AiSession, { foreignKey: "userId" });
  AiSession.belongsTo(User, { foreignKey: "userId" });

  // Session -> AI turns
  AiSession.hasMany(AiPost, { foreignKey: "sessionId" });
  AiPost.belongsTo(AiSession, { foreignKey: "sessionId" });
};
