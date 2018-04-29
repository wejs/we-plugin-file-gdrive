module.exports = {
  /**
   * Get we-plugin-view modal content for select files in it
   *
   * @apiName file.getFormModalContent
   * @apiGroup file
   *
   * @module Controller
   *
   * @param {Object} req Express.js request
   * @param {Object} res Express.js response
   * @param {Function} next Express.js callback
   *
   * @successResponse 200
   */
  getFormModalContent(req, res) {
    // only works with we-plugin-view
    if (!req.we.view) return res.notFound();

    res.send(
      req.we.view.renderTemplate(
        req.params.type+'/form-'+req.params.type+'-modal-content', res.locals.theme, res.locals
      )
    );
  },

  /**
   * Upload one video to default storage strategy and save metadata on database
   *
   * @apiName video.create
   * @apiGroup video
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
    // create video disabled
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

    we.db.models.video
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
