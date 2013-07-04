var appc = require('../index'),
	fs = require('fs'),
	path = require('path'),
	http = require('http'),
	temp = require('temp');
//	wrench = require('wrench');

describe('auth', function () {
	it('namespace exists', function () {
		appc.should.have.property('auth');
		appc.auth.should.be.a('object');
	});

	describe('#login()', function () {
		//
	});

	describe('#logout()', function () {
		//
	});

	describe('#status()', function () {
		//
	});

	describe('#getMID()', function () {
		it('creates non-existant mid file', function (done) {
			var tempDir = temp.mkdirSync();
			appc.auth.getMID(tempDir, function (mid) {
				mid.should.be.a('string');
				fs.existsSync(path.join(tempDir, 'mid.json')).should.be.ok;
				done();
			});
		});

		it('results cached', function (done) {
			var tempDir = temp.mkdirSync();
			appc.auth.getMID(tempDir, function (result1) {
				appc.auth.getMID(tempDir, function (result2) {
					result1.should.equal(result2);
					done();
				});
			});
		});
	});
});