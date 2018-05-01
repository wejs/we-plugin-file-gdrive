/**
 * We.js client side lib
 */

(function (we) {

if (!we.cache) we.cache = {};
we.cache.videos = {};
we.cache.findVideo = function findVideo(id) {
  if (we.cache.videos[id]) return we.cache.videos[id];

  we.cache.videos[id] = $.ajax({
    method: 'get',
    url: '/api/v1/video/'+id,
    dataType: 'json',
    headers: { Accept : 'application/json' }
  });

  return we.cache.videos[id];
};

we.components.videoSelector = {
  formModalContentIsLoad: true,
  currentRecord: null,

  selectVideo: function(cb) {
    this.videoSelectedHandler = cb;

    this.loadFormModalContentFromServer(function() {
      this.modal.modal('show');
    }.bind(this));
  },

  loadFormModalContentFromServer: function(cb) {
    var self = this;

    if (self.formModalContentCache) return cb(null, self.formModalContentCache);

    $.ajax({
      url: '/api/v1/video/get-form-modal-content'
    }).then(function (html) {
      self.formModalContentCache = html;

      $('body').append(html);
      we.components.videoSelector.init('#videoSelectorFormModal');

      cb(null, self.formModalContentCache);
    });
  },
  videoSelected: function(err, file) {
    this.videoSelectedHandler(err, file);
    this.modal.modal('hide');
    this.resetProcess();
  },
  videoSelectedHandler: null,

  init: function(selector) {
    var self = this;
    this.modal = $(selector);
    this.messagesArea = this.modal.find('.video-uploader-messages');
    this.uploader = this.modal.find('.videoupload');
    this.progress = this.modal.find('.progress');
    this.progressBar = this.progress.find('.progress-bar');

    // Change this to the location of your server-side upload handler:
    this.uploader.fileupload({
      dataType: 'json',
      sequentialUploads: true,
      add: function (e, data) {
        if (data.files && data.files[0]) {
          we.components.videoSelector.requestUploadUrl({
            name: data.files[0].name,
            size: data.files[0].size,
            type: data.files[0].type
          }, function(err, uploadUrl) {
            self.sendFileToGoogleDrive(data.files[0], uploadUrl, function(err, result) {
              self.saveUploadedFileData(result, function(err, r) {
                self.videoSelected(null, r.video);
              });
            });
          });
        }

        $('.fileinput-button').hide();
        self.progress.show();
      }
    })
    .prop('disabled', !$.support.fileInput)
    .parent().addClass($.support.fileInput ? undefined : 'disabled');

    function newMessage(status, message) {
     self.messagesArea.append('<div data-dismiss="alert" aria-label="Close" class="alert alert-' + status + '">'+
        '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">×</span></button>' +
       message + ' </div>');
    }

  },
  selectForField: function(selector, name) {
    var self = this;
    this.selectVideo(function (err, file) {
      if (err) throw new Error('Error on select file.');
      self.showFieldData(selector, name, file);
    });
  },

  showFieldData: function(fieldSelector, name, file) {
    var row = $(fieldSelector + 'FieldTemplates tr').clone();
    row.find('td[data-file-name]').html(
      file.originalname +
      '<input name="'+name+'" type="hidden" value="'+file.id+'">'
    );

    if ($(fieldSelector).attr('data-multiple') !== 'true'){
      $(fieldSelector + 'BTNSelector').hide();
    }

    $(fieldSelector + 'Table tbody').append(row);
    $(fieldSelector + 'Table').show();
  },

  removeVideo: function(e, selector) {
    if (confirm('Tem certeza que deseja remover esse vídeo?')) {
      var tbody = $(e).parent().parent().parent();
      $(e).parent().parent().remove();
      if (!tbody.find('tr').length) {
        $(selector + 'BTNSelector').show();
        $(selector + 'Table').hide();
      }
    }
  },
  updateProgressBar: function(e, data) {
    var progress = parseInt(data.loaded / data.total * 100, 10);
    this.progressBar.css( 'width', progress + '%' );
  },

  requestUploadUrl: function(data, cb) {
    var self = this;

    $.ajax({
      type: 'POST',
      url: '/drive/get-upload-url',
      data: data,
      headers: {
        'x-Origin': location.origin
      }
    })
    .then(function (result) {
      if (result && result.uploadUrl) {
        self.currentRecord = result.video;
        cb(null, result.uploadUrl);
      } else {
        cb('unknow response');
      }
    });
  },

  sendFileToGoogleDrive: function(file, uploadUrl, cb) {
    var up = we.components.videoSelector;

    $.ajax({
      url: uploadUrl,
      type: 'PUT',
      data: file,
      headers: {
        'X-Origin': location.origin
      },
      crossDomain: true,
      contentType: false,
      processData: false,
      xhr: function() {
        var myXhr = $.ajaxSettings.xhr();
        if (myXhr.upload) {
          myXhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
              up.updateProgressBar(e, e);
            }
          } , false);
        }
        return myXhr;
      }
    })
    .then(function (result) {
      cb(null, result);
    })
    .fail( function(err) {
      console.log('Error on upload video to youtube', err);
      alert('Ocorreu um erro ao enviar o vídeo, tente novamente mais tarte ou entre '+
        'em contato com um administrador do sistema');
    });
  },

  saveUploadedFileData: function(gDriveResponse, cb) {
    $.ajax({
      type: 'POST',
      url: '/drive/video/'+this.currentRecord.id,
      data: gDriveResponse
    })
    .then(function (result) {
      if (result && result.video) {
        cb(null, result);
      } else {
        cb('unknow response');
      }
    });
  },

  resetProcess: function() {
    this.currentRecord = null;
    $('.fileinput-button').show();
    this.progress.hide();
    this.progressBar.css( 'width', '0%' );
    this.videoSelectedHandler = null;
  }
};

})(window.we);

window.addEventListener('WebComponentsReady', function() {
  var we = window.we;

  /**
   *  Video description component
   *  usage: <we-video-description data-id="{{id}}"></we-video-description>
   */
  var WeVideoDescriptionPrototype = Object.create(HTMLElement.prototype);
  WeVideoDescriptionPrototype.createdCallback = function() {
    var self = this;

    var id = this.dataset.id;
    if (!id) return console.warn('data-id is required for we-file-description');

    we.cache.findVideo(id).then(function (result) {
      var html = '<div>';
      html += '<div class="vf-desc">'+result.video.originalname+'</div>';
      if (result.video.urls && result.video.urls.original) {
        html +='<iframe width="320px" height="240px" src="'+result.video.urls.original+
          '" frameborder="0" class="field-video-preview" ></iframe>';
      }
      self.innerHTML = html+'</div>';
    });
  };

  document.registerElement('we-video-description', {
    prototype: WeVideoDescriptionPrototype
  });
});