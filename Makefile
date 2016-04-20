# Makefile for kbase-cdn-js

clean:
	@echo "> Removing all build artifacts"
	rm -rf dev/build
	rm -rf dist

build: 
	@echo "> Building the current state of the CDN"
	node build

dist:
	@echo "> Building the distribution"
	node dist

start:
	@echo "> Starting the example server"
	node server start $(dir) &
	
quick:
	@echo "> Doing a quick clean, build, start"
	clean
	build
	start

init:
	@echo "> Initialiing the repo for work"
	npm install
	
stop: 
	@echo "> Stopping the example server"
	node server stop

.PHONY: test build dist
