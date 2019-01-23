/**
 * @typedef {object} LinkToolData
 * @description Link Tool's input and output data format
 * @property {string} link — data url
 * @property {object} linkData — fetched link data
 */

// eslint-disable-next-line
import css from './index.css';
import ToolboxIcon from './svg/toolbox.svg';
import ajax from '@codexteam/ajax';

/**
 * @typedef {object} UploadResponseFormat
 * @description This format expected from backend on link data fetching
 * @property {number} success  - 1 for successful uploading, 0 for failure
 * @property {object} linkData - Object with link data.
 *                           tool may have any data provided by backend,
 *                           currently are supported by design:
 *                              - title
 *                              - description
 *                              - image
 *                              - url
 */
export default class ImageTool {
  /**
   * Get Tool toolbox settings
   * icon - Tool icon's SVG
   * title - title to show in toolbox
   *
   * @return {{icon: string, title: string}}
   */
  static get toolbox() {
    return {
      icon: ToolboxIcon,
      title: 'Link'
    };
  }

  /**
   * @param {LinkToolData} data - previously saved data
   * @param {config} config - user config for Tool
   * @param {object} api - CodeX Editor API
   */
  constructor({data, config, api}) {
    this.api = api;

    /**
     * Tool's initial config
     */
    this.config = {
      endpoints: config.endpoints || ''
    };

    this.nodes = {
      wrapper: null,
      container: null,
      progress: null,
      input: null,
      inputHolder: null,
      linkContent: null,
      linkImage: null,
      linkTitle: null,
      linkDescription: null,
      linkText: null
    };

    /**
     * Set saved state
     */
    this._data = {
      link: '',
      linkData: {}
    };

    this.data = data;
  }

  /**
   * Renders Block content
   * @public
   *
   * @return {HTMLDivElement}
   */
  render() {
    this.nodes.wrapper = this.make('div', this.CSS.baseClass);
    this.nodes.container = this.make('div', this.CSS.container);

    this.nodes.inputHolder = this.makeInputHolder();
    this.nodes.linkContent = this.prepareLinkPreview();

    this.nodes.container.appendChild(this.nodes.linkContent);

    /**
     * If Tool already has data, render link preview, otherwise insert input
     */
    if (Object.keys(this._data.linkData).length) {
      this.showLinkPreview(this._data.linkData);
    } else {
      this.nodes.container.insertBefore(this.nodes.inputHolder, this.nodes.linkContent);
    }

    this.nodes.wrapper.appendChild(this.nodes.container);

    return this.nodes.wrapper;
  }

  /**
   * Return Block data
   * @public
   *
   * @return {LinkToolData}
   */
  save() {
    return this.data;
  }

  /**
   * Stores all Tool's data
   * @param {LinkToolData} data
   */
  set data(data) {
    this._data.link = data.link || '';
    this._data.linkData = data.linkData || {};
  }

  /**
   * Return Tool data
   * @return {LinkToolData} data
   */
  get data() {
    return this._data;
  }

  /**
   * @return {object} - Link Tool styles
   * @constructor
   */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      input: this.api.styles.input,

      /**
       * Tool's classes
       */
      container: 'link-tool',
      inputEl: 'link-tool__input',
      inputHolder: 'link-tool__input-holder',
      linkContent: 'link-tool__content',
      linkImage: 'link-tool__image',
      linkTitle: 'link-tool__title',
      linkDescription: 'link-tool__description',
      linkText: 'link-tool__anchor',
      progress: 'link-tool__progress',
      progressLoading: 'link-tool__progress--loading',
      progressLoaded: 'link-tool__progress--loaded'
    };
  }

  /**
   * Prepare input holder
   * @return {HTMLElement} - url input
   */
  makeInputHolder() {
    const inputHolder = this.make('div', this.CSS.inputHolder);

    this.nodes.progress = this.make('label', this.CSS.progress);
    this.nodes.input = this.make('input', [this.CSS.input, this.CSS.inputEl]);
    this.nodes.input.placeholder = 'Paste Link...';

    this.nodes.input.addEventListener('paste', (event) => {
      const url = (event.clipboardData || window.clipboardData).getData('text');

      this.uploadByUrl(url);
    });

    inputHolder.appendChild(this.nodes.progress);
    inputHolder.appendChild(this.nodes.input);

    return inputHolder;
  }

  /**
   * Prepare link preview holder
   * @return {HTMLElement}
   */
  prepareLinkPreview() {
    const holder = this.make('div', this.CSS.linkContent);

    this.nodes.linkImage = this.make('div', this.CSS.linkImage);
    this.nodes.linkTitle = this.make('h2', this.CSS.linkTitle);
    this.nodes.linkDescription = this.make('p', this.CSS.linkDescription);
    this.nodes.linkText = this.make('a', this.CSS.linkText);

    holder.appendChild(this.nodes.linkImage);
    holder.appendChild(this.nodes.linkTitle);
    holder.appendChild(this.nodes.linkDescription);
    holder.appendChild(this.nodes.linkText);

    return holder;
  }

  /**
   * Compose link preview from fetched data
   * @param meta - link meta data
   */
  showLinkPreview(meta) {
    if (meta.image) {
      this.nodes.linkImage.style.backgroundImage = 'url(' + meta.image.url + ')';
    }

    if (meta.title) {
      this.nodes.linkTitle.innerHTML = meta.title;
    }

    if (meta.description) {
      this.nodes.linkDescription.innerHTML = meta.description;
    }

    this.nodes.linkText.innerHTML = this._data.link;
    this.nodes.linkText.setAttribute('href', this._data.link);
  }

  /**
   * Show loading progressbar
   */
  showProgress() {
    this.nodes.progress.classList.add(this.CSS.progressLoading);
  }

  /**
   * Hide loading progressbar
   */
  hideProgress() {
    return new Promise((resolve) => {
      this.nodes.progress.classList.remove(this.CSS.progressLoading);
      this.nodes.progress.classList.add(this.CSS.progressLoaded);

      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  /**
   * Sends to backend pasted url and receives link data
   * @param {string} url - link source url
   */
  uploadByUrl(url) {
    this.showProgress();
    this._data.link = url;
    ajax.get({
      url: this.config.endpoints.byUrl,
      data: {
        url: url
      }
    }).then((response) => {
      this.onFetch(response);
    }).catch((error) => {
      console.log('error', error);
    });
  }

  /**
   * Link data fetching callback
   * @param {UploadResponseFormat} response
   */
  onFetch(response) {
    if (response && response.success) {
      const metaData = response.meta;

      this._data.linkData = metaData;

      this.hideProgress().then(() => {
        this.nodes.inputHolder.remove();
        this.showLinkPreview(metaData);
      });
    } else {
      this.fetchingFailed('incorrect response: ' + JSON.stringify(response));
    }
  }

  /**
   * Handle link fetching errors
   * @private
   *
   * @param {string} errorText
   */
  fetchingFailed(errorText) {
    console.log('Link Tool: data fetching because of', errorText);

    this.api.notifier.show({
      message: 'Can not get this link data, try another',
      style: 'error'
    });

    this.hideProgress();
  }

  /**
   * Helper method for elements creation
   * @param tagName
   * @param classNames
   * @param attributes
   * @return {HTMLElement}
   */
  make(tagName, classNames = null, attributes = {}) {
    let el = document.createElement(tagName);

    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }

    for (let attrName in attributes) {
      el[attrName] = attributes[attrName];
    }

    return el;
  }
}
