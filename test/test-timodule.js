/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2019 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
/* eslint no-unused-expressions: "off" */
'use strict';

const appc = require('../index');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
require('should');
require('colors');

function MockConfig() {
	this.get = function (s) {
		if (s === 'cli.ignoreDirs') {
			return '^(.svn|.git|.hg|.?[Cc][Vv][Ss]|.bzr)$';
		}
	};
}

function MockLogger() {
	this.buffer = '';
	this.debug = function (s) {
		this.buffer += s + '\n';
	};
	this.info = function (s) {
		this.buffer += s + '\n';
	};
	this.warn = function (s) {
		this.buffer += s + '\n';
	};
	this.error = function (s) {
		this.buffer += s + '\n';
	};
}

describe('timodule', function () {
	this.timeout(1000);

	it('namespace exists', function () {
		appc.should.have.property('timodule');
		appc.timodule.should.be.an.Object;
	});

	const testResourcesDir = path.join(__dirname, 'resources', 'timodule');
	const dummyModuleDir = path.join(testResourcesDir, 'modules', 'ios', 'dummy', '1.2.3');
	const toonewModuleDir = path.join(testResourcesDir, 'modules', 'ios', 'toonew', '1.0');
	const ambiguousModuleDir = path.join(testResourcesDir, 'modules', 'ios', 'ambiguous', '1.0');
	const ambiguousCommonJSModuleDir = path.join(testResourcesDir, 'modules', 'commonjs', 'ambiguous', '1.0');

	describe('#scopedDetect()', function () {
		it('should return immediately if no paths to search', function (done) {
			appc.timodule.scopedDetect(null, null, null, function () {
				done();
			});
		});

		// because the internal detectModules() function caches all modules for the
		// remainder of this test, we must test the zip file stuff first
		it('should unzip dummy module and report bad zip file failure', function (done) {
			const logger = new MockLogger(),
				dummyDir = path.join(__dirname, 'resources', 'timodule', 'modules', 'ios', 'dummy'),
				goodZipFile = path.join(__dirname, 'resources', 'timodule', 'dummy-ios-1.2.3.zip'),
				badZipFile = path.join(__dirname, 'resources', 'timodule', 'badzip-ios-1.0.0.zip');

			// remove the dummy directory and existing zip file
			fs.existsSync(dummyDir) && fs.removeSync(dummyDir);
			fs.existsSync(goodZipFile) && fs.unlinkSync(goodZipFile);
			fs.existsSync(badZipFile) && fs.unlinkSync(badZipFile);

			// duplicate the zip files
			fs.writeFileSync(
				goodZipFile,
				fs.readFileSync(path.join(__dirname, 'resources', 'timodule', 'dummy-ios-1.2.3.zip.orig'))
			);
			fs.writeFileSync(
				badZipFile,
				fs.readFileSync(path.join(__dirname, 'resources', 'timodule', 'badzip-ios-1.0.0.zip.orig'))
			);

			// now run the detection
			appc.timodule.scopedDetect({
				testResources: path.join(testResourcesDir, 'modules')
			}, new MockConfig(), logger, function (result) {
				try {
					fs.existsSync(goodZipFile) && fs.unlinkSync(goodZipFile);
					fs.existsSync(badZipFile) && fs.unlinkSync(badZipFile);

					logger.buffer.stripColors.should.containEql('Installing module: dummy-ios-1.2.3.zip');
					logger.buffer.stripColors.should.containEql('Installing module: badzip-ios-1.0.0.zip');
					logger.buffer.stripColors.should.containEql('Failed to unzip module "' + badZipFile + '"');

					result.should.be.an.Object;
					result.should.have.property('testResources');
					result.testResources.should.have.property('ios');
					result.testResources.ios.should.be.an.Object;
					result.testResources.ios.should.have.property('ti.dummy');

					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it('should find all test modules', function (done) {
			const logger = new MockLogger();

			// now run the detection
			appc.timodule.scopedDetect({
				testResources: path.join(testResourcesDir, 'modules')
			}, new MockConfig(), logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql('Detecting modules in ' + path.join(testResourcesDir, 'modules'));
					logger.buffer.stripColors.should.containEql('Detected ios module: ti.dummy 1.2.3 @ ' + dummyModuleDir);
					logger.buffer.stripColors.should.containEql('Detected ios module: ti.toonew 1.0 @ ' + toonewModuleDir);
					logger.buffer.stripColors.should.containEql('Detected ios module: ti.ambiguous 1.0 @ ' + ambiguousModuleDir);
					logger.buffer.stripColors.should.containEql('Detected commonjs module: ti.ambiguous 1.0 @ ' + ambiguousCommonJSModuleDir);

					result.should.be.an.Object;
					result.should.have.property('testResources');
					result.testResources.should.have.property('ios');
					result.testResources.ios.should.be.an.Object;
					result.testResources.ios.should.have.property('ti.dummy');
					result.testResources.ios.should.have.property('ti.toonew');
					result.testResources.ios.should.have.property('ti.ambiguous');
					result.testResources.commonjs.should.be.an.Object;
					result.testResources.commonjs.should.have.property('ti.ambiguous');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should skip scanning and return cache', function (done) {
			var logger = new MockLogger();

			// now run the detection
			appc.timodule.scopedDetect({
				testResources: path.join(testResourcesDir, 'modules')
			}, new MockConfig(), logger, function () {
				try {
					logger.buffer.stripColors.should.not.containEql('Detecting modules in ' + path.join(testResourcesDir, 'modules'));
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	describe('#detect()', function () {
		let logger;

		beforeEach(() => {
			logger = new MockLogger();
		});

		it('should find the test modules with individual params', function (done) {
			const dir = path.join(__dirname, 'resources', 'timodule');

			// we test for dupe search paths, but only one should be searched
			appc.timodule.detect([ dir, dir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql('Detecting modules in ' + path.join(testResourcesDir, 'modules'));
					logger.buffer.stripColors.should.containEql('Detected ios module: ti.dummy 1.2.3 @ ' + dummyModuleDir);
					logger.buffer.stripColors.should.containEql('Detected ios module: ti.toonew 1.0 @ ' + toonewModuleDir);
					logger.buffer.stripColors.should.containEql('Detected ios module: ti.ambiguous 1.0 @ ' + ambiguousModuleDir);
					logger.buffer.stripColors.should.containEql('Detected commonjs module: ti.ambiguous 1.0 @ ' + ambiguousCommonJSModuleDir);

					var dupeSearch = logger.buffer.stripColors.split('Detected ios module: ti.dummy 1.2.3 @').length - 1;
					assert(dupeSearch === 1, 'Path searched ' + dupeSearch + ' times instead of once');

					result.should.be.an.Object;
					result.should.have.property('global');
					result.should.have.property('project');
					result.project.should.have.property('ios');
					result.project.ios.should.be.an.Object;
					result.project.ios.should.have.property('ti.dummy');
					result.project.ios.should.have.property('ti.toonew');
					result.project.ios.should.have.property('ti.ambiguous');
					result.project.should.have.property('commonjs');
					result.project.commonjs.should.have.property('ti.ambiguous');
					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find the test modules with params object', function (done) {
			const dir = path.join(__dirname, 'resources', 'timodule');

			// we test for dupe search paths, but only one should be searched
			appc.timodule.detect({
				bypassCache: true,
				searchPaths: [ dir, dir ],
				logger: logger,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql('Detecting modules in ' + path.join(testResourcesDir, 'modules'));
						logger.buffer.stripColors.should.containEql('Detected ios module: ti.dummy 1.2.3 @ ' + dummyModuleDir);
						logger.buffer.stripColors.should.containEql('Detected ios module: ti.toonew 1.0 @ ' + toonewModuleDir);
						logger.buffer.stripColors.should.containEql('Detected ios module: ti.ambiguous 1.0 @ ' + ambiguousModuleDir);
						logger.buffer.stripColors.should.containEql('Detected commonjs module: ti.ambiguous 1.0 @ ' + ambiguousCommonJSModuleDir);

						var dupeSearch = logger.buffer.stripColors.split('Detected ios module: ti.dummy 1.2.3 @').length - 1;
						assert(dupeSearch === 1, 'Path searched ' + dupeSearch + ' times instead of once');

						result.should.be.an.Object;
						result.should.have.property('global');
						result.should.have.property('project');
						result.project.should.have.property('ios');
						result.project.ios.should.be.an.Object;
						result.project.ios.should.have.property('ti.dummy');
						result.project.ios.should.have.property('ti.toonew');
						result.project.ios.should.have.property('ti.ambiguous');
						result.project.should.have.property('commonjs');
						result.project.commonjs.should.have.property('ti.ambiguous');
						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('detects native module in node_modules folder under given project path', finished => {
			appc.timodule.detect([ path.join(__dirname, 'resources/npm-native-module') ], logger, result => {
				try {
					result.should.be.an.Object;
					result.should.have.property('global');
					result.should.have.property('project');
					result.project.should.have.property('ios');
					result.project.ios.should.be.an.Object;
					result.project.ios.should.have.property('native-module');
					const nativeModule = result.project.ios['native-module']['2.0.1'];
					nativeModule.id.should.eql('native-module');
					nativeModule.modulePath.should.eql(path.join(__dirname, 'resources/npm-native-module/node_modules/native-module'));
					nativeModule.platform.should.eql([ 'ios' ]);
					nativeModule.version.should.eql('2.0.1');
					nativeModule.manifest.should.be.an.Object;
					nativeModule.manifest.should.have.a.property('minsdk').which.is.eql('5.0.0');
					nativeModule.manifest.should.have.a.property('apiversion').which.is.eql(2);
					nativeModule.manifest.should.have.a.property('guid').which.is.eql('bba89061-0fdb-4ff1-95a8-02876f5601f9');
					nativeModule.manifest.should.have.a.property('moduleid').which.is.eql('native-module');
					nativeModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'arm64', 'i386', 'x86_64' ]);
					finished();
				} catch (e) {
					finished(e);
				}
			});
		});

		it('combines node_modules and legacy based modules', finished => {
			const dir = path.join(__dirname, 'resources', 'timodule');
			appc.timodule.detect([ path.join(__dirname, 'resources/npm-native-module'), dir ], logger, result => {
				try {
					result.should.be.an.Object;
					result.should.have.property('global');
					result.should.have.property('project');
					result.project.should.have.property('ios');
					result.project.ios.should.be.an.Object;
					// has the "legacy" modules
					result.project.ios.should.have.property('ti.dummy');
					result.project.ios.should.have.property('ti.toonew');
					result.project.ios.should.have.property('ti.ambiguous');
					result.project.should.have.property('commonjs');
					result.project.commonjs.should.have.property('ti.ambiguous');
					// has the native module supplied via node_modules
					result.project.ios.should.have.property('native-module');
					const nativeModule = result.project.ios['native-module']['2.0.1'];
					nativeModule.id.should.eql('native-module');
					nativeModule.modulePath.should.eql(path.join(__dirname, 'resources/npm-native-module/node_modules/native-module'));
					nativeModule.platform.should.eql([ 'ios' ]);
					nativeModule.version.should.eql('2.0.1');
					nativeModule.manifest.should.be.an.Object;
					nativeModule.manifest.should.have.a.property('minsdk').which.is.eql('5.0.0');
					nativeModule.manifest.should.have.a.property('apiversion').which.is.eql(2);
					nativeModule.manifest.should.have.a.property('guid').which.is.eql('bba89061-0fdb-4ff1-95a8-02876f5601f9');
					nativeModule.manifest.should.have.a.property('moduleid').which.is.eql('native-module');
					nativeModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'arm64', 'i386', 'x86_64' ]);
					finished();
				} catch (e) {
					finished(e);
				}
			});
		});
	});

	describe('#find()', function () {
		let logger;

		beforeEach(() => {
			logger = new MockLogger();
		});

		it('should return immediately if no modules with individual params', function (done) {
			appc.timodule.find([], null, null, null, null, logger, function (result) {
				try {
					result.should.eql({
						found: [],
						missing: [],
						incompatible: [],
						conflict: []
					});
					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should return immediately if no modules with params object', function (done) {
			appc.timodule.find({
				modules: [],
				platforms: null,
				deployType: null,
				sdkVersion: null,
				searchPaths: null,
				logger: logger,
				callback: function (result) {
					try {
						result.should.eql({
							found: [],
							missing: [],
							incompatible: [],
							conflict: []
						});
						done();
					} catch (e) {
						done(e);
					}
				},
				bypassCache: true
			});
		});

		it('should find "dummy" module using only the id with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.dummy' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=development'
					);

					const found = result.found.find(r => r.id === 'ti.dummy');
					assert(found, '"ti.dummy" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find "dummy" module using only the id with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.dummy' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=development'
						);

						const found = result.found.find(r => r.id === 'ti.dummy');
						assert(found, '"ti.dummy" module not marked as found');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find "dummy" module with matching version with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.dummy', version: '1.2.3' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=development'
					);

					const found = result.found.find(r => r.id === 'ti.dummy');
					assert(found, '"ti.dummy" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find "dummy" module with matching version with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.dummy', version: '1.2.3' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=development'
						);

						const found = result.found.find(r => r.id === 'ti.dummy');
						assert(found, '"ti.dummy" module not marked as found');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should not find "dummy" module with wrong version with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.dummy', version: '3.2.1' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Could not find a valid Titanium module id=ti.dummy version=3.2.1 platform=ios,commonjs deploy-type=development'
					);

					const missing = result.missing.find(r => r.id === 'ti.dummy');
					assert(missing, '"ti.dummy" module not marked as missing');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should not find "dummy" module with wrong version with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.dummy', version: '3.2.1' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Could not find a valid Titanium module id=ti.dummy version=3.2.1 platform=ios,commonjs deploy-type=development'
						);

						const missing = result.missing.find(r => r.id === 'ti.dummy');
						assert(missing, '"ti.dummy" module not marked as missing');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find "dummy" module with matching deploy type with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.dummy', deployType: 'test,production' }
			], [ 'ios', 'iphone' ], 'production', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=test,production'
					);

					const found = result.found.find(r => r.id === 'ti.dummy');
					assert(found, '"ti.dummy" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find "dummy" module with matching deploy type with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.dummy', deployType: 'test,production' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'production',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=test,production'
						);

						const found = result.found.find(r => r.id === 'ti.dummy');
						assert(found, '"ti.dummy" module not marked as found');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should ignore "dummy" module with non-matching deploy type with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.dummy', deployType: 'test,production' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {

					const found = result.found.find(r => r.id === 'ti.dummy');
					assert(!found, '"ti.dummy" module was marked as found, should have been ignored');

					const missing = result.missing.find(r => r.id === 'ti.dummy');
					assert(!missing, '"ti.dummy" module was marked as missing, should have been ignored');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should ignore "dummy" module with non-matching deploy type with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.dummy', deployType: 'test,production' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						const found = result.found.find(r => r.id === 'ti.dummy');
						assert(!found, '"ti.dummy" module was marked as found, should have been ignored');

						const missing = result.missing.find(r => r.id === 'ti.dummy');
						assert(!missing, '"ti.dummy" module was marked as missing, should have been ignored');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find "dummy" module with matching platform with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.dummy', platform: 'ios,android' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=development'
					);

					const found = result.found.find(r => r.id === 'ti.dummy');
					assert(found, '"ti.dummy" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find "dummy" module with matching platform with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.dummy', platform: 'ios,android' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Found Titanium module id=ti.dummy version=1.2.3 platform=ios deploy-type=development'
						);

						const found = result.found.find(r => r.id === 'ti.dummy');
						assert(found, '"ti.dummy" module not marked as found');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should ignore "dummy" module with non-matching platform with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.dummy', platform: 'android,mobileweb' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					const found = result.found.find(r => r.id === 'ti.dummy');
					assert(!found, '"ti.dummy" module was marked as found, should have been ignored');

					const missing = result.missing.find(r => r.id === 'ti.dummy');
					assert(!missing, '"ti.dummy" module was marked as missing, should have been ignored');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should ignore "dummy" module with non-matching platform with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.dummy', platform: 'android,mobileweb' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						const found = result.found.find(r => r.id === 'ti.dummy');
						assert(!found, '"ti.dummy" module was marked as found, should have been ignored');

						const missing = result.missing.find(r => r.id === 'ti.dummy');
						assert(!missing, '"ti.dummy" module was marked as missing, should have been ignored');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should not find doesnotexist module with individual params', function (done) {
			appc.timodule.find([
				{ id: 'doesnotexist' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Could not find a valid Titanium module id=doesnotexist version=latest platform=ios,commonjs deploy-type=development'
					);

					const missing = result.missing.find(r => r.id === 'doesnotexist');
					assert(missing, '"doesnotexist" module not marked as missing');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should not find doesnotexist module with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'doesnotexist' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Could not find a valid Titanium module id=doesnotexist version=latest platform=ios,commonjs deploy-type=development'
						);

						const missing = result.missing.find(r => r.id === 'doesnotexist');
						assert(missing, '"doesnotexist" module not marked as missing');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find incompatible "toonew" module with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.toonew' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found incompatible Titanium module id=ti.toonew version=1.0 platform=ios deploy-type=development'
					);

					const incompatible = result.incompatible.find(r => r.id === 'ti.toonew');
					assert(incompatible, '"ti.toonew" module not marked as incompatible');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find incompatible "toonew" module with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.toonew' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Found incompatible Titanium module id=ti.toonew version=1.0 platform=ios deploy-type=development'
						);

						const incompatible = result.incompatible.find(r => r.id === 'ti.toonew');
						assert(incompatible, '"ti.toonew" module not marked as incompatible');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find conflicting "ambiguous" module with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.ambiguous' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir ], logger, function (result) {
				try {
					const conflict = result.conflict.find(r => r.id === 'ti.ambiguous');
					assert(conflict, '"ti.ambiguous" module was not marked as conflict');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find conflicting "ambiguous" module with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.ambiguous' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						const conflict = result.conflict.find(r => r.id === 'ti.ambiguous');
						assert(conflict, '"ti.ambiguous" module was not marked as conflict');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find only one "baz" module with individual params', function (done) {
			appc.timodule.find([
				{ id: 'baz' }
			], [ 'ios', 'iphone' ], 'development', '3.2.0', [ testResourcesDir, path.join(__dirname, 'resources', 'timodule2') ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=baz version=2.0.1 platform=ios deploy-type=development'
					);

					let found = 0;
					for (let i = 0; !found && i < result.found.length; i++) {
						if (result.found[i].id === 'baz') {
							found++;
						}
					}
					assert(found === 1, '"baz" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find only one "baz" module with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'baz' } ],
				platforms: [ 'ios', 'iphone' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ testResourcesDir, path.join(__dirname, 'resources', 'timodule2') ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Found Titanium module id=baz version=2.0.1 platform=ios deploy-type=development'
						);

						let found = 0;
						for (let i = 0; !found && i < result.found.length; i++) {
							if (result.found[i].id === 'baz') {
								found++;
							}
						}
						assert(found === 1, '"baz" module not marked as found');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find the latest valid module with individual params', function (done) {
			appc.timodule.find([
				{ id: 'ti.latestvalid' }
			], [ 'commonjs' ], 'development', '3.2.0', [ path.join(__dirname, 'resources', 'timodule3') ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.latestvalid version=1.0 platform=commonjs deploy-type=development'
					);

					let found = 0;
					for (let i = 0; !found && i < result.found.length; i++) {
						if (result.found[i].id === 'ti.latestvalid') {
							found++;
						}
					}
					assert(found === 1, '"ti.latestvalid" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find the latest valid module with params object', function (done) {
			appc.timodule.find({
				modules: [ { id: 'ti.latestvalid' } ],
				platforms: [ 'commonjs' ],
				deployType: 'development',
				sdkVersion: '3.2.0',
				searchPaths: [ path.join(__dirname, 'resources', 'timodule3') ],
				logger: logger,
				bypassCache: true,
				callback: function (result) {
					try {
						logger.buffer.stripColors.should.containEql(
							'Found Titanium module id=ti.latestvalid version=1.0 platform=commonjs deploy-type=development'
						);

						let found = 0;
						for (let i = 0; !found && i < result.found.length; i++) {
							if (result.found[i].id === 'ti.latestvalid') {
								found++;
							}
						}
						assert(found === 1, '"ti.latestvalid" module not marked as found');

						done();
					} catch (e) {
						done(e);
					}
				}
			});
		});

		it('should find the latest valid module with iphone/ios mismatch platform', function (done) {
			appc.timodule.find([
				{ id: 'ti.map' }
			], [ 'ios' ], 'development', '6.3.0', [ path.join(__dirname, 'resources', 'timodule4') ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.map version=3.1.0 platform=ios deploy-type=development'
					);

					const found = result.found.find(r => r.id === 'ti.map');
					assert(found, '"ti.map" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should find the latest valid module with iphone/ios mismatch platform 2', function (done) {
			appc.timodule.find([
				{ id: 'ti.map', platform: 'iphone' }
			], [ 'iphone' ], 'development', '6.3.0', [ path.join(__dirname, 'resources', 'timodule4') ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.map version=3.1.0 platform=ios deploy-type=development'
					);

					const found = result.found.find(r => r.id === 'ti.map');
					assert(found, '"ti.map" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should parse apiversion to an integer before comparing', function (done) {
			appc.timodule.find([
				{ id: 'ti.map', platform: 'android' }
			], [ 'android' ], 'development', { sdkVersion: '6.3.0', moduleAPIVersion: { android: 2 } }, [ path.join(__dirname, 'resources', 'timodule5') ], logger, function (result) {
				try {
					logger.buffer.stripColors.should.containEql(
						'Found Titanium module id=ti.map version=3.1.0 platform=android deploy-type=development'
					);

					const found = result.found.find(r => r.id === 'ti.map');
					assert(found, '"ti.map" module not marked as found');

					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});

		it('should check apiversion for iphone if no ios value', function (done) {
			appc.timodule.find([
				{ id: 'cross-platform-with-manifest', platform: 'iphone' }
			], [ 'iphone' ], 'development', { sdkVersion: '6.3.0', moduleAPIVersion: { iphone: '2' } }, [ path.join(__dirname, 'resources', 'cross-platform-native-module-with-manifest') ], logger, function (result) {
				try {
					console.log(logger.buffer.stripColors);
					logger.buffer.stripColors.should.containEql(
						'Found incompatible Titanium module id=cross-platform-with-manifest version=1.2.3 platform=ios api-version=1 deploy-type=development'
					);

					logger.buffer.stripColors.should.containEql(
						'Module cross-platform-with-manifest has apiversion=1, but the selected SDK supports module apiversion=2 on platform=ios'
					);

					assert(result.found.length === 0, '"cross-platform-with-manifest" module was marked as found');
					done();
				} catch (e) {
					done(e);
				}
			}, true);
		});
	});

	describe('#detectNodeModules()', () => {
		it('detects single-platform native module with package.json and no explicit platform sub-directory', async () => {
			const modules = await appc.timodule.detectNodeModules([ path.join(__dirname, 'resources/npm-native-module/node_modules') ]);
			modules.should.be.an.Array;
			modules.should.have.length(1);
			const nativeModule = modules[0];
			nativeModule.id.should.eql('native-module');
			nativeModule.modulePath.should.eql(path.join(__dirname, 'resources/npm-native-module/node_modules/native-module'));
			nativeModule.platform.should.eql([ 'ios' ]);
			nativeModule.version.should.eql('2.0.1');
			nativeModule.manifest.should.be.an.Object;
			nativeModule.manifest.should.have.a.property('minsdk').which.is.eql('5.0.0');
			nativeModule.manifest.should.have.a.property('apiversion').which.is.eql(2);
			nativeModule.manifest.should.have.a.property('guid').which.is.eql('bba89061-0fdb-4ff1-95a8-02876f5601f9');
			nativeModule.manifest.should.have.a.property('moduleid').which.is.eql('native-module');
			nativeModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'arm64', 'i386', 'x86_64' ]);
		});

		it('detects single-platform native module with package.json and explicit platform sub-directory', async () => {
			const modules = await appc.timodule.detectNodeModules([ path.join(__dirname, 'resources/native-module-with-platform-subdir/node_modules') ]);
			modules.should.be.an.Array;
			modules.should.have.length(1);
			const nativeModule = modules[0];
			nativeModule.id.should.eql('native-module');
			nativeModule.modulePath.should.eql(path.join(__dirname, 'resources/native-module-with-platform-subdir/node_modules/native-module/ios'));
			nativeModule.platform.should.eql([ 'ios' ]);
			nativeModule.version.should.eql('2.0.1');
			nativeModule.manifest.should.be.an.Object;
			nativeModule.manifest.should.have.a.property('minsdk').which.is.eql('5.0.0');
			nativeModule.manifest.should.have.a.property('apiversion').which.is.eql(2);
			nativeModule.manifest.should.have.a.property('guid').which.is.eql('bba89061-0fdb-4ff1-95a8-02876f5601f9');
			nativeModule.manifest.should.have.a.property('moduleid').which.is.eql('native-module');
			nativeModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'arm64', 'i386', 'x86_64' ]);
		});

		it('detects cross-platform native module w/o manifest files', async () => {
			// test that we handle a native module with per-platform sub-directories
			const modules = await appc.timodule.detectNodeModules([ path.join(__dirname, 'resources/cross-platform-native-module/node_modules') ]);
			modules.should.be.an.Array;
			// Expands out to one "module" per-platform
			modules.should.have.length(2);
			const iosModule = modules[0];
			iosModule.id.should.eql('cross-platform');
			iosModule.modulePath.should.eql(path.join(__dirname, 'resources/cross-platform-native-module/node_modules/cross-platform/ios'));
			iosModule.platform.should.eql([ 'ios' ]);
			iosModule.version.should.eql('2.0.1');
			iosModule.manifest.should.be.an.Object;
			iosModule.manifest.should.have.a.property('minsdk').which.is.eql('5.0.0');
			iosModule.manifest.should.have.a.property('apiversion').which.is.eql(2);
			iosModule.manifest.should.have.a.property('guid').which.is.eql('bba89061-0fdb-4ff1-95a8-02876f5601f9');
			iosModule.manifest.should.have.a.property('moduleid').which.is.eql('cross-platform');
			iosModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'arm64', 'i386', 'x86_64' ]);
			// android
			const androidModule = modules[1];
			androidModule.id.should.eql('cross-platform');
			androidModule.modulePath.should.eql(path.join(__dirname, 'resources/cross-platform-native-module/node_modules/cross-platform/android'));
			androidModule.platform.should.eql([ 'android' ]);
			androidModule.version.should.eql('2.0.1');
			androidModule.manifest.should.be.an.Object;
			androidModule.manifest.should.have.a.property('minsdk').which.is.eql('7.0.0');
			androidModule.manifest.should.have.a.property('apiversion').which.is.eql(4);
			androidModule.manifest.should.have.a.property('guid').which.is.eql('bba89061-0fdb-4ff1-95a8-02876f5601f9');
			androidModule.manifest.should.have.a.property('moduleid').which.is.eql('cross-platform');
			androidModule.manifest.should.have.a.property('architectures').which.is.eql([ 'arm64-v8a', 'armeabi-v7a', 'x86' ]);
		});

		it('detects native module in node_modules folder with package.json and manifest and merges values', async () => {
			// test that we merge the info from package.json and manifest
			// This is a single-platform module with implicit top-level dir
			const modules = await appc.timodule.detectNodeModules([ path.join(__dirname, 'resources/native-module-with-manifest/node_modules') ]);
			modules.should.be.an.Array;
			modules.should.have.length(1);
			const nativeModule = modules[0];
			nativeModule.id.should.eql('native-module-with-manifest');
			nativeModule.modulePath.should.eql(path.join(__dirname, 'resources/native-module-with-manifest/node_modules/native-module-with-manifest'));
			nativeModule.platform.should.eql([ 'ios' ]);
			nativeModule.version.should.eql('4.0.2'); // taken from anifest file, not package.json version
			nativeModule.manifest.should.be.an.Object;
			nativeModule.manifest.should.have.a.property('minsdk').which.is.eql('5.0.0');
			nativeModule.manifest.should.have.a.property('apiversion').which.is.eql(2);
			nativeModule.manifest.should.have.a.property('guid').which.is.eql('bba89061-0fdb-4ff1-95a8-02876f5601f9');
			nativeModule.manifest.should.have.a.property('moduleid').which.is.eql('native-module-with-manifest');
			nativeModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'arm64', 'i386', 'x86_64' ]);
		});

		it('detects cross-platform native module with platform-specific manifests', async () => {
			const modules = await appc.timodule.detectNodeModules([ path.join(__dirname, 'resources/cross-platform-native-module-with-manifest/node_modules') ]);
			modules.should.be.an.Array;
			// Expands out to one "module" per-platform
			modules.should.have.length(2);
			const iosModule = modules[0];
			iosModule.id.should.eql('cross-platform-with-manifest');
			iosModule.modulePath.should.eql(path.join(__dirname, 'resources/cross-platform-native-module-with-manifest/node_modules/cross-platform/ios'));
			iosModule.platform.should.eql([ 'ios' ]);
			iosModule.version.should.eql('1.2.3'); // platform specific manifest value trumps the cross-platform package.json version
			iosModule.manifest.should.be.an.Object;
			iosModule.manifest.should.have.a.property('minsdk').which.is.eql('3.0.0');
			iosModule.manifest.should.have.a.property('apiversion').which.is.eql(1);
			iosModule.manifest.should.have.a.property('guid').which.is.eql('ccb89061-0fdb-4ff1-95a8-02876f5601f9');
			iosModule.manifest.should.have.a.property('moduleid').which.is.eql('cross-platform-with-manifest');
			iosModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'i386' ]);
			// android
			const androidModule = modules[1];
			androidModule.id.should.eql('cross-platform-with-manifest');
			androidModule.modulePath.should.eql(path.join(__dirname, 'resources/cross-platform-native-module-with-manifest/node_modules/cross-platform/android'));
			androidModule.platform.should.eql([ 'android' ]);
			androidModule.version.should.eql('1.2.3'); // platform specific manifest value trumps the cross-platform package.json version
			androidModule.manifest.should.be.an.Object;
			androidModule.manifest.should.have.a.property('minsdk').which.is.eql('4.0.0');
			androidModule.manifest.should.have.a.property('apiversion').which.is.eql(6);
			androidModule.manifest.should.have.a.property('guid').which.is.eql('ccb89061-0fdb-4ff1-95a8-02876f5601f9');
			androidModule.manifest.should.have.a.property('moduleid').which.is.eql('cross-platform-with-manifest');
			androidModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armeabi-v7a', 'x86' ]);
		});
		// TODO: Test single platform module with explicit sub-dir and manifest file!

		// TODO: test the priority of values: platform-specific package.json > manifest > cross-platform package.json values > generic package.json values
		it('detects cross-platform native module w/ manifest files, w/ platform-specific package.json values', async () => {
			const modules = await appc.timodule.detectNodeModules([ path.join(__dirname, 'resources/cross-platform-native-module-specific-package-json/node_modules') ]);
			modules.should.be.an.Array;
			// Expands out to one "module" per-platform
			modules.should.have.length(2);
			const iosModule = modules[0];
			iosModule.id.should.eql('cross-platform-with-manifest-ios'); // manifest beat out the cross-platform section in package.json
			iosModule.modulePath.should.eql(path.join(__dirname, 'resources/cross-platform-native-module-specific-package-json/node_modules/cross-platform/ios'));
			iosModule.platform.should.eql([ 'ios' ]);

			// platform subsection of package.json wins over manifest
			iosModule.version.should.eql('4.3.1');
			iosModule.manifest.should.be.an.Object;
			iosModule.manifest.should.have.a.property('minsdk').which.is.eql('5.0.0');
			iosModule.manifest.should.have.a.property('apiversion').which.is.eql(2);
			iosModule.manifest.should.have.a.property('architectures').which.is.eql([ 'armv7', 'arm64', 'i386', 'x86_64' ]);

			// manifest wins over cross-platform section of package.json
			iosModule.manifest.should.have.a.property('guid').which.is.eql('ccb89061-0fdb-4ff1-95a8-02876f5601f9');
			iosModule.manifest.should.have.a.property('moduleid').which.is.eql('cross-platform-with-manifest-ios');

			// falls back to npm package name (without scope) if titanium sub-sections of package.json and manifest don't declare it
			iosModule.manifest.should.have.a.property('name').which.is.eql('cross-platform-npm-package');

			// android
			const androidModule = modules[1];
			androidModule.id.should.eql('cross-platform-with-manifest-android');
			androidModule.modulePath.should.eql(path.join(__dirname, 'resources/cross-platform-native-module-specific-package-json/node_modules/cross-platform/android'));
			androidModule.platform.should.eql([ 'android' ]);

			// platform subsection of package.json wins over manifest
			androidModule.version.should.eql('6.0.1');
			androidModule.manifest.should.be.an.Object;
			androidModule.manifest.should.have.a.property('minsdk').which.is.eql('7.0.0');
			androidModule.manifest.should.have.a.property('apiversion').which.is.eql(4);
			androidModule.manifest.should.have.a.property('architectures').which.is.eql([ 'arm64-v8a', 'armeabi-v7a', 'x86' ]);

			// manifest wins over cross-platform section of package.json
			androidModule.manifest.should.have.a.property('guid').which.is.eql('ccb89061-0fdb-4ff1-95a8-02876f5601f9');
			androidModule.manifest.should.have.a.property('moduleid').which.is.eql('cross-platform-with-manifest-android');

			// falls back to npm package name (without scope) if titanium sub-sections of package.json and manifest don't declare it
			androidModule.manifest.should.have.a.property('name').which.is.eql('cross-platform-npm-package');
		});
	});
});
