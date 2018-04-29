module.exports = {
  addAllVideoHooks(we, done) {
    const models = we.db.models;
    const vid = we.file.video;
    const _ = we.utils._;

    for (let modelName in models) {
      let videoFields = vid.getModelFields(
        we.db.modelsConfigs[modelName]
      );

      if (_.isEmpty(videoFields)) continue;

      let model = models[modelName];

      model.addHook('afterFind', 'loadVideos', vid.afterFind);
      model.addHook('afterCreate', 'createVideo', vid.afterCreatedRecord);
      model.addHook('afterUpdate', 'updateVideo', vid.afterUpdatedRecord);
      model.addHook('afterDestroy', 'destroyVideo', vid.afterDeleteRecord);
    }

    done();
  },

  addAllAudioHooks(we, done) {
    const models = we.db.models;
    const aud = we.file.audio;
    const _ = we.utils._;

    for (let modelName in models) {
      let audioFields = aud.getModelFields(
        we.db.modelsConfigs[modelName]
      );

      if (_.isEmpty(audioFields)) continue;

      let model = models[modelName];

      model.addHook('afterFind', 'loadAudios', aud.afterFind);
      model.addHook('afterCreate', 'createAudio', aud.afterCreatedRecord);
      model.addHook('afterUpdate', 'updateAudio', aud.afterUpdatedRecord);
      model.addHook('afterDestroy', 'destroyAudio', aud.afterDeleteRecord);
    }

    done();
  }
};