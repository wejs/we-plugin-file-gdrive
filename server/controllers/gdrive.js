const request = require('request');

module.exports = {
  updateAudioMetadata(req, res) {
    if (!req.isAuthenticated()) {
      return res.forbidden();
    }
    const we = req.we;
    const eid = req.body.id;

    we.log.info('gdrive:upload:complete request:audio:', {
      uid: req.user.id,
      externalId: eid
    });

    we.db.models.audio.findOne({
      where: {
        id: req.params.id,
        creatorId: req.user.id
      }
    })
    .then( (audio)=> {
      if (!audio) return res.notFound();

      return audio.updateAttributes({
        active: true,
        externalId: eid,
        originalname: req.body.name,
        extension: we.utils.mime.getExtension(req.body.mime),
        mime: req.body.mime,
        processStatus: 'salved',
        urls: {
          original: 'https://drive.google.com/file/d/'+eid+'/preview',
          download: 'https://drive.google.com/uc?export=download&id='+eid,
          view: 'https://drive.google.com/file/d/'+eid+'/view?usp=sharing'
        }
      });
    })
    .then( (r)=> {
      we.log.info('gdrive:upload complete:audio:', {
        uid: req.user.id,
        externalId: eid,
        audioId: r.id
      });

      res.send({ audio: r });
      return null;
    })
    .catch(res.queryError);
  },
  getAudioUploadUrl(req, res) {
    if (!req.isAuthenticated()) {
      return res.forbidden();
    }

    const GA = req.we.plugins['we-plugin-google-api'].GA;

    GA.refreshAccessTokenIfNeed( (err)=> {
      if (err) return res.queryError(err);

      const we = req.we,
        Model = we.db.models.audio,
        ss = we.systemSettings;

      const headers = {
        'User-Agent': req.headers['user-agent'],
        'Authorization': 'Bearer '+GA.oAuth2Client.credentials.access_token,
        'X-Upload-Content-Type': req.body.type,
        'X-Upload-Content-Length': req.body.size,
        'Origin': req.headers.origin
      };

      request({
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        method: 'POST',
        followAllRedirects: false,
        headers: headers,
        json: {
          name: req.body.name || 'teste upload',
          parents: [ss.googleDriveAudioFolderId]
        }
      }, function(err, httpResponse, body) {
        if (err) {
          req.we.log.error('getUploadUrl:Error', err, body);
          return res.queryError(err);
        }

        Model.create({
          label: req.body.label,
          description: req.body.description,
          size: req.body.size,
          mime: req.body.type,
          active: false,
          storageName: 'googleDrive',
          processStatus: 'upload_link',
          externalId: null,
          isLocalStorage: false,
          creatorId: req.user.id,
          urls: {}
        })
        .then( (record)=> {
          we.log.info('gdrive:new url upload request:audio:', {
            uid: req.user.id,
            folder: ss.googleDriveAudioFolderId,
            url: httpResponse.headers.location,
            recordId: record.id
          });

          res.send({
            uploadUrl: httpResponse.headers.location,
            audio: record
          });
          return null;
        })
        .catch(res.queryError);
      });
    });
  },

  updateVideoMetadata(req, res) {
    if (!req.isAuthenticated()) {
      return res.forbidden();
    }
    const we = req.we;
    const eid = req.body.id;

    we.log.info('gdrive:upload:complete request:video:', {
      uid: req.user.id,
      externalId: eid
    });

    we.db.models.video.findOne({
      where: {
        id: req.params.id,
        creatorId: req.user.id
      }
    })
    .then( (video)=> {
      if (!video) return res.notFound();

      return video.updateAttributes({
        active: true,
        externalId: eid,
        originalname: req.body.name,
        extension: we.utils.mime.getExtension(req.body.mime),
        mime: req.body.mime,
        processStatus: 'salved',
        urls: {
          original: 'https://drive.google.com/file/d/'+eid+'/preview',
          download: 'https://drive.google.com/uc?export=download&id='+eid,
          view: 'https://drive.google.com/file/d/'+eid+'/view?usp=sharing'
        }
      });
    })
    .then( (r)=> {
      we.log.info('gdrive:upload complete:video:', {
        uid: req.user.id,
        externalId: eid,
        videoId: r.id
      });

      res.send({ video: r });
      return null;
    })
    .catch(res.queryError);
  },
  getUploadUrl(req, res) {
    if (!req.isAuthenticated()) {
      return res.forbidden();
    }

    const GA = req.we.plugins['we-plugin-google-api'].GA;

    GA.refreshAccessTokenIfNeed( (err)=> {
      if (err) return res.queryError(err);

      const we = req.we,
        Model = we.db.models.video,
        ss = we.systemSettings;

      const headers = {
        'User-Agent': req.headers['user-agent'],
        'Authorization': 'Bearer '+GA.oAuth2Client.credentials.access_token,
        'X-Upload-Content-Type': req.body.type,
        'X-Upload-Content-Length': req.body.size,
        'Origin': req.headers.origin
      };

      request({
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        method: 'POST',
        followAllRedirects: false,
        headers: headers,
        json: {
          name: req.body.name || 'teste upload',
          parents: [ss.googleDriveVideoFolderId]
        }
      }, function(err, httpResponse, body) {
        if (err) {
          req.we.log.error('getUploadUrl:Error', err, body);
          return res.queryError(err);
        }

        Model.create({
          label: req.body.label,
          description: req.body.description,
          size: req.body.size,
          mime: req.body.type,
          active: false,
          storageName: 'googleDrive',
          processStatus: 'upload_link',
          externalId: null,
          isLocalStorage: false,
          creatorId: req.user.id,
          urls: {}
        })
        .then( (video)=> {
          we.log.info('gdrive:new url upload request:video:', {
            uid: req.user.id,
            folder: ss.googleDriveVideoFolderId,
            url: httpResponse.headers.location,
            videoId: video.id
          });

          res.send({
            uploadUrl: httpResponse.headers.location,
            video: video
          });
          return null;
        })
        .catch(res.queryError);
      });
    });
  }
}