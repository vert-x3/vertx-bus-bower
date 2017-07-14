/*
 *   Copyright (c) 2011-2015 The original author or authors
 *   ------------------------------------------------------
 *   All rights reserved. This program and the accompanying materials
 *   are made available under the terms of the Eclipse Public License v1.0
 *   and Apache License v2.0 which accompanies this distribution.
 *
 *       The Eclipse Public License is available at
 *       http://www.eclipse.org/legal/epl-v10.html
 *
 *       The Apache License v2.0 is available at
 *       http://www.opensource.org/licenses/apache2.0.php
 *
 *   You may elect to redistribute this code under either of these licenses.
 */
!function (factory) {
  if (typeof require === 'function' && typeof module !== 'undefined') {
    // CommonJS loader
    var SockJS = require('sockjs-client');
    if (!SockJS) {
      throw new Error('vertx-eventbus.js requires sockjs-client, see http://sockjs.org');
    }
    factory(SockJS);
  } else if (typeof define === 'function' && define.amd) {
    // AMD loader
    define('vertx-eventbus', ['sockjs'], factory);
  } else {
    // plain old include
    if (typeof this.SockJS === 'undefined') {
      throw new Error('vertx-eventbus.js requires sockjs-client, see http://sockjs.org');
    }

    EventBus = factory(this.SockJS);
  }
}(function (SockJS) {

  function makeUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (a, b) {
      return b = Math.random() * 16, (a == 'y' ? b & 3 | 8 : b | 0).toString(16);
    });
  }

  function mergeHeaders(defaultHeaders, headers) {
    if (defaultHeaders) {
      if (!headers) {
        return defaultHeaders;
      }

      for (var headerName in defaultHeaders) {
        if (defaultHeaders.hasOwnProperty(headerName)) {
          // user can overwrite the default headers
          if (typeof headers[headerName] === 'undefined') {
            headers[headerName] = defaultHeaders[headerName];
          }
        }
      }
    }

    // headers are required to be a object
    return headers || {};
  }

  /**
   * EventBus
   *
   * @param url
   * @param options
   * @constructor
   */
  var EventBus = function (url, options) {
    var self = this;

    options = options || {};

    // attributes
    this.pingInterval = options.vertxbus_ping_interval || 5000;
    this.pingTimerID = null;
    this.isReconnectEnabled = false;
    this.reconnectInterval = options.vertxbus_reconnect_interval || 3000;
    this.reconnectTimerID = null;
    this.defaultHeaders = null;

    // default event handlers
    this.onerror = function (err) {
      try {
        console.error(err);
      } catch (e) {
        // dev tools are disabled so we cannot use console on IE
      }
    };

    var setupSockJSConnection = function () {
      self.sockJSConn = new SockJS(url, null, options);
      self.state = EventBus.CONNECTING;

      // handlers and reply handlers are tied to the state of the socket
      // they are added onopen or when sending, so reset when reconnecting
      self.handlers = {};
      self.replyHandlers = {};

      var isReconnect;
      if (self.reconnectTimerID) {
        clearInterval(self.reconnectTimerID);
        isReconnect = true;
      } else {
        isReconnect = false;
      }

      self.sockJSConn.onopen = function () {
        self.pingEnabled(true);
        self.state = EventBus.OPEN;
        self.onopen && self.onopen();
        if (isReconnect) {
          // fire separate event for reconnects
          // consistent behavior with adding handlers onopen
          self.onreconnect && self.onreconnect();
        }
      };

      self.sockJSConn.onclose = function (e) {
        self.state = EventBus.CLOSED;
        if (self.pingTimerID) clearInterval(self.pingTimerID);
        if (self.isReconnectEnabled && self.reconnectInterval > 0) {
          self.sockJSConn = null;
          // wrap in function to prevent blowing up stack
          self.reconnectTimerID = setInterval(function () {
            setupSockJSConnection();
          }, self.reconnectInterval);
        }
        self.onclose && self.onclose(e);
      };

      self.sockJSConn.onmessage = function (e) {
        var json = JSON.parse(e.data);

        // define a reply function on the message itself
        if (json.replyAddress) {
          Object.defineProperty(json, 'reply', {
            value: function (message, headers, callback) {
              self.send(json.replyAddress, message, headers, callback);
            }
          });
        }

        if (self.handlers[json.address]) {
          // iterate all registered handlers
          var handlers = self.handlers[json.address];
          for (var i = 0; i < handlers.length; i++) {
            if (json.type === 'err') {
              handlers[i]({ failureCode: json.failureCode, failureType: json.failureType, message: json.message });
            } else {
              handlers[i](null, json);
            }
          }
        } else if (self.replyHandlers[json.address]) {
          // Might be a reply message
          var handler = self.replyHandlers[json.address];
          delete self.replyHandlers[json.address];
          if (json.type === 'err') {
            handler({ failureCode: json.failureCode, failureType: json.failureType, message: json.message });
          } else {
            handler(null, json);
          }
        } else {
          if (json.type === 'err') {
            self.onerror(json);
          } else {
            try {
              console.warn('No handler found for message: ', json);
            } catch (e) {
              // dev tools are disabled so we cannot use console on IE
            }
          }
        }
      }
    };

    // function cannot be anonymous and self-calling due to pseudo-recursion
    setupSockJSConnection();
  };

  /**
   * Send a message
   *
   * @param {String} address
   * @param {Object} message
   * @param {Object} [headers]
   * @param {Function} [callback]
   */
  EventBus.prototype.send = function (address, message, headers, callback) {
    // are we ready?
    if (this.state != EventBus.OPEN) {
      throw new Error('INVALID_STATE_ERR');
    }

    if (typeof headers === 'function') {
      callback = headers;
      headers = {};
    }

    var envelope = {
      type: 'send',
      address: address,
      headers: mergeHeaders(this.defaultHeaders, headers),
      body: message
    };

    if (callback) {
      var replyAddress = makeUUID();
      envelope.replyAddress = replyAddress;
      this.replyHandlers[replyAddress] = callback;
    }

    this.sockJSConn.send(JSON.stringify(envelope));
  };

  /**
   * Publish a message
   *
   * @param {String} address
   * @param {Object} message
   * @param {Object} [headers]
   */
  EventBus.prototype.publish = function (address, message, headers) {
    // are we ready?
    if (this.state != EventBus.OPEN) {
      throw new Error('INVALID_STATE_ERR');
    }

    this.sockJSConn.send(JSON.stringify({
      type: 'publish',
      address: address,
      headers: mergeHeaders(this.defaultHeaders, headers),
      body: message
    }));
  };

  /**
   * Register a new handler
   *
   * @param {String} address
   * @param {Object} [headers]
   * @param {Function} callback
   */
  EventBus.prototype.registerHandler = function (address, headers, callback) {
    // are we ready?
    if (this.state != EventBus.OPEN) {
      throw new Error('INVALID_STATE_ERR');
    }

    if (typeof headers === 'function') {
      callback = headers;
      headers = {};
    }

    // ensure it is an array
    if (!this.handlers[address]) {
      this.handlers[address] = [];
      // First handler for this address so we should register the connection
      this.sockJSConn.send(JSON.stringify({
        type: 'register',
        address: address,
        headers: mergeHeaders(this.defaultHeaders, headers)
      }));
    }

    this.handlers[address].push(callback);
  };

  /**
   * Unregister a handler
   *
   * @param {String} address
   * @param {Object} [headers]
   * @param {Function} callback
   */
  EventBus.prototype.unregisterHandler = function (address, headers, callback) {
    // are we ready?
    if (this.state != EventBus.OPEN) {
      throw new Error('INVALID_STATE_ERR');
    }

    var handlers = this.handlers[address];

    if (handlers) {

      if (typeof headers === 'function') {
        callback = headers;
        headers = {};
      }

      var idx = handlers.indexOf(callback);
      if (idx != -1) {
        handlers.splice(idx, 1);
        if (handlers.length === 0) {
          // No more local handlers so we should unregister the connection
          this.sockJSConn.send(JSON.stringify({
            type: 'unregister',
            address: address,
            headers: mergeHeaders(this.defaultHeaders, headers)
          }));

          delete this.handlers[address];
        }
      }
    }
  };

  /**
   * Closes the connection to the EvenBus Bridge.
   */
  EventBus.prototype.close = function () {
    this.state = EventBus.CLOSING;
    this.sockJSConn.close();
  };

  EventBus.CONNECTING = 0;
  EventBus.OPEN = 1;
  EventBus.CLOSING = 2;
  EventBus.CLOSED = 3;

  EventBus.prototype.pingEnabled = function (enable) {
    var self = this;

    if (enable) {
      var sendPing = function () {
        self.sockJSConn.send(JSON.stringify({ type: 'ping' }));
      };

      if (self.pingInterval > 0) {
        // Send the first ping then send a ping every pingInterval milliseconds
        sendPing();
        self.pingTimerID = setInterval(sendPing, self.pingInterval);
      }
    } else {
      if (self.pingTimerID) {
        clearInterval(self.pingTimerID);
        self.pingTimerID = null;
      }
    }
  };

  EventBus.prototype.reconnectEnabled = function (enable) {
    var self = this;
    
    self.isReconnectEnabled = enable;
    if (!enable && self.reconnectTimerID) {
      clearInterval(self.reconnectTimerID);
      self.reconnectTimerID = null;
    }
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = EventBus;
    } else {
      exports.EventBus = EventBus;
    }
  } else {
    return EventBus;
  }
});