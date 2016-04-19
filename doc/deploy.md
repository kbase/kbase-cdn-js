# KBase Javascript CDN

The CDN deployment consists of the set of CDN assets and an http server to make them available at a known address.

The CDN assets are prepared to a production ready mode, the meaning of which is interpreted in the context of the type of asset. For instance, a javascript file will be prepared by minificatino, as will a stylesheet. However, the processes of minification are very different. 

The http server used to make the assets available is either the testing and prototyping nodejs server provided with the package, or production-friendly nginx, which is not provided in the package but an example configuration stanza is.

Deploying the CDN employs the following steps:

- obtain the CDN source code
- configure the CDN
- perform a base CDN build
- perform a distribution CDN build
- move the files into place
- 

## Prerequisites

- clone and build the CDN as per [building.md](building.md).

## Preparing a deployable release

For a deployment, which will minify all files

```
make dist
```

Note that this will destroy the build artifacts as well.

To check it out

```
make start dir=dist/bin
```

will point the test server to the production CDN (minified, with source maps)

or 

```
make start dir=dist/source
```

will point the test server to the raw source.
