# Installing CoursePad.me

Thank you for contributing to CoursePad.me! In order to start coding, you will need to set up your development environment first.

CoursePad.me is an offline-first single-page application (SPA). Therefore, the vast majority of the code (and development) is in frontend, written in TypeScript (with some legacy JavaScript which need to be converted or removed). The backend is written in Go, and supports features such as sharing and syncing. In addition, there is a roster database updater, written in python, whose job is to load the roster from university registrar and convert it into a format CoursePad.me understands.

As a rule of thumb, in the majority of the cases, you will not need to install the backend environment. CoursePad.me can function without one.

This tutorial assumes that you use a Unix-like environment. CoursePad.me is written on macOS (née OS X) and the server runs Ubuntu 12.04. Windows will probably work but YMMV.

## Front End

#### Install Node.js
Install the latest version. CoursePad.me uses some ES6 features.

#### Clone Repository
Duh.

#### Install NPM dependencies
 In frontend directory, do `npm install`
 Also you may want to install gulp globally:
(sudo) `npm install -g gulp`

#### Download Roster
You will need to download the roster. In `server/roster_updater`, copy `config.py.sample` to `config.py`

Outside of repository, create a folder with a name you like (We recommend `coursepad_data`). Create three subfolders: `data`, `rollback`, and `audit`.
 - `data` contains the roster data
 - `rollback` contains data necessary should you need to rollback an update
 - `audit` contains data for audit trail
Put the path of the folders to the respective variables in `config.py`.
You can change the `OMIT_TERM` and `FORCE_TERM` to `{}`. `OMIT_TERM` specifies which terms should be omitted. `FORCE_TERM` forces certain terms to be downloaded and updated, even if they are otherwise automatically omitted.

Run `python update.py`. It should automatically download all the semesters of roster data to your directory.

#### Edit `hosts`
Open `/etc/hosts` with your favorite editor and add a line:
`127.0.0.1 test.coursepad.me`
This way you can access your local version of CoursePad.me at `http://test.coursepad.me`
It is necessary to do this for third-party integration.

#### Install & Configure nginx
Of course you may use any server software but we recommend nginx.

Install nginx. Once again, we recommend using homebrew on macOS.

Edit nginx config file (If you installed with homebrew, it should be at `/usr/local/ect/nginx/nginx.conf`) and add a stanza in `http {}` like this (replacing paths as necessary)

```
server {
    listen       80;
    server_name  test.coursepad.me;

    location /static/data/ {
        alias [PATH TO coursepad_data]/data/data/;
    }

    location /static/data_index/ {
        alias [PATH TO coursepad_data]/data/data_index/;
    }

    location / {
        root   [PATH TO REPOSITORY]/frontend/_build/dev;
        index  index.html index.htm;
    }
}
```

#### Ready to run
In `frontend/`, run `gulp`. It will automatically compile all static resources and assemble a working application.

Now you can visit your very own CoursePad.me at `http://test.coursepad.me`. Pretty exciting huh?


## Back End

Front-end is where most interesting things happen, and the backend development is pretty much stagnated. You probably don't need to do this, until you need to work on this stuff :)

#### Install Postgres
Download and install Postgres. You need at least 9.4. On macOS, `Postgres.app` is a good choice.

Create a database `CREATE DATABASE coursepad;`

Import the schema file in `server/schema/`. Don't forget to switch to your database first! (e.g. `\c coursepad`)

#### Install Redis
CoursePad.me uses Redis to manage sessions, as well as a message queue.

You simply need to download redis and run it. It's that simple.

#### Install Go
Install Go. CoursePad.me is known to work on 1.7.

Create a symlink in your `GOROOT` named `coursepad` to `server/go/src/coursepad`.
Install [Glide](https://glide.sh/). Then you can install vendored dependencies with `glide install`

#### Configure nginx
Add a couple stanzas in your coursepad server like this to pass the corresponding endpoints to Go server
```
location /endpoints/ {
    proxy_pass http://localhost:6780;
}

location /shared/ {
    proxy_pass http://localhost:6780;
}
```

#### Configure server
In `server/configs/cpserver`, copy `sample.conf` to somewhere (preferably outside of repository so you don't accidentally commit it) and edit it. Change the path to the correct ones on your machine.

#### Run server
`go build` the server, and `./server -config=[PATH TO YOUR CONFIG FILE]`. Now you have a working backend!