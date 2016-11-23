/**
 * A module that makes a justified grid of images.
 *
 * @module justified-grid
 * @author kfoley
 */
YUI.add('justified-grid', function ( Y ) {

  Y.namespace( 'Wexley' );

  /**
   * A plugin to make a group of
   * images have justified alignment
   * in a grid.
   *
   * @class JustifiedGrid
   * @constructor
   * @namespace Squarespace.Plugins
   * @extends Plugin.Base
   */
  Y.Wexley.JustifiedGrid = Y.Base.create( 'justified-grid', Y.Plugin.Base, [], {

    initializer: function() {
      this._render( this._getGridData() );

      if ( this.get('refreshOnResize') ) {
        var resizeEmitter = new Y.Squarespace.ResizeEmitter( { timeout: 200 } );

        resizeEmitter.on( 'resize:start', function () {
          if ( Y.UA.safari ) {
            // Safari has a weird bug where the images don't repaint
            // nicely on resize. Messing with the display style forces
            // a repaint on the images and it seems to fix the problem.
            this.get( 'host' ).all( this.get( 'slides' ) ).setStyle( 'display', 'none' );
          }

          this._clearStyles();
        }, this);

        resizeEmitter.on( 'resize:end', function () {
          if ( Y.UA.safari ) {
            // Remove the display definition that web made on resize
            // start if the user is in safari.
            this.get( 'host' ).all( this.get('slides') ).setStyle( 'display', '' );
          }

          this.refresh();
        }, this);
      }
    },


    destructor: function () {
      this._clearStyles();
      this._containerWidth = null;
    },


    /**
     * @method refresh
     * @expose
     */
    refresh: function () {
      this._render( this._getGridData() );
    },


    /**
     * Clear all the inline styles
     * on the host and slides.
     *
     * @method _clearStyles
     * @private
     */
    _clearStyles: function () {
      this.get( 'host' ).setStyles( {
        position: null,
        height: null,
        overflowX: null
      } );

      this.get( 'host' ).all(this.get( 'slides' ) ).each( function( slide ) {
        slide.removeAttribute( 'style' );
        slide.one( 'img' ).removeAttribute( 'style' );
      } );
    },


    /**
     * Build the data object for
     * the image grid.
     *
     * @method _getGridData
     * @private
     * @return {Object} The rows, their default values, and their scale factors.
     */
    _getGridData: function () {
      this._containerWidth = this.get( 'host' ).get( 'clientWidth' );

      var gutter = this.get( 'gutter' );
      var $slides = this.get( 'host' ).all( this.get( 'slides' ) );

      var rows = [];

      var currentRow = { items: [] };
      var currentRowWidth = 0;
      var currentNode = {};

      var imgData;
      var imgNode;

      // Loop through all the slides and store
      // data about rows and images sizes.
      $slides.each(function( $slide, index ) {
        imgData = ImageLoader._getDataFromNode($slide.one( 'img' ) );

        currentNode.width = ImageLoader.getDimensionForValue( 'width', this.get( 'initialHeight' ), imgData ) || 0;
        currentNode.el = $slide;

        var items;

        if (currentRow.items.length > 0) {
          items = currentRow.items.length - 1;
        } else {
          items = 1;
        }

        if ( currentRowWidth + currentNode.width + gutter * ( items ) <= this._containerWidth || currentRow.items.length < 1 ) {
          currentRowWidth = currentRowWidth + currentNode.width;
          currentRow.items.push( currentNode );
        } else {
          // Build the row object.
          currentRow.width = currentRowWidth;
          currentRow.scale = this._calculatescale( currentRow, currentRowWidth );
          rows.push( currentRow );

          // Reset variables.
          currentRow = { items: [] };
          currentRow.items.push( currentNode );
          currentRowWidth = currentNode.width;
        }

        // Handle the last row.
        if ( index == $slides.size() - 1 ) {
          // Build the row object.
          currentRow.width = currentRowWidth;
          currentRow.scale = this._calculatescale(currentRow, currentRowWidth);

          if ( currentRow.scale > 1.5 ) {
            var previous = rows[rows.length - 2];

            if ( previous ) {
              if ( previous.width * previous.scale > this._containerWidth - ( previous.items.length * gutter ) ) {
                currentRow.scale = previous.scale;
              } else {
                currentRow.scale = 1;
              }
            } else {
              currentRow.scale = 1;
            }
          }

          rows.push( currentRow );
        }

        currentNode = {};
      }, this);

      return rows;
    },


    /**
     * Calculates the scale of each
     * row based on some input.
     *
     * @method _calculateMultipler
     * @private
     * @param  {Object} row
     * @param  {Number} width
     * @return {Number}
     */
    _calculatescale: function ( row, width ) {
      return ( this._containerWidth - this.get( 'gutter' ) * ( row.items.length - 1 ) ) / width;
    },


    /**
     * Render the grid on the page.
     *
     * @method _render
     * @private
     * @param {Object} rows
     */
    _render: function ( rows ) {
      var gutter = this.get( 'gutter' );
      var topValue;
      var leftValue;

      var slideHeight;
      var slideWidth;

      if ( this.get('host').getComputedStyle( 'position' ) == 'static' ) {
        this.get( 'host' ).setStyles( {
          position: 'relative',
          overflowX: 'hidden'
        } );
      }

      // Loop through each row.
      Y.Array.forEach(rows, function( row, rowNumber ) {
        if ( row.items.length == 0 ) {
          rows.splice( rowNumber, 1 );
          return false;
        }

        if ( !topValue ) {
          topValue = 0;
        }

        slideHeight = this.get( 'initialHeight' ) * row.scale;

        // Loop through the nodes in the current row.
        Y.Array.forEach( row.items, function( item, itemNumber ) {
          if ( !leftValue ) {
            leftValue = 0;
          }

          slideWidth = item.width * row.scale;

          item.el.setStyles( {
            position: 'absolute',
            top: topValue,
            left: leftValue,
            width: Math.ceil( slideWidth ),
            height:  Math.ceil( slideHeight )
          } );

          if ( item.el.one( 'img' ) ) {
            item.el.one( 'img' ).setStyles( {
              minWidth: '100%'
            } );
          }

          leftValue = leftValue + slideWidth + gutter;
        } );

        topValue = topValue + slideHeight + gutter;

        leftValue = null;
      }, this);

      var syncHeight = function() {
        var lastNode = this.get('host').one( this.get( 'slides') + ':last-child' ).getDOMNode();
        var height = lastNode.getBoundingClientRect().bottom + document.body.scrollTop;

        this.get( 'host' ).setStyles( {
          height: height
        } );
      }.bind(this);

      syncHeight();

      // Load images.
      this.get( 'host' ).all( this.get( 'slides') ).each(function ( slide ) {
        var imgNode = slide.one( 'img' );
        ImageLoader.load( imgNode, {
          load: true
        } );

        if (imgNode) {
          imgNode.on('load', syncHeight);
          imgNode.on('error', syncHeight);
        }
      });
    }

  }, {
    NS: 'justifiedgrid',
    ATTRS: {
      /**
       * The slide selector. It's always
       * a child element of the host.
       *
       * @attribute slides
       * @type Node
       * @default 'img'
       * @writeOnce
       */
      slides: {
        value: 'img'
      },


      /**
       * The gutters between images in pixels.
       *
       * @attribute gutter
       * @type Number
       * @default 16
       */
      gutter: {
        value: 16
      },


      /**
       * The default slide height. This
       * provides a baseline layout that
       * we use to anchor the justified
       * layout.
       *
       * @attribute initialHeight
       * @type Number
       * @default 300
       */
      initialHeight: {
        value: 300
      },


      /**
       * A Boolean attribute that
       * determines whether or not the
       * layout should be recalculated on
       * resize.
       *
       * @attribute refreshOnResize
       * @type Boolean
       * @default true
       * @writeOnce
       */
      refreshOnResize: {
        value: true
      }
    }
  } );
},
  '1.0',
  {
    requires: [
      'base',
      'plugin',
      'node',
      'event',
      'squarespace-util',
      'transition'
    ]
  }
);
