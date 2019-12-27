# marks.database
A database frontend to manage movies, books, todos, and recipes/pantry

I've had a local database I've run where I keep track of movies and books I've seen or read. 
It's fairly clunky to use however. I've thought about using php myadmin or something similar,
but that isn't much easier really. This project is fairly specific, but its a frontend to 
manage the tables that I need. It also includes a recipe manager, which is fairly complex. It
can keep track of your pantry too, allowing you to move things between owned and a shopping list.

# Installation
Download the repository, run `npm install`, set up a mysql server with a user and a database, 
fill out a `config.json` file as specified below, and then `npm run run`. 

`config.json` should be of the following form
```
{
    "database": {
        "host": "<DB_HOST>",
        "user": "<DB_USER>",
        "database": "<DB_NAME>",
        "password": "<PASSWORD>"
    },
    "port": <PORT_TO_RUN_WEBSERVER_ON>
}

```
