/**
 * Audio model
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

   // after define all models, add audio field hooks in models how have audios
  we.hooks.on('we:models:set:joins', sh.addAllAudioHooks);

  we.events.on('we:after:load:plugins', function (we) {
    if (!we.file) we.file = {}
    if (!we.file.audio) we.file.audio = {}
    const db = we.db

    we.file.audio.getModelFields = function getModelFields(Model) {
      if (!Model || !Model.options || !Model.options.audioFields) return null;
      return Model.options.audioFields
    }

    we.file.audio.afterFind = function afterFind (r, opts) {
      return new Promise( (resolve, reject)=> {
        const Model = this;

        // skip if is raw query that dont preload need model attrs and methods
        if (opts.raw) return resolve();

        if (_.isArray(r)) {
          async.each(r, (r1, next)=> {
            // we.db.models.audioassoc
            we.file.audio.afterFindRecord.bind(Model)(r1, opts, next);
          }, (err)=> {
            if (err) return reject(err);
            resolve();
          });
        } else {
          we.file.audio.afterFindRecord.bind(Model)(r, opts, (err)=> {
            if (err) return reject(err);
            resolve();
          });
        }
      });
    }

    we.file.audio.afterFindRecord = function afterFindRecord (r, opts, done) {
      const functions = [];
      const Model = this;
      // found 0 results
      if (!r) return done();
      // skip if is raw query that dont preload need model attrs and methods
      if (opts.raw || !r.setDataValue) return done();

      const fields = we.file.audio.getModelFields(this);
      if (!fields) return done();

      if (!r._salvedAudios) r._salvedAudios = {};
      if (!r._salvedaudioassocs) r._salvedaudioassocs = {};

      const fieldNames = Object.keys(fields);
      // for each field
      fieldNames.forEach( (fieldName)=> {
        functions.push( (next)=> {
          return db.models.audioassoc
          .findAll({
            where: {
              modelName: Model.name,
              modelId: r.id,
              field: fieldName
            },
            include: [{ all: true }]
          })
          .then( (audAssocs)=> {
            if (_.isEmpty(audAssocs)) {
              next();
              return null;
            }

            r._salvedAudios = audAssocs.map( (audAssoc)=> {
              return audAssoc.audio.toJSON();
            });

            r.setDataValue(fieldName, r._salvedAudios);
            // salved terms cache
            r._salvedaudioassocs[fieldName] = audAssocs;
            next();
            return null;
          })
          .catch((err)=> {
            we.log.error(err);
            next();
            return err;
          });
        })
      })

      async.parallel(functions, done);
    }
    // after create one record with audio fields
    we.file.audio.afterCreatedRecord = function afterCreatedRecord (r, opts) {
      return new Promise( (resolve, reject)=> {
        const functions = [];
        const Model = this;

        // skip if is raw query that dont preload need model attrs and methods
        if (opts.raw || !r.setDataValue) return resolve();

        const fields = we.file.audio.getModelFields(this);
        if (!fields) return resolve();

        const audioFields = Object.keys(fields);

        if (!r._salvedAudios) r._salvedAudios = {};
        if (!r._salvedaudioassocs) r._salvedaudioassocs = {};

        audioFields.forEach( (fieldName)=> {
          let values = r.get(fieldName);
          if (_.isEmpty(values)) return;

          const audiosToSave = [];
          const newaudioassocs = [];

          functions.push( (nextField)=> {
            async.each(values,  (value, next)=> {
              if (!value || (value === 'null')) return next();

              // check if the audio exists
              db.models.audio
              .findOne({
                where: { id: value.id || value }
              })
              .then( (i)=> {
                if (!i) {
                  next();
                  return null;
                }

                return db.models.audioassoc
                .create({
                  modelName: Model.name,
                  modelId: r.id,
                  field: fieldName,
                  audioId: value.id || value
                })
                .then( (r)=> {
                  we.log.verbose('Audio assoc created:', r.id);

                  audiosToSave.push(i);
                  newaudioassocs.push(r);

                  next();
                  return null;
                });
              })
              .catch(next);
            }, (err)=> {
              if (err) return nextField(err);

              r._salvedaudioassocs[fieldName] = newaudioassocs;
              r._salvedAudios[fieldName] = audiosToSave;
              r.setDataValue(fieldName, audiosToSave.map( (im)=> {
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
    // after update one record with audio fields
    we.file.audio.afterUpdatedRecord = function afterUpdatedRecord (r, opts) {
      return new Promise( (resolve, reject)=> {
        const Model = this;

        // skip if is raw query that dont preload need model attrs and methods
        if (opts.raw || !r.setDataValue) return resolve();

        const fields = we.file.audio.getModelFields(this);
        if (!fields) {
          return resolve();
        }

        const fieldNames = Object.keys(fields);
        async.eachSeries(fieldNames,  (fieldName, nextField)=> {
          // check if user whant update this field
          if (opts.fields.indexOf(fieldName) === -1) return nextField();

          let audiosToSave = _.clone(r.get(fieldName));
          let newaudioassocs = [];
          let newaudioassocsIds = [];

          async.series([
            function findOrCreateAllAssocs (done) {
              let preloadedAudiosAssocsToSave = [];

              async.each(audiosToSave, (its, next)=> {
                if (_.isEmpty(its) || its === 'null') return next();

                let values = {
                  modelName: Model.name,
                  modelId: r.id,
                  field: fieldName,
                  audioId: its.id || its
                };
                // check if this audio exits
                db.models.audio.findOne({
                  where: { id: its.id || its }
                })
                .then( (i)=> {
                  if (!i) {
                    done();
                    return null;
                  }
                  // find of create the assoc
                  return db.models.audioassoc
                  .findOrCreate({
                    where: values, defaults: values
                  })
                  .then( (r)=> {
                    r[0].audio = i;
                    preloadedAudiosAssocsToSave.push(r[0]);
                    next();
                    return null;
                  });
                })
                .catch(done);
              }, (err)=> {
                if (err) return done(err)

                audiosToSave = preloadedAudiosAssocsToSave.map( (r)=> {
                  newaudioassocsIds.push(r.id);
                  return r.audio
                });

                newaudioassocs = preloadedAudiosAssocsToSave;
                done();
              })
            },
            // delete removed audio assocs
            function deleteAssocs (done) {
              let query = {
                where: {
                  modelName: Model.name,
                  modelId: r.id,
                  field: fieldName
                }
              };

              if (!_.isEmpty(newaudioassocsIds)) {
                query.where.id = { [we.Op.notIn]: newaudioassocsIds };
              }

              db.models.audioassoc
              .destroy(query)
              .then( (result)=> {
                we.log.verbose('Result from deleted audio assocs: ', result, fieldName, Model.name);
                done();
                return null;
              })
              .catch(done);
            },
            function setRecorValues (done) {
              r._salvedAudios[fieldName] = audiosToSave;
              r._salvedaudioassocs[fieldName] = newaudioassocs;
              r.setDataValue(fieldName, audiosToSave.map( (im)=> {
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
    // delete the audio associations after delete related model
    we.file.audio.afterDeleteRecord = function afterDeleteRecord (r) {
      return new Promise( (resolve, reject)=> {
        const Model = this;

        db.models.audioassoc
        .destroy({
          where: {
            modelName: Model.name,
            modelId: r.id
          }
        })
        .then( (result)=> {
          we.log.debug('Deleted ' + result + ' audio assocs from record with id: ' + r.id);
          resolve();
          return null;
        })
        .catch(reject);
      });
    }
  });

  return model;
}
