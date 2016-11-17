'use strict';

var _ = require('underscore');

var express = require('express');
var router = express.Router();

var thinky = require('thinky')();
var type = thinky.type;

var models = require('../public/config/models.json').models;

var mapFieldType = {
  String: type.string(),
  PrimaryKey: type.string(),
  Date: type.date(),
  Integer: type.number().integer(),
  Boolean: type.boolean()
};

var ModelMap = _.reduce(models, function (map, model) {
  var schema = _.reduce(model.fields, function (memo, field) {
    if (field.relation) {
      memo[field.id + 'Id'] = type.string();
    } else {
      memo[field.id] = mapFieldType[field.type];
    }
    return memo;
  }, {});
  var ThinkyModel = thinky.createModel(model.id, schema);
  map[model.id] = ThinkyModel;
  return map;
}, {});

_.each(models, function (model) {
  var relations = _.filter(model.fields, function (f) {
    return f.relation;
  });
  _.each(relations, function (r) {
    var ThinkyModel = ModelMap[model.id];
    var relationType = r.relation.type;
    var foreignType = r.relation.foreignType;
    if (relationType === 'belongsTo') {
      ThinkyModel[relationType](ModelMap[foreignType], r.id, r.id + 'Id', 'id');
    } else {
      ThinkyModel[relationType](ModelMap[foreignType], r.id, 'id', r.id + 'Id');
    }
  });
});

_.each(models, function (model) {
  var ThinkyModel = ModelMap[model.id];

  var route = '/' + model.id.toLowerCase();

  router.get(route, function (req, res, next) {
    var relations = _.filter(model.fields, function (f) {
      return f.relation;
    });
    var join = _.reduce(relations, function (memo, r) {
      memo[r.id] = true;
      return memo;
    }, {});
    ThinkyModel.filter(function () {
      return true;
    }).getJoin(join).run(function (err, results) {
      if (err) return next(err);

      res.json({ items: results });
    });
  });

  router.post(route, function (req, res, next) {
    var data = req.body;
    var doc = new ThinkyModel(data);

    doc.save().then(() => { res.end(); }).error((err) => { next(err); });
  });

  router.put(route + '/:id', function (req, res, next) {
    var data = req.body;

    ThinkyModel.get(req.params.id).run().then(function (doc) {
      doc.merge(data).save().then(function () {
        res.end();
      });
    }).error(function (err) {
      next(err);
    });
  });

  router.delete(route + '/:id', function (req, res, next) {
    ThinkyModel.get(req.params.id).run().then(function (doc) {
      doc.delete().then(function () {
        res.end();
      });
    }).error(function (err) {
      next(err);
    });
  });
});

module.exports = router;
