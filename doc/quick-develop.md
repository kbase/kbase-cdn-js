# Quick Develop Guide

## Prerequisites

The following steps will give you an Vagrant Ubuntu virtual machine with the necessary prerequisites for working with the CDN. Any equivalent workflow will suffice.

(1) in your trusty developer directory, create ubuntu/trusty64 image

```
vagrant init ubuntu/trusty64
```

tweak the Vagrantfile to allow outside network connections

```
vi Vagrantfile
```

ensure a line like this (ymmv, but this is easy)

```
config.vm.network "private_network", type: "dhcp"
```

Then bring it up

```
vagrant up
vagrant ssh
```

(2) Update the VM

```
sudo su
apt-get update 
apt-get upgrade -y
apt-get dist-upgrade -y
```

(3) Install node 4.4.x from ```https://github.com/nodesource/distributions#debinstall```

```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
apt-get install -y nodejs
```

Install other deps

```
apt-get install -y git nginx
```

(4) Clone the repo

```
git clone https://github.com/eapearson/kbase-cdn-js
```

> Note that this has not been promoted to the incubator yet so it is still in my account

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
make start &
```

When you are done you can stop the server 

```
make stop 
```

## map cdn.kbase.us to your vm

Although you can use the ip address and port of the development service, it is handy also to map a hostname, especially if you are testing changes for a deployment.

In the vm find out the ip address

```
ifconfig
```

Back on the host add the corresponding line to your /etc/hosts

```
your.ip.add.ress cdn.kbase.us
```

Of course you can use any host other than cdn.kbase.us, but that matches the documentation

Also, for dist builds, the memory should be at least 1024M

```
config.vm.provider "virtualbox" do |vb|
    vb.memory = "1024"
end
```

## Set up a proxy to point to the cdn

In develop mode, the cdn operates on a little nodejs server. To test inside a vm, you can simply set up nginx to reverse proxy to it. It would be perfectly find as well just to point an nginx server to the files themselves, for that is all that the nodejs server does.

```
    location / {
        proxy_pass http://127.0.0.1:10001
    }
```

## Hello jquery

Try this from your host environment, e.g. Mac, like this:

```
wget http://cdn.kbase.us/jquery/2.2.2/jquery.js
```


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

## Testing

There is currently no testing. In order to provide testing, we first need to integrate AMD dependents