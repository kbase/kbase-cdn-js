# Package Configuration Specification

Each package is specified with a single list entry in the top level "packages" property

## Bower package name

First, a set of properties describes the name of the package. In the simple, canonical, implementation the package name is the same as the bower package name, the directory the package is stored in, and the AMD root path element. For example, many top-tier Javascript packages work this way out of the box because they use simple bower, github repo, and well known (and oft-used) AMD module id.

However, each of these values may be provided explicitly to provide better order and usability to the default package.

name
: Bower name, unless packageName is defined, directory name, unless directory is specified, AMD root path, unless otherwise specified with amdRoot

packageName
: Override name for usage as the bower package name

installedDirectory
: Indicates that the directory the package was installed into is different than the name or packageName

amdName
: Override name and packageName for using within generated amd path specs


## Bower package version

In addition, the *versions* property is used to specify one or more specific versions to be installed

versions
: A list of one or more version expressions acceptable to bower which specify a single invariant version.


### AMD Names

One of the outputs of the CDN build is a mapping of AMD path names to CDN paths. This is extracted from the package config like so:

amdName
: if the amdName property is present, it will be used

name
: Otherwise use the primary name

Note the difference between the AMD name and the package path. 

### Package Path

The package path is structured like

package-or-repo-name/version/module-path

where 

package-or-repo-name
: Is the top level directory name for the package. This is normally constructed from the package name as defined in the config and passed to bower. Note that this may be different than the directory the package is originally installed into. If this is the case, the package config will have the installedDirectory property -- otherwise the CDN build tool would not know where to find the package!

version
: This is the precise version of the package, in dotted notation.

module-path
: The module path identifies the module being accessed. It represents a path within the package, the final component of which must be a file with the suffix ".js".

packagePath = packageName || 

### Examples

This is an example of a very simple package, *d3*. Note that the package name suffices for all naming needs, 

```
packages:
    -
        name: d3
        versions: [3.5.16]    
```


### Backup -- Bower package processing

It is worth reviewing the process of obtaining and installing a Javascript package from bower:

1. The build process specifies to bower a package name and a version. In the typical usage, this is provided within the "dependencies" property of a bower.json file.

2. Bower locates this package within the bower global service, and uses the configuration for this package to identify the git repository it resides in.

3. Bower determines if the requested version, as expressed by a semver expression or explicit git tag or branch, is available.

4. If available, bower will install, via git clone, the associated repository at the specified tag or branch, with a depth of 1. The installation location is by default bower_components, but may be specified in the .bowerrc file.

5. Bower will them remove any files or directories as specified in the "ignore" property, if any, in the original request to bower.

6. This is the end of the Bower work


There are a few issues at this point with the state of the bower package if one wants to make it available to a browser runtime.

1. There are always extraneous files beyond what is required by the javascript runtime. Typically, many packages in the end resolve to a single file, the the packages include at a minimum the bower.json config file, a package.json, a readme and license file, perhaps documentation, test, source code, packages for different environments, minified versions of them. The presence of these files makes the package and thus the web app more complex, exposes files to the server side of the web app which are not intended to be exposed.

2. The directory the package is installed to is determined by the repo the package is associated with. This is usually, but not always, the same as the bower package name. 

3. A bower config property "main" is used to specify the files provided by the package. This is a poorly specified and understood feature, but many packages use it correctly. Still, some do not use it correctly. In addition, there is no bower utility for handling the "main" feature.

To handle these issues we have implemented additional processing of both the bower configuration and our packages configuration to create the final, usable package structure.

## Build configuration

For cases in which the bower configuration, with the help of the the name properties, is not adequate to install the package, an *install* property 

method
: install method to use

startPath
: start all file references at the given path. For "custom" installs, it is used literally as the start path for the file references, for "bowerMain", the path is actually removed from the resulting paths.

exclude
: do not copy files in this list

files
: List of files, in glob-compatible format, to be copied from the source package into the destination

## More Examples

### nunjucks: main is not what we want

In this example, we find that the nunjucks bower.json specifies that the main file is *browser/nunjucks.min.js*.

There is a problem here -- we don't want to install the minimized version of the package, so we can't use this bower.json main config setting. By inspecting the raw package (repo) source we see that the source file we want is actually *browser/nunjucks.js*.

In order to override the *bowerMain* install method, we specify "custom"  for the *install.method* property.

We specify a *startPath* of *browser*, so that we copy just *nunjucks.js* into the *package* directory.

And finally, we need to specify the files to copy in the files property. Note that this is relative to the startPath within the package repo. (Which is different from bowerMain, in which the files are always specified as full paths, and the startPath is used to snip off the matching start segment of the path.)


```
 -
    name: nunjucks
    versions: [2.4.1]
    install:
        method: custom
        startPath: browser
        files: 
            - nunjucks.js
```