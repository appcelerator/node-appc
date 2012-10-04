/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var afs = require('./fs'),
	sdkPaths = require('./environ').os.sdkPaths,
	util = require('./util'),
	version = require('./version'),
	zip = require('./zip'),
	async = require('async'),
	fs = require('fs'),
	path = require('path');

exports.detect = function (projectDir, logger, callback) {
	var searchPaths = (projectDir ? [projectDir] : []).concat(sdkPaths.map(function (p) {
			return afs.resolvePath(p);
		})),
		moduleZipRegExp = /^.+\-.+?\-.+?\.zip$/,
		modules = {};
	
	function searchModuleDir(moduleName, modulePath, platform) {
		afs.visitDirsSync(modulePath, function (version, versionPath) {
			var manifestFile = path.join(versionPath, 'manifest');
			if (afs.exists(manifestFile)) {
				var module = modules[moduleName] || (modules[moduleName] = {}),
					details = module[version] || (module[version] = {
						modulePath: versionPath,
						manifest: {},
						platforms: {}
					});
				
				fs.readFileSync(manifestFile).toString().split('\n').forEach(function (line) {
					var p = line.indexOf(':'),
						key,
						value;
					if (line.charAt(0) != '#' && p != -1) {
						key = line.substring(0, p);
						value = details.manifest[key] = line.substring(p + 1).trim();
						if (platform) {
							// old style
							details.platforms[platform] || (details.platforms[platform] = { originalManifest: {} });
							details.platforms[platform].originalManifest[key] = value;
						} else {
							// new style
							key == 'platforms' && value.split(',').forEach(function (p) {
								details.platforms[p.trim()] = {}; // empty for now...
							});
						}
					}
				});
				
				logger && logger.debug(__('Detected module for %s: %s %s @ %s', Object.keys(details.platforms).join(','), details.manifest.moduleid.cyan, details.manifest.version, details.modulePath));
			}
		});
	}
	
	async.parallel(searchPaths.map(function (titaniumRoot) {
		return function(cb) {
			afs.exists(titaniumRoot, function (exists) {
				if (!exists) return cb();
				
				var moduleRoot = path.join(titaniumRoot, 'modules'),
					tasks = [];
				
				// auto-install zipped modules
				fs.readdirSync(titaniumRoot).forEach(function (file) {
					var moduleZip = path.join(titaniumRoot, file);
					if (fs.statSync(moduleZip).isFile() && moduleZipRegExp.test(file)) {
						tasks.push(function (taskDone) {
							logger && logger.info(__('Installing module: %s', file));
							zip.unzip(moduleZip, titaniumRoot, function () {
								try {
									fs.unlinkSync(moduleZip);
								} catch (e) {}
								taskDone();
							});
						});
					}
				});
				
				async.parallel(tasks, function () {
					// search module directories
					logger && logger.debug(__('Detecting modules in %s', moduleRoot.cyan));
					afs.visitDirs(moduleRoot, function (platform, modulesPath) {
						if (/^osx|win32|linux$/.test(platform)) {
							// skip old Titanium Desktop directories
						} else if (/^android|iphone|mobileweb|commonjs$/.test(platform)) {
							// old style module directory
							afs.visitDirsSync(modulesPath, function (moduleName, modulePath) {
								searchModuleDir(moduleName, modulePath, platform);
							});
						} else {
							// possibly a new style module directory
							searchModuleDir(platform, modulesPath);
						}
					}, cb);
				});
			});
		};
	}), function () {
		callback(modules);
	});
};

exports.find = function (modules, platforms, deployType, projectDir, logger, callback) {
	var result = {
			found: [],
			missing: [],
			incompatible: []
		};
	
	// if there are modules to find, then just exit now
	if (!modules || !modules.length) return callback(result);
	
	Array.isArray(platforms) || (platforms = [platforms]);
	platforms.push('commonjs');
	
	exports.detect(projectDir, logger, function (installed) {
		modules.forEach(function (module) {
			if (module.platform && platforms.indexOf(module.platform) == -1) return;
			if (module.deployType && module.deployType != deployType) return;
			
			logger && logger.debug(__('Looking for Titanium Module id: %s version: %s platform: %s', module.id.cyan, (module.version || 'latest').cyan, module.platform.cyan));
			
			if (module.id && installed[module.id]) {
				var mp = module.platform ? [module.platform] : platforms, // if the module doesn't have any platforms, then it's any platform
					i = 0,
					info,
					platform,
					found;
				
				while (!found && i < mp.length) {
					platform = mp[i++];
					if (platforms.indexOf(platform) != -1) {
						if (module.version) {
							info = installed[module.id][module.version];
							if (info && info.platforms[platform]) {
								util.mix(module, info);
								if (info.minsdk && version.gt(info.minsdk, ti.manifest.version)) {
									incompatible.push(module);
								} else {
									result.found.push(module);
								}
								found = true;
							}
						} else {
							// no version, scan newest versions for the first one to match this platform
							var versions = Object.keys(installed[module.id]).sort().reverse(),
								j = 0;
							while (j < versions.length) {
								info = installed[module.id][versions[j++]];
								if (info.platforms[platform]) {
									util.mix(module, info);
									if (info.minsdk && version.gt(info.minsdk, ti.manifest.version)) {
										incompatible.push(module);
									} else {
										result.found.push(module);
									}
									found = true;
									break;
								}
							}
						}
					}
				}
				
				found || result.missing.push(module);
			} else {
				logger && logger.warn(__('Could not find Titanium Module id: %s version: %s platform: %s', module.id.cyan, (module.version || 'latest').cyan, module.platform.cyan));
				result.missing.push(module);
			}
		});
		
		callback(result);
	});
};