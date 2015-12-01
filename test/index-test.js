
"use strict";
var fs = require('fs');
var spartan = require('../index');
var privkey = fs.readFileSync(__dirname + '/test-ES256-app-privkey.pem');
var pubkey = fs.readFileSync(__dirname + '/test-ES256-app-pubkey.pem', 'utf8');

var assert = require('assert');
var express = require('express');
var request = require('supertest');


describe("TokenSign and TokenVerify API Unit tests", function() {
    it("testTokenSignVerify", function(done) {

      var opt = {
		  sub: 'test-subject',
		  iss: 'self',
		  exp: 60, // 1 minute
		  alg: 'ES256'
		};
      var data =  { test: 'test_data' };

      var ret = spartan.tokenSign(opt, data, privkey);

      assert.equal(ret.success, true);

      var ret2 = spartan.tokenVerify(ret.token, pubkey);

      assert.equal(ret2.success, true);
      assert.deepEqual(ret2.data.sub, opt.sub);
      //assert.equal(ret2.data.sub, opt.sub);
      //assert.(ret2.data.iss, opt.iss);
      //assert.ok(ret2.data.exp, opt.exp);
      done();

    });

    it("testTokenSignVerify2", function(done) {
      var opt = {
		    sub: 'test-subject',
		    //iss: 'self',  // TEST: commending this will ret false
		    exp: 60, // 1 minute
		    alg: 'ES256'
		  };
      var data =  { test: 'test_data' };

      var ret = spartan.tokenSign(opt, data, 'privkey');
      assert.equal(ret.success, false);

      var ret2 = spartan.tokenVerify('randomstring', pubkey);
      assert.equal(ret2.success, false);

      var ret3 = spartan.tokenVerify(null, pubkey);
      assert.equal(ret3.success, false);

      var ret4 = spartan.tokenVerify('data', null);
      assert.equal(ret4.success, false);

      done();
    });


    it("testTokenAuth", function(done) {
      var opt = {
              sub: 'test-subject',
              iss: 'self',
              exp: 60, // 1 minute
              alg: 'ES256'
            };
      var data =  { role: 'SuperRole', type: 'as-app-token' };

      var ret = spartan.tokenSign(opt, data, privkey);

      assert.equal(ret.success, true);

      var opt2 = {
               as_pubkey: pubkey,       // attestation server's pub key
               role: 'SuperRole',          // Role for authorization check
               token_type: 'as-app-token' // optional, def: app-svc_token
             };

      var ret2 = spartan.tokenAuth(ret.token, opt2);

      assert.equal(ret2.success, true);
      //assert.ok(ret2.data.sub, opt.sub);
      //assert.ok(ret2.data.iss, opt.iss);
      //assert.ok(ret2.data.exp, opt.exp);
      done();
    });


});

describe('asAuth API (express route handler) test', function() {
  var app;

  beforeEach(function() {
    app = express();
    app.use(require('body-parser').urlencoded({extended: true}));
    app.use(require('body-parser').json());

    // Parameters to pass for auth
    var sp_options = {
      as_pubkey: pubkey
    };

    var sp_handlr = new spartan.RouteHandler(sp_options);

    app.get('/token', [sp_handlr.asAuth.bind(sp_handlr)], function(req, res) {
      // If you reach here, that means you are authorized to access this endpoint
      return res.status(200).json({
        msg: 'app is authenticated by Attestation server!'
      });

      //assert.equal(0, 0);
    });
  });

  afterEach(function() { });

  it('as-app-req type test (should return HTTP 200 OK)', function(done) {

    var ret = spartan.tokenSign({
          sub: 'self',
          iss: 'spartan-domain',
        }, 
        { type: 'as-app-req',
          pubkey: pubkey
        },
        privkey);

    if (!ret.success) {
      console.error('tokenSign failed');
      done('tokenSign failed');
    }

    request(app)
      .get('/token')
      .set('Accept', 'application/json')
      .set('x-spartan-auth-token', ret.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res){
        if (err) return done(err);
        console.error(res.body);
        done();
      });
  });

});

describe('svcAuth API (express route handler) test', function() {
  var app;

  beforeEach(function() {
    app = express();
    app.use(require('body-parser').urlencoded({extended: true}));
    app.use(require('body-parser').json());

    // Parameters to pass for auth
    var sp_options = {
      as_pubkey: pubkey,
      role: 'SuperRole',
      token_type: 'as-app-token' // other options is 'as-app-token'
    };

    var sp_handlr = new spartan.RouteHandler(sp_options);

    app.get('/auth-test', [sp_handlr.svcAuth.bind(sp_handlr)], function(req, res) {
      // If you reach here, that means you are authorized to access this endpoint
      return res.status(200).json({
        msg: 'app is authenticated!'
      });

      //assert.equal(0, 0);
    });
  });

  afterEach(function() { });

  it('as-app-token type test (should return HTTP 200 OK)', function(done) {

    var ret = spartan.tokenSign({
          sub: 'self',
          iss: 'spartan-domain',
        }, {role: 'SuperRole', type: 'as-app-token'}, privkey);

    if (!ret.success) {
      //console.log('tokenSign success');
      console.error('tokenSign failed');
      done('tokenSign failed');
    }

    request(app)
      .get('/auth-test')
      .set('Accept', 'application/json')
      .set('x-spartan-auth-token', ret.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res){
        if (err) return done(err);
        console.error(res.body);
        done();
      });
  });

  it('app-svc-req type test (should return HTTP 400)', function(done) {

    var ret = spartan.tokenSign({
          sub: 'self',
          iss: 'spartan-domain',
        }, {role: 'SuperRole', type: 'app-svc-req'}, privkey);

    if (!ret.success) {
      console.error('tokenSign failed');
      done('tokenSign failed');
    }

    request(app)
      .get('/auth-test')
      .set('Accept', 'application/json')
      .set('x-spartan-auth-token', ret.token)
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function(err, res){
        if (err) return done(err);
        done();
      });
  });

});

