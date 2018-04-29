/**
 * Main We.js google drive file storage plugin
 */

module.exports = function loadPlugin(projectPath, Plugin) {
  const plugin = new Plugin(__dirname);

  plugin.setConfigs({
    permissions: {}
  });

  plugin.setRoutes({
    'post /drive/get-upload-url': {
      controller: 'gdrive',
      action: 'getUploadUrl',
      responseType: 'json'
    },
    // upload/complete google drive upload process
    'post /drive/video/:id': {
      controller: 'gdrive',
      action: 'updateVideoMetadata',
      model: 'video',
      responseType: 'modal',
      permission: 'upload_gdrive_video'
    },

    'get /user/:userId/video': {
      controller: 'video',
      action: 'find',
      model: 'video',
      permission: 'find_user_video',
      search: {
        currentUserIs: {
          parser: 'paramIs',
          param: 'userId',
          runIfNull: true,
          target: {
            type: 'field',
            field: 'creatorId'
          }
        }
      }
    },
    'get /api/v1/video/:id([0-9]+)': {
      controller: 'video',
      action: 'findOne',
      model: 'video',
      responseType: 'json',
      permission: 'find_video'
    },
    'delete /api/v1/video/:name': {
      controller: 'video',
      action: 'destroy',
      model: 'video',
      responseType: 'json',
      permission: 'delete_video'
    },
    'get /api/v1/:type(video|audio)/get-form-modal-content': {
      controller: 'video',
      action: 'getFormModalContent',
      model: 'video',
      responseType: 'modal',
      permission: true
    },

    // audio
    'post /drive/get-audio-upload-url': {
      controller: 'gdrive',
      action: 'getAudioUploadUrl',
      responseType: 'json'
    },
    'post /drive/audio/:id': {
      controller: 'gdrive',
      action: 'updateAudioMetadata',
      model: 'audio',
      responseType: 'modal',
      permission: 'upload_gdrive_audio'
    },

    'get /user/:userId/audio': {
      controller: 'audio',
      action: 'find',
      model: 'audio',
      permission: 'find_user_audio',
      search: {
        currentUserIs: {
          parser: 'paramIs',
          param: 'userId',
          runIfNull: true,
          target: {
            type: 'field',
            field: 'creatorId'
          }
        }
      }
    },
    'get /api/v1/audio/:id([0-9]+)': {
      controller: 'audio',
      action: 'findOne',
      model: 'audio',
      responseType: 'json',
      permission: 'find_audio'
    },
    'delete /api/v1/audio/:name': {
      controller: 'audio',
      action: 'destroy',
      model: 'audio',
      responseType: 'json',
      permission: 'delete_audio'
    }
  });

  plugin.addJs('we.component.videoSelector', {
    weight: 20,
    pluginName: 'we-plugin-file-gdrive',
    path: 'files/public/we.components.videoSelector.js'
  });

  plugin.addJs('we.component.audioSelector', {
    weight: 20,
    pluginName: 'we-plugin-file-gdrive',
    path: 'files/public/we.components.audioSelector.js'
  });

  return plugin;
};