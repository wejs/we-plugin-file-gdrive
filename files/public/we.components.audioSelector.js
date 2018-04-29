/**
 * We.js client side lib
 */

(function (we) {

if (!we.cache) we.cache = {};
we.cache.audios = {};
we.cache.findAudio = function findAudio(id) {
  if (we.cache.audios[id]) return we.cache.audios[id];

  we.cache.audios[id] = $.ajax({
    method: 'get',
    url: '/api/v1/audio/'+id,
    dataType: 'json',
    headers: { Accept : 'application/json' }
  });

  return we.cache.audios[id];
};

we.components.audioSelector = {
  formModalContentIsLoad: true,
  currentRecord: null,

  selectAudio: function(cb) {
    this.audioSelectedHandler = cb;

    this.loadFormModalContentFromServer(function() {
      this.modal.modal('show');
    }.bind(this));
  },

  loadFormModalContentFromServer: function(cb) {
    var self = this;

    if (self.formModalContentCache) return cb(null, self.formModalContentCache);

    $.ajax({
      url: '/api/v1/audio/get-form-modal-content'
    }).then(function (html) {
      self.formModalContentCache = html;

      $('body').append(html);
      we.components.audioSelector.init('#audioSelectorFormModal');

      cb(null, self.formModalContentCache);
    });
  },
  audioSelected: function(err, file) {
    this.audioSelectedHandler(err, file);
    this.modal.modal('hide');
    this.resetProcess();
  },
  audioSelectedHandler: null,

  init: function(selector) {
    var self = this;
    this.modal = $(selector);
    this.messagesArea = this.modal.find('.audio-uploader-messages');
    this.uploader = this.modal.find('.audioupload');
    this.progress = this.modal.find('.progress');
    this.progressBar = this.progress.find('.progress-bar');

    // Change this to the location of your server-side upload handler:
    this.uploader.fileupload({
      dataType: 'json',
      sequentialUploads: true,
      add: function (e, data) {
        if (data.files && data.files[0]) {
          we.components.audioSelector.requestUploadUrl({
            name: data.files[0].name,
            size: data.files[0].size,
            type: data.files[0].type
          }, function(err, uploadUrl) {
            self.sendFileToGoogleDrive(data.files[0], uploadUrl, function(err, result) {
              self.saveUploadedFileData(result, function(err, r) {
                self.audioSelected(null, r.audio);
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
    this.selectAudio(function (err, file) {
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

  removeAudio: function(e, selector) {
    if (confirm('Tem certeza que deseja remover esse audio?')) {
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
      url: '/drive/get-audio-upload-url',
      data: data
    })
    .then(function (result) {
      if (result && result.uploadUrl) {
        self.currentRecord = result.audio;
        cb(null, result.uploadUrl);
      } else {
        cb('unknow response');
      }
    });
  },

  sendFileToGoogleDrive: function(file, uploadUrl, cb) {
    var up = we.components.audioSelector;

    $.ajax({
      url: uploadUrl,
      type: 'PUT',
      data: file,
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
      console.log('Error on upload audio to youtube', err);
      alert('Ocorreu um erro ao enviar o vídeo, tente novamente mais tarte ou entre '+
        'em contato com um administrador do sistema');
    });
  },

  saveUploadedFileData: function(gDriveResponse, cb) {
    $.ajax({
      type: 'POST',
      url: '/drive/audio/'+this.currentRecord.id,
      data: gDriveResponse
    })
    .then(function (result) {
      if (result && result.audio) {
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
    this.audioSelectedHandler = null;
  }
};

})(window.we);

window.addEventListener('WebComponentsReady', function() {
  var we = window.we;

  /**
   *  Audio description component
   *  usage: <we-audio-description data-id="{{id}}"></we-audio-description>
   */
  var WeAudioDescriptionPrototype = Object.create(HTMLElement.prototype);
  WeAudioDescriptionPrototype.createdCallback = function() {
    var self = this;

    var id = this.dataset.id;
    if (!id) return console.warn('data-id is required for we-file-description');

    we.cache.findAudio(id).then(function (result) {
      var html = '<div>';
      html += '<div class="vf-desc">'+result.audio.originalname+'</div>';
      if (result.audio.urls && result.audio.urls.original) {
        html +='<iframe width="320px" height="140px" src="'+result.audio.urls.original+
          '" frameborder="0" class="field-audio-preview" ></iframe>';
      }
      self.innerHTML = html+'</div>';
    });
  };

  document.registerElement('we-audio-description', {
    prototype: WeAudioDescriptionPrototype
  });
});