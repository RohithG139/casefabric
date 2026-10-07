# Getting started with Case Managment

This repository enables you to quickly setup a Case Management demo environment with Docker.

## Prerequisites

The Case Management demo environment consists of a set of Docker images. Make sure you have a running [Docker](https://www.docker.com/) instance available on your system.

Please contact [info@casefabric.com](mailto:info@casefabric.com) for further information and assistence.

## Downloading and starting the environment

If Git is available on the environment, you can clone the repository by running the below command in a terminal.

Alternatively you can download the repository code from GitHub by pressing the green `<> Code` button in the top of the browser window.

``` bash
# this step puts the code onto your system
git clone https://github.com/casefabric/getting-started.git

```

Next, go into the directory where the code is available, and simply start the docker container

``` bash
# go into the directory that holds the code
cd ./getting-started

# tell Docker to spin up the environment - this may take a while the first time you do it
docker-compose up
```

Earlier versions of this setup used an in-memory database. We have modified this to work with a setup using [PostgreSQL](https://www.postgresql.org/).

This way, when Docker environment is stopped, and then started again, the case instances created earlier are still available.

To start with a fresh environment, you'd have to stop the containers and remove the appropriate volumes.

## Exposed URLs of the CaseFabric Demo environment

After starting up the Case Management demo environment, the following URLs allow you to access the various parts of the
environment:

- Case User Interface: [http://localhost:3317](http://localhost:3317)
- Case Management IDE environment for desiging and modifying case definitions: [http://localhost:2081](http://localhost:2081)
- Case Engine REST APIs (exposed through Swagger): [http://localhost:2027](http://localhost:2027)
- MailCatcher web UI: [http://localhost:1080](http://localhost:1080)

## Building and deploying a CMMN model

### Creating a model

The Case Designer can be accessed via http://localhost:2081.
In this environment, you can create new CMMN models and deploy them to the engine.

### Deploy existing models to the demo enviroment

When you already have existing models built by the Case Designer, you can simply deploy them to this
environment by copying the build CMMN model XML file to the `deployments/definitions` folder in this repository.
The Case Management demo environment picks up any valid model that is stored in this folder.

## Working with Docker commands and further help

The demo environment assumes you have some basic knowledge of Docker to maintain the installation.

If you need help or encounter issues, you can search the [existing repository issues](https://github.com/casefabric/getting-started/issues) or directly [create a new issue](https://github.com/casefabric/getting-started/issues/new).


