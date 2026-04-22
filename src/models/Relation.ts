import User from './User'
import AiSession from './AiSession'
import AiPost from './AiPost'
import './EquipmentGif' // register model so Sequelize syncs the table

export const relations = () => {
  // User → AI sessions
  User.hasMany(AiSession, { foreignKey: 'userId' })
  AiSession.belongsTo(User, { foreignKey: 'userId' })

  // Session → AI turns
  AiSession.hasMany(AiPost, { foreignKey: 'sessionId', as: 'posts' })
  AiPost.belongsTo(AiSession, { foreignKey: 'sessionId', as: 'session' })
}
