'use strict';

var fork = require('child_process').fork;
var path = require('path');
var ObjectID = require('mongodb').ObjectID;
var Promise = require('es6-promise').Promise;
var config = require('../config');

module.exports = function register (server, options, next) {
  var myWorkers = {};
  var myProcesses = {};

  server.expose({ spawn: spawn });

  next();

  function spawn () {
    var available = Object.keys(myWorkers);
    var workers = server.plugins.db.connection.collection('workers');
    server.log(['debug'], 'maybe spawn... available: ' + available +
      ' max: ' + config.maxWorkers);
    if (available.length < config.maxWorkers) {
      spawnWorker();
      return Promise.resolve();
    } else if (config.maxWorkers > 0) {
      var id = available[0];
      server.log(['debug'], 'Attempting to pause ' + id);
      id = new ObjectID(id);
      // we think we have a worker available already, but there's a potential
      // race condition between the worker checking for new jobs and deciding
      // to shut down.  we avoid it by setting the worker's state to 'paused',
      // from which it will not allow itself to shut down.
      return workers.findOneAndUpdate({ _id: id, state: 'working' }, {
        $set: { state: 'paused' }
      })
      .then(function (result) {
        server.log(['debug'], result);
        if (result.value) {
          // we successfully switched the state to 'paused', so we can safely
          // unpause it and know that it will try to look for another job.
          server.log(['debug'], 'Successfully paused; resuming.');
          return workers.updateOne({ _id: id, state: 'paused' }, {
            $set: { state: 'working' }
          });
        } else {
          // our worker must have shut itself down before we were able to
          // pause it, so let's spawn a new one
          server.log(['debug'], 'Could not pause; spawning.');
          return spawnWorker();
        }
      });
    }
  }

  function spawnWorker () {
    server.log(['debug'], 'spawnWorker');
    var cp = fork(path.join(__dirname, '../worker'))
    .on('message', function (msg) {
      myWorkers[msg.workerId] = cp.pid;
      myProcesses[cp.pid] = msg.workerId;
      server.log(['worker'].concat(msg.tags), msg.message);
    })
    .on('exit', function (info) {
      server.log(['debug'], 'Worker exited: ' + JSON.stringify(info));
      delete myWorkers[myProcesses[cp.pid]];
      delete myProcesses[cp.pid];
    });
  }
};

module.exports.attributes = { name: 'workers' };
