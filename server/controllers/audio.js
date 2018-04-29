module.exports = {
  /**
   * Upload one audio to default storage strategy and save metadata on database
   *
   * @apiName audio.create
   * @apiGroup audio
   *
   * @module Controller
   *
   * @param {Object} req Express.js request
   * @param {Object} res Express.js response
   * @param {Function} next Express.js callback
   *
   * @successResponse 201
   */
  create(req, res) {
    // create audio disabled
    return res.notFound();
  },
  /**
   * Delete one file
   *
   * @apiName file.destroy
   * @apiGroup file
   *
   * @module Controller
   *
   * @param {Object} req Express.js request
   * @param {Object} res Express.js response
   * @param {Function} next Express.js callback
   *
   * @successResponse 204
   */
  destroy(req, res) {
    const we = req.we;

    we.db.models.audio
    .findOne({
      where: { name: req.params.name }
    })
    .then(function afterDelete (record) {
      if (!record) return res.notFound();

      res.locals.deleted = true;

      var storage = we.config.upload.storages[record.storageName];
      if (!storage) return res.serverError('we-plugin-file:delete:storage:not_found');

      storage.destroyFile(record, function afterDeleteFile(err) {
        if (err) return res.serverError(err);
        return res.deleted();
      });

      return null;
    })
    .catch(res.queryError);
  }
}
