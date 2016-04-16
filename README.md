# KBase CDN Prototype

A prototype CDN server for Javascript clients.

- build a collection of javscript libraries published via Bower
- organize by library and version, as in library/#.#.#
- rationalize the installation, removing all unnecessary bits of the library other than assets actually being served
- provide a small nodejs based server for testing or deployment
- may also be deployed under nginx or any other file-serving web server

## Updates

For now, use this section to record progress and future work.

- there is now a build process

### TODO

- documentation, esp. 
    - how to add a new package and version
    - troubleshooting (e.g. packages with funky versions or locations)
- testing
- create requirejs paths 
- some sort of inspectable content per package ... an info file of sources to
  record the origin, license, amd path, dependencies ... these are all maybes


### NOTE

For the time being, 

## installation

### for testing ...

```
create ubuntu/trusty64 image
```

update it

install node from ```https://github.com/nodesource/distributions#debinstall```

```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
```

install git

```
sudo apt-get install -y git
```

Clone the repo

```
git clone https://github.com/epearson/kbase-cdn-js
```

Enter the repo and install node dependencies

```
cd kbase-cdn-js
make init
```

Install and build all of the libraries

```
make build
```


To start up a little nodejs server pointing to the build

```
make start
```

When you are done you can stop the server 

```
make stop 
```

### Preparing a deployable release

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
### How it works

For each library