/**
 * Video association model
 */

module.exports = function Model (we) {
  // set sequelize model define and options
  const model = {
    definition: {
      modelName: {
        type: we.db.Sequelize.STRING,
        allowNull: false
      },
      modelId: {
        type: we.db.Sequelize.BIGINT,
        allowNull: false
      },
      field: {
        type: we.db.Sequelize.STRING,
        allowNull: false
      },
      order: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: false
      }
    },
    associations: {
      audio: {
        type: 'belongsTo',
        model: 'audio',
        constraints: false,
        foreignKey: 'audioId'
      }
    },
    options: { paranoid: false }
  }

  return model;
}
