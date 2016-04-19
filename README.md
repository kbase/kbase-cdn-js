# KBase CDN Prototype

A prototype CDN server for Javascript clients.

- build a collection of javscript libraries published via Bower
- organize by library and version, as in library/#.#.#
- optimize and limit the installation, removing all unnecessary bits of the library other than assets actually being served
- provide a small nodejs based server for testing or deployment
- may also be deployed under nginx or any other file-serving web server

## Contents

- [Quick Develop Guide](doc/quick-develop.md)
- [Quick Deploy Guide](doc/quick-deploy.md)
- [Building](doc/building.md)
- [Developing](doc/developing.md)
- [Testing](doc/testing.md)
- [Installing and Deploying](doc/installing.md)

## Updates

For now, use this section to record progress and future work.

- there is now a build process

## TODO

- documentation, esp. 
    - how to add a new package and version
    - troubleshooting (e.g. packages with funky versions or locations)
- testing
- create requirejs paths 
- some sort of inspectable content per package ... an info file of sources to
  record the origin, license, amd path, dependencies ... these are all maybes


## NOTES

For the time being, 

## About

The CDN provides http access to external and internal javascript packages in use within the KBase javascript front end environments -- Narrative, kbase-ui, and local development.

The following is an example of a simple browser-based single page app which will obtain the "object info" for a given object and display a brief summary of it on the page.

```
<html>
<head>
  <title>CDN Test</title>
</head>
<body>
  <div id="main"></div>
  <script>
    var require = {
      baseUrl: 'js',
      paths: {
        jquery: '//cdn.kbase.us/cdn/jquery/2.2.2/jquery',
        bluebird: '//cdn.kbase.us/cdn/bluebird/3.3.4/bluebird',
        kb_service: '//cdn.kbase.us/cdn/kbase-service-clients-js/1.4.0'
      }
    };
  </script>
  <script src='//cdn.kbase.us/cdn/requirejs/2.2.0/require.js'></script>
  <script>
    require([
      'jquery',
      'kb_service/client/workspace'
    ], function($, Workspace) {
      var workspace = new Workspace('https://ci.kbase.us/services/ws'),
          objectRef = '6312/14/2';
      workspace.get_object_info_new({
          objects: [{
            ref: objectRef
          }],
          includeMetadata: 1
        })
        .then(function(data) {
          $('#main').html('Hi, you asked for object with ref id <b>' + objectRef +
            '</b>, which is named <b>' + data[0][1] + '</b> and of type <i>' +
            data[0][2] + '</i>.');
        })
        .catch(function(err) {
          $('#main').html(err.error.message);
          console.error('ERROR', err);
        });
    });
  </script>
</body>
</html>
```

Notable features of this example:

- All assets in this example are derived from the CDN
- To set up module paths, the require config must be set up before require or define usage
- each module path points to a CDN host and path
- For a directly invocable module (jquery and bluebird above) the module path is mapped to the module file (sans the "js" extension). For module paths which serve as the root path component for a collection of modules, the module path maps to the top level of the CDN host + path.
- The "module loader" runtime support module may itself be loaded from the CDN, and contains a set of pre-packaged module paths. 
- the only non-amd code source is the requirejs library itself, which is also obtained from the cdn

One  benefit of using the CDN is that we have package references which are idempotent -- that is, the same url will always resolve to the same version of the same package. This property allows a browser to cache files loaded from a CDN package, no matter how the file is requested. The file may be requested by multiple module loaders or even within iframes, and will be downloaded only once per browser session.

It also of course allows a simpler deployment model (at the cost of maintining the cdn.) Ordinarily browser based javascript loads dependencies from the server based on a single well known location. Especially in projects using bower, npm or other other package managers, the dependency between the host project and the external code loaded in and accessed is expressed in the package configuration which is used to obtain the code. However, the code lives in canonical locations within the system and does not carry version information. If a host project is developed with one version of a library, but the package manager updates it to another, the host project will be running under an untested environment. If the dependency follows semver practices, updated dependencies may cause no problem. However, there may be unintended consequences, or the host module may have put in place code to work around bugs in the dependency.

Another benefit is that we can package up collections of package instances which are known to work well together (and which we test) into runtime module packages. This is implemented as a requirejs amd configuration object, which is used to create a module loader. We provide a version to each defined module loader, allowing both the host system (narrative, kbase-ui, etc.) to use a well-defined set of packages and modules, and yet for external component to be developed against the same or another module loader definition. This allows external components to be integrated into the system without worrying about whether the actual module dependency is exactly the same version. Within the runtime environment, as within most application runtimes, there is not multi-versioning -- there is a single module associated with a single identifier. By loading the host environment and any external components with specific, defined module loaders, we can ensure that the modules visible to the component are exactly the ones it was developed and tested against.

We can also, if we so choose, create runtime module loaders which provide multiple or all files into a single module file per runtime.


### Why not use an external CDN service?

There are many commercial CDN services. Why not use them?

- external services may not be reliable
- no single external services covers ALL packages we use
- we need to deploy internal code to the CDN
- we may need to deploy patched external code
- we can build in only the versions that we use and support, greatly reducing the support and maintenance footprint.

For example, in early prototyping we had to use two separate CDNs and and internal set of module mappings for both kbase code and external packages not located in any external CDN. And in addition external CDN reliability proved to be imperfect.
