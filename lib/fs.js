/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * Portions derived from wrench under the MIT license.
 * Copyright (c) 2010 Ryan McGrath
 * https://github.com/ryanmcgrath/wrench-js
 */

var fs = require('fs'),
	path = require('path'),
	wrench = require('wrench'),
	tildeRegExp = new RegExp('^(~)(\\' + path.sep + '.*)?$'),
	winEnvVarRegExp = /(%([^%]*)%)/g;

exports.home = function () {
	return process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'];
};

exports.exists = function (p) {
	// existsSync was moved from path to fs in node 0.8.0
	var len = arguments.length,
		cb = len && arguments[len-1];
	if (cb && Object.prototype.toString.call(cb) == '[object Function]') {
		// async
		if (arguments.length > 2) {
			(fs.exists || path.exists)(path.join.apply(null, Array.prototype.slice.call(arguments, 0, len-1)), cb);
		} else {
			(fs.exists || path.exists)(p, cb);
		}
	} else {
		// sync
		return (fs.existsSync || path.existsSync)(len > 1 ? path.join.apply(null, arguments) : p);
	}
};

exports.resolvePath = function () {
	var p = path.join.apply(null, arguments);
	return path.resolve(p.replace(tildeRegExp, function (s, m, n) {
		return exports.home() + (n || '/');
	}).replace(winEnvVarRegExp, function (s, m, n) {
		return process.platform == 'win32' && process.env[n] || m;
	}));
};

// list all directories in a given directory and call the callback function for each specific directory
exports.visitDirs = function (dir, visitor, finished) {
	var visited = 0;
	fs.readdir(dir, function (err, files) {
		if (err) {
			finished();
		} else {
			files.forEach(function (file) {
				var full = path.join(dir, file);
				fs.lstat(full, function (err, stats) {
					!err && stats.isDirectory() && visitor(file, full);
					++visited == files.length && finished();
				});
			});
		}
	});
};

exports.visitDirsSync = function (dir, visitor) {
	fs.readdirSync(dir).filter(function (file) {
		return fs.lstatSync(path.join(dir, file)).isDirectory();
	}).forEach(function (subdir) {
		visitor(subdir, path.join(dir, subdir));
	});
};

exports.touch = function (file) {
	if (exports.exists(file)) {
		fs.utimesSync(file, Date.now(), Date.now());
	} else {
		fs.writeFileSync(file, '');
	}
};

exports.isDirWritable = function (dir) {
	var result = false,
		tmpFile = path.join(dir, 'tmp' + Math.round(Math.random() * 1e12));
	if (exports.exists(dir)) {
		try {
			exports.touch(tmpFile);
			result = exports.exists(tmpFile);
			fs.unlink(tmpFile);
		} catch (e) {}
	}
	return result;
};

// Copies a file synchronously. If the destination is an existing directory, it uses the source's filename.
// If the destination is a existing file, it uses the destination file's name. If the destination does NOT
// exist, it assumes the dest is a path to a file.
exports.copyFileSync = function (src, dest, opts) {
	var destFilename = path.basename(src);
	if (!exports.exists(dest) || !fs.lstatSync(dest).isDirectory()) {
		destFilename = path.basename(dest);
		dest = path.dirname(dest);
	}
	wrench.mkdirSyncRecursive(dest);
	dest = path.join(dest, destFilename);
	opts && opts.logger && opts.logger(__('Copying %s => %s', src.cyan, dest.cyan));
	fs.writeFileSync(dest, fs.readFileSync(src));
};

// copyDirSyncRecursive() is the same as the one from wrench, except this one supports a
// logger option and ignore lists.
exports.copyDirSyncRecursive = function(sourceDir, newDirLocation, opts) {
	opts = opts || {};
	opts.logger && opts.logger(__('Copying %s => %s', sourceDir.cyan, newDirLocation.cyan));
	
	if (!opts.preserve) {
		try {
			fs.statSync(newDirLocation).isDirectory() && exports.rmdirSyncRecursive(newDirLocation);
		} catch(e) {}
	}
	
	//  Create the directory where all our junk is moving to; read the mode of the source directory and mirror it
	var checkDir = fs.statSync(sourceDir),
		files = fs.readdirSync(sourceDir),
		rootIgnore = opts.rootIgnore && [].concat(opts.rootIgnore);
	
	if (!files.length) wrench.mkdirSyncRecursive(newDirLocation);
	
	delete opts.rootIgnore;
	
	for (var i = 0; i < files.length; i++) {
		if (rootIgnore && rootIgnore.indexOf(files[i]) != -1) continue;
		
		var currFile = fs.lstatSync(sourceDir + '/' + files[i]),
			destFile = newDirLocation + '/' + files[i];
		
		if (currFile.isDirectory()) {
			// recursion this thing right on back.
			if (opts.ignoreDirs && opts.ignoreDirs.indexOf(files[i]) != -1) continue;
			wrench.mkdirSyncRecursive(newDirLocation);
			exports.copyDirSyncRecursive(sourceDir + '/' + files[i], destFile, opts);
		} else {
			if (opts.ignoreFiles && opts.ignoreFiles.indexOf(files[i]) != -1) continue;
			if (currFile.isSymbolicLink()) {
				wrench.mkdirSyncRecursive(newDirLocation);
				var symlinkFull = fs.readlinkSync(sourceDir + '/' + files[i]);
				fs.symlinkSync(symlinkFull, destFile);
			} else {
				// At this point, we've hit a file actually worth copying... so copy it on over.
				var contents = fs.readFileSync(sourceDir + '/' + files[i]);
				if (opts.callback) {
					contents = opts.callback(sourceDir + '/' + files[i], destFile, contents, opts.logger);
					if (Object.prototype.toString.call(contents) == '[object Object]') {
						contents.dest && (destFile = contents.dest);
						contents.contents && (contents = contents.contents);
					}
				}
				wrench.mkdirSyncRecursive(path.dirname(destFile));
				fs.writeFileSync(destFile, contents);
			}
		}
	}
};

// Copies the contents from one dir to another, but only if the file doesn't already exist in the destination. Uses 
// copyFileSync under the hood, and the options are passed straight through to copyFileSync
exports.nonDestructiveCopyDirSyncRecursive = function(sourceDir, newDirLocation, opts) {
	var pathStack = [''],
		ignoreHiddenFiles = opts && opts.ignoreHiddenFiles,
		dir;

	// Build up the ignore files list to contain everything that already exists in the destination
	while(pathStack.length) {
		dir = pathStack.pop();
		fs.readdirSync(path.join(sourceDir, dir)).forEach(function (file) {
			var sourceFilePath = path.join(sourceDir, dir, file),
				destFilePath = path.join(newDirLocation, dir, file)
			if (fs.statSync(sourceFilePath).isDirectory()) {
				pathStack.push(path.join(dir, file));
			} else if (!exports.exists(destFilePath)) {
				if (!ignoreHiddenFiles || path.basename(sourceFilePath).charAt(0) !== '.') {
					exports.copyFileSync(sourceFilePath, destFilePath, opts);
				}
			}
		});
	}
};