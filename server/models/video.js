/**
 * Video model
 */

const sh = require('../../lib/media.js'),
  uuid = require('uuid');

module.exports = function Model (we) {
  const _ = we.utils._,
    async = we.utils.async;

  const model = {
    definition: {
      // - user given data text
      label: { type: we.db.Sequelize.STRING },
      description: { type: we.db.Sequelize.TEXT },
      // - data get from file
      name: {
        type: we.db.Sequelize.STRING,
        allowNull: false,
        unique: true,
        defaultValue() {
          return Date.now() + '_' + uuid.v1();
        }
      },

      size: { type: we.db.Sequelize.INTEGER },
      encoding: { type: we.db.Sequelize.STRING },

      active: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: true
      },

      originalname: { type: we.db.Sequelize.STRING },
      mime: { type: we.db.Sequelize.STRING },
      extension: { type: we.db.Sequelize.STRING },

      storageName: { type: we.db.Sequelize.STRING },
      isLocalStorage: {
        type: we.db.Sequelize.BOOLEAN,
        defaultValue: true
      },

      externalId: { type: we.db.Sequelize.TEXT },
      processStatus: {
        type: we.db.Sequelize.STRING,
        size: 20
      },

      urls: {
        type: we.db.Sequelize.BLOB,
        allowNull: false,
        skipSanitizer: true,
        get() {
          var v = this.getDataValue('urls')
          if (!v) return {}

          if (v instanceof Buffer) {
            try {
              return JSON.parse(v.toString('utf8'))
            } catch (e) {
              we.log.error('error on parse file urls from db', e)
              return {}
            }
          } else if (typeof v == 'string') {
            return JSON.parse(v)
          } else {
            return v
          }
        },
        set(v) {
          if (!v) v = {}
          if (typeof v != 'object')
            throw new Error('file:urls:need_be_object')

          this.setDataValue('urls', JSON.stringify(v))
        }
      },

      extraData: {
        type: we.db.Sequelize.BLOB,
        skipSanitizer: true,
        get() {
          var v = this.getDataValue('extraData')
          if (!v) return {}

          if (v instanceof Buffer) {
            try {
              return JSON.parse(v.toString('utf8'))
            } catch (e) {
              we.log.error('error on parse file extraData from db', e)
              return {}
            }
          } else if (typeof v == 'string') {
            return JSON.parse(v)
          } else {
            return v
          }
        },
        set(v) {
          if (!v) v = {}
          if (typeof v != 'object')
            throw new Error('file:extraData:need_be_object')

          this.setDataValue('extraData', JSON.stringify(v))
        }
      }
    },
    associations: {
      creator: { type: 'belongsTo', model: 'user' }
    },

    options: {}
  }

   // after define all models, add video field hooks in models how have videos
  we.hooks.on('we:models:set:joins', sh.addAllVideoHooks);

  we.events.on('we:after:load:plugins', function (we) {
    if (!we.file) we.file = {}
    if (!we.file.video) we.file.video = {}
    const db = we.db

    we.file.video.getModelFields = function getModelFields(Model) {
      if (!Model || !Model.options || !Model.options.videoFields) return null;
      return Model.options.videoFields
    }

    we.file.video.afterFind = function afterFind (r, opts) {
      return new Promise( (resolve, reject)=> {
        const Model = this;

        // skip if is raw query that dont preload need model attrs and methods
        if (opts.raw) return resolve();

        if (_.isArray(r)) {
          async.each(r, (r1, next)=> {
            // we.db.models.videoassoc
            we.file.video.afterFindRecord.bind(Model)(r1, opts, next);
          }, (err)=> {
            if (err) return reject(err);
            resolve();
          });
        } else {
          we.file.video.afterFindRecord.bind(Model)(r, opts, (err)=> {
            if (err) return reject(err);
            resolve();
          });
        }
      });
    }

    we.file.video.afterFindRecord = function afterFindRecord (r, opts, done) {
      const functions = [];
      const Model = this;
      // found 0 results
      if (!r) return done();
      // skip if is raw query that dont preload need model attrs and methods
      if (opts.raw || !r.setDataValue) return done();

      const fields = we.file.video.getModelFields(this);
      if (!fields) return done();

      if (!r._salvedVideos) r._salvedVideos = {};
      if (!r._salvedvideoassocs) r._salvedvideoassocs = {};

      const fieldNames = Object.keys(fields);
      // for each field
      fieldNames.forEach( (fieldName)=> {
        functions.push( (next)=> {
          return db.models.videoassoc
          .findAll({
            where: {
              modelName: Model.name,
              modelId: r.id,
              field: fieldName
            },
            include: [{ all: true }]
          })
          .then( (vidAssocs)=> {
            if (_.isEmpty(vidAssocs)) {
              next();
              return null;
            }

            r._salvedVideos = vidAssocs.map( (vidAssoc)=> {
              return vidAssoc.video.toJSON();
            });

            r.setDataValue(fieldName, r._salvedVideos);
            // salved terms cache
            r._salvedvideoassocs[fieldName] = vidAssocs;
            next();
            return null;
          })
          .catch(next);
        })
      })

      async.parallel(functions, done);
    }
    // after create one record with video fields
    we.file.video.afterCreatedRecord = function afterCreatedRecord (r, opts) {
      return new Promise( (resolve, reject)=> {
        const functions = [];
        const Model = this;

        // skip if is raw query that dont preload need model attrs and methods
        if (opts.raw || !r.setDataValue) return resolve();

        const fields = we.file.video.getModelFields(this);
        if (!fields) return resolve();

        const videoFields = Object.keys(fields);

        if (!r._salvedVideos) r._salvedVideos = {};
        if (!r._salvedvideoassocs) r._salvedvideoassocs = {};

        videoFields.forEach( (fieldName)=> {
          let values = r.get(fieldName);
          if (_.isEmpty(values)) return;

          const videosToSave = [];
          const newvideoassocs = [];

          functions.push( (nextField)=> {
            async.each(values,  (value, next)=> {
              if (!value || (value === 'null')) return next();

              // check if the video exists
              db.models.video
              .findOne({
                where: { id: value.id || value }
              })
              .then( (i)=> {
                if (!i) {
                  next();
                  return null;
                }

                return db.models.videoassoc
                .create({
                  modelName: Model.name,
                  modelId: r.id,
                  field: fieldName,
                  videoId: value.id || value
                })
                .then( (r)=> {
                  we.log.verbose('Video assoc created:', r.id);

                  videosToSave.push(i);
                  newvideoassocs.push(r);

                  next();
                  return null;
                });
              })
              .catch(next);
            }, (err)=> {
              if (err) return nextField(err);

              r._salvedvideoassocs[fieldName] = newvideoassocs;
              r._salvedVideos[fieldName] = videosToSave;
              r.setDataValue(fieldName, videosToSave.map( (im)=> {
                return im.toJSON();
              }));

              nextField();
            });
          });
        });

        async.series(functions, (err)=> {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    // after update one record with video fields
    we.file.video.afterUpdatedRecord = function afterUpdatedRecord (r, opts) {
      return new Promise( (resolve, reject)=> {
        const Model = this;

        // skip if is raw query that dont preload need model attrs and methods
        if (opts.raw || !r.setDataValue) return resolve();

        const fields = we.file.video.getModelFields(this);
        if (!fields) {
          return resolve();
        }

        const fieldNames = Object.keys(fields);
        async.eachSeries(fieldNames,  (fieldName, nextField)=> {
          // check if user whant update this field
          if (opts.fields.indexOf(fieldName) === -1) return nextField();

          let videosToSave = _.clone(r.get(fieldName));
          let newvideoassocs = [];
          let newvideoassocsIds = [];

          async.series([
            function findOrCreateAllAssocs (done) {
              let preloadedVideosAssocsToSave = [];

              async.each(videosToSave, (its, next)=> {
                if (_.isEmpty(its) || its === 'null') return next();

                let values = {
                  modelName: Model.name,
                  modelId: r.id,
                  field: fieldName,
                  videoId: its.id || its
                };
                // check if this video exits
                db.models.video.findOne({
                  where: { id: its.id || its }
                })
                .then( (i)=> {
                  if (!i) {
                    done();
                    return null;
                  }
                  // find of create the assoc
                  return db.models.videoassoc
                  .findOrCreate({
                    where: values, defaults: values
                  })
                  .then( (r)=> {
                    r[0].video = i;
                    preloadedVideosAssocsToSave.push(r[0]);
                    next();
                    return null;
                  });
                })
                .catch(done);
              }, (err)=> {
                if (err) return done(err)

                videosToSave = preloadedVideosAssocsToSave.map( (r)=> {
                  newvideoassocsIds.push(r.id);
                  return r.video
                });

                newvideoassocs = preloadedVideosAssocsToSave;
                done();
              })
            },
            // delete removed video assocs
            function deleteAssocs (done) {
              let query = {
                where: {
                  modelName: Model.name,
                  modelId: r.id,
                  field: fieldName
                }
              };

              if (!_.isEmpty(newvideoassocsIds)) {
                query.where.id = { [we.Op.notIn]: newvideoassocsIds };
              }

              db.models.videoassoc
              .destroy(query)
              .then( (result)=> {
                we.log.verbose('Result from deleted video assocs: ', result, fieldName, Model.name);
                done();
                return null;
              })
              .catch(done);
            },
            function setRecorValues (done) {
              r._salvedVideos[fieldName] = videosToSave;
              r._salvedvideoassocs[fieldName] = newvideoassocs;
              r.setDataValue(fieldName, videosToSave.map( (im)=> {
                return im.toJSON();
              }));
              done();
            }
          ], nextField);
        }, (err)=> {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    // delete the video associations after delete related model
    we.file.video.afterDeleteRecord = function afterDeleteRecord (r) {
      return new Promise( (resolve, reject)=> {
        const Model = this;

        db.models.videoassoc
        .destroy({
          where: {
            modelName: Model.name,
            modelId: r.id
          }
        })
        .then( (result)=> {
          we.log.debug('Deleted ' + result + ' video assocs from record with id: ' + r.id);
          resolve();
          return null;
        })
        .catch(reject);
      });
    }
  });

  return model;
}
