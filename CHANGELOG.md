0.1.x
-------------------
 * Fixed Titanium module detection library to properly handle the deploy-type property. [TIMOB-12422]
 * Removed the deprecated Uglify 1 AST walker since we've upgraded to Uglify 2. [TIMOB-12439]

0.1.27 (1/22/2013)
-------------------
 * Fixed bug if ~/.titanium folder doesn't already exist [TIMOB-12373]

0.1.26 (1/21/2013)
-------------------
 * Fixed bugs in the analytics library when the user is offline [TIMOB-12265]
 * Fixed plist parsing when <string> tag is empty [TIMOB-12167]
 * Fixed iOS cert parsing to properly decode special characters as well as organize certs by keychain [TIMOB-12033]
 * Fixed bug in fs lib's copyDirSyncRecursive() function with copying relative symlinks
 * Added support to Titanium module detection to find conflicting module names [TIMOB-11919]
 * Fixed Titanium module detection searching the same path twice

0.1.25 (12/21/2012)
-------------------
 * Fixed buffer size issues when ios library detects installed developer certs [TIMOB-12146]

0.1.24 (12/12/2012)
-------------------
 * Removed 'default' from Android skin detection that was throwing off Titanium Studio [TIMOB-12082]

0.1.23 (12/12/2012)
-------------------
 * Fixed bug with modules not properly being unzipped if the modules directory doesn't exist [TIMOB-12031]

0.1.22 (12/11/2012)
-------------------
 * Fixed timodule unzipping [TIMOB-12031]
 * Updated a i18n string

0.1.21 (12/7/2012)
-------------------
 * Fixed bug with the zip library not properly unzipping on Windows due to extraneous quotes [TIMOB-11649]
 * Added better error handling when unzipping on Windows
 * Added trace logging for the image resizing

0.1.20 (12/6/2012)
-------------------
 * Extended the AST walker to accept a pre-parsed AST tree instead of the filename of a file to parse

0.1.19 (12/6/2012)
-------------------
 * Fixed ISO string formatting in plist date fields [TIMOB-11982]

0.1.18 (12/6/2012)
-------------------
 * Updated i18n strings and fixed a bug with the locale being loaded correctly [TIMOB-11825]

0.1.17 (11/28/2012)
-------------------
 * Fixed Uglify version to 1.3.X [TIMOB-11867]

0.1.16 (11/27/2012)
-------------------
 * Fixed bug with zip file extracting on Windows [TIMOB-11880]

0.1.15 (11/21/2012)
-------------------
 * Small tweaks

0.1.14 (11/21/2012)
-------------------
 * Fixed bug with Android detection library not resolving Android SDK paths starting with a tilde (~) [TIMOB-11781]

0.1.13 (11/11/2012)
-------------------
 * Fixed bug with unzip arguments being unnecessarily quoted

0.1.12 (11/7/2012)
-------------------
 * Changed environ lib to explicit detect() call instead of automatic
 * Added support for additional Titanium SDK path detection
 * Fixed bug with unzipping files erroring because stdout exceeded buffer size [TIMOB-11649]

0.1.11 (10/31/2012)
-------------------
 * Fixed typo in variable name that was breaking analytics library
