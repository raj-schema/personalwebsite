Y.use([
  'node',
  'squarespace-gallery-ng',
  'squarespace-image-loader',
  'event-key',
  'justified-grid'
], function(Y) {

  Y.namespace('Wexley');

  Y.Wexley.Site = Singleton.create({

    ready: function() {
      this.slideshow = null;
      this.thumbs = null;
      this._resizeEmitter = new Y.Squarespace.ResizeEmitter({ timeout: 200 });

      Y.on('domready', this.initialize, this);
    },

    initialize: function() {

      this.setupNavigation();

      this._initializeThumbs();

      if (Y.UA.mobile) {
        Y.one(Y.config.win).on('orientationchange', function() {
          this._initializeThumbs();
        }, this);
      }

      if (Y.one('body.collection-type-gallery')) {
        this.setupGallery();
        this.setupTweakHandlers();
      } else if (Y.one('body.collection-type-blog')) {
        var sidebarEl = Y.one('#sidebarWrapper');
        Y.one('#page').setStyle('minHeight', sidebarEl.get('offsetHeight'));
      }
    },

    _initializeThumbs: function() {
      if (Y.config.win.innerWidth > 800) {
        this.loadThumbs();
      }
    },

    setupNavigation: function() {
      if (Modernizr && Modernizr.touch) {
        Y.all('.dropdown-hover .folder').each(function (f){
          if (f.all('a').size() > 1) {
            f.one('a').on('click', function (e) {
              e.preventDefault();
            });
          }
        });
      }

      // Mobile Nav ///////////////////////////////////
      if(Y.one('.mobile-nav')){

        Y.one('#mobileMenuLink').removeClass('hidden');
        var mobileMenu = Y.one('#mobileMenuLink a');
        var mobileMenuFolders = Y.all('.folder-toggle-label');

        var setMobileMenuHeight = function(e) {
          var mobileMenuHeight = parseInt(Y.one('#mobileNav .wrapper').get('offsetHeight'),10);

          if (Y.one('#mobileNav').hasClass('menu-open') && !e.currentTarget.hasClass('folder-toggle-label')) {
            new Y.Anim({ node: Y.one('#mobileNav'), to: { height: 0 }, duration: 0.5, easing: 'easeBoth' }).run();
          } else {
            new Y.Anim({ node: Y.one('#mobileNav'), to: { height: mobileMenuHeight }, duration: 0.5, easing: 'easeBoth' }).run();
          }

          Y.one('#mobileNav').toggleClass('menu-open');
        };

        if (mobileMenu) {
          mobileMenu.on('click', setMobileMenuHeight);
        }

        if (mobileMenuFolders.size() > 0) {
          mobileMenuFolders.on('click', function(e) {
            Y.later(100, this, function() {
              setMobileMenuHeight(e);
            });
          });
        }
      }



    },

    loadThumbs: function() {
      if (Y.one('body.full-view')) {
        return;
      }

      var wrapper = Y.one('#thumbList');

      if (Y.one('body.index-fullwidth') && wrapper && wrapper.one('.thumb')) {
        if (wrapper.justifiedgrid) {
          wrapper.justifiedgrid.refresh();
          return;
        }

        wrapper.plug(Y.Wexley.JustifiedGrid, {
          slides: '.thumb',
          gutter: parseInt(Y.one('.thumb').getComputedStyle('marginRight')),
          initialHeight: Y.one('.thumb').get('clientHeight')
        });
      } else {
        if (wrapper && wrapper.justifiedgrid) {
          wrapper.justifiedgrid.destructor();
        }

        Y.all('#thumbList img').each(function(img) {
          img.setStyle('height', null).get('parentNode').setStyles({
            marginRight: null,
            height: null,
            width: null
          });
          ImageLoader.load(img.removeAttribute('data-load'));
        });
      }
    },

    setupGallery: function() {
      if (Y.one('body').get('winWidth') < 800) {
        Y.all('#slideshow .slide').each(function(slide) {
          if (slide.one('.sqs-video-wrapper')) {
            slide.one('.sqs-video-wrapper').plug(Y.Squarespace.VideoLoader);
          } else {
            ImageLoader.load(slide.one('img').removeAttribute('data-load'));
          }
        });
      } else {
        var canvasPadding = parseInt(Y.Squarespace.Template.getTweakValue('outerPadding'),10);
        var logoHeight = parseInt(Y.Squarespace.Template.getTweakValue('logoSize'),10);
        var siteSubTitleHeight = Y.one('.logo-subtitle') ? Y.one('.logo-subtitle').get('offsetHeight') : 0;
        var headerHeight = Y.one('#headerWrapper').get('offsetHeight');
        if (logoHeight > headerHeight) {
          headerHeight = logoHeight + parseInt(Y.Squarespace.Template.getTweakValue('headerPadding'),10);
        }
        var controlsHeight = Y.one('#simpleControls').get('offsetHeight') + Y.one('#numberControls').get('offsetHeight') + Y.one('#dotControls').get('offsetHeight') + Y.one('#tinyThumbControls').get('offsetHeight') + 40;

        var setHeight = function() {
          var windowHeight = Y.one('body').get('winHeight');
          var headerHeight = Y.one('#headerWrapper').get('offsetHeight');

          if ((windowHeight - canvasPadding - headerHeight*2) > 600) {
            Y.one('#slideshowWrapper').setStyle('height', windowHeight - canvasPadding*2 - headerHeight - controlsHeight);
          } else {
            Y.one('#slideshowWrapper').setStyle('height', '600px');
          }
        };

        setHeight();

        this._resizeEmitter.on('resize:end', function(e) {
          this.loadThumbs();
          setHeight();
          this.slideshow.refresh();
        }, this);

        var itemId = (new Y.HistoryHash()).get('itemId');

        // full slideshow
        if (Y.one('#slideshow .slide')) {
          this.slideshow = new Y.Squarespace.Gallery2({
            container: Y.one('#slideshow'),
            elements: {
              next: '.next-slide',
              previous: '.prev-slide',
              controls: '#dotControls, #numberControls, #tinyThumbControls'
            },
            lazyLoad: true,
            loop: true,
            design: 'stacked',
            designOptions: {
              autoHeight: false,
              preloadCount: 1
            },
            loaderOptions: { mode: 'fit' },
            historyHash: true
          });
        }



        var lastKnownScrollY;

        Y.one('#thumbList').delegate('click', function(e) {
          lastKnownScrollY = Y.config.win.scrollY;
          this.slideshow.set('currentIndex', Y.all('.thumb').indexOf(e.currentTarget));
          Y.one('body').addClass('full-view');
          Y.one('#slideshowWrapper').addClass('slideshow-ready');
        }, '.thumb', this);

        Y.one('#imageInfoToggle').on('click', function(e) {
          Y.one('#slideshowWrapper').toggleClass('image-info-on');
        });


        /* Bind Escape Key to Close Lightbox
        **************************************/

        // Disable the escape to login if the lighbox is open.
        Y.one(window).on('key', function (e) {
          Y.one('.full-view') ? Y.Squarespace.EscManager.disable() : Y.Squarespace.EscManager.enable();
        }, 'esc');

        // Store the lightbox close function.
        var closeLightbox = Y.bind(function () {
          Y.one('body').removeClass('full-view');
          Y.one('#slideshowWrapper').removeClass('slideshow-ready');
          if (window.history && window.history.replaceState) {
            window.history.replaceState('itemId', null, Static.SQUARESPACE_CONTEXT.collection.fullUrl);
          }
          this.loadThumbs();
          Y.config.win.scrollTo(0,lastKnownScrollY);
        }, this);

        // Bind the event handlers.
        Y.one('#backToThumbs').on('click', closeLightbox, this);
        Y.one(window).on('key', closeLightbox, 'esc');


        if (itemId) {
          var thumbNode = Y.one('#thumbList .thumb[data-slide-id="'+itemId+'"]');
          thumbNode && thumbNode.simulate('click');
        }

      }

      // Fix for videos not stopping when closing lightbox.
      Y.one('#backToThumbs').on('click', function () {
        Y.all('.sqs-video-wrapper').each(function(video) {
          video.videoloader.reload();
        });
      });
    },

    setupTweakHandlers: function() {
      Y.Global.on('tweak:change', function(f){
        var tweakName = f.getName();

        if (tweakName == 'gallery-style' || f.getName() == 'gallery-auto-play' ) {
          if (tweakName == 'gallery-auto-play') {
            this.slideshow.set('autoplay', Y.Squarespace.Template.getTweakValue('gallery-auto-play') + '' === 'true');
          }
        } else if (tweakName.match(/indexItem|index-fullwidth/) !== null) {
          this.loadThumbs();
        }

        if (tweakName == 'indexItemPadding') {
          var thumbList = Y.one('#thumbList');
          if (thumbList.justifiedgrid) {
            thumbList.justifiedgrid.set('gutter', parseInt(thumbList.one('.thumb').getComputedStyle('marginRight')));
            thumbList.justifiedgrid.refresh();
          }
        }

        if (tweakName == 'index-fullwidth') {
          this.setupGallery();
        }
      }, this);

      Y.Global.on(['tweak:reset','tweak:beforeopen'], function(){
        this.slideshow && Y.later(500, this, function() {
          this.slideshow.refresh();
          this.loadThumbs();
        });
      }, this);

      Y.Global.on('tweak:close', function(){
        this.slideshow && Y.later(500, this, function() {
          this.slideshow.refresh();
          this.loadThumbs();
        });
      }, this);
    }

  });

});
