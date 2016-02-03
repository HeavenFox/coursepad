CREATE TABLE users (
    id serial PRIMARY KEY,
    slug text,
    name text NOT NULL,
    email text,
    password text,
    fb_uid bigint,
    goog_uid text,
    profile_picture text,
    extra json
);

CREATE UNIQUE INDEX ON users (slug);
CREATE UNIQUE INDEX ON users (fb_uid);

CREATE TABLE shared (
    slug text PRIMARY KEY,
    author int,
    term text,
    schedule json,
    created bigint 
);

CREATE TABLE schedules (
    author int,
    school int DEFAULT 1,
    term text,
    schedule text,
    version bigint,
    last_modified int
);

CREATE UNIQUE INDEX ON schedules (
    author, school, term
);

CREATE TABLE fb_friends (
    id int,
    friend_fbid bigint
);

CREATE INDEX ON fb_friends (
    id
);
