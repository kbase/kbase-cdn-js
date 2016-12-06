# Makefile for kbase-cdn-js

TARGET ?= /kb/deployment
SERVICE_NAME = cdnjs

all: clean init build dist
	
deploy:
	@echo "> Deploying to "
	@echo ">  $(TARGET)/services/$(SERVICE_NAME)"
	mkdir -p  $(TARGET)/services/$(SERVICE_NAME)/files
	cp -pr dist/bin/*  $(TARGET)/services/$(SERVICE_NAME)/files

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

quick:
	@echo "> Doing a quick clean, build, start"
	clean
	build
	start

init:
	@echo "> Initialiing the repo for work"
	npm install
	
start:
	@echo "> Starting the example server"
	node server start $(dir) &
	
stop: 
	@echo "> Stopping the example server"
	node server stop

.PHONY: test build dist
